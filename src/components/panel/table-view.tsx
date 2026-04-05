// Renders tabular data in the context panel.
// Columns and rows come from the AI's showTable tool output.
// Status cells are rendered as color-coded badges.
// Initial load capped at 15 rows; "Show more" button fetches additional pages.
// Rows are clickable when onNavigate is provided and the table has an ID column.

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Table2 } from "lucide-react";
import type { TablePayload } from "@/types/panel";
import { usePanelStore } from "@/stores/panel-store";
import { StatusBadge } from "./status-badge";

// Column keys that contain status values (rendered as badges instead of text).
const STATUS_COLUMN_KEYS = new Set(["status", "result"]);

// Matches "id" as a standalone word or suffix (e.g. "id", "prId", "testId")
// but not inside words like "valid" or "sub-requirement".
const ID_COLUMN_RE = /(?:^|[^a-z])id$/i;

/** Return a fixed col width based on the column key, or undefined for auto. */
function colWidth(key: string): string | undefined {
  const k = key.toLowerCase();
  if (ID_COLUMN_RE.test(k)) return "68px";
  if (k.includes("status") || k.includes("result")) return "90px";
  if (k.includes("team") || k.includes("ref") || k.includes("type")) return "85px";
  return undefined;
}

/** True when the column should use nowrap. */
function isFixedColumn(key: string): boolean {
  return colWidth(key) !== undefined;
}

/** True when the column is an ID column (for mono font styling). */
function isIdColumn(key: string): boolean {
  return ID_COLUMN_RE.test(key.toLowerCase());
}

// Maps queryType to the entity type each row represents.
// Aggregation types (testResultSummary, coverageByTeam) are not navigable.
const QUERY_TYPE_ENTITY: Record<string, string> = {
  allRequirements: "ProductRequirement",
  allSubRequirements: "SubRequirement",
  uncoveredSubRequirements: "SubRequirement",
  allTestProcedures: "TestProcedure",
  untestedProcedures: "TestProcedure",
  allTestCases: "TestCase",
  testCasesForRequirement: "TestCase",
  // searchResults: entity type varies per row (has "entityType" column)
};

/** Find the first column key that looks like an ID column. */
function findIdColumnKey(columns: TablePayload["columns"]): string | undefined {
  return columns.find((col) => isIdColumn(col.key))?.key;
}

interface TableViewProps {
  payload: TablePayload;
  /** Called when a row is clicked. Receives the entity type and ID to navigate to. */
  onNavigate?: (entityType: string, entityId: string) => void;
}

