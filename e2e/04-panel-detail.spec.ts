// Suite 4: Panel Detail View
// Tests that the AI can open entity detail views in the context panel,
// and that the panel displays dex-card sections, status badges, and
// supports drag-to-resize.

import { test, expect, sendMessage, waitForResponse, selectors } from "./fixtures";

test.describe("Panel Detail View", () => {
  test("shows entity detail with dex-card sections and status badge", async ({
    appPage: page,
  }) => {
    // Ask the AI to show details for a known product requirement.
    await sendMessage(page, "Show details for PR-001");
    await waitForResponse(page);

    // The context panel should open.
    const panel = page.locator(selectors.panelAside);
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // The panel should contain at least one dex-card section.
    const dexCards = panel.locator(".dex-card");
    await expect(dexCards.first()).toBeVisible({ timeout: 5_000 });
    const cardCount = await dexCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // A status badge should be visible (showing DRAFT, APPROVED, etc.).
    const statusBadge = panel.locator(".status-badge, [class*='StatusBadge']");
    await expect(statusBadge.first()).toBeVisible({ timeout: 5_000 });
    const badgeText = await statusBadge.first().textContent();
    expect(badgeText).toBeTruthy();
  });

  test("panel resize handle changes panel width on drag", async ({
    appPage: page,
  }) => {
    // First, open the panel by triggering a detail view.
    await sendMessage(page, "Show details for PR-001");
    await waitForResponse(page);

    const panel = page.locator(selectors.panelAside);
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // The resize handle is a div on the left edge of the panel, visible on lg+ screens.
    // Ensure the viewport is wide enough to see it.
    await page.setViewportSize({ width: 1280, height: 800 });

    const resizeHandle = panel.locator(".panel-resize-handle");
    await expect(resizeHandle).toBeVisible({ timeout: 5_000 });

    // Record the initial panel width.
    const initialBox = await panel.boundingBox();
    expect(initialBox).toBeTruthy();
    const initialWidth = initialBox!.width;

    // Drag the resize handle to the left to make the panel wider.
    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).toBeTruthy();
    const startX = handleBox!.x + handleBox!.width / 2;
    const startY = handleBox!.y + handleBox!.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Move 100px to the left (panel grows from the left edge).
    await page.mouse.move(startX - 100, startY, { steps: 10 });
    await page.mouse.up();

    // The panel should now be wider than before.
    const newBox = await panel.boundingBox();
    expect(newBox).toBeTruthy();
    expect(newBox!.width).toBeGreaterThan(initialWidth);
  });
});
