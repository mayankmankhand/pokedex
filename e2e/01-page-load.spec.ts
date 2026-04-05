// Suite 1: Page Load and Empty State
// Verifies the app loads correctly with all expected UI elements.

import { test, expect, selectors } from "./fixtures";

test.describe("Page Load and Empty State", () => {
  test("app loads without console errors", async ({ appPage }) => {
    const errors: string[] = [];

    // Collect console error messages.
    appPage.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Reload so we capture console events from the start.
    await appPage.reload();
    await appPage.waitForSelector(selectors.chatInput, { state: "visible" });

    // Give the page a moment to settle.
    await appPage.waitForTimeout(1_000);

    expect(errors).toEqual([]);
  });

  test("empty state heading is visible", async ({ appPage }) => {
    // The main heading should greet the user.
    const heading = appPage.getByText("A wild POKEMON appeared!");
    await expect(heading).toBeVisible();
  });

  test("subheading 'Choose your first move' is visible", async ({
    appPage,
  }) => {
    const subheading = appPage.getByText("Choose your first move");
    await expect(subheading).toBeVisible();
  });

  test("suggestion chips rendered (at least 3)", async ({ appPage }) => {
    // Suggestion chips use the data-suggestion attribute.
    const chips = appPage.locator("[data-suggestion]");
    await expect(chips).toHaveCount(await chips.count());
    expect(await chips.count()).toBeGreaterThanOrEqual(3);
  });

  test("user picker is present", async ({ appPage }) => {
    const picker = appPage.locator(selectors.userPicker);
    await expect(picker).toBeVisible();
  });

  test("default user is Ash", async ({ appPage }) => {
    // The user picker button text should contain "Ash".
    const picker = appPage.locator(selectors.userPicker);
    await expect(picker).toContainText("Ash");
  });

  test("page title is 'Pokedex PLM'", async ({ appPage }) => {
    await expect(appPage).toHaveTitle("Pokedex PLM");
  });
});
