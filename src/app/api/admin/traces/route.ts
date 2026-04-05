// GET /api/admin/traces - List recent sessions with summary info.
// Protected by ADMIN_SECRET_KEY or CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/admin-guard";
import { listSessions } from "@/services/trace.service";
import { handleApiError } from "@/lib/api-utils";

// Force dynamic rendering - trace data changes on every request
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const denied = checkAdminAccess(request);
    if (denied) return denied;

    const url = new URL(request.url);

    // Parse and clamp limit/offset to prevent NaN, negative, or absurd values
    const rawLimit = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;

    const rawOffset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

    const sessions = await listSessions(limit, offset);
    return NextResponse.json({ sessions });
  } catch (error) {
    return handleApiError(error);
  }
}
