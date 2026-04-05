// Confirmation UI shown when the AI asks before a destructive action.
// Wrapped in a surface container with border. After the user clicks
// Accept/Reject, collapses to a one-liner with icon and timestamp.
// See docs/design/plm-redesign-spec-v3.md Section 6.4.

"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

interface ConfirmButtonsProps {
  onConfirm: () => void;
  onReject: () => void;
}

type Resolution = { action: "accepted" | "rejected"; time: string } | null;

export function ConfirmButtons({ onConfirm, onReject }: ConfirmButtonsProps) {
  const [resolution, setResolution] = useState<Resolution>(null);

  function handleAccept() {
    setResolution({
      action: "accepted",
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    });
    onConfirm();
  }

  function handleReject() {
    setResolution({
      action: "rejected",
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    });
    onReject();
  }

  // After resolution: collapsed one-liner
  if (resolution) {
    const isAccepted = resolution.action === "accepted";
    return (
      <div className="flex items-center gap-2 mt-3 text-sm text-text-muted">
        {isAccepted ? (
          <Check size={14} className="text-success" />
        ) : (
          <X size={14} className="text-text-muted" />
        )}
        <span>
          {isAccepted ? "Action confirmed" : "Action canceled"}
          {" "}
          <span className="text-text-subtle">{resolution.time}</span>
        </span>
      </div>
    );
  }

  // Before resolution: Gen 1 Yes/No confirmation box
  return (
    <div className="mt-3 border-2 border-border rounded-lg bg-surface-elevated overflow-hidden max-w-xs">
      <button
        onClick={handleAccept}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                   text-danger bg-surface-elevated
                   hover:bg-surface-hover focus-visible:bg-surface-hover
                   transition-colors duration-150
                   border-b border-border-subtle
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset
                   cursor-pointer group"
        aria-label="Confirm action"
      >
        <span className="font-mono text-xs text-primary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
          &gt;
        </span>
        Yes, proceed
      </button>
      <button
        onClick={handleReject}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                   text-text bg-surface-elevated
                   hover:bg-surface-hover focus-visible:bg-surface-hover
                   transition-colors duration-150
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset
                   cursor-pointer group"
        aria-label="Reject action"
      >
        <span className="font-mono text-xs text-primary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
          &gt;
        </span>
        No, cancel
      </button>
    </div>
  );
}
