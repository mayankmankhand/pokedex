// Human-readable labels for LLM tool names.
// Used by the tool call visualization to show friendly descriptions
// instead of camelCase function names.

import { humanize } from "@/lib/format-utils";

const TOOL_LABELS: Record<string, string> = {
  // Product Requirement mutations
  createProductRequirement: "Creating product requirement",
  updateProductRequirement: "Updating product requirement",
  approveProductRequirement: "Approving product requirement",
  cancelProductRequirement: "Canceling product requirement",

  // Sub-Requirement mutations
  createSubRequirement: "Creating sub-requirement",
  updateSubRequirement: "Updating sub-requirement",
  approveSubRequirement: "Approving sub-requirement",
  cancelSubRequirement: "Canceling sub-requirement",

  // Test Procedure mutations
  createTestProcedure: "Creating test procedure",
  createTestProcedureVersion: "Creating test procedure version",
  cancelTestProcedure: "Canceling test procedure",

  // Test Case mutations
  createTestCase: "Creating test case",
  recordTestResult: "Recording test result",
  skipTestCase: "Skipping test case",

  // Read tools
  getProductRequirement: "Looking up product requirement",
  getSubRequirement: "Looking up sub-requirement",
  getTestProcedure: "Looking up test procedure",
  getTestProcedureVersion: "Looking up test procedure version",
  getTestCase: "Looking up test case",

  // Query tools
  getTraceabilityChain: "Tracing requirement chain",
  getUncoveredSubRequirements: "Checking coverage gaps",
  getProceduresWithoutTestCases: "Finding procedures without test cases",
  getRecentAuditLog: "Fetching audit log",

  // Search
  searchByTitle: "Searching by title",

  // UI intent tools (open context panel)
  showEntityDetail: "Showing in panel",
  showTable: "Showing table in panel",
  showDiagram: "Showing diagram in panel",
  showTraceabilityDiagram: "Showing traceability diagram",
  showStatusDiagram: "Showing status diagram",
  showCoverageDiagram: "Showing coverage diagram",
  showAuditLog: "Showing audit log in panel",
  presentChoices: "Presenting options",
};

// UI intent tool names - these open the context panel.
// Used by message-bubble to render compact summaries instead of raw JSON.
export const UI_INTENT_TOOLS = new Set([
  "showEntityDetail",
  "showTable",
  "showDiagram",
  "showTraceabilityDiagram",
  "showStatusDiagram",
  "showCoverageDiagram",
  "showAuditLog",
  "presentChoices",
]);

/**
 * Returns a human-readable label for a tool name.
 * Falls back to a formatted version of the tool name if not mapped.
 */
export function getToolLabel(toolName: string): string {
  if (TOOL_LABELS[toolName]) {
    return TOOL_LABELS[toolName];
  }
  // Fallback: convert camelCase to spaced words (e.g. "someNewTool" -> "Some new tool")
  const spaced = humanize(toolName);
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

// Inline tools render inside chat messages (not in the side panel).
// Used by page.tsx to skip panel dispatch for these tools.
const INLINE_TOOLS = new Set(["presentChoices"]);

/**
 * Returns true if this tool renders inline in chat rather than in the panel.
 * Inline tools are still UI intent tools (tracked in UI_INTENT_TOOLS) but
 * their output is consumed by MessageBubble, not the panel store.
 */
export function isInlineTool(toolName: string): boolean {
  return INLINE_TOOLS.has(toolName);
}
