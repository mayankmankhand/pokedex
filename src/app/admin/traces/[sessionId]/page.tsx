// Admin page: Session detail view.
// Shows all events for a session, grouped by requestId.
// Timeline ordering: primary by timestamp, secondary by sequenceNumber.
// Depends on getSessionEvents() returning sorted data.
// Protected by ADMIN_SECRET_KEY via query parameter.

import { getSessionEvents } from "@/services/trace.service";
import { isAdminPageAccessAllowed } from "@/lib/admin-guard";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EVENT_TYPE_COLORS, EVENT_TYPE_ICONS } from "../constants";

// Force dynamic rendering
export const dynamic = "force-dynamic";

function formatTime(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

/**
 * Group events by requestId for visual clarity.
 * Each group shows events from a single API request.
 * Groups preserve insertion order from the already-sorted event list.
 */
function groupByRequest(
  events: Array<{
    id: string;
    eventType: string;
    payload: unknown;
    requestId: string | null;
    sequenceNumber: number;
    source: string | null;
    createdAt: Date;
  }>,
) {
  const groups: Map<
    string,
    typeof events
  > = new Map();

  for (const event of events) {
    const key = event.requestId ?? "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  return Array.from(groups.entries());
}

/**
 * Render a payload value as a readable string.
 * Handles the typed payload shapes from trace.service.ts.
 */
function renderPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return String(payload);

  const p = payload as Record<string, unknown>;

  switch (p.type) {
    case "USER_MESSAGE":
      return String(p.messageText ?? "");
    case "AI_RESPONSE":
      return String(p.text ?? "");
    case "TOOL_CALL":
      return `${p.toolName}(${JSON.stringify(p.input ?? {})})`;
    case "TOOL_RESULT": {
      const status = p.success ? "ok" : "FAILED";
      const duration = p.durationMs ? ` (${p.durationMs}ms)` : "";
      return `${p.toolName} [${status}]${duration}: ${typeof p.output === "string" ? p.output : JSON.stringify(p.output ?? {})}`;
    }
    case "PANEL_ACTION":
      return `${p.method} ${p.route}${p.entityType ? ` (${p.entityType}/${p.action})` : ""}`;
    case "API_CALL":
      return `${p.method} ${p.route} -> ${p.status}`;
    case "ERROR":
      return `[${p.code ?? "ERROR"}] ${p.message}${p.context ? ` @ ${p.context}` : ""}`;
    default:
      return JSON.stringify(payload);
  }
}

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { sessionId } = await params;
  const { key } = await searchParams;

  // Access control: shared policy function prevents drift with API guard
  if (!isAdminPageAccessAllowed(key)) {
    redirect("/");
  }

  const events = await getSessionEvents(sessionId);

  if (events.length === 0) {
    return (
      <div className="min-h-screen bg-[#F5F0EA] p-6">
        <div className="mx-auto max-w-4xl">
          <p className="text-gray-500">Session not found or has no events.</p>
          <Link href={`/admin/traces${key ? `?key=${key}` : ""}`} className="text-blue-600 hover:underline">
            Back to sessions
          </Link>
        </div>
      </div>
    );
  }

  const requestGroups = groupByRequest(events);

  return (
    <div className="min-h-screen bg-[#F5F0EA] p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/admin/traces${key ? `?key=${key}` : ""}`}
            className="mb-2 inline-block text-sm text-blue-600 hover:underline"
          >
            &larr; Back to sessions
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">Session Detail</h1>
          <p className="text-sm text-gray-500">
            <code className="font-mono">{sessionId}</code> - {events.length} events across {requestGroups.length} request{requestGroups.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Event timeline grouped by request */}
        <div className="space-y-4">
          {requestGroups.map(([requestId, groupEvents]) => (
            <div
              key={requestId}
              className="rounded-lg border-2 border-gray-300 bg-white"
            >
              {/* Request group header */}
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
                <code className="font-mono text-xs text-gray-500">
                  request: {requestId.slice(0, 12)}...
                </code>
                <span className="ml-2 text-xs text-gray-400">
                  ({groupEvents.length} events)
                </span>
              </div>

              {/* Events in this request */}
              <div className="divide-y divide-gray-100">
                {groupEvents.map((event) => (
                  <div key={event.id} className={`px-4 py-3${event.eventType === "ERROR" ? " border-l-4 border-l-red-400" : ""}`}>
                    <div className="flex items-start gap-3">
                      {/* Type indicator - decorative, hidden from screen readers */}
                      <code className="mt-0.5 shrink-0 text-xs text-gray-400" aria-hidden="true">
                        {EVENT_TYPE_ICONS[event.eventType] ?? "[ ]"}
                      </code>

                      {/* Badge + content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_TYPE_COLORS[event.eventType] ?? "bg-gray-100 text-gray-800"}`}
                          >
                            {event.eventType}
                          </span>
                          {event.source && (
                            <span className="text-xs text-gray-400">
                              via {event.source}
                            </span>
                          )}
                          <span className="ml-auto text-xs text-gray-400">
                            {formatTime(event.createdAt)}
                          </span>
                        </div>

                        {/* Payload content - capped height for large payloads */}
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-sm text-gray-700">
                          {renderPayload(event.payload)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
