// Lightweight LLM trace logging for debugging.
// Logs tool call sequences as structured JSON to console AND writes
// TOOL_CALL/TOOL_RESULT events to the trace DB (deferred via after()).
// Designed to hook into Vercel AI SDK's onStepFinish callback.

import { after } from "next/server";
import {
  writeTraceEvent,
  toolCallPayload,
  toolResultPayload,
} from "@/services/trace.service";

/**
 * Truncates a string to maxLen characters, appending "..." if truncated.
 */
function truncate(value: unknown, maxLen = 100): string {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}

/**
 * Extracts loggable fields from tool call args.
 * Keeps IDs and short fields, truncates long text content.
 */
function summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string" && value.length > 100) {
      summary[key] = truncate(value);
    } else {
      summary[key] = value;
    }
  }
  return summary;
}

/**
 * Extracts entity IDs and error info from a tool result.
 */
function summarizeResult(result: unknown): { entityId?: string; error?: string } {
  if (!result || typeof result !== "object") return {};

  const obj = result as Record<string, unknown>;

  // Check for error response from our tool wrapper
  if (typeof obj.error === "string") {
    return { error: truncate(obj.error, 200) };
  }

  // Extract entity ID if present
  if (typeof obj.id === "string") {
    return { entityId: obj.id };
  }

  return {};
}

interface TraceLogEntry {
  timestamp: string;
  requestId: string;
  userId: string;
  stepNumber: number;
  toolCalls: Array<{
    toolName: string;
    args: Record<string, unknown>;
    entityId?: string;
    error?: string;
  }>;
  finishReason: string;
  elapsedMs?: number;
}

/**
 * Creates a trace logger bound to a specific request.
 * Returns an onStepFinish callback for streamText.
 *
 * Logs to console (dev only) AND writes TOOL_CALL/TOOL_RESULT events
 * to the trace DB via after() (deferred - best effort).
 *
 * Usage:
 *   const tracer = createTraceLogger(ctx.requestId, ctx.userId, ctx.sessionId);
 *   streamText({ ..., onStepFinish: tracer.onStepFinish });
 */
export function createTraceLogger(requestId: string, userId: string, sessionId?: string) {
  const startTime = Date.now();

  return {
    // Hook into streamText's onStepFinish callback.
    // Called after each LLM call + tool execution round.
    // Uses the StepResult type from Vercel AI SDK - we access fields
    // that exist on all StepResult variants.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onStepFinish(event: any) {
      const stepNumber: number = event.stepNumber ?? 0;
      const finishReason: string = event.finishReason ?? "unknown";

      // toolCalls is an array of { toolName, args, toolCallId } objects
      const toolCalls: Array<{
        toolName: string;
        args: Record<string, unknown>;
        toolCallId?: string;
      }> = event.toolCalls ?? [];

      // Only log steps that include tool calls (skip pure text responses)
      if (toolCalls.length === 0) return;

      // toolResults is an array of { toolName, result, toolCallId } objects
      const toolResults: Array<{
        toolName: string;
        result: unknown;
        toolCallId?: string;
      }> = event.toolResults ?? [];

      // Build a results map keyed by toolCallId for correct correlation
      // of parallel tool calls (same tool called twice in one step).
      // Falls back to toolName if toolCallId is not available.
      const resultsMap = new Map<string, unknown>();
      for (const tr of toolResults) {
        const key = tr.toolCallId ?? tr.toolName;
        resultsMap.set(key, tr.result);
      }

      const entry: TraceLogEntry = {
        timestamp: new Date().toISOString(),
        requestId,
        userId,
        stepNumber,
        toolCalls: toolCalls.map((tc) => {
          const lookupKey = tc.toolCallId ?? tc.toolName;
          const resultSummary = summarizeResult(resultsMap.get(lookupKey));
          return {
            toolName: tc.toolName,
            args: summarizeArgs(tc.args),
            ...resultSummary,
          };
        }),
        finishReason,
        elapsedMs: Date.now() - startTime,
      };

      // Console trace logs (dev only)
      if (process.env.NODE_ENV !== "production") {
        console.log("[llm-trace]", JSON.stringify(entry));
      }

      // Write tool events to the trace DB (deferred via after()).
      // These are best-effort - occasional drops are acceptable.
      // Each writeTraceEvent call is wrapped in an arrow function so the
      // DB write starts AFTER the response is sent, not during streaming.
      // Sequence numbers are pre-captured into block-scoped constants to
      // avoid non-deterministic values from closure variable mutation.
      if (sessionId) {
        let seq = 0;
        for (const tc of toolCalls) {
          const lookupKey = tc.toolCallId ?? tc.toolName;
          const result = resultsMap.get(lookupKey);
          const resultSummary = summarizeResult(result);
          const isSuccess = !resultSummary.error;

          // Pre-capture sequence numbers before the after() closure
          const callSeq = seq++;
          const resultSeq = seq++;

          // Pre-capture tool data for stable closure references
          const callPayload = toolCallPayload(tc.toolName, summarizeArgs(tc.args), stepNumber);
          const resultPayloadData = toolResultPayload(
            tc.toolName,
            typeof result === "object" && result !== null
              ? summarizeArgs(result as Record<string, unknown>)
              : String(result ?? ""),
            isSuccess,
            Date.now() - startTime,
          );

          after(() => writeTraceEvent(
            sessionId, "TOOL_CALL", callPayload,
            requestId, callSeq, "chat",
          ));

          after(() => writeTraceEvent(
            sessionId, "TOOL_RESULT", resultPayloadData,
            requestId, resultSeq, "chat",
          ));
        }
      }
    },
  };
}
