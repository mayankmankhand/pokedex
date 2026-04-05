// Shared Prisma query helpers used by both read tools and UI intent tools.
// Extracts common fetch logic so we don't duplicate queries.
// Each function returns a compact, structured payload.

import { prisma, ACTIVE_ATTACHMENT_FILTER } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Editable fields + available actions helpers for detail payloads
// ---------------------------------------------------------------------------

type EditableField = {
  key: string;
  label: string;
  value: string;
  fieldType: "text" | "textarea";
};

type ActionMeta = {
  action: string;
  label: string;
  requiresConfirmation: boolean;
  variant: "default" | "destructive";
};

/** Determine which fields are editable based on entity type and status. */
export function computeEditableFields(
  entityType: string,
  status: string,
  entity: { title?: string; description?: string | null },
): EditableField[] | undefined {
  const title: EditableField = {
    key: "title",
    label: "Title",
    value: entity.title ?? "",
    fieldType: "text",
  };
  const description: EditableField = {
    key: "description",
    label: "Description",
    value: entity.description ?? "",
    fieldType: "textarea",
  };

  switch (entityType) {
    case "ProductRequirement":
    case "SubRequirement":
      if (status === "DRAFT" || status === "APPROVED") return [title, description];
      return undefined;
    case "TestProcedure":
      if (status === "ACTIVE") return [title];
      return undefined;
    case "TestProcedureVersion":
      if (status === "DRAFT") return [description];
      if (status === "APPROVED") return [description];
      return undefined;
    case "TestCase":
      if (status === "PENDING") return [title, description];
      return undefined;
    default:
      return undefined;
  }
}

/** Determine which lifecycle actions are available based on entity type and status. */
export function computeAvailableActions(
  entityType: string,
  status: string,
): ActionMeta[] | undefined {
  const approve: ActionMeta = { action: "approve", label: "Approve", requiresConfirmation: true, variant: "default" };
  const cancel: ActionMeta = { action: "cancel", label: "Cancel", requiresConfirmation: true, variant: "destructive" };
  const reactivate: ActionMeta = { action: "reactivate", label: "Reactivate", requiresConfirmation: true, variant: "default" };
  const skip: ActionMeta = { action: "skip", label: "Skip", requiresConfirmation: true, variant: "destructive" };
  const correct: ActionMeta = { action: "correct", label: "Correct Result", requiresConfirmation: true, variant: "default" };
  const reExecute: ActionMeta = { action: "re-execute", label: "Re-execute", requiresConfirmation: true, variant: "default" };

  switch (entityType) {
    case "ProductRequirement":
    case "SubRequirement":
      if (status === "DRAFT") return [approve, cancel];
      if (status === "APPROVED") return [cancel];
      if (status === "CANCELED") return [reactivate];
      return undefined;
    case "TestProcedure":
      if (status === "ACTIVE") return [cancel];
      if (status === "CANCELED") return [reactivate];
      return undefined;
    case "TestProcedureVersion":
      if (status === "DRAFT") return [approve];
      return undefined;
    case "TestCase":
      if (status === "PENDING") return [skip];
      if (status === "PASSED" || status === "FAILED" || status === "BLOCKED") return [correct, reExecute];
      return undefined;
    default:
      return undefined;
  }
}

// Shared attachment select block used by all entity fetch functions.
// fileUrl is deliberately excluded - no blob storage in V1, avoid leaking stub URLs.
const ATTACHMENT_SELECT = {
  where: ACTIVE_ATTACHMENT_FILTER,
  select: {
    id: true,
    fileName: true,
    fileType: true,
    createdAt: true,
    uploader: { select: { name: true } },
  },
  take: 20,
  orderBy: { createdAt: "desc" as const },
};

/**
 * Fetch a product requirement with sub-requirements and attachments.
 * Used by getProductRequirement (read tool) and showEntityDetail (UI intent).
 */
export async function fetchProductRequirement(id: string) {
  return prisma.productRequirement.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
      createdBy: true,
      subRequirements: {
        select: {
          id: true,
          title: true,
          status: true,
          teamId: true,
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      },
      attachments: ATTACHMENT_SELECT,
    },
  });
}

/**
 * Fetch a sub-requirement with parent and test procedures.
 */
