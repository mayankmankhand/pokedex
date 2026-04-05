// Session-based demo usage limiter.
// Uses a signed httpOnly cookie to track message count per visitor.
// The server increments and validates the count - clients can't tamper.
//
// Config via env vars:
//   DEMO_SESSION_LIMIT (default 25) - max messages per session
//   DEMO_WARNING_THRESHOLD (default 20) - when to start warning
//   SESSION_LIMIT_DISABLED=true - bypass session limiting
//
// Cookie: demo_session_count, httpOnly, signed with HMAC-SHA256,
// 24h max-age. Invalid/tampered cookies reset to fresh session.
//
// Kill switch: Set SESSION_LIMIT_DISABLED=true to bypass session limiting
// (useful for development or if the limiter causes issues).

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

const COOKIE_NAME = "demo_session_count";
const COOKIE_MAX_AGE = 86400; // 24 hours

// Use a server-side secret for signing. Falls back to a default for dev.
const SIGNING_SECRET =
  process.env.SESSION_COOKIE_SECRET || "pokedex-plm-demo-secret-change-in-prod";

const DEFAULT_SESSION_LIMIT = 25;
const DEFAULT_WARNING_THRESHOLD = 20;

export function getLimit(): number {
  const env = process.env.DEMO_SESSION_LIMIT;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_SESSION_LIMIT;
}

export function getWarningThreshold(): number {
  const env = process.env.DEMO_WARNING_THRESHOLD;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_WARNING_THRESHOLD;
}

/** Sign a value with HMAC-SHA256. */
function sign(value: string): string {
  return createHmac("sha256", SIGNING_SECRET).update(value).digest("hex");
}

/**
 * Read and validate the signed session cookie.
 * Returns the current message count, or 0 if cookie is missing/tampered.
 */
export function getSessionCount(request: NextRequest): number {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return 0;

  // Cookie format: "count.signature"
  const dotIndex = cookie.value.lastIndexOf(".");
  if (dotIndex === -1) return 0;

  const countStr = cookie.value.slice(0, dotIndex);
  const signature = cookie.value.slice(dotIndex + 1);

  // Verify HMAC signature using constant-time comparison
  // to prevent timing side-channel attacks.
  const expected = sign(countStr);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf))
    return 0;

  // Parse and validate count
  const count = parseInt(countStr, 10);
  if (isNaN(count) || count < 0) return 0;

  return count;
}

/**
 * Check if the session is under the demo limit.
 * Returns whether the request is allowed and how many messages remain.
 */
export function checkSessionLimit(request: NextRequest): {
  allowed: boolean;
  remaining: number;
  count: number;
} {
  // Kill switch - bypass session limiting when explicitly disabled
  if (process.env.SESSION_LIMIT_DISABLED === "true") {
    return { allowed: true, remaining: Infinity, count: 0 };
  }

  const limit = getLimit();
  const count = getSessionCount(request);
  const allowed = count < limit;
  const remaining = Math.max(0, limit - count);

  return { allowed, remaining, count };
}

/**
 * Create a signed Set-Cookie header value for the session count.
 * The cookie is httpOnly, SameSite=Lax, and expires after 24 hours.
 */
export function createSessionCookie(count: number): string {
  const value = `${count}.${sign(String(count))}`;
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
}

/**
 * Build the x-remaining-messages response header.
 * Useful for debugging and future frontend improvements.
 */
export function getSessionLimitHeaders(
  remaining: number,
): Record<string, string> {
  return { "x-remaining-messages": String(remaining) };
}
