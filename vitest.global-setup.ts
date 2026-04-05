/**
 * Vitest Global Setup
 *
 * Runs once before any test file is loaded. Three jobs:
 * 1. Load .env.test so DATABASE_URL points to the test database
 * 2. Apply Prisma migrations to the test database (same path as production)
 * 3. Re-seed the test database so every run starts clean
 *
 * Why globalSetup instead of setupFiles?
 * - globalSetup runs before Vitest imports any test file
 * - Prisma reads DATABASE_URL at import time (when src/lib/prisma.ts loads)
 * - If we used setupFiles, the import would already have happened with the wrong URL
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export function setup() {
  const envTestPath = resolve(__dirname, ".env.test");

  // Fail fast if .env.test is missing - don't silently fall back to the app DB
  if (!existsSync(envTestPath)) {
    throw new Error(
      "Missing .env.test file. Tests require a separate database.\n" +
        "See .claude/plans/PLAN-issue-17.md for setup instructions."
    );
  }

  // Parse .env.test and inject into process.env
  const envContent = readFileSync(envTestPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    // Strip surrounding quotes if present
    const value = trimmed
      .slice(eqIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }

  // Verify DATABASE_URL was actually set
  if (!process.env.DATABASE_URL) {
    throw new Error(
      ".env.test exists but DATABASE_URL is not set. Add your test database URL."
    );
  }

  // Apply migrations so the test DB matches the migration history exactly.
  // The full_schema migration includes custom SQL constraints (partial unique
  // index + CHECK) so no separate raw SQL step is needed.
  console.log("[test-setup] Applying migrations to test database...");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env },
  });

  // Seed the test database so every run starts with a known state
  console.log("[test-setup] Seeding test database...");
  execSync("npx tsx prisma/seed.ts", {
    stdio: "inherit",
    env: { ...process.env },
  });
  console.log("[test-setup] Test database ready.");
}
