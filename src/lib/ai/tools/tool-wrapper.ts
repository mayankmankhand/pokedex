// Error handling for tool execute functions.
// Converts caught errors into a structured { error: string } object
// so the LLM sees error details instead of the stream failing.

import { LifecycleError, NotFoundError } from "@/lib/errors";
import { ZodError } from "zod";

/**
 * Converts an unknown error into a stable error string with a prefix.
 * Use inside a try/catch in each tool's execute function.
 *
 * Prefixes:
 *  - LifecycleError: action not allowed in current state
 *  - NotFoundError: entity not found
 *  - ValidationError: bad input (Zod)
 *  - Error: unexpected
 */
export function formatToolError(error: unknown): string {
  if (error instanceof LifecycleError) {
    return `LifecycleError: ${error.message}`;
  }

  if (error instanceof NotFoundError) {
    return `NotFoundError: ${error.message}`;
  }

  // Prisma's "not found" error from findUniqueOrThrow
  if (error instanceof Error && error.name === "NotFoundError") {
    return `NotFoundError: ${error.message}`;
  }

  // Zod validation errors - use instanceof for reliable detection
  if (error instanceof ZodError) {
    return `ValidationError: ${error.message}`;
  }

  // Unexpected errors - log for debugging
  const message = error instanceof Error ? error.message : "Unknown error";
  if (process.env.NODE_ENV !== "production") {
    console.error("[tool-wrapper] Unexpected error:", error);
  }
  return `Error: ${message}`;
}
