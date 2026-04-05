// Next.js Edge Middleware - runs before every /api/* request.
// Validates the demo user and attaches identity + request-id + session-id headers.
//
// This file must live at src/middleware.ts (Next.js convention when using a src dir).
// It runs in the Edge Runtime, so no Node.js-specific APIs are used.

import { NextRequest, NextResponse } from "next/server";
import { DEMO_USERS, getUserById } from "./lib/demo-users";

// Default to Ash (first demo user) when no header is provided.
// This makes it easy to hit APIs during development without extra setup.
const DEFAULT_USER_ID = DEMO_USERS[0].id;

// Pre-compiled regex for UUID format validation (avoids re-creating on every request)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Session ID cookie for trace event correlation.
// A "session" is a browser-level concept: shared across tabs in the same
// browser profile, reset on cookie clear or 24-hour expiry.
// Not a guaranteed one-human-one-session mapping.
const SESSION_COOKIE_NAME = "demo_session_id";
const SESSION_COOKIE_MAX_AGE = 86400; // 24 hours

export function middleware(request: NextRequest) {
  const userIdHeader = request.headers.get("x-demo-user-id");
  if (userIdHeader && !UUID_RE.test(userIdHeader)) {
    return NextResponse.json(
      { error: "Unauthorized - invalid user id format" },
      { status: 401 },
    );
  }

  const userId = userIdHeader || DEFAULT_USER_ID;

  // Validate that the user exists in our demo set.
  const user = getUserById(userId);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized - invalid demo user id" },
      { status: 401 },
    );
  }

  // Generate a unique request id for tracing / audit logs.
  const requestId = crypto.randomUUID();

  // Read or create session ID for trace event correlation.
  // The session ID is a plain UUID stored in a cookie - no signing needed
  // since it has no security implications (unlike the session count cookie).
  const existingSessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isValidSessionId = existingSessionId && UUID_RE.test(existingSessionId);
  const sessionId = isValidSessionId ? existingSessionId : crypto.randomUUID();

  // Clone the request headers and attach identity info so downstream
  // route handlers can read them via getRequestContext().
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-demo-user-id", user.id);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-session-id", sessionId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Set the session cookie if it was missing or invalid
  if (!isValidSessionId) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE,
    });
  }

  return response;
}

// Only run this middleware on API routes.
export const config = {
  matcher: "/api/:path*",
};
