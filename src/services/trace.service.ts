// Trace event writer for request/session observability.
//
// This is observability data, NOT audit-grade. Some intermediate events
// (TOOL_CALL, TOOL_RESULT, PANEL_ACTION, API_CALL) are written via after()
// and may be lost if the runtime terminates early. Critical events
// (USER_MESSAGE, AI_RESPONSE, ERROR) are awaited.
//
// Each event type has a typed payload builder. Payloads are truncated
// before serialization to avoid memory spikes and DB bloat.
// Events older than 7 days are cleaned up by a daily cron job.

import { prisma } from "../lib/prisma";
import { TraceEventType, Prisma } from "@prisma/client";

// ─── Payload truncation ─────────────────────────────────

const MAX_STRING_LENGTH = 2000;

/**
 * Truncate a string to MAX_STRING_LENGTH, appending a marker if cut.
 * Truncation happens before serialization to avoid memory spikes.
 */
function truncateString(value: string, maxLen = MAX_STRING_LENGTH): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen) + "...[truncated]";
}

/**
 * Deep-truncate all string values in an object.
 * Handles nested objects and arrays.
 */
function truncatePayload(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = truncateString(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string"
          ? truncateString(item)
          : typeof item === "object" && item !== null
            ? truncatePayload(item as Record<string, unknown>)
            : item
      );
    } else if (typeof value === "object" && value !== null) {
      result[key] = truncatePayload(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Typed payload builders ─────────────────────────────

export interface UserMessagePayload {
  type: "USER_MESSAGE";
  messageText: string;
}

export interface AiResponsePayload {
  type: "AI_RESPONSE";
  text: string;
  finishReason?: string;
}

export interface ToolCallPayload {
  type: "TOOL_CALL";
  toolName: string;
  input: Record<string, unknown>;
  stepIndex: number;
}

export interface ToolResultPayload {
  type: "TOOL_RESULT";
  toolName: string;
  output: Record<string, unknown> | string;
  durationMs?: number;
  success: boolean;
}

export interface PanelActionPayload {
  type: "PANEL_ACTION";
  route: string;
  method: string;
  entityType?: string;
  action?: string;
}

export interface ApiCallPayload {
  type: "API_CALL";
  route: string;
  method: string;
  status: number;
  source?: string;
}

export interface ErrorPayload {
  type: "ERROR";
  code?: string;
  message: string;
  context?: string; // route or tool name where error occurred
}

export type TracePayload =
  | UserMessagePayload
  | AiResponsePayload
  | ToolCallPayload
  | ToolResultPayload
  | PanelActionPayload
  | ApiCallPayload
  | ErrorPayload;

// ─── Write functions ────────────────────────────────────

/**
 * Write a trace event to the database.
 * This is the core write function - callers choose whether to await it
 * (critical events) or fire it inside after() (deferred events).
 *
 * Errors are caught and logged to console. Trace writes never throw -
 * a failed trace should never break a user's request.
 */
export async function writeTraceEvent(
  sessionId: string,
  eventType: TraceEventType,
  payload: TracePayload,
  requestId?: string,
  sequenceNumber?: number,
  source?: string,
): Promise<void> {
  try {
    // Truncate before serialization to avoid memory spikes
    const truncated = truncatePayload(payload as unknown as Record<string, unknown>);

    await prisma.traceEvent.create({
      data: {
        sessionId,
        eventType,
        payload: truncated as unknown as Prisma.InputJsonValue,
        requestId: requestId ?? null,
        sequenceNumber: sequenceNumber ?? 0,
        source: source ?? null,
      },
    });
  } catch (error) {
    // Trace writes never throw. Log structured failure info for debugging.
    console.error("[trace-write-error]", {
      sessionId,
      requestId,
      eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─── Convenience builders ───────────────────────────────

export function userMessagePayload(messageText: string): UserMessagePayload {
  return { type: "USER_MESSAGE", messageText };
}

export function aiResponsePayload(text: string, finishReason?: string): AiResponsePayload {
  return { type: "AI_RESPONSE", text, finishReason };
}

export function toolCallPayload(
  toolName: string,
  input: Record<string, unknown>,
  stepIndex: number,
): ToolCallPayload {
  return { type: "TOOL_CALL", toolName, input, stepIndex };
}

export function toolResultPayload(
  toolName: string,
  output: Record<string, unknown> | string,
  success: boolean,
  durationMs?: number,
): ToolResultPayload {
  return { type: "TOOL_RESULT", toolName, output, success, durationMs };
}

export function panelActionPayload(
  route: string,
  method: string,
  entityType?: string,
  action?: string,
): PanelActionPayload {
  return { type: "PANEL_ACTION", route, method, entityType, action };
}

export function apiCallPayload(
  route: string,
  method: string,
  status: number,
  source?: string,
): ApiCallPayload {
  return { type: "API_CALL", route, method, status, source };
}

export function errorPayload(
  message: string,
  code?: string,
  context?: string,
): ErrorPayload {
  return { type: "ERROR", message, code, context };
}

// ─── Session queries (centralized for future trace_sessions table) ──

export interface SessionSummary {
  sessionId: string;
  startedAt: Date;
  lastEventAt: Date;
  eventCount: number;
}

/**
 * List recent sessions with summary info.
 * Aggregates from trace_events - centralized here so a future
 * trace_sessions table can be swapped in without changing callers.
 */
export async function listSessions(
  limit = 20,
  offset = 0,
): Promise<SessionSummary[]> {
  // Use raw query for efficient aggregation without loading full payloads
  const sessions = await prisma.$queryRaw<SessionSummary[]>`
    SELECT
      session_id AS "sessionId",
      MIN(created_at) AS "startedAt",
      MAX(created_at) AS "lastEventAt",
      COUNT(*)::int AS "eventCount"
    FROM trace_events
    GROUP BY session_id
    ORDER BY MAX(created_at) DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return sessions;
}

/**
 * Get all events for a session, ordered by timestamp and sequence number.
 * Groups by requestId for display (primary: timestamp, secondary: sequenceNumber).
 */
export async function getSessionEvents(sessionId: string) {
  return prisma.traceEvent.findMany({
    where: { sessionId },
    orderBy: [{ createdAt: "asc" }, { sequenceNumber: "asc" }],
    select: {
      id: true,
      eventType: true,
      payload: true,
      requestId: true,
      sequenceNumber: true,
      source: true,
      createdAt: true,
    },
  });
}

/**
 * Delete trace events older than the given number of days.
 * Called by the cleanup cron job and the manual "Run Cleanup Now" button.
 * Returns the count of deleted events.
 */
export async function cleanupOldTraces(retentionDays = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await prisma.traceEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return result.count;
}
