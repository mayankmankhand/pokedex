// Renders audit log entries as a timeline in the context panel.
// Each entry shows an action badge, entity info, actor, and
// optionally expandable field-level changes.

"use client";

import { useState } from "react";
import { Clock, ChevronRight, ChevronDown } from "lucide-react";
import type { AuditPayload, AuditEntry } from "@/types/panel";
import { humanize } from "@/lib/format-utils";

// Visual treatment for each audit action type.
// Colors are component-local hex values (same pattern as StatusBadge).
const ACTION_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  CREATE:            { label: "CREATED",            bg: "#BBF7D0", text: "#14532D" },  // Grass
  UPDATE:            { label: "UPDATED",            bg: "#FEF3C7", text: "#78350F" },  // Electric/Ground
  APPROVE:           { label: "APPROVED",           bg: "#BFDBFE", text: "#1E3A5F" },  // Water
  CANCEL:            { label: "CANCELED",           bg: "#FECACA", text: "#7F1D1D" },  // Fire
  SKIP:              { label: "SKIPPED",            bg: "#E7E5E4", text: "#44403C" },  // Rock
  ADD_ATTACHMENT:    { label: "ADDED",              bg: "#BBF7D0", text: "#14532D" },  // Grass
  REMOVE_ATTACHMENT: { label: "REMOVED",            bg: "#FECACA", text: "#7F1D1D" },  // Fire
  CREATE_VERSION:    { label: "VERSIONED",          bg: "#BFDBFE", text: "#1E3A5F" },  // Water
  RECORD_RESULT:     { label: "RECORDED",           bg: "#FEF3C7", text: "#78350F" },  // Ground
  RE_PARENT:         { label: "RE-PARENTED",        bg: "#E9D5FF", text: "#581C87" },  // Poison/Psychic
  REACTIVATE:        { label: "REACTIVATED",        bg: "#BFDBFE", text: "#1E3A5F" },  // Water
};

const DEFAULT_ACTION = { label: "Unknown", bg: "#F1F5F9", text: "#64748B" };

// Returns a human-friendly relative time string.
function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  // Guard against future dates (clock skew or test data)
  if (diffMs < 60_000) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diffMs / 86_400_000);
  if (days < 7) return `${days}d ago`;

  // Beyond 7 days - show abbreviated date (include year if different)
  const date = new Date(isoDate);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== new Date().getFullYear()) {
    options.year = "numeric";
  }
  return date.toLocaleDateString("en-US", options);
}

// Color-coded pill for the audit action.
function ActionBadge({ action }: { action: string }) {
  const config = ACTION_CONFIG[action] ?? DEFAULT_ACTION;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium uppercase tracking-wide"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}

// Formats a single field change as a readable string.
// Uses undefined checks (not truthiness) so empty strings are preserved.
function formatChange(change: { field: string; old?: string; new?: string }): string {
  if (change.old !== undefined && change.new !== undefined) return `${change.field}: ${change.old} -> ${change.new}`;
  if (change.new !== undefined) return `${change.field}: ${change.new}`;
  if (change.old !== undefined) return `${change.field}: ${change.old} -> (removed)`;
  return change.field;
}

interface AuditViewProps {
  payload: AuditPayload;
}

export function AuditView({ payload }: AuditViewProps) {
  // Tracks which entries have their changes section expanded.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleEntry(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (payload.entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock
          size={48}
          strokeWidth={1.2}
          className="text-text-muted opacity-25 mb-3"
        />
        <p className="text-sm font-medium text-text mb-0.5">No audit entries</p>
        <p className="text-xs text-text-muted">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
          Activity
        </span>
        <span className="text-[11px] font-mono text-text-subtle">
          {payload.entries.length} {payload.entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      {payload.entries.map((entry: AuditEntry) => {
        const isOpen = expanded.has(entry.id);
        const hasChanges = entry.changes.length > 0;
        const absoluteDate = new Date(entry.createdAt).toLocaleString();

        return (
          <div
            key={entry.id}
            className="bg-surface-elevated rounded-lg p-3 border border-border-subtle"
          >
            {/* ACTOR ACTION Target pattern */}
            <div className="text-sm leading-relaxed">
              <span className="font-bold uppercase tracking-wide text-text">
                {entry.actor.name}
              </span>{" "}
              <ActionBadge action={entry.action} />{" "}
              <span className="font-medium text-accent">
                {humanize(entry.entityType)}
              </span>
              {(() => {
                const source = (entry as AuditEntry & { source?: string }).source;
                return source && ["chat", "panel", "api"].includes(source) ? (
                  <span className={`audit-source-badge audit-source-${source}`}>
                    {source}
                  </span>
                ) : null;
              })()}
            </div>

            {/* Timestamp in monospace */}
            <span
              className="text-[11px] font-mono text-text-subtle mt-1 block"
              title={absoluteDate}
            >
              {formatRelativeTime(entry.createdAt)}
            </span>

            {/* Expandable changes (unchanged) */}
            {hasChanges && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => toggleEntry(entry.id)}
                  aria-expanded={isOpen}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors duration-150
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
                >
                  {isOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                  {entry.changes.length} {entry.changes.length === 1 ? "change" : "changes"}
                </button>

                {isOpen && (
                  <pre className="overflow-x-auto whitespace-pre-wrap bg-surface rounded-lg p-3 text-xs text-text mt-1">
                    {entry.changes.map(formatChange).join("\n")}
                  </pre>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