export async function fetchSubRequirement(id: string) {
  return prisma.subRequirement.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
      productRequirementId: true,
      teamId: true,
      productRequirement: {
        select: { id: true, title: true, status: true },
      },
      team: {
        select: { id: true, name: true },
      },
      testProcedures: {
        select: {
          id: true,
          title: true,
          status: true,
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      },
      attachments: ATTACHMENT_SELECT,
    },
  });
}

/**
 * Fetch a test procedure with version history.
 */
export async function fetchTestProcedure(id: string) {
  return prisma.testProcedure.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      subRequirementId: true,
      createdAt: true,
      subRequirement: {
        select: { id: true, title: true, status: true },
      },
      versions: {
        select: {
          id: true,
          versionNumber: true,
          description: true,
          status: true,
          createdAt: true,
        },
        orderBy: { versionNumber: "desc" },
        take: 10,
      },
      attachments: ATTACHMENT_SELECT,
    },
  });
}

/**
 * Fetch a test procedure version with test cases.
 */
export async function fetchTestProcedureVersion(id: string) {
  return prisma.testProcedureVersion.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      versionNumber: true,
      description: true,
      steps: true,
      status: true,
      createdAt: true,
      testProcedure: {
        select: { id: true, title: true },
      },
      testCases: {
        select: {
          id: true,
          title: true,
          status: true,
          result: true,
        },
        take: 15,
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

/**
 * Fetch a test case with parent version info.
 */
export async function fetchTestCase(id: string) {
  return prisma.testCase.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      result: true,
      notes: true,
      executedBy: true,
      executedAt: true,
      testProcedureVersionId: true,
      testProcedureVersion: {
        select: {
          id: true,
          versionNumber: true,
          status: true,
          testProcedure: {
            select: { id: true, title: true },
          },
        },
      },
      attachments: ATTACHMENT_SELECT,
    },
  });
}

/**
 * Fetch audit log entries for panel display.
 * Unlike the query tool version, this includes the changes JSON
 * since the panel renders directly without LLM context cost.
 */
