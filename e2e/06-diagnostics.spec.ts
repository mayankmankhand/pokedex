// Suite 6: Diagnostics and Edge Cases
// Tests user picker, keyboard shortcuts, responsive layout,
// accessibility, and console error monitoring.

import { test, expect, sendMessage, waitForResponse, selectors } from "./fixtures";

test.describe("Diagnostics and Edge Cases", () => {
  test("user picker opens a listbox with user names", async ({
    appPage: page,
  }) => {
    // Click the user picker button to open the dropdown.
    await page.click(selectors.userPicker);

    // A listbox should appear with selectable options.
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5_000 });

    // The listbox should contain at least 2 user options.
    const options = listbox.locator('[role="option"]');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("selecting a different user clears the chat", async ({
    appPage: page,
  }) => {
    // Send a message first so there is chat history.
    await sendMessage(page, "Hello");
    await waitForResponse(page);

    // Verify at least one assistant message exists.
    const assistantMessages = page.locator(selectors.assistantMessage);
    await expect(assistantMessages.first()).toBeVisible({ timeout: 10_000 });

    // Open the user picker and select a different user (Misty).
    await page.click(selectors.userPicker);
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5_000 });

    // Click on the option containing "Misty".
    const mistyOption = listbox.locator('[role="option"]', { hasText: "Misty" });
    await mistyOption.click();

    // Chat should be cleared - no assistant messages should remain.
    await expect(assistantMessages).toHaveCount(0, { timeout: 5_000 });
  });

  test("trainer sprite SVG is visible inside user picker button", async ({
    appPage: page,
  }) => {
    // The user picker button should contain an SVG sprite (decorative).
    const pickerButton = page.locator(selectors.userPicker);
    const sprite = pickerButton.locator('svg[aria-hidden="true"]');
    await expect(sprite).toBeVisible({ timeout: 5_000 });
  });

  test("Cmd/Ctrl+K focuses the chat input", async ({ appPage: page }) => {
    // Click somewhere else first to ensure input is not focused.
    await page.click("body");

    // Press the keyboard shortcut to focus chat input.
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+k`);

    // The chat input should now be focused.
    const chatInput = page.locator(selectors.chatInput);
    await expect(chatInput).toBeFocused({ timeout: 2_000 });
  });

  test("Cmd/Ctrl+\\ toggles the panel closed", async ({ appPage: page }) => {
    // First, open the panel by triggering a detail view.
    await sendMessage(page, "Show details for PR-001");
    await waitForResponse(page);

    const panel = page.locator(selectors.panelAside);
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Press Cmd/Ctrl+\ to close the panel.
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+\\`);

    // The panel should no longer be visible.
    await expect(panel).toBeHidden({ timeout: 5_000 });
  });

  test("responsive: panel is full-width overlay on narrow viewport", async ({
    appPage: page,
  }) => {
    // Resize viewport to tablet width.
    await page.setViewportSize({ width: 768, height: 1024 });

    // Trigger a panel view.
    await sendMessage(page, "Show details for PR-001");
    await waitForResponse(page);

    const panel = page.locator(selectors.panelAside);
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // On narrow viewports the panel should take full width (overlay).
    const panelBox = await panel.boundingBox();
    expect(panelBox).toBeTruthy();
    // Panel width should be close to the viewport width (allowing small margins).
    expect(panelBox!.width).toBeGreaterThanOrEqual(700);
  });

  test("all icon-only buttons have an aria-label", async ({
    appPage: page,
  }) => {
    // Find all buttons that contain only an SVG (no text content).
    // These are icon-only buttons and must have aria-label for accessibility.
    const iconButtons = page.locator("button:has(svg)");
    const count = await iconButtons.count();

    for (let i = 0; i < count; i++) {
      const button = iconButtons.nth(i);
      const textContent = await button.textContent();
      const trimmedText = (textContent || "").replace(/\s/g, "");

      // If the button has no visible text, it must have an aria-label.
      if (trimmedText === "") {
        const ariaLabel = await button.getAttribute("aria-label");
        expect(
          ariaLabel,
          `Icon-only button at index ${i} is missing aria-label`
        ).toBeTruthy();
      }
    }
  });

  test("no console errors during normal usage", async ({ appPage: page }) => {
    // Collect all console errors from the moment the page loads.
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Perform some basic interactions to exercise the app.
    await sendMessage(page, "Hello");
    await waitForResponse(page);

    // Allow a moment for any deferred errors to surface.
    await page.waitForTimeout(1_000);

    // There should be zero console errors.
    expect(consoleErrors).toEqual([]);
  });
});
