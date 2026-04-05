// In-memory sliding window rate limiter.
// Tracks request timestamps per IP and enforces a max request count
// within a rolling time window. Designed for the chat endpoint to
// protect the Anthropic API bill from abuse.
//
// LIMITATION: On Vercel serverless, each function invocation gets its
// own memory. The in-memory Map does not persist across invocations,
// so this provides per-instance throttling only (not global). For
// stronger protection, set spending limits in the Anthropic dashboard
// and consider switching to a persistent backend (Vercel KV, Upstash
// Redis, or a database table) if abuse becomes an issue.
//
// Kill switch: Set RATE_LIMIT_DISABLED=true to bypass rate limiting
// (useful for load testing or if the limiter causes issues).

const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_WINDOW_MS = 60_000; // 60 seconds

// Map of IP -> array of request timestamps (epoch ms)
const requestLog = new Map<string, number[]>();

// Periodic cleanup interval to prevent memory leaks from stale IPs.
// Runs every 5 minutes, removes IPs with no recent requests.
const CLEANUP_INTERVAL_MS = 5 * 60_000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(windowMs: number) {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, timestamps] of requestLog) {
      const valid = timestamps.filter((t) => t > cutoff);
      if (valid.length === 0) {
        requestLog.delete(ip);
      } else {
        requestLog.set(ip, valid);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow the Node process to exit even if the timer is still running
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export function checkRateLimit(
  ip: string,
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS,
): { allowed: boolean; retryAfter?: number } {
  // Kill switch - bypass rate limiting when explicitly disabled
  if (process.env.RATE_LIMIT_DISABLED === "true") {
    return { allowed: true };
  }

  // Start cleanup on first call
  startCleanup(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;

  // Get existing timestamps and filter to current window
  const timestamps = (requestLog.get(ip) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= maxRequests) {
    // Oldest timestamp in the window determines when the next slot opens
    const oldestInWindow = timestamps[0];
    const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Record this request
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return { allowed: true };
}
