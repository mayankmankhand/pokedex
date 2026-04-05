// Multi-choice buttons shown when the AI presents options via presentChoices tool.
// Renders inline in chat (not in the panel). After resolution, collapses to a
// one-liner showing the selected choice or "Responded" if the user typed instead.
// See PLAN-issue-14.md for design decisions.

"use client";

import { useState, useCallback, useRef } from "react";
import { Check, MessageSquare, MinusCircle } from "lucide-react";

type ChoiceState =
  | { kind: "active" }
  | { kind: "selected"; label: string; time: string }
  | { kind: "answered"; time: string }
  | { kind: "superseded" };

interface ChoiceButtonsProps {
  choices: string[];
  onSelect: (choiceText: string) => void;
  /** Externally driven state override (e.g. superseded by newer choices). */
  forceState?: "superseded" | "answered";
}

export function ChoiceButtons({ choices, onSelect, forceState }: ChoiceButtonsProps) {
  const [internal, setInternal] = useState<ChoiceState>({ kind: "active" });

  // Capture the "answered" timestamp once on first transition (not on every render).
  // Without this, the displayed time would drift forward on each re-render.
  const answeredTimeRef = useRef<string | null>(null);
  if (forceState === "answered" && !answeredTimeRef.current) {
    answeredTimeRef.current = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // External state overrides internal (superseded, answered via typing)
  const state: ChoiceState =
    forceState === "superseded"
      ? { kind: "superseded" }
      : forceState === "answered"
        ? { kind: "answered", time: answeredTimeRef.current ?? "" }
        : internal;

  const handleClick = useCallback(
    (label: string) => {
      if (state.kind !== "active") return;
      setInternal({
        kind: "selected",
        label,
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      });
      onSelect(label);
    },
    [state.kind, onSelect],
  );

  // Collapsed states - single line with icon + text + timestamp
  if (state.kind === "selected") {
    return (
      <div className="flex items-center gap-2 mt-3 text-sm text-text-muted">
        <Check size={14} className="text-success" />
        <span>
          Selected: {state.label}
          {" "}
          <span className="text-text-subtle">{state.time}</span>
        </span>
      </div>
    );
  }

  if (state.kind === "answered") {
    return (
      <div className="flex items-center gap-2 mt-3 text-sm text-text-muted">
        <MessageSquare size={14} className="text-text-muted" />
        <span>
          Responded
          {" "}
          <span className="text-text-subtle">{state.time}</span>
        </span>
      </div>
    );
  }

  if (state.kind === "superseded") {
    return (
      <div className="flex items-center gap-2 mt-3 text-sm text-text-muted opacity-50">
        <MinusCircle size={14} />
        <span>Superseded</span>
      </div>
    );
  }

  // Active state - clickable buttons
  return (
    <div role="group" aria-label="Choose an option" className="mt-3 border-2 border-border rounded-lg bg-surface-elevated overflow-hidden max-w-sm">
      {choices.map((choice, i) => (
        <button
          key={choice}
          onClick={() => handleClick(choice)}
          className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold
                     text-text bg-surface-elevated
                     hover:bg-surface-hover focus-visible:bg-surface-hover
                     transition-colors duration-150
                     ${i < choices.length - 1 ? "border-b border-border-subtle" : ""}
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset
                     cursor-pointer group`}
          aria-label={`Choose: ${choice}`}
        >
          <span className="font-mono text-xs text-primary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
            &gt;
          </span>
          {choice}
        </button>
      ))}
    </div>
  );
}
