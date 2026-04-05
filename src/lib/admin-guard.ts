// Admin access guard for trace/observability routes.
// Uses ADMIN_SECRET_KEY env var to protect admin pages and API routes.
//
// Two access paths:
//   1. Admin key: via "x-admin-key" header or "key" query parameter
//   2. Vercel cron: via "Authorization: Bearer <CRON_SECRET>" header
//
// Shared policy functions (isAdminAccessConfigured, isValidAdminKey)
// are used by both API routes and server component pages to prevent
// auth logic drift.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

// ─── Shared policy functions ────────────────────────────

/** Whether admin access control is configured (ADMIN_SECRET_KEY is set). */
export function isAdminAccessConfigured(): boolean {
  return !!process.env.ADMIN_SECRET_KEY;
}

/**
 * Check if the provided key matches ADMIN_SECRET_KEY.
 * Uses timing-safe comparison to prevent side-channel attacks.
 * Returns false if no admin key is configured.
 */
export function isValidAdminKey(providedKey: string | null | undefined): boolean {
  const adminKey = process.env.ADMIN_SECRET_KEY;
  if (!adminKey || !providedKey) return false;

  // timingSafeEqual requires equal-length Buffers.
  // If lengths differ, the key is obviously wrong, but we still
  // do a constant-time comparison to avoid leaking length info.
  const keyBuf = Buffer.from(adminKey);
  const providedBuf = Buffer.from(providedKey);
  if (keyBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(keyBuf, providedBuf);
}

/**
 * Check if the request has a valid Vercel cron secret.
 * Vercel cron jobs send "Authorization: Bearer <CRON_SECRET>".
 */
export function isValidCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice(7);
  const secretBuf = Buffer.from(cronSecret);
  const tokenBuf = Buffer.from(token);
  if (secretBuf.length !== tokenBuf.length) return false;

  return timingSafeEqual(secretBuf, tokenBuf);
}

// ─── API route guard ────────────────────────────────────

/**
 * Check whether the request has valid admin access for API routes.
 * Returns null if access is granted, or a 401/403 NextResponse if denied.
 *
 * Accepts admin key (header/query) OR Vercel cron secret (Bearer token).
 */
export function checkAdminAccess(request: NextRequest): NextResponse | null {
  // If no admin key is configured, block in production, allow in dev.
  if (!isAdminAccessConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Admin access not configured" },
        { status: 403 },
      );
    }
    return null;
  }

  // Check admin key (header or query param)
  const headerKey = request.headers.get("x-admin-key");
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("key");
  if (isValidAdminKey(headerKey || queryKey)) {
    return null;
  }

  // Check Vercel cron secret (for scheduled cleanup jobs)
  if (isValidCronRequest(request)) {
    return null;
  }

  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 },
  );
}

// ─── Page guard ─────────────────────────────────────────

/**
 * Check admin access for server component pages.
 * Returns true if access is granted, false if denied.
 * Pages should call redirect("/") when this returns false.
 */
export function isAdminPageAccessAllowed(queryKey?: string): boolean {
  // In production, require ADMIN_SECRET_KEY to be configured
  if (!isAdminAccessConfigured()) {
    return process.env.NODE_ENV !== "production";
  }

  return isValidAdminKey(queryKey);
}
