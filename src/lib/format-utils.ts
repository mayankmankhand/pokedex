// Shared formatting utilities.

/**
 * Converts a PascalCase or camelCase string into spaced words.
 * e.g. "ProductRequirement" -> "Product Requirement"
 */
export function humanize(str: string): string {
  return str.replace(/([A-Z])/g, " $1").trim();
}

/**
 * Formats a Date or date-string for display (e.g. "Jan 15, 2026").
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
