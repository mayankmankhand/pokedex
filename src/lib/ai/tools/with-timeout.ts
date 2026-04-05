// Per-tool timeout wrapper for LLM tool executions.
// Prevents hung Prisma queries or network calls from blocking the stream indefinitely.
// Returns a timeout error string to the LLM so it can recover gracefully.
//
// Note: timed-out operations continue running in the background because Prisma
// does not support AbortController. A timed-out mutation may still complete.
// The LLM is instructed to warn users about this. Acceptable for V1.

// 30 seconds - generous enough for cold-start DB connections,
// short enough to not leave users waiting on truly hung queries.
export const TOOL_TIMEOUT_MS = 30_000;

/**
 * Wraps a tool's execute function with a timeout.
 * On timeout, returns { error: "TimeoutError: ..." } instead of throwing,
 * so the LLM sees the error and can tell the user what happened.
 *
 * The timeout timer is cleared on success or failure to avoid
 * orphaned timers accumulating in the Node.js event loop.
 */
export function withTimeout<TArgs, TResult>(
  toolName: string,
  executeFn: (args: TArgs) => Promise<TResult>,
): (args: TArgs) => Promise<TResult | { error: string }> {
  return (args: TArgs) => {
    let timer: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<{ error: string }>((resolve) => {
      timer = setTimeout(
        () =>
          resolve({
            error: `TimeoutError: ${toolName} timed out after ${TOOL_TIMEOUT_MS / 1000}s`,
          }),
        TOOL_TIMEOUT_MS,
      );
    });

    // Clear the timer once the real function settles (success or error)
    // to avoid orphaned timers in long-lived dev servers.
    const executePromise = executeFn(args).finally(() => clearTimeout(timer));

    return Promise.race([executePromise, timeoutPromise]);
  };
}
