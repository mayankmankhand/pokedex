// Playwright E2E test configuration for Pokedex PLM.
// Runs against next dev with the test database (.env.test).
// Chromium-only for speed - add more browsers if needed later.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Sequential - tests share app state (chat, panel)
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:3000",
    // Capture trace on first retry for debugging flaky tests.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start the dev server with the test database before running E2E tests.
  // The server is killed automatically after tests finish.
  webServer: {
    command: "env $(cat .env.test | grep -v '^#' | xargs) npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
