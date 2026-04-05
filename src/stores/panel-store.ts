// Zustand store for the context panel.
// Controls panel visibility and content. The AI opens the panel
// by calling UI intent tools; the user closes it with X or Escape.

import { create } from "zustand";
import type {
  DetailPayload,
  TablePayload,
  DiagramPayload,
  AuditPayload,
  PanelState,
} from "@/types/panel";

// Default panel width in pixels (used by context-panel.tsx and page.tsx)
export const DEFAULT_PANEL_WIDTH = 540;

// Max navigation history entries (drop oldest when exceeded)
const MAX_HISTORY = 20;

interface PanelStore {
  // State
  isOpen: boolean;
  content: PanelState | null;
  panelWidth: number;
  // Navigation history stack (most recent entry at end)
  history: PanelState[];
  // Derived: true when there is at least one history entry to go back to
  canGoBack: boolean;

  // Actions - each one opens the panel with the given content
  showDetail: (payload: DetailPayload) => void;
  showTable: (payload: TablePayload) => void;
  showDiagram: (payload: DiagramPayload) => void;
  showAudit: (payload: AuditPayload) => void;
  showError: (toolName: string, message: string) => void;
  close: () => void;
  // Re-open the panel with its existing content (used by Cmd+\ toggle)
  reopen: () => void;
  // Update panel width during drag-to-resize
  setPanelWidth: (width: number) => void;
  // Pop the last history entry and restore it as current content
  navigateBack: () => void;
  // Append rows to the current table (used by "Show more" pagination)
  appendTableRows: (rows: Record<string, unknown>[], isTruncated: boolean) => void;
  // Replace current content without pushing history (used after mutations to refresh)
  replaceContent: (content: PanelState) => void;
  // Reset everything (e.g. on user switch)
  reset: () => void;
}

/**
 * Push current content onto history before replacing it.
 * Skips push if current content is null or identical to the new content
 * (consecutive duplicate suppression via JSON.stringify comparison).
 * Caps history at MAX_HISTORY by dropping the oldest entry.
 */
function pushHistory(
  currentContent: PanelState | null,
  newContent: PanelState,
  history: PanelState[],
): PanelState[] {
  if (!currentContent) return history;
  if (JSON.stringify(currentContent) === JSON.stringify(newContent)) return history;
  const next = [...history, currentContent];
  if (next.length > MAX_HISTORY) next.shift();
  return next;
}

export const usePanelStore = create<PanelStore>((set) => ({
  isOpen: false,
  content: null,
  panelWidth: DEFAULT_PANEL_WIDTH,
  history: [],
  canGoBack: false,

  showDetail: (payload) =>
    set((state) => {
      const history = pushHistory(state.content, payload, state.history);
      return { isOpen: true, content: payload, history, canGoBack: history.length > 0 };
    }),
  showTable: (payload) =>
    set((state) => {
      const history = pushHistory(state.content, payload, state.history);
      return { isOpen: true, content: payload, history, canGoBack: history.length > 0 };
    }),
  showDiagram: (payload) =>
    set((state) => {
      const history = pushHistory(state.content, payload, state.history);
      return { isOpen: true, content: payload, history, canGoBack: history.length > 0 };
    }),
  showAudit: (payload) =>
    set((state) => {
      const history = pushHistory(state.content, payload, state.history);
      return { isOpen: true, content: payload, history, canGoBack: history.length > 0 };
    }),
  showError: (toolName, message) =>
    set((state) => {
      const errorContent = { type: "error" as const, toolName, message };
      const history = pushHistory(state.content, errorContent, state.history);
      return { isOpen: true, content: errorContent, history, canGoBack: history.length > 0 };
    }),

  // Close hides the panel but keeps content and history (so animation can finish)
  close: () => set({ isOpen: false }),

  // Re-open with existing content (no-op if content is null)
  reopen: () =>
    set((state) => (state.content ? { isOpen: true } : {})),

  // Update panel width during drag-to-resize (called from context-panel.tsx)
  setPanelWidth: (width) => set({ panelWidth: width }),

  // Pop last history entry and restore it as current content
  navigateBack: () =>
    set((state) => {
      if (state.history.length === 0) return {};
      const history = [...state.history];
      const previous = history.pop()!;
      return { content: previous, history, canGoBack: history.length > 0 };
    }),

  // Append rows to existing table content (no history push - this is pagination, not navigation)
  appendTableRows: (rows, isTruncated) =>
    set((state) => {
      if (!state.content || state.content.type !== "table") return {};
      // Deduplicate by JSON-stringifying each row (offset pagination rarely produces
      // duplicates, but guards against data changes between fetches)
      const existing = new Set(state.content.rows.map((r) => JSON.stringify(r)));
      const unique = rows.filter((r) => !existing.has(JSON.stringify(r)));
      return {
        content: {
          ...state.content,
          rows: [...state.content.rows, ...unique],
          isTruncated,
        },
      };
    }),

  // Replace current content without pushing history (e.g. post-mutation refresh)
  replaceContent: (content) => set({ isOpen: true, content }),

  // Full reset clears content and history
  reset: () =>
    set({ isOpen: false, content: null, panelWidth: DEFAULT_PANEL_WIDTH, history: [], canGoBack: false }),
}));
