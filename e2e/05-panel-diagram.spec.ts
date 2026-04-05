// Suite 5: Panel Diagram View
// Tests that the AI can render Mermaid diagrams in the context panel,
// with zoom controls and no console errors.

import { test, expect, sendMessage, waitForResponse, selectors } from "./fixtures";

test.describe("Panel Diagram View", () => {
  test("renders a Mermaid diagram with zoom controls", async ({
    appPage: page,
  }) => {
    // Collect console errors throughout the test.
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Ask the AI to show a traceability diagram.
    await sendMessage(page, "Show traceability diagram for Scanner Assembly");
    await waitForResponse(page);

    // The context panel should open.
    const panel = page.locator(selectors.panelAside);
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // The panel should contain a rendered SVG (the Mermaid diagram output).
    const svg = panel.locator("svg");
    await expect(svg.first()).toBeVisible({ timeout: 10_000 });

    // Zoom controls should be present.
    const zoomIn = panel.locator('button[aria-label="Zoom in"]');
    const zoomOut = panel.locator('button[aria-label="Zoom out"]');
    const fitButton = panel.locator('button[aria-label="Fit diagram to panel width"]');
    const copyButton = panel.locator('button[aria-label="Copy diagram source to clipboard"]');

    await expect(zoomIn).toBeVisible({ timeout: 5_000 });
    await expect(zoomOut).toBeVisible();
    await expect(fitButton).toBeVisible();
    await expect(copyButton).toBeVisible();

    // No console errors should have occurred during diagram rendering.
    expect(consoleErrors).toEqual([]);
  });
});
