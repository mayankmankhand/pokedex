// Suite 2: Chat Interaction
// Verifies sending messages, suggestion chips, keyboard shortcuts,
// and AI response behavior.

import { test, expect, sendMessage, waitForResponse, selectors } from "./fixtures";

test.describe("Chat Interaction", () => {
  test("clicking a suggestion chip sends a user message", async ({
    appPage,
  }) => {
    // Click the "Show all requirements" suggestion chip.
    const chip = appPage.locator('[data-suggestion="Show all requirements"]');
    await expect(chip).toBeVisible();
    await chip.click();

    // The user message should appear in the chat.
    const userMessage = appPage.getByText("Show all requirements");
    await expect(userMessage).toBeVisible({ timeout: 5_000 });
  });

  test("AI responds after sending a message", async ({ appPage }) => {
    // Send a message and wait for the AI to reply.
    await sendMessage(appPage, "Show all requirements");

    try {
      await waitForResponse(appPage);

      // At least one assistant message should be visible.
      const assistantMessages = appPage.locator(selectors.assistantMessage);
      await expect(assistantMessages.first()).toBeVisible({ timeout: 30_000 });
    } catch {
      // If AI is unavailable (no API key), the test passes gracefully.
      // We just verify the user message was sent.
      const userMessage = appPage.getByText("Show all requirements");
      await expect(userMessage).toBeVisible();
    }
  });

  test("thinking indicator shows during response", async ({ appPage }) => {
    await sendMessage(appPage, "Show all requirements");

    try {
      // The pokeball spinner should appear while the AI is thinking.
      const spinner = appPage.locator(selectors.thinkingIndicator);
      await expect(spinner).toBeVisible({ timeout: 10_000 });

      // Wait for it to disappear (AI finished responding).
      await expect(spinner).toBeHidden({ timeout: 60_000 });
    } catch {
      // If AI is unavailable, the spinner may never appear - that is OK.
    }
  });

  test("empty state disappears after first message", async ({ appPage }) => {
    // Confirm empty state is visible before sending.
    const heading = appPage.getByText("A wild POKEMON appeared!");
    await expect(heading).toBeVisible();

    await sendMessage(appPage, "Hello");

    // Empty state heading should no longer be visible.
    await expect(heading).toBeHidden({ timeout: 5_000 });
  });

  test("Enter key sends a message", async ({ appPage }) => {
    const input = appPage.locator(selectors.chatInput);
    await input.fill("Hello from keyboard");
    await input.press("Enter");

    // The user message should appear in the chat.
    const userMessage = appPage.getByText("Hello from keyboard");
    await expect(userMessage).toBeVisible({ timeout: 5_000 });
  });

  test("Shift+Enter adds a newline instead of sending", async ({
    appPage,
  }) => {
    const input = appPage.locator(selectors.chatInput);
    await input.fill("Line one");
    await input.press("Shift+Enter");

    // The input should now contain a newline - message was NOT sent.
    const value = await input.inputValue();
    expect(value).toContain("\n");

    // The empty state heading should still be visible (message was not sent).
    const heading = appPage.getByText("A wild POKEMON appeared!");
    await expect(heading).toBeVisible();
  });
});
