// Cleanup endpoint for trace events older than 7 days.
// Two access paths:
//   GET  - Vercel cron (authenticated via CRON_SECRET Bearer token)
//   POST - Manual "Run Cleanup Now" button (authenticated via ADMIN_SECRET_KEY)

import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/admin-guard";
import { cleanupOldTraces } from "@/services/trace.service";
import { handleApiError } from "@/lib/api-utils";

// Force dynamic rendering - cleanup should never be cached
export const dynamic = "force-dynamic";

/** GET handler for Vercel cron jobs. */
export async function GET(request: NextRequest) {
  try {
    const denied = checkAdminAccess(request);
    if (denied) return denied;

    const deleted = await cleanupOldTraces(7);
    return NextResponse.json({
      deleted,
      message: `Cleaned up ${deleted} trace events older than 7 days`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST handler for manual cleanup button. */
export async function POST(request: NextRequest) {
  try {
    const denied = checkAdminAccess(request);
    if (denied) return denied;

    const deleted = await cleanupOldTraces(7);
    return NextResponse.json({
      deleted,
      message: `Cleaned up ${deleted} trace events older than 7 days`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
