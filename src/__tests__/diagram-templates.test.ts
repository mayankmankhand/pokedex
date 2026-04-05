// Snapshot/fixture tests for diagram template functions.
// Verifies byte-for-byte identical Mermaid output for identical input.
// Pure unit tests - no database access needed.

import { describe, it, expect } from "vitest";
import {
  escapeMermaidLabel,
  buildTraceabilityDiagram,
  buildStatusDistributionDiagram,
  buildMultiStatusDiagram,
  buildTeamCoverageDiagram,
  MAX_DIAGRAM_NODES,
  type TraceabilityData,
  type StatusDistributionData,
  type TeamCoverageData,
} from "@/lib/ai/diagram-templates";

// ─── escapeMermaidLabel ─────────────────────────────────

describe("escapeMermaidLabel", () => {
  it("passes through safe strings unchanged", () => {
    expect(escapeMermaidLabel("Hello World")).toBe("Hello World");
  });

  it("escapes double quotes", () => {
    expect(escapeMermaidLabel('Say "hello"')).toBe("Say &quot;hello&quot;");
  });

  it("replaces arrow operators", () => {
    expect(escapeMermaidLabel("A --> B")).toBe("A -> B");
    expect(escapeMermaidLabel("A ---> B")).toBe("A -> B");
    expect(escapeMermaidLabel("long --- dash")).toBe("long -- dash");
  });

  it("replaces pipe characters", () => {
    expect(escapeMermaidLabel("option|choice")).toBe("option/choice");
  });

  it("removes brackets, parens, and braces", () => {
    expect(escapeMermaidLabel("Test [v2] (draft) {internal}")).toBe(
      "Test v2 draft internal",
    );
  });

  it("handles combined special characters", () => {
    const input = 'Update Auth (v2) --> Done | "Final"';
    const result = escapeMermaidLabel(input);
    expect(result).toBe("Update Auth v2 -> Done / &quot;Final&quot;");
  });

  it("handles empty string", () => {
    expect(escapeMermaidLabel("")).toBe("");
  });
});

// ─── Fixtures ───────────────────────────────────────────

const TRACEABILITY_FIXTURE: TraceabilityData = {
  requirements: [
    {
      id: "PR-001",
      title: "Pokemon Scanner Module",
      status: "APPROVED",
      totalSubRequirements: 2,
      subRequirements: [
        {
          id: "SR-1",
          title: "Visual Recognition",
          status: "APPROVED",
          teamName: "Firmware",
          totalTestProcedures: 1,
          testProcedures: [
            {
              id: "TP-1",
              title: "Scanner Accuracy",
              status: "ACTIVE",
              totalTestCases: 3,
              testCases: [
                { id: "TC-1", title: "Daylight Scan", status: "PASSED" },
                { id: "TC-2", title: "Low Light Scan", status: "PASSED" },
                { id: "TC-3", title: "Motion Scan", status: "FAILED" },
              ],
            },
          ],
        },
        {
          id: "SR-2",
          title: "Species Database",
          status: "DRAFT",
          teamName: "Firmware",
          totalTestProcedures: 0,
          testProcedures: [],
        },
      ],
    },
  ],
};

const STATUS_FIXTURE: StatusDistributionData = {
  entityType: "Product Requirements",
  statusCounts: [
    { status: "DRAFT", count: 3 },
    { status: "APPROVED", count: 5 },
    { status: "CANCELED", count: 1 },
  ],
};

const COVERAGE_FIXTURE: TeamCoverageData = {
  teams: [
    {
      name: "Firmware",
      subRequirements: 5,
      testProcedures: 4,
      uncovered: 1,
      coveragePercent: "80%",
    },
    {
      name: "Hardware",
      subRequirements: 3,
      testProcedures: 3,
      uncovered: 0,
      coveragePercent: "100%",
    },
  ],
};

// ─── buildTraceabilityDiagram ───────────────────────────

