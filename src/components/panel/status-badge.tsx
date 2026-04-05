// Renders a color-coded status pill badge.
// Nine lifecycle states with distinct visual treatments.
// Badge colors are component-local hex values (not @theme tokens)
// mapped to Pokemon type colors for the Pokedex theme (Issue #7).
// Each status maps to a Pokemon type for consistent visual identity.

"use client";

import type { CSSProperties } from "react";

// All status values this component handles (from Prisma enums).
type StatusValue =
  | "DRAFT" | "APPROVED" | "CANCELED"    // RequirementStatus / ProcedureVersionStatus
  | "ACTIVE"                              // ProcedureStatus
  | "PENDING" | "PASSED" | "FAILED"       // TestCaseStatus (subset)
  | "BLOCKED" | "SKIPPED";               // TestCaseStatus (full)

// Map each status to its visual treatment.
// Background, text color, and optional border for outlined style.
const STATUS_STYLES: Record<StatusValue, { bg: string; text: string; border?: string }> = {
  DRAFT:     { bg: "#C6C1B5", text: "#44403C" },                           // Normal type
  APPROVED:  { bg: "#BBF7D0", text: "#14532D" },                           // Grass type
  CANCELED:  { bg: "#E7E5E4", text: "#44403C" },                           // Rock type (gray, distinct from Blocked purple)
  PENDING:   { bg: "#FEF3C7", text: "#78350F", border: "1px solid #D6D3D1" }, // Ground type
  PASSED:    { bg: "#BBF7D0", text: "#14532D" },                           // Grass type
  FAILED:    { bg: "#FECACA", text: "#7F1D1D" },                           // Fire type
  ACTIVE:    { bg: "#BFDBFE", text: "#1E3A5F" },                           // Water type
  BLOCKED:   { bg: "#E9D5FF", text: "#581C87" },                           // Poison type
  SKIPPED:   { bg: "#E7E5E4", text: "#44403C" },                           // Rock type
};

// Fallback for unknown statuses - uses @theme tokens since those are in the palette.
const DEFAULT_STYLE = { bg: "bg-surface", text: "text-text-muted" };

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const known = STATUS_STYLES[status as StatusValue];

  // Known statuses use inline styles with component-local hex colors.
  if (known) {
    const inlineStyle: CSSProperties = {
      backgroundColor: known.bg,
      color: known.text,
      ...(known.border ? { border: known.border } : {}),
    };

    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.02em]"
        style={inlineStyle}
      >
        {status}
      </span>
    );
  }

  // Unknown statuses fall back to Tailwind @theme classes.
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.02em] ${DEFAULT_STYLE.bg} ${DEFAULT_STYLE.text}`}
    >
      {status}
    </span>
  );
}
