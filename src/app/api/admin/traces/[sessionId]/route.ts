// GET /api/admin/traces/:sessionId - Get all events for a session.
// Events are ordered by timestamp (primary) and sequenceNumber (secondary).
// Protected by ADMIN_SECRET_KEY or CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/admin-guard";
import { getSessionEvents } from "@/services/trace.service";
import { handleApiError } from "@/lib/api-utils";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const denied = checkAdminAccess(request);
    if (denied) return denied;

    const { sessionId } = await params;
    const events = await getSessionEvents(sessionId);

    if (events.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ sessionId, events });
  } catch (error) {
    return handleApiError(error);
  }
}