describe("buildTraceabilityDiagram", () => {
  it("produces identical output on repeated calls (summary)", () => {
    const result1 = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "summary");
    const result2 = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "summary");
    expect(result1).toBe(result2);
  });

  it("produces identical output on repeated calls (detailed)", () => {
    const result1 = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "detailed");
    const result2 = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "detailed");
    expect(result1).toBe(result2);
  });

  it("starts with flowchart LR", () => {
    const result = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "summary");
    expect(result).toMatch(/^flowchart LR/);
  });

  it("includes PR node with correct label", () => {
    const result = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "summary");
    expect(result).toContain('pr_PR001["PR-001 Pokemon Scanner Module"]');
  });

  it("includes SR node with team name", () => {
    const result = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "summary");
    expect(result).toContain('sr_SR1["SR-1 Visual Recognition Firmware"]');
  });

  it("includes TP node", () => {
    const result = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "summary");
    expect(result).toContain('tp_TP1["TP-1 Scanner Accuracy"]');
  });

  it("includes summary node with counts in summary mode", () => {
    const result = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "summary");
    expect(result).toContain("Passed 2");
    expect(result).toContain("Failed 1");
    expect(result).toContain("Skipped 0");
    expect(result).toContain("Pending 0");
  });

  it("includes classDef for failed summary", () => {
    const result = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "summary");
    expect(result).toContain("classDef hasFailed");
    expect(result).toContain("#DC2626"); // red
  });

  it("includes individual TC nodes in detailed mode", () => {
    const result = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "detailed");
    expect(result).toContain("TC-1 Daylight Scan");
    expect(result).toContain("TC-2 Low Light Scan");
    expect(result).toContain("TC-3 Motion Scan");
    expect(result).toContain("PASSED");
    expect(result).toContain("FAILED");
  });

  it("does not include classDef in detailed mode", () => {
    const result = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "detailed");
    expect(result).not.toContain("classDef");
  });

  it("renders empty state for SR with no TPs", () => {
    const result = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "summary");
    expect(result).toContain("No test procedures");
  });

  it("renders truncation indicator when totalTestCases exceeds array", () => {
    const data: TraceabilityData = {
      requirements: [
        {
          id: "PR-001",
          title: "Test",
          status: "DRAFT",
          totalSubRequirements: 1,
          subRequirements: [
            {
              id: "SR-1",
              title: "Sub",
              status: "DRAFT",
              teamName: "Team",
              totalTestProcedures: 1,
              testProcedures: [
                {
                  id: "TP-1",
                  title: "Proc",
                  status: "ACTIVE",
                  totalTestCases: 10,
                  testCases: [
                    { id: "TC-1", title: "Case 1", status: "PASSED" },
                    { id: "TC-2", title: "Case 2", status: "PENDING" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const result = buildTraceabilityDiagram(data, "detailed");
    expect(result).toContain("+8 more");
  });

  it("handles empty requirements array", () => {
    const data: TraceabilityData = { requirements: [] };
    const result = buildTraceabilityDiagram(data, "summary");
    // Empty data produces just the header + edge separator
    expect(result).toMatch(/^flowchart LR\n/);
  });

  it("sorts entities by ID naturally (SR-2 before SR-10)", () => {
    const data: TraceabilityData = {
      requirements: [
        {
          id: "PR-001",
          title: "Test",
          status: "DRAFT",
          totalSubRequirements: 2,
          subRequirements: [
            {
              id: "SR-10",
              title: "Tenth",
              status: "DRAFT",
              teamName: "A",
              totalTestProcedures: 0,
              testProcedures: [],
            },
            {
              id: "SR-2",
              title: "Second",
              status: "DRAFT",
              teamName: "B",
              totalTestProcedures: 0,
              testProcedures: [],
            },
          ],
        },
      ],
    };
    const result = buildTraceabilityDiagram(data, "summary");
    const sr2Pos = result.indexOf("SR-2");
    const sr10Pos = result.indexOf("SR-10");
    expect(sr2Pos).toBeLessThan(sr10Pos);
  });
});

// ─── buildStatusDistributionDiagram ─────────────────────

describe("buildStatusDistributionDiagram", () => {
  it("produces identical output on repeated calls", () => {
    const result1 = buildStatusDistributionDiagram(STATUS_FIXTURE);
    const result2 = buildStatusDistributionDiagram(STATUS_FIXTURE);
    expect(result1).toBe(result2);
  });

  it("starts with flowchart LR", () => {
    const result = buildStatusDistributionDiagram(STATUS_FIXTURE);
    expect(result).toMatch(/^flowchart LR/);
  });

  it("includes entity type label", () => {
    const result = buildStatusDistributionDiagram(STATUS_FIXTURE);
    expect(result).toContain("Product Requirements");
  });

  it("includes all status counts", () => {
    const result = buildStatusDistributionDiagram(STATUS_FIXTURE);
    expect(result).toContain("DRAFT: 3");
    expect(result).toContain("APPROVED: 5");
    expect(result).toContain("CANCELED: 1");
  });

  it("renders statuses in canonical order", () => {
    const result = buildStatusDistributionDiagram(STATUS_FIXTURE);
    const draftPos = result.indexOf("DRAFT");
    const approvedPos = result.indexOf("APPROVED");
    const canceledPos = result.indexOf("CANCELED");
    expect(draftPos).toBeLessThan(approvedPos);
    expect(approvedPos).toBeLessThan(canceledPos);
  });

  it("includes classDef with correct colors", () => {
    const result = buildStatusDistributionDiagram(STATUS_FIXTURE);
    expect(result).toContain("statusGreen");
    expect(result).toContain("statusGray");
    expect(result).toContain("statusRed");
  });
});

// ─── buildTeamCoverageDiagram ───────────────────────────

describe("buildTeamCoverageDiagram", () => {
  it("produces identical output on repeated calls", () => {
    const result1 = buildTeamCoverageDiagram(COVERAGE_FIXTURE);
    const result2 = buildTeamCoverageDiagram(COVERAGE_FIXTURE);
    expect(result1).toBe(result2);
  });

  it("starts with flowchart LR", () => {
    const result = buildTeamCoverageDiagram(COVERAGE_FIXTURE);
    expect(result).toMatch(/^flowchart LR/);
  });

  it("includes team names", () => {
    const result = buildTeamCoverageDiagram(COVERAGE_FIXTURE);
    expect(result).toContain("Firmware");
    expect(result).toContain("Hardware");
  });

  it("includes coverage metrics", () => {
    const result = buildTeamCoverageDiagram(COVERAGE_FIXTURE);
    expect(result).toContain("SRs: 5");
    expect(result).toContain("TPs: 4");
    expect(result).toContain("Uncovered: 1");
    expect(result).toContain("Coverage: 80%");
  });

  it("sorts teams alphabetically", () => {
    const result = buildTeamCoverageDiagram(COVERAGE_FIXTURE);
    const firmwarePos = result.indexOf("Firmware");
    const hardwarePos = result.indexOf("Hardware");
    expect(firmwarePos).toBeLessThan(hardwarePos);
  });

  it("uses red classDef for teams with uncovered SRs", () => {
    const result = buildTeamCoverageDiagram(COVERAGE_FIXTURE);
    expect(result).toContain("coverageRed");
  });

  it("uses green classDef for fully covered teams", () => {
    const result = buildTeamCoverageDiagram(COVERAGE_FIXTURE);
    expect(result).toContain("coverageGreen");
  });

  it("handles empty teams array", () => {
    const data: TeamCoverageData = { teams: [] };
    const result = buildTeamCoverageDiagram(data);
    expect(result).toMatch(/^flowchart LR/);
  });
});

// ─── Shuffle-input determinism ──────────────────────────

describe("shuffle-input determinism", () => {
  it("produces same output regardless of input order (traceability)", () => {
    const data: TraceabilityData = {
      requirements: [
        {
          id: "PR-001",
          title: "A",
          status: "DRAFT",
          totalSubRequirements: 3,
          subRequirements: [
            { id: "SR-3", title: "Third", status: "DRAFT", teamName: "C", totalTestProcedures: 0, testProcedures: [] },
            { id: "SR-1", title: "First", status: "DRAFT", teamName: "A", totalTestProcedures: 0, testProcedures: [] },
            { id: "SR-2", title: "Second", status: "DRAFT", teamName: "B", totalTestProcedures: 0, testProcedures: [] },
          ],
        },
      ],
    };
    const shuffled: TraceabilityData = {
      requirements: [
        {
          ...data.requirements[0],
          subRequirements: [
            data.requirements[0].subRequirements[1], // SR-1
            data.requirements[0].subRequirements[2], // SR-2
            data.requirements[0].subRequirements[0], // SR-3
          ],
        },
      ],
    };
    const result1 = buildTraceabilityDiagram(data, "summary");
    const result2 = buildTraceabilityDiagram(shuffled, "summary");
    expect(result1).toBe(result2);
  });

  it("produces same output regardless of team order (coverage)", () => {
    const data: TeamCoverageData = {
      teams: [
        { name: "Zebra", subRequirements: 1, testProcedures: 1, uncovered: 0, coveragePercent: "100%" },
        { name: "Alpha", subRequirements: 2, testProcedures: 1, uncovered: 1, coveragePercent: "50%" },
      ],
    };
    const shuffled: TeamCoverageData = {
      teams: [data.teams[1], data.teams[0]],
    };
    const result1 = buildTeamCoverageDiagram(data);
    const result2 = buildTeamCoverageDiagram(shuffled);
    expect(result1).toBe(result2);
  });
});

// ─── Pathological label escaping ────────────────────────

describe("escapeMermaidLabel edge cases", () => {
  it("strips semicolons", () => {
    expect(escapeMermaidLabel("Step 1; Step 2")).toBe("Step 1 Step 2");
  });

  it("strips backticks", () => {
    expect(escapeMermaidLabel("Use `code` here")).toBe("Use code here");
  });

  it("collapses whitespace and trims", () => {
    expect(escapeMermaidLabel("  Hello   World  ")).toBe("Hello World");
  });

  it("normalizes newlines and tabs", () => {
    expect(escapeMermaidLabel("Line1\nLine2\tLine3")).toBe("Line1 Line2 Line3");
  });

  it("handles all special chars combined", () => {
    const input = '`Test; (v2) [draft] {x} | "A" --> B`';
    const result = escapeMermaidLabel(input);
    // Semicolons only appear inside &quot; entities (which is safe)
    expect(result.replace(/&quot;/g, "")).not.toContain(";");
    expect(result).not.toContain("`");
    expect(result).not.toContain("[");
    expect(result).not.toContain("(");
    expect(result).not.toContain("|");
    expect(result).toContain("&quot;");
  });
});

// ─── Quoted label contract ──────────────────────────────

describe("quoted label contract", () => {
  it("all traceability nodes use double-quoted labels", () => {
    const result = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "summary");
    // Every node definition should use ["..."] form
    const nodeLines = result.split("\n").filter((l) => l.match(/^\s+\w+\["/));
    expect(nodeLines.length).toBeGreaterThan(0);
    for (const line of nodeLines) {
      expect(line).toMatch(/\["[^"]*"\]/);
    }
  });

  it("no raw UUIDs appear in traceability labels", () => {
    const result = buildTraceabilityDiagram(TRACEABILITY_FIXTURE, "detailed");
    // UUIDs are 36 chars with hyphens: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    expect(result).not.toMatch(uuidPattern);
  });
});

// ─── Node budget guard ──────────────────────────────────

describe("MAX_DIAGRAM_NODES guard", () => {
  it("falls back to summary when detailed mode exceeds budget", () => {
    // Create data that would produce > MAX_DIAGRAM_NODES in detailed mode
    const bigData: TraceabilityData = {
      requirements: Array.from({ length: 5 }, (_, i) => ({
        id: `PR-${String(i + 1).padStart(3, "0")}`,
        title: `Req ${i + 1}`,
        status: "APPROVED",
        totalSubRequirements: 10,
        subRequirements: Array.from({ length: 10 }, (_, j) => ({
          id: `SR-${i * 10 + j + 1}`,
          title: `Sub ${j + 1}`,
          status: "APPROVED",
          teamName: "Team",
          totalTestProcedures: 3,
          testProcedures: Array.from({ length: 3 }, (_, k) => ({
            id: `TP-${i * 30 + j * 3 + k + 1}`,
            title: `Proc ${k + 1}`,
            status: "ACTIVE",
            totalTestCases: 2,
            testCases: [
              { id: `TC-${i * 60 + j * 6 + k * 2 + 1}`, title: "TC A", status: "PASSED" },
              { id: `TC-${i * 60 + j * 6 + k * 2 + 2}`, title: "TC B", status: "FAILED" },
            ],
          })),
        })),
      })),
    };

    const result = buildTraceabilityDiagram(bigData, "detailed");
    // Should contain summary nodes (rolled up) instead of individual TC nodes
    expect(result).toContain("Passed");
    expect(result).toContain("Failed");
    // Should contain budget exceeded note
    expect(result).toContain(`exceeds ${MAX_DIAGRAM_NODES} node limit`);
  });
});

// ─── buildMultiStatusDiagram ────────────────────────────

describe("buildMultiStatusDiagram", () => {
  const MULTI_FIXTURE: StatusDistributionData[] = [
    { entityType: "Product Requirements", statusCounts: [{ status: "DRAFT", count: 2 }, { status: "APPROVED", count: 5 }] },
    { entityType: "Sub-Requirements", statusCounts: [{ status: "DRAFT", count: 3 }, { status: "CANCELED", count: 1 }] },
  ];

  it("produces identical output on repeated calls", () => {
    const result1 = buildMultiStatusDiagram(MULTI_FIXTURE);
    const result2 = buildMultiStatusDiagram(MULTI_FIXTURE);
    expect(result1).toBe(result2);
  });

  it("starts with flowchart LR", () => {
    const result = buildMultiStatusDiagram(MULTI_FIXTURE);
    expect(result).toMatch(/^flowchart LR/);
  });

  it("includes subgraph sections for each entity type", () => {
    const result = buildMultiStatusDiagram(MULTI_FIXTURE);
    expect(result).toContain('subgraph "Product Requirements"');
    expect(result).toContain('subgraph "Sub-Requirements"');
    expect(result).toContain("end");
  });

  it("uses prefixed node IDs to avoid collisions", () => {
    const result = buildMultiStatusDiagram(MULTI_FIXTURE);
    expect(result).toContain("g0_entity");
    expect(result).toContain("g1_entity");
    expect(result).toContain("g0_DRAFT");
    expect(result).toContain("g1_DRAFT");
  });

  it("hoists classDef definitions outside subgraphs", () => {
    const result = buildMultiStatusDiagram(MULTI_FIXTURE);
    const lines = result.split("\n");
    // classDef lines should appear after all "end" lines
    const lastEnd = lines.lastIndexOf("  end");
    const firstClassDef = lines.findIndex((l) => l.includes("classDef"));
    expect(firstClassDef).toBeGreaterThan(lastEnd);
  });
});
