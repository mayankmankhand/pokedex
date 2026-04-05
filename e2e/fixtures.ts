// Shared Playwright fixtures and helpers for Pokedex E2E tests.
// Provides a ready-to-use page with the app loaded and common selectors.

import { test as base, expect, type Page } from "@playwright/test";

// Common selectors used across test suites.
export const selectors = {
  chatInput: 'textarea[aria-label="Chat message input"]',
  sendButton: 'button[aria-label="Send message"]',
  userPicker: 'button[aria-haspopup="listbox"]',
  panelAside: 'aside[aria-label="Context panel"]',
  emptyStateHeading: "text=What will you do?",
  suggestionChips: '[data-testid="suggestion-chip"]',
  assistantMessage: ".chat-markdown",
  thinkingIndicator: ".pokeball-spinner",
  streamingDots: ".streaming-pokeballs",
} as const;

// Wait for the app to be fully loaded and interactive.
async function waitForAppReady(page: Page) {
  // Wait for the chat input to be visible and enabled.
  await page.waitForSelector(selectors.chatInput, { state: "visible" });
}

// Send a chat message and wait for the AI to start responding.
async function sendMessage(page: Page, text: string) {
  await page.fill(selectors.chatInput, text);
  await page.click(selectors.sendButton);
  // Wait for the user message to appear in the chat.
  await page.waitForSelector(`text="${text}"`, { timeout: 5_000 });
}

// Wait for the AI to finish responding (no more streaming indicators).
async function waitForResponse(page: Page) {
  // Wait for thinking indicator or streaming dots to appear, then disappear.
  // Use a generous timeout since AI responses can take time.
  try {
    await page.waitForSelector(selectors.thinkingIndicator, {
      state: "visible",
      timeout: 5_000,
    });
  } catch {
    // Indicator may have already appeared and disappeared - that's fine.
  }
  // Wait for all indicators to clear.
  await page.waitForSelector(selectors.thinkingIndicator, {
    state: "hidden",
    timeout: 60_000,
  });
  await page.waitForSelector(selectors.streamingDots, {
    state: "hidden",
    timeout: 10_000,
  });
}

// Extend the base test with app-specific fixtures.
export const test = base.extend<{
  appPage: Page;
}>({
  appPage: async ({ page }, use) => {
    await page.goto("/");
    await waitForAppReady(page);
    await use(page);
  },
});

export { expect, sendMessage, waitForResponse, waitForAppReady };
