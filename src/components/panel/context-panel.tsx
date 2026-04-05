// Context panel wrapper - slides in from the right when the AI
// calls a UI intent tool. Solid opaque surface with drag-to-resize.
// See docs/design/plm-redesign-spec-v3.md Sections 6.3 and 5.1.

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, ArrowLeft, Table2, FileText, GitBranch, AlertCircle, History, FileCode, GitCompare, CalendarDays } from "lucide-react";
import { usePanelStore, DEFAULT_PANEL_WIDTH } from "@/stores/panel-store";
import { useDesktopBreakpoint } from "@/hooks/use-desktop-breakpoint";
import { fetchPanelDetail } from "@/lib/panel-utils";
import { DetailView } from "./detail-view";
import { TableView } from "./table-view";
import { DiagramView } from "./diagram-view";
import { ErrorView } from "./error-view";
import { AuditView } from "./audit-view";

import type { PanelState } from "@/types/panel";

// Badge config for each content type - shown as a pill in the panel header.
type BadgeConfig = { label: string; icon: typeof FileText };
const TYPE_BADGES: Record<PanelState["type"], BadgeConfig> = {
  detail: { label: "Detail", icon: FileText },
  table: { label: "Table", icon: Table2 },
  diagram: { label: "Diagram", icon: GitBranch },
  audit: { label: "Audit", icon: History },
  error: { label: "Error", icon: AlertCircle },
  // Reserved types (not rendered yet - see spec Section 9)
  document: { label: "Document", icon: FileCode },
  comparison: { label: "Comparison", icon: GitCompare },
  timeline: { label: "Timeline", icon: CalendarDays },
};

// Panel width constraints (default lives in panel-store.ts)
const MIN_WIDTH = 360;
const MAX_WIDTH = 800;

interface ContextPanelProps {
  /** Inject a system note into the chat transcript (used by detail-view for mutations). */
  notifyChat: (message: string) => void;
}

export function ContextPanel({ notifyChat }: ContextPanelProps) {
  const isDesktop = useDesktopBreakpoint();
  const isOpen = usePanelStore((s) => s.isOpen);
  const content = usePanelStore((s) => s.content);
  const close = usePanelStore((s) => s.close);
  const panelWidth = usePanelStore((s) => s.panelWidth);
  const setPanelWidth = usePanelStore((s) => s.setPanelWidth);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_PANEL_WIDTH);

  // Iris wipe overlay - plays once when panel opens (Phase 3 battle encounter effect).
  // Tracks previous isOpen value via ref to detect false-to-true transitions.
  const [showIrisWipe, setShowIrisWipe] = useState(false);
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current && !showIrisWipe) {
      // Panel just opened (and no animation in progress) - trigger the iris wipe
      setShowIrisWipe(true);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, showIrisWipe]);

  // Drag-to-resize: mousedown on the handle starts tracking
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isOpen) return;
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [isOpen, panelWidth]);

  // Track mouse movement and release during drag
  useEffect(() => {
    if (!isDragging) return;

    function onMouseMove(e: MouseEvent) {
      // Dragging left = wider (delta is negative, so subtract)
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta));
      setPanelWidth(newWidth);
    }

    function onMouseUp() {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, setPanelWidth]);

  const showDetail = usePanelStore((s) => s.showDetail);
  const showError = usePanelStore((s) => s.showError);
  const canGoBack = usePanelStore((s) => s.canGoBack);
  const navigateBack = usePanelStore((s) => s.navigateBack);

  // Navigate from a table row to the entity's detail view.
  // Fetches the detail payload, then pushes it onto the panel (with history).
  const handleTableNavigate = useCallback(
    async (entityType: string, entityId: string) => {
      try {
        const detail = await fetchPanelDetail(entityType, entityId);
        showDetail(detail);
      } catch (err) {
        showError("showTable", err instanceof Error ? err.message : "Failed to load detail");
      }
    },
    [showDetail, showError],
  );

  const badge = content ? TYPE_BADGES[content.type] : null;
  const BadgeIcon = badge?.icon;
  const title =
    content && "title" in content ? content.title : badge?.label ?? "Panel";

  return (
    <>
      {/* Backdrop overlay for mobile/tablet when panel is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <aside
        ref={panelRef}
        role="complementary"
        aria-label="Context panel"
        className={`
          fixed top-0 right-0 h-dvh z-40
          w-full md:w-[540px]
          border-l-2 border-border
          flex flex-col
          ${isDragging ? "" : "transform transition-all duration-250 ease-[cubic-bezier(0.165,0.85,0.45,1)]"}
          ${isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"}
        `}
        style={{
          // Desktop uses dynamic width from resize; mobile stays full-width
          ...(isDesktop ? { width: `${panelWidth}px` } : {}),
          // Solid opaque surface (Issue #7 - Pokemon theme replaces frosted glass)
          backgroundColor: "var(--color-surface-panel)",
        }}
      >
        {/* Iris wipe overlay - dark circle expands to reveal panel on open (Phase 3).
            Absolutely positioned above all content, removed after animation ends. */}
        {showIrisWipe && (
          <div
            className="absolute inset-0 bg-black/80 z-50 panel-iris-wipe"
            onAnimationEnd={() => setShowIrisWipe(false)}
            aria-hidden="true"
          />
        )}

        {/* Resize handle - invisible 6px strip on the left edge */}
        <div
          className={`panel-resize-handle hidden lg:block ${isDragging ? "active" : ""}`}
          onMouseDown={handleMouseDown}
        />

        {/* Header - sits on the solid panel surface */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Back button - shown when navigation history exists */}
            {canGoBack && (
              <button
                onClick={navigateBack}
                aria-label="Go back"
                title="Go back"
                className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-hover
                           transition-colors duration-150
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            {badge && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-primary bg-primary-subtle px-2.5 py-0.5 rounded-full">
                {BadgeIcon && <BadgeIcon size={12} />}
                {badge.label}
              </span>
            )}
            <h2 className="text-sm font-semibold text-text truncate" title={title}>{title}</h2>
          </div>
          <button
            onClick={close}
            aria-label="Close panel"
            title="Close panel"
            className="p-1.5 rounded-lg text-text-muted
                       hover:text-text hover:bg-surface-hover transition-colors duration-150
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-5">
          {content?.type === "detail" && <DetailView payload={content} notifyChat={notifyChat} onNavigate={handleTableNavigate} />}
          {content?.type === "table" && <TableView payload={content} onNavigate={handleTableNavigate} />}
          {content?.type === "diagram" && <DiagramView payload={content} />}
          {content?.type === "audit" && <AuditView payload={content} />}
          {content?.type === "error" && <ErrorView payload={content} />}
        </div>
      </aside>
    </>
  );
}
