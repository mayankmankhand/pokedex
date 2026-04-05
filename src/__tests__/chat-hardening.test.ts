// Unit tests for Issue #30 chat API hardening:
// AuthError mapping, request-context auth checks, and tool timeout wrapper.
// These are pure in-memory tests - no database needed.

import { describe, it, expect, vi } from "vitest";
import { AuthError } from "@/lib/errors";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { withTimeout, TOOL_TIMEOUT_MS } from "@/lib/ai/tools/with-timeout";

// ─── AuthError Class ────────────────────────────────────

describe("AuthError", () => {
  it("is an instance of Error", () => {
    const err = new AuthError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AuthError");
    expect(err.message).toBe("test");
  });
});

// ─── handleApiError -> 401 ──────────────────────────────

describe("handleApiError maps AuthError to 401", () => {
  it("returns 401 for AuthError", () => {
    const response = handleApiError(new AuthError("Missing header"));
    expect(response.status).toBe(401);
  });

  it("includes the error message in the body", async () => {
    const response = handleApiError(new AuthError("Missing x-demo-user-id"));
    const body = await response.json();
    expect(body.error).toBe("Missing x-demo-user-id");
  });
});

// ─── getRequestContext Auth Checks ──────────────────────

describe("getRequestContext", () => {
  // Helper to build a minimal Request with headers
  function makeRequest(headers: Record<string, string>): Request {
    return new Request("http://localhost/api/test", {
      headers,
    });
  }

  it("throws AuthError when x-demo-user-id is missing", () => {
    const req = makeRequest({ "x-request-id": "req-123" });
    expect(() => getRequestContext(req)).toThrow(AuthError);
  });

  it("throws AuthError when x-request-id is missing", () => {
    const req = makeRequest({ "x-demo-user-id": "some-id" });
    expect(() => getRequestContext(req)).toThrow(AuthError);
  });

  it("throws AuthError for unknown user id", () => {
    const req = makeRequest({
      "x-demo-user-id": "nonexistent-user-id",
      "x-request-id": "req-123",
    });
    expect(() => getRequestContext(req)).toThrow(AuthError);
  });

  it("does not leak user ID in error message for unknown user", () => {
    const req = makeRequest({
      "x-demo-user-id": "nonexistent-user-id",
      "x-request-id": "req-123",
      "x-session-id": "test-session",
    });
    expect(() => getRequestContext(req)).toThrow("Invalid user credentials");
  });
});

// ─── withTimeout ────────────────────────────────────────

describe("withTimeout", () => {
  it("returns the result when execute resolves before timeout", async () => {
    const fastFn = async (args: { id: string }) => ({ name: args.id });
    const wrapped = withTimeout("testTool", fastFn);

    const result = await wrapped({ id: "abc" });
    expect(result).toEqual({ name: "abc" });
  });

  it("returns a timeout error when execute exceeds the timeout", async () => {
    vi.useFakeTimers();

    // A function that never resolves
    const hungFn = async () => new Promise<string>(() => {});
    const wrapped = withTimeout("slowTool", hungFn);

    const resultPromise = wrapped({});

    // Fast-forward past the timeout
    vi.advanceTimersByTime(TOOL_TIMEOUT_MS + 100);

    const result = await resultPromise;
    expect(result).toEqual({
      error: `TimeoutError: slowTool timed out after ${TOOL_TIMEOUT_MS / 1000}s`,
    });

    vi.useRealTimers();
  });

  it("clears the timeout timer when execute resolves quickly", async () => {
    vi.useFakeTimers();

    const fastFn = async () => "done";
    const wrapped = withTimeout("fastTool", fastFn);

    await wrapped({});

    // No orphaned timers should remain after the function resolved
    expect(vi.getTimerCount()).toBe(0);

    vi.useRealTimers();
  });

  it("propagates rejections from the execute function", async () => {
    const failingFn = async () => {
      throw new Error("DB connection lost");
    };
    const wrapped = withTimeout("failTool", failingFn);

    await expect(wrapped({})).rejects.toThrow("DB connection lost");
  });

  it("exports the timeout constant as 30 seconds", () => {
    expect(TOOL_TIMEOUT_MS).toBe(30_000);
  });
});
