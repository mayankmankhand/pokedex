// Shared constants for admin trace pages.

// Event type badge colors (matches Pokemon type color palette)
export const EVENT_TYPE_COLORS: Record<string, string> = {
  USER_MESSAGE: "bg-blue-100 text-blue-800",
  AI_RESPONSE: "bg-purple-100 text-purple-800",
  TOOL_CALL: "bg-amber-100 text-amber-800",
  TOOL_RESULT: "bg-green-100 text-green-800",
  PANEL_ACTION: "bg-teal-100 text-teal-800",
  API_CALL: "bg-gray-100 text-gray-800",
  ERROR: "bg-red-100 text-red-800",
};

// Event type icons (simple text markers for visual scanning)
export const EVENT_TYPE_ICONS: Record<string, string> = {
  USER_MESSAGE: ">>",
  AI_RESPONSE: "<<",
  TOOL_CALL: "->",
  TOOL_RESULT: "<-",
  PANEL_ACTION: "[P]",
  API_CALL: "[A]",
  ERROR: "[!]",
};
