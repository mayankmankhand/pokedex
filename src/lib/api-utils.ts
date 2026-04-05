// Shared API route utilities.
// Centralizes error handling so route handlers stay thin.

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AuthError, LifecycleError, NotFoundError } from "./errors";
import {
  writeTraceEvent,
  errorPayload,
  apiCallPayload,
  panelActionPayload,
} from "@/services/trace.service";

// ─── Trace context for API routes ───────────────────────

/**
 * Optional trace context for API error/success logging.
 * Pass this to handleApiError() or logApiCall() to write trace events.
 * The sessionId comes from the x-session-id header set by middleware.
 */
export interface TraceContext {
  sessionId: string;
  requestId?: string;
  source?: string;
  route?: string;
  method?: string;
}

/**
 * Extract trace context from a Request for trace logging.
 * Lightweight - doesn't validate user or throw errors.
 */
export function getTraceContext(request: Request, route?: string): TraceContext {
  return {
    sessionId: request.headers.get("x-session-id") ?? "unknown",
    requestId: request.headers.get("x-request-id") ?? undefined,
    source: request.headers.get("x-audit-source") ?? "api",
    route: route ?? new URL(request.url).pathname,
    method: request.method,
  };
}

// ─── Error handling ─────────────────────────────────────

/**
 * Convert any caught error into an appropriate NextResponse.
 *
 * - ZodError          -> 400 with validation details
 * - AuthError         -> 401 Unauthorized (missing auth headers)
 * - LifecycleError    -> 409 Conflict (action not allowed in current state)
 * - NotFoundError     -> 404
 * - Prisma P2025      -> 404 (record not found)
 * - Other Error       -> 400 (generic bad request)
 * - Unknown           -> 500
 *
 * If traceCtx is provided, also writes an ERROR trace event.
 */
export function handleApiError(error: unknown, traceCtx?: TraceContext): NextResponse {
  const errMsg = error instanceof Error ? error.message : String(error);
  let status = 500;
  let code = "UNKNOWN";

  if (error instanceof ZodError) {
    status = 400;
    code = "VALIDATION";
    // Intentionally not awaited - trace writes are fire-and-forget in sync functions.
    // Using void to make the floating promise explicit.
    if (traceCtx) {
      void writeTraceEvent(
        traceCtx.sessionId, "ERROR",
        errorPayload("Validation failed", code, traceCtx.route),
        traceCtx.requestId, undefined, traceCtx.source,
      );
    }
    return NextResponse.json(
      { error: "Validation failed", details: error.errors },
      { status },
    );
  }

  if (error instanceof AuthError) {
    status = 401;
    code = "AUTH";
  } else if (error instanceof LifecycleError) {
    status = 409;
    code = "LIFECYCLE";
  } else if (error instanceof NotFoundError) {
    status = 404;
    code = "NOT_FOUND";
  } else if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    status = 404;
    code = "NOT_FOUND";
  } else if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("not found")) {
      status = 404;
      code = "NOT_FOUND";
    } else {
      status = 400;
      code = "BAD_REQUEST";
    }
  }

  // Intentionally not awaited - trace writes are fire-and-forget in sync functions
  if (traceCtx) {
    void writeTraceEvent(
      traceCtx.sessionId, "ERROR",
      errorPayload(errMsg, code, traceCtx.route),
      traceCtx.requestId, undefined, traceCtx.source,
    );
  }

  // Return generic messages to avoid leaking internals
  if (status === 401) return NextResponse.json({ error: errMsg }, { status });
  if (status === 404) return NextResponse.json({ error: "Record not found" }, { status });
  if (status === 409) return NextResponse.json({ error: errMsg }, { status });
  if (status === 500) return NextResponse.json({ error: "Internal server error" }, { status });
  return NextResponse.json({ error: "Bad request" }, { status });
}

// ─── API call trace logging ─────────────────────────────

/**
 * Log a successful API call as a trace event (fire-and-forget).
 * Call this in route handlers after a successful mutation.
 */
export function logApiTrace(
  traceCtx: TraceContext,
  status: number,
  entityType?: string,
  action?: string,
): void {
  const eventType = traceCtx.source === "panel" ? "PANEL_ACTION" : "API_CALL";

  if (eventType === "PANEL_ACTION") {
    void writeTraceEvent(
      traceCtx.sessionId, "PANEL_ACTION",
      panelActionPayload(traceCtx.route ?? "", traceCtx.method ?? "", entityType, action),
      traceCtx.requestId, undefined, traceCtx.source,
    );
  } else {
    void writeTraceEvent(
      traceCtx.sessionId, "API_CALL",
      apiCallPayload(traceCtx.route ?? "", traceCtx.method ?? "", status, traceCtx.source),
      traceCtx.requestId, undefined, traceCtx.source,
    );
  }
}
