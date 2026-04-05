// Integration tests for showTable aggregation queries (Issue #24).
// Runs against the seeded test database to verify:
// - testResultSummary: correct status buckets (SKIPPED separate from PENDING)
// - coverageByTeam: correct SR/TP/uncovered counts
// - testCasesForRequirement: flattened TC list with lineage
// - Truncation detection (isTruncated flag)

import { describe, it, expect } from "vitest";
import { createUIIntentTools } from "@/lib/ai/tools/ui-intent-tools";
import type { TablePayload } from "@/types/panel";

// Create the tools once - they use the shared Prisma client internally
const tools = createUIIntentTools();

// Helper to call showTable's execute function with typed args
async function queryTable(args: {
  queryType: string;
  team?: string;
  requirementId?: string;
  searchQuery?: string;
  entityType?: string;
}): Promise<TablePayload | { error: string }> {
  // The tool's execute function is on the tool definition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tools.showTable as any).execute(args);
}

// ─── testResultSummary ───────────────────────────────────

describe("showTable: testResultSummary", () => {
  it("returns table with correct columns including skipped", async () => {
    const result = await queryTable({ queryType: "testResultSummary" });
    expect("error" in result).toBe(false);
    const table = result as TablePayload;

    expect(table.type).toBe("table");
    expect(table.title).toBe("Test Result Summary by Procedure");

    const columnKeys = table.columns.map((c) => c.key);
    expect(columnKeys).toContain("passed");
    expect(columnKeys).toContain("failed");
    expect(columnKeys).toContain("blocked");
    expect(columnKeys).toContain("skipped");
    expect(columnKeys).toContain("pending");
    expect(columnKeys).toContain("total");
  });

  it("only includes ACTIVE procedures (excludes CANCELED)", async () => {
    const result = await queryTable({ queryType: "testResultSummary" });
    const table = result as TablePayload;

    // Seed has 17 ACTIVE, 1 CANCELED (TP9: Bluetooth Synchronization Test)
    // TP9 should NOT appear in results
    const procedureNames = table.rows.map((r) => r.procedure);
    expect(procedureNames).not.toContain("Bluetooth Synchronization Test");
  });

  it("counts SKIPPED separately from PENDING", async () => {
    const result = await queryTable({ queryType: "testResultSummary" });
    const table = result as TablePayload;

    // Every row's total should equal sum of all 5 buckets
    for (const row of table.rows) {
      const sum =
        (row.passed as number) +
        (row.failed as number) +
        (row.blocked as number) +
        (row.skipped as number) +
        (row.pending as number);
      expect(sum).toBe(row.total);
    }
  });

  it("sorts by failed count DESC", async () => {
    const result = await queryTable({ queryType: "testResultSummary" });
    const table = result as TablePayload;

    const failedCounts = table.rows.map((r) => r.failed as number);
    for (let i = 1; i < failedCounts.length; i++) {
      expect(failedCounts[i]).toBeLessThanOrEqual(failedCounts[i - 1]);
    }
  });

  it("has isTruncated flag", async () => {
    const result = await queryTable({ queryType: "testResultSummary" });
    const table = result as TablePayload;
    expect(typeof table.isTruncated).toBe("boolean");
  });
});

// ─── coverageByTeam ──────────────────────────────────────

describe("showTable: coverageByTeam", () => {
  it("returns table with correct columns", async () => {
    const result = await queryTable({ queryType: "coverageByTeam" });
    expect("error" in result).toBe(false);
    const table = result as TablePayload;

    expect(table.type).toBe("table");
    expect(table.title).toBe("Test Coverage by Team");

    const columnKeys = table.columns.map((c) => c.key);
    expect(columnKeys).toEqual(["team", "subRequirements", "testProcedures", "uncovered", "coveragePercent"]);
  });

  it("includes all seeded teams", async () => {
    const result = await queryTable({ queryType: "coverageByTeam" });
    const table = result as TablePayload;

    const teamNames = table.rows.map((r) => r.team);
    expect(teamNames).toContain("Hardware");
    expect(teamNames).toContain("Firmware");
    expect(teamNames).toContain("Product");
    expect(teamNames).toContain("Field Testing");
  });

  it("sorts by uncovered count DESC", async () => {
    const result = await queryTable({ queryType: "coverageByTeam" });
    const table = result as TablePayload;

    const uncoveredCounts = table.rows.map((r) => r.uncovered as number);
    for (let i = 1; i < uncoveredCounts.length; i++) {
      expect(uncoveredCounts[i]).toBeLessThanOrEqual(uncoveredCounts[i - 1]);
    }
  });

  it("calculates coverage percentage correctly", async () => {
    const result = await queryTable({ queryType: "coverageByTeam" });
    const table = result as TablePayload;

    for (const row of table.rows) {
      const srCount = row.subRequirements as number;
      const uncovered = row.uncovered as number;
      if (srCount > 0) {
        const expected = `${Math.round(((srCount - uncovered) / srCount) * 100)}%`;
        expect(row.coveragePercent).toBe(expected);
      } else {
        expect(row.coveragePercent).toBe("-");
      }
    }
  });

  it("has isTruncated flag", async () => {
    const result = await queryTable({ queryType: "coverageByTeam" });
    const table = result as TablePayload;
    expect(typeof table.isTruncated).toBe("boolean");
  });
});

// ─── testCasesForRequirement ─────────────────────────────

describe("showTable: testCasesForRequirement", () => {
  it("returns ValidationError when requirementId is missing", async () => {
    const result = await queryTable({ queryType: "testCasesForRequirement" });
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("ValidationError");
  });

  it("returns test cases for a known requirement", async () => {
    // PR1 ID from seed: deterministic UUID for "Pokemon Scanner Module"
    // Look it up from the database to be robust
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const pr = await prisma.productRequirement.findFirst({
        where: { title: { contains: "Pokemon Scanner" } },
        select: { id: true },
      });
      expect(pr).not.toBeNull();

      const result = await queryTable({
        queryType: "testCasesForRequirement",
        requirementId: pr!.id,
      });
      expect("error" in result).toBe(false);
      const table = result as TablePayload;

      expect(table.type).toBe("table");
      expect(table.title).toBe("Test Cases for Requirement");
      expect(table.rows.length).toBeGreaterThan(0);

      // Verify columns include lineage fields
      const columnKeys = table.columns.map((c) => c.key);
      expect(columnKeys).toContain("procedure");
      expect(columnKeys).toContain("subRequirement");
      expect(columnKeys).toContain("executedBy");
    } finally {
      await prisma.$disconnect();
    }
  });

  it("returns empty table for non-existent requirement ID", async () => {
    const result = await queryTable({
      queryType: "testCasesForRequirement",
      requirementId: "00000000-0000-0000-0000-000000000000",
    });
    expect("error" in result).toBe(false);
    const table = result as TablePayload;
    expect(table.rows).toHaveLength(0);
  });

  it("caps results at 15 rows", async () => {
    // With seed data we won't hit 15, but verify the contract
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const pr = await prisma.productRequirement.findFirst({
        select: { id: true },
      });
      const result = await queryTable({
        queryType: "testCasesForRequirement",
        requirementId: pr!.id,
      });
      const table = result as TablePayload;
      expect(table.rows.length).toBeLessThanOrEqual(15);
      expect(typeof table.isTruncated).toBe("boolean");
    } finally {
      await prisma.$disconnect();
    }
  });
});
