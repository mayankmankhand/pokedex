// Unit tests for session-based demo usage limiter.
// Tests the core logic: signed cookie validation and limit enforcement.
// These are pure in-memory tests - no database needed.

import { describe, it, expect, vi } from "vitest";
import { createHmac } from "crypto";

// The signing secret used in dev (matches the fallback in session-limit.ts)
const SIGNING_SECRET = "pokedex-plm-demo-secret-change-in-prod";

function sign(value: string): string {
  return createHmac("sha256", SIGNING_SECRET).update(value).digest("hex");
}

/** Build a minimal NextRequest-like object with an optional cookie. */
function mockRequest(cookieValue?: string) {
  return {
    cookies: {
      get(name: string) {
        if (name === "demo_session_count" && cookieValue !== undefined) {
          return { value: cookieValue };
        }
        return undefined;
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ─── Limit Enforcement ─────────────────────────────────

describe("checkSessionLimit", () => {
  it("allows messages under limit and blocks at limit", async () => {
    const { checkSessionLimit } = await import("@/lib/session-limit");

    // Count 24 (one under default limit of 25) - should be allowed
    const validCookie = `24.${sign("24")}`;
    const underLimit = checkSessionLimit(mockRequest(validCookie));
    expect(underLimit.allowed).toBe(true);
    expect(underLimit.remaining).toBe(1);
    expect(underLimit.count).toBe(24);

    // Count 25 (at limit) - should be blocked
    const atLimitCookie = `25.${sign("25")}`;
    const atLimit = checkSessionLimit(mockRequest(atLimitCookie));
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.remaining).toBe(0);
    expect(atLimit.count).toBe(25);
  });

  it("allows requests with no cookie (fresh session)", async () => {
    const { checkSessionLimit } = await import("@/lib/session-limit");

    const result = checkSessionLimit(mockRequest());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(25);
    expect(result.count).toBe(0);
  });
});

// ─── Cookie Tampering ──────────────────────────────────

describe("getSessionCount rejects tampered cookies", () => {
  it("resets to 0 when signature is wrong", async () => {
    const { getSessionCount } = await import("@/lib/session-limit");

    // Valid count but forged signature
    const tampered = "5.definitely-not-a-valid-signature";
    expect(getSessionCount(mockRequest(tampered))).toBe(0);
  });

  it("resets to 0 when count is non-numeric", async () => {
    const { getSessionCount } = await import("@/lib/session-limit");

    // Non-numeric count with a "valid" signature for that string
    const badCount = `abc.${sign("abc")}`;
    expect(getSessionCount(mockRequest(badCount))).toBe(0);
  });

  it("resets to 0 when cookie has no dot separator", async () => {
    const { getSessionCount } = await import("@/lib/session-limit");

    expect(getSessionCount(mockRequest("nodothere"))).toBe(0);
  });
});

// ─── Cookie Creation ───────────────────────────────────

describe("createSessionCookie", () => {
  it("produces a signed httpOnly cookie", async () => {
    const { createSessionCookie } = await import("@/lib/session-limit");

    const cookie = createSessionCookie(10);
    expect(cookie).toContain("demo_session_count=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=86400");
    // Value should be "10.<hex-signature>"
    expect(cookie).toMatch(/demo_session_count=10\.[a-f0-9]{64}/);
  });
});