export function TableView({ payload, onNavigate }: TableViewProps) {
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [loadingRowIdx, setLoadingRowIdx] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const appendTableRows = usePanelStore((s) => s.appendTableRows);

  // Clear loading timeout on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  // Determine if rows are clickable: need an ID column and a way to resolve entity type
  const idColumnKey = findIdColumnKey(payload.columns);
  const staticEntityType = payload.queryType
    ? QUERY_TYPE_ENTITY[payload.queryType]
    : undefined;
  // For searchResults, rows have an "entityType" column
  const isSearchResults = payload.queryType === "searchResults";
  const isNavigable = !!onNavigate && !!idColumnKey && (!!staticEntityType || isSearchResults);

  /** Handle row click - resolve entity type and ID, then call onNavigate. */
  const handleRowClick = useCallback(
    (row: Record<string, unknown>, rowIdx: number) => {
      if (!onNavigate || !idColumnKey) return;
      const entityId = String(row[idColumnKey] ?? "");
      if (!entityId || entityId === "-") return;

      // Resolve entity type: static from queryType, or per-row for search results
      const entityType = staticEntityType ?? String(row["entityType"] ?? "");
      if (!entityType) return;

      setLoadingRowIdx(rowIdx);
      onNavigate(entityType, entityId);
      // Clear loading state after a short delay (panel switch happens synchronously
      // once the fetch completes in the parent)
      loadingTimeoutRef.current = setTimeout(() => setLoadingRowIdx(null), 600);
    },
    [onNavigate, idColumnKey, staticEntityType],
  );

  /** Handle keyboard activation on clickable rows. */
  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent, row: Record<string, unknown>, rowIdx: number) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleRowClick(row, rowIdx);
      }
    },
    [handleRowClick],
  );

  /** Fetch the next page of rows and append to the table. */
  const handleShowMore = useCallback(async () => {
    if (!payload.queryType || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/panel/table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queryType: payload.queryType,
          queryParams: payload.queryParams ?? {},
          offset: payload.rows.length,
          limit: 15,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const data = await res.json();
      appendTableRows(data.rows, data.isTruncated);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load more rows");
    } finally {
      setLoadingMore(false);
    }
  }, [payload.queryType, payload.queryParams, payload.rows.length, loadingMore, appendTableRows]);

  if (payload.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Table2
          size={48}
          strokeWidth={1.2}
          className="text-text-muted opacity-25 mb-3"
        />
        <p className="text-sm font-medium text-text mb-0.5">No results</p>
        <p className="text-xs text-text-muted">Try a different query.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-elevated rounded-xl border-2 border-border shadow-sm overflow-hidden">
      <div
        className="panel-table-scroll overflow-x-auto"
      >
        <table
          className="w-full text-sm"
          style={{ tableLayout: "fixed", minWidth: 420 }}
        >
          <colgroup>
            {payload.columns.map((col) => {
              const w = colWidth(col.key);
              return <col key={col.key} style={w ? { width: w } : undefined} />;
            })}
          </colgroup>

          <thead>
            <tr className="border-b-2 border-border">
              {payload.columns.map((col) => (
                <th
                  key={col.key}
                  className="sticky top-0 z-10 bg-surface px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted"
                  style={
                    isFixedColumn(col.key)
                      ? { whiteSpace: "nowrap" }
                      : undefined
                  }
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {payload.rows.map((row, i) => {
              const rowClickable = isNavigable && loadingRowIdx === null;
              const isLoading = loadingRowIdx === i;
              return (
              <tr
                key={idColumnKey ? String(row[idColumnKey]) : i}
                className={`border-b border-border-subtle last:border-b-0 hover:bg-surface-hover transition-colors${
                  rowClickable ? " cursor-pointer" : ""
                }${isLoading ? " opacity-60" : ""}`}
                {...(rowClickable
                  ? {
                      role: "button",
                      tabIndex: 0,
                      onClick: () => handleRowClick(row, i),
                      onKeyDown: (e: React.KeyboardEvent) => handleRowKeyDown(e, row, i),
                    }
                  : {})}
              >
                {payload.columns.map((col) => {
                  const value = String(row[col.key] ?? "-");
                  const isStatus = STATUS_COLUMN_KEYS.has(
                    col.key.toLowerCase()
                  );
                  const fixed = isFixedColumn(col.key);
                  const isId = isIdColumn(col.key);

                  return (
                    <td
                      key={col.key}
                      className={`px-3.5 py-2.5 ${isId ? "font-mono text-[12px] text-text-muted" : "text-text"}`}
                      style={
                        fixed
                          ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
                          : { whiteSpace: "normal", wordBreak: "break-word" }
                      }
                      title={isId ? value : undefined}
                    >
                      {isStatus && value !== "-" ? (
                        <StatusBadge status={value} />
                      ) : isId ? (
                        value.slice(0, 8)
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer with count and pagination */}
      <div className="border-t-2 border-border bg-surface px-3.5 py-2.5 text-[11px] font-medium text-text-muted flex items-center justify-between">
        <span>
          Showing {payload.rows.length}{" "}
          {payload.rows.length === 1 ? "row" : "rows"}
          {payload.isTruncated && " (more available)"}
        </span>
        {payload.isTruncated && payload.queryType && (
          <button
            onClick={handleShowMore}
            disabled={loadingMore}
            className="text-xs text-text font-medium py-1 px-3 rounded-md border-2 border-border bg-surface-elevated
                       hover:bg-surface-hover transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {loadingMore ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="pokeball-spinner pokeball-spinner-sm" />
                Loading...
              </span>
            ) : (
              "Show more"
            )}
          </button>
        )}
      </div>
      {loadError && (
        <div className="px-3.5 py-1.5 text-xs text-danger">{loadError}</div>
      )}
    </div>
  );
}
