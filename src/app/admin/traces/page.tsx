// Admin page: Session list view.
// Shows all trace sessions sorted by most recent, with event count.
// Protected by ADMIN_SECRET_KEY via query parameter.
//
// Access: /admin/traces?key=YOUR_ADMIN_SECRET_KEY

import { listSessions } from "@/services/trace.service";
import { isAdminPageAccessAllowed } from "@/lib/admin-guard";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CleanupButton } from "./cleanup-button";

// Force dynamic rendering - trace data changes on every request
export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default async function TracesPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; offset?: string }>;
}) {
  const { key, offset: offsetParam } = await searchParams;

  // Access control: shared policy function prevents drift with API guard
  if (!isAdminPageAccessAllowed(key)) {
    redirect("/");
  }

  const pageSize = 20;
  const offset = Math.max(parseInt(offsetParam ?? "0", 10) || 0, 0);
  const sessions = await listSessions(pageSize + 1, offset);

  // Fetch one extra to detect if there are more pages
  const hasMore = sessions.length > pageSize;
  const displaySessions = hasMore ? sessions.slice(0, pageSize) : sessions;

  return (
    <div className="min-h-screen bg-[#F5F0EA] p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Trace Sessions</h1>
            <p className="text-sm text-gray-500">
              {displaySessions.length} recent session{displaySessions.length !== 1 ? "s" : ""}
              {offset > 0 ? ` (offset ${offset})` : ""}
            </p>
          </div>
          <CleanupButton adminKey={key} />
        </div>

        {/* Session list */}
        {displaySessions.length === 0 ? (
          <div className="rounded-lg border-2 border-gray-300 bg-white p-8 text-center">
            <p className="text-gray-500">No trace sessions yet. Start chatting to generate traces.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displaySessions.map((session) => (
              <Link
                key={session.sessionId}
                href={`/admin/traces/${session.sessionId}${key ? `?key=${key}` : ""}`}
                className="block rounded-lg border-2 border-gray-300 bg-white p-4 transition-colors hover:border-gray-400 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <code className="font-mono text-sm font-medium text-gray-700">
                      {session.sessionId.slice(0, 8)}...
                    </code>
                    <p className="mt-1 text-xs text-gray-500">
                      Started {formatDate(session.startedAt)} ({formatTimeAgo(session.startedAt)})
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-800">
                      {session.eventCount} event{session.eventCount !== 1 ? "s" : ""}
                    </span>
                    <p className="mt-1 text-xs text-gray-500">
                      Last activity {formatTimeAgo(session.lastEventAt)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-4 flex justify-between">
          {offset > 0 ? (
            <Link
              href={`/admin/traces?${key ? `key=${key}&` : ""}offset=${Math.max(0, offset - pageSize)}`}
              className="text-sm text-blue-600 hover:underline"
            >
              Previous
            </Link>
          ) : <span />}
          {hasMore && (
            <Link
              href={`/admin/traces?${key ? `key=${key}&` : ""}offset=${offset + pageSize}`}
              className="text-sm text-blue-600 hover:underline"
            >
              Show more
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
