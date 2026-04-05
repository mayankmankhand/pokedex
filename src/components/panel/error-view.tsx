// Renders an error state in the context panel.
// Shown when a UI intent tool fails (e.g. entity not found).
// Uses a grayed-out "fainted" Pokeball icon (CSS-only, defined in globals.css).

"use client";

import type { PanelError } from "@/types/panel";

interface ErrorViewProps {
  payload: PanelError;
}

export function ErrorView({ payload }: ErrorViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {/* Fainted Pokeball - grayed out with X mark (CSS class from globals.css) */}
      <div className="pokeball-fainted mb-5" />

      <p className="text-sm font-bold uppercase tracking-wide text-text mb-1.5">
        Tool failed
      </p>
      <p className="text-sm text-text-muted max-w-xs leading-relaxed">
        {payload.message}
      </p>
      <p className="text-[11px] font-mono text-text-subtle mt-3">
        {payload.toolName}
      </p>
    </div>
  );
}
