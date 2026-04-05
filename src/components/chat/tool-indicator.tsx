// Shows tool execution status as vertical rows with icon, label, and elapsed time.
// Multiple tools are grouped under a collapsible "Used N tools" header.
// Completed tools are expandable to show raw JSON output.
// See docs/design/plm-redesign-spec-v3.md Section 6.2 for design rules.

"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { getToolLabel } from "./tool-labels";

interface ToolIndicatorProps {
  toolName: string;
  state: string;
  output?: unknown;
}

// Single tool row - shows icon, label, and elapsed time.
export function ToolIndicator({ toolName, state, output }: ToolIndicatorProps) {
  const label = getToolLabel(toolName);
  const [elapsed, setElapsed] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const startTime = useRef(Date.now());

  const isRunning = state === "input-streaming" || state === "input-available";
  const isError = state === "output-error";

  // Track elapsed time while running
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Format elapsed as "Xs" or "Xm Ys"
  const elapsedText = elapsed < 60
    ? `${elapsed}s`
    : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  return (
    <div>
      <button
        type="button"
        onClick={() => !isRunning && output && setShowDetail((prev) => !prev)}
        aria-expanded={!isRunning && output ? showDetail : undefined}
        className={`flex items-center gap-2 w-full text-left text-sm
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded ${
          !isRunning && output ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {/* Status icon */}
        {isRunning && (
          <span className="pokeball-spinner pokeball-spinner-sm" />
        )}
        {isError && (
          <AlertTriangle size={14} className="text-danger flex-shrink-0" />
        )}
        {!isRunning && !isError && (
          <CheckCircle2 size={14} className="text-success flex-shrink-0" />
        )}

        {/* Label */}
        <span className={isError ? "text-danger text-sm" : "text-text-muted text-sm"}>
          {isRunning ? `${label}...` : isError ? `${label} failed` : label}
        </span>

        {/* Elapsed time */}
        {(isRunning || elapsed > 0) && (
          <span className="text-text-subtle text-xs ml-auto">{elapsedText}</span>
        )}
      </button>

      {/* Expandable detail panel for completed tools */}
      {showDetail && output != null && (
        <pre className="bg-surface rounded-lg p-3 text-xs font-mono mt-1 overflow-x-auto text-text-muted">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </div>
  );
}

// Groups multiple tool indicators under a collapsible header.
interface ToolGroupProps {
  children: React.ReactNode;
  count: number;
}

export function ToolGroup({ children, count }: ToolGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Don't show group header for a single tool
  if (count <= 1) {
    return <div className="space-y-1.5">{children}</div>;
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors cursor-pointer rounded
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span>Used {count} tools</span>
      </button>
      {!collapsed && children}
    </div>
  );
}