export async function fetchAuditLogForPanel(filters: {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  limit: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.actorId) where.actorId = filters.actorId;

  return prisma.auditLog.findMany({
    where,
    take: filters.limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      changes: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Diagram template helpers
// ---------------------------------------------------------------------------

// Import types from diagram-templates (single source of truth for diagram shapes)
import type {
  TraceabilityData,
  TeamCoverageData,
  StatusDistributionData,
} from "@/lib/ai/diagram-templates";

/**
 * Fetch the PR -> SR -> TP -> TC hierarchy shaped for diagram templates.
 * If requirementId is provided, fetches that single PR's tree.
 * If omitted, fetches ALL product requirements with their trees.
 *
 * UUIDs are replaced with human-readable sequential IDs (PR-001, SR-1, etc.)
 * and test cases are flattened across versions into a single array per TP.
 */
export async function fetchTraceabilityForDiagram(
  requirementId?: string,
): Promise<TraceabilityData> {
  const prSelect = {
    id: true,
    title: true,
    status: true,
    subRequirements: {
      select: {
        id: true,
        title: true,
        status: true,
        team: { select: { name: true } },
        testProcedures: {
          select: {
            id: true,
            title: true,
            status: true,
            versions: {
              select: {
                testCases: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                  },
                  take: 5,
                  orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] as Array<Record<string, "asc">>,
                },
                _count: { select: { testCases: true } },
              },
              orderBy: { versionNumber: "desc" as const },
              take: 3,
            },
            _count: { select: { versions: true } },
          },
          take: 10,
          orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] as Array<Record<string, "asc">>,
        },
        _count: { select: { testProcedures: true } },
      },
      take: 20,
      orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] as Array<Record<string, "asc">>,
    },
    _count: { select: { subRequirements: true } },
  };

  const rawPrs = requirementId
    ? [
        await prisma.productRequirement.findUniqueOrThrow({
          where: { id: requirementId },
          select: prSelect,
        }),
      ]
    : await prisma.productRequirement.findMany({
        select: prSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

  // Sequential ID counters - reset per call for determinism
  let prCounter = 0;
  let srCounter = 0;
  let tpCounter = 0;
  let tcCounter = 0;

  const requirements = rawPrs.map((pr) => {
    prCounter++;
    const prId = `PR-${String(prCounter).padStart(3, "0")}`;

    const subRequirements = pr.subRequirements.map((sr) => {
      srCounter++;
      const srId = `SR-${srCounter}`;

      const testProcedures = sr.testProcedures.map((tp) => {
        tpCounter++;
        const tpId = `TP-${tpCounter}`;

        // Flatten test cases across all versions into one array
        const seenTcIds = new Set<string>();
        const flatTestCases: Array<{
          id: string;
          title: string;
          status: string;
        }> = [];

        for (const ver of tp.versions) {
          for (const tc of ver.testCases) {
            if (!seenTcIds.has(tc.id)) {
              seenTcIds.add(tc.id);
              tcCounter++;
              flatTestCases.push({
                id: `TC-${tcCounter}`,
                title: tc.title,
                status: tc.status,
              });
            }
          }
        }

        // Use distinct count from the dedup set for accurate TC totals.
        // The raw _count.testCases sum across versions can double-count TCs
        // that appear in multiple versions, causing false "+N more" indicators.
        // Note: TCs on unfetched older versions (beyond take: 3) are not counted,
        // which is acceptable since the diagram only shows fetched data.
        const totalTestCases = seenTcIds.size;

        return {
          id: tpId,
          title: tp.title,
          status: tp.status,
          testCases: flatTestCases,
          totalTestCases,
        };
      });

      return {
        id: srId,
        title: sr.title,
        status: sr.status,
        teamName: sr.team?.name ?? "Unassigned",
        testProcedures,
        totalTestProcedures: sr._count.testProcedures,
      };
    });

    return {
      id: prId,
      title: pr.title,
      status: pr.status,
      subRequirements,
      totalSubRequirements: pr._count.subRequirements,
    };
  });

  return { requirements };
}

// StatusDistributionData type imported from diagram-templates above.
// fetchStatusDistribution returns an array of entries matching that shape.

/**
 * Count entities grouped by status for diagram templates.
 * If entityType is provided, only count that type.
 * If omitted, count all four entity types.
 * Uses $transaction for snapshot consistency.
 */
export async function fetchStatusDistribution(
  entityType?: "PR" | "SR" | "TP" | "TC",
): Promise<StatusDistributionData[]> {
  const labels: Record<string, string> = {
    PR: "Product Requirements",
    SR: "Sub-Requirements",
    TP: "Test Procedures",
    TC: "Test Cases",
  };

  const keys = entityType ? [entityType] : (["PR", "SR", "TP", "TC"] as const);

  // Build PrismaPromise array for $transaction
  const queryForKey = (k: string) => {
    switch (k) {
      case "PR":
        return prisma.productRequirement.groupBy({
          by: ["status"],
          _count: { _all: true },
        });
      case "SR":
        return prisma.subRequirement.groupBy({
          by: ["status"],
          _count: { _all: true },
        });
      case "TP":
        return prisma.testProcedure.groupBy({
          by: ["status"],
          _count: { _all: true },
        });
      case "TC":
        return prisma.testCase.groupBy({
          by: ["status"],
          _count: { _all: true },
        });
      default:
        throw new Error(`Unknown entity type: ${k}`);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = await prisma.$transaction(keys.map((k) => queryForKey(k)) as any[]);

  return keys.map((k, i) => ({
    entityType: labels[k],
    statusCounts: (
      results[i] as Array<{ status: string; _count: { _all: number } }>
    ).map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
  }));
}

// TeamCoverageData type imported from diagram-templates above.

/**
 * Fetch team coverage data for diagram templates.
 * Counts sub-requirements, test procedures, and uncovered SRs per team.
 * Same calculation logic as the coverageByTeam showTable query.
 */
export async function fetchTeamCoverage(): Promise<TeamCoverageData> {
  const rawTeams = await prisma.team.findMany({
    select: {
      name: true,
      subRequirements: {
        select: {
          id: true,
          testProcedures: { select: { id: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const teams = rawTeams.map((team) => {
    const srCount = team.subRequirements.length;
    const tpCount = team.subRequirements.reduce(
      (sum, sr) => sum + sr.testProcedures.length,
      0,
    );
    const uncovered = team.subRequirements.filter(
      (sr) => sr.testProcedures.length === 0,
    ).length;
    const coveragePercent =
      srCount > 0
        ? Math.round(((srCount - uncovered) / srCount) * 100) + "%"
        : "-";

    return {
      name: team.name,
      subRequirements: srCount,
      testProcedures: tpCount,
      uncovered,
      coveragePercent,
    };
  });

  return { teams };
}
