// UI intent tools - these open the context panel in the chat UI.
// Unlike read tools (which fetch data silently for LLM reasoning),
// UI intent tools return structured payloads that the frontend
// renders in the context panel for the user to see.
//
// 8 tools: showEntityDetail, showTable, showDiagram, showAuditLog,
//           showTraceabilityDiagram, showStatusDiagram, showCoverageDiagram,
//           presentChoices

import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formatToolError } from "./tool-wrapper";
import { formatDate } from "@/lib/format-utils";
import { AuditEntityTypeEnum } from "@/schemas/query.schema";
import {
  fetchProductRequirement,
  fetchSubRequirement,
  fetchTestProcedure,
  fetchTestProcedureVersion,
  fetchTestCase,
  fetchAuditLogForPanel,
  fetchTraceabilityForDiagram,
  fetchStatusDistribution,
  fetchTeamCoverage,
  computeEditableFields,
  computeAvailableActions,
} from "./shared-queries";
import {
  buildTraceabilityDiagram,
  buildStatusDistributionDiagram,
  buildMultiStatusDiagram,
  buildTeamCoverageDiagram,
} from "@/lib/ai/diagram-templates";
import type { DetailPayload, TablePayload, DiagramPayload, AuditPayload } from "@/types/panel";

// Helper to format generation timestamp for diagram titles
function diagramTimestamp(): string {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Map Prisma attachment rows to the DetailPayload attachment shape.
function mapAttachments(
  attachments: Array<{ id: string; fileName: string; fileType: string; createdAt: Date; uploader: { name: string } }>
): Array<{ id: string; fileName: string; fileType: string; uploadedBy: string; createdAt: string }> {
  return attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    fileType: a.fileType,
    uploadedBy: a.uploader.name,
    createdAt: formatDate(a.createdAt),
  }));
}

// Normalize raw changes JSON from the database into typed change items.
// The changes column stores freeform JSON - this extracts field/old/new
// pairs and caps at 10 items. Malformed data collapses to empty array.
// Safely convert a value to a display string.
// Objects/arrays get JSON-stringified; null/undefined become "(none)".
function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return "(none)";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function normalizeChanges(raw: unknown): Array<{ field: string; old?: string; new?: string }> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];

  try {
    const entries = Object.entries(raw as Record<string, unknown>);
    return entries.slice(0, 10).map(([key, value]) => {
      // Handle { before: X, after: Y } shape (used by some services)
      if (value && typeof value === "object" && !Array.isArray(value) && ("before" in value || "after" in value)) {
        const v = value as Record<string, unknown>;
        return {
          field: key,
          ...(v.before !== undefined ? { old: toDisplayString(v.before) } : {}),
          ...(v.after !== undefined ? { new: toDisplayString(v.after) } : {}),
        };
      }
      // Simple key-value: treat as a new value
      return { field: key, new: toDisplayString(value) };
    });
  } catch {
    return [];
  }
}

export function createUIIntentTools() {
  return {
    // -- Show a single entity's detail in the context panel --
    showEntityDetail: tool({
      description:
        "Display an entity's details in the context panel. " +
        "Use this when the user says 'show me', 'pull up', or 'display' an entity. " +
        "Do NOT use read tools (getProductRequirement, etc.) for user-facing display - use this instead.",
      inputSchema: z.object({
        entityType: z.enum([
          "ProductRequirement",
          "SubRequirement",
          "TestProcedure",
          "TestProcedureVersion",
          "TestCase",
        ]).describe("Type of entity to display"),
        id: z.string().uuid().describe("ID of the entity"),
      }),
      execute: async (args): Promise<DetailPayload | { error: string }> => {
        try {
          switch (args.entityType) {
            case "ProductRequirement": {
              const data = await fetchProductRequirement(args.id);
              return {
                type: "detail" as const,
                entityType: args.entityType,
                entityId: data.id,
                title: data.title,
                fields: [
                  { label: "ID", value: data.id },
                  { label: "Status", value: data.status },
                  { label: "Description", value: data.description },
                  { label: "Created", value: formatDate(data.createdAt) },
                ],
                relatedEntities: data.subRequirements.map((sr) => ({
                  id: sr.id,
                  title: sr.title,
                  status: sr.status,
                  entityType: "SubRequirement",
                })),
                attachments: mapAttachments(data.attachments),
                editableFields: computeEditableFields(args.entityType, data.status, data),
                availableActions: computeAvailableActions(args.entityType, data.status),
              };
            }

            case "SubRequirement": {
              const data = await fetchSubRequirement(args.id);
              return {
                type: "detail" as const,
                entityType: args.entityType,
                entityId: data.id,
                title: data.title,
                fields: [
                  { label: "ID", value: data.id },
                  { label: "Status", value: data.status },
                  { label: "Description", value: data.description },
                  { label: "Team", value: data.team.name },
                  { label: "Parent Requirement", value: data.productRequirement.title },
                  { label: "Created", value: formatDate(data.createdAt) },
                ],
                relatedEntities: data.testProcedures.map((tp) => ({
                  id: tp.id,
                  title: tp.title,
                  status: tp.status,
                  entityType: "TestProcedure",
                })),
                attachments: mapAttachments(data.attachments),
                editableFields: computeEditableFields(args.entityType, data.status, data),
                availableActions: computeAvailableActions(args.entityType, data.status),
              };
            }

            case "TestProcedure": {
              const data = await fetchTestProcedure(args.id);
              return {
                type: "detail" as const,
                entityType: args.entityType,
                entityId: data.id,
                title: data.title,
                fields: [
                  { label: "ID", value: data.id },
                  { label: "Status", value: data.status },
                  { label: "Parent Sub-Requirement", value: data.subRequirement.title },
                  { label: "Created", value: formatDate(data.createdAt) },
                ],
                relatedEntities: data.versions.map((v) => ({
                  id: v.id,
                  title: `v${v.versionNumber}${v.description ? ` - ${v.description}` : ""}`,
                  status: v.status,
                  entityType: "TestProcedureVersion",
                })),
                attachments: mapAttachments(data.attachments),
                editableFields: computeEditableFields(args.entityType, data.status, data),
                availableActions: computeAvailableActions(args.entityType, data.status),
              };
            }

            // No attachments - TPV has no attachment FK (attachments belong to parent TestProcedure)
            case "TestProcedureVersion": {
              const data = await fetchTestProcedureVersion(args.id);
              return {
                type: "detail" as const,
                entityType: args.entityType,
                entityId: data.id,
                title: `${data.testProcedure.title} v${data.versionNumber}`,
                fields: [
                  { label: "ID", value: data.id },
                  { label: "Status", value: data.status },
                  { label: "Version", value: String(data.versionNumber) },
                  { label: "Description", value: data.description },
                  { label: "Steps", value: data.steps },
                  { label: "Procedure", value: data.testProcedure.title },
                  { label: "Created", value: formatDate(data.createdAt) },
                ],
                relatedEntities: data.testCases.map((tc) => ({
                  id: tc.id,
                  title: tc.title,
                  status: tc.status,
                  entityType: "TestCase",
                })),
                editableFields: computeEditableFields(args.entityType, data.status, data),
                availableActions: computeAvailableActions(args.entityType, data.status),
              };
            }

            case "TestCase": {
              const data = await fetchTestCase(args.id);
              const fields = [
                { label: "ID", value: data.id },
                { label: "Status", value: data.status },
                { label: "Description", value: data.description },
                { label: "Procedure", value: data.testProcedureVersion.testProcedure.title },
                { label: "Version", value: `v${data.testProcedureVersion.versionNumber}` },
              ];
              if (data.result) fields.push({ label: "Result", value: data.result });
              if (data.notes) fields.push({ label: "Notes", value: data.notes });
              if (data.executedAt) fields.push({ label: "Executed", value: formatDate(data.executedAt) });

              return {
                type: "detail" as const,
                entityType: args.entityType,
                entityId: data.id,
                title: data.title,
                fields,
                attachments: mapAttachments(data.attachments),
                editableFields: computeEditableFields(args.entityType, data.status, data),
                availableActions: computeAvailableActions(args.entityType, data.status),
              };
            }

            default: {
              // Exhaustive check - TypeScript will error if a new enum value is added
              // but not handled above.
              const _exhaustive: never = args.entityType;
              return { error: `ValidationError: Unknown entity type: ${_exhaustive}` };
            }
          }
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Show a table of query results in the context panel --
    showTable: tool({
      description:
        "Display a table of query results in the context panel. " +
        "Use this to show lists like uncovered sub-requirements, untested procedures, " +
        "search results, aggregations, or any entity list the user asks to see. " +
        "Results are capped at 15 rows. If isTruncated is true, tell the user more results exist " +
        "and suggest narrowing with filters (e.g. team).",
      inputSchema: z.object({
        queryType: z.enum([
          "uncoveredSubRequirements",
          "untestedProcedures",
          "allRequirements",
          "allSubRequirements",
          "allTestProcedures",
          "allTestCases",
          "searchResults",
          "testResultSummary",
          "coverageByTeam",
          "testCasesForRequirement",
        ]).describe("Which query to run"),
        searchQuery: z.string().trim().optional()
          .describe("Search term (only for searchResults queryType)"),
        entityType: z
          .enum(["ProductRequirement", "SubRequirement", "TestProcedure", "TestCase"])
          .optional()
          .describe("Entity type filter (only for searchResults queryType)"),
        team: z.string().trim().optional()
          .describe("Team name filter (for allSubRequirements, allTestProcedures)"),
        requirementId: z.string().uuid().optional()
          .describe("Product requirement ID (required for testCasesForRequirement). Use searchByTitle first if user gives a name."),
      }),
      execute: async (args): Promise<TablePayload | { error: string }> => {
        try {
          switch (args.queryType) {
            // ─── Existing queries (enriched with cross-entity columns) ───

            case "uncoveredSubRequirements": {
              const data = await prisma.subRequirement.findMany({
                where: { testProcedures: { none: {} } },
                select: {
                  id: true,
                  title: true,
                  status: true,
                  team: { select: { name: true } },
                  productRequirement: { select: { title: true, status: true } },
                },
                take: 16, // Fetch one extra to detect truncation
                orderBy: { createdAt: "desc" },
              });
              const isTruncated = data.length > 15;
              const rows = data.slice(0, 15);
              return {
                type: "table" as const,
                title: "Uncovered Sub-Requirements",
                columns: [
                  { key: "id", label: "ID" },
                  { key: "title", label: "Title" },
                  { key: "status", label: "Status" },
                  { key: "team", label: "Team" },
                  { key: "productRequirement", label: "Product Requirement" },
                  { key: "parentStatus", label: "PR Status" },
                ],
                rows: rows.map((d) => ({
                  id: d.id,
                  title: d.title,
                  status: d.status,
                  team: d.team.name,
                  productRequirement: d.productRequirement.title,
                  parentStatus: d.productRequirement.status,
                })),
                isTruncated,
                queryType: args.queryType,
                queryParams: {},
              };
            }

            case "untestedProcedures": {
              const data = await prisma.testProcedureVersion.findMany({
                where: { status: "APPROVED", testCases: { none: {} } },
                select: {
                  id: true,
                  versionNumber: true,
                  testProcedure: {
                    select: {
                      id: true,
                      title: true,
                      subRequirement: {
                        select: {
                          title: true,
                          team: { select: { name: true } },
                        },
                      },
                    },
                  },
                },
                take: 16,
                orderBy: { createdAt: "desc" },
              });
              const isTruncated = data.length > 15;
              const rows = data.slice(0, 15);
              return {
                type: "table" as const,
                title: "Untested Procedure Versions",
                columns: [
                  { key: "id", label: "ID" },
                  { key: "procedure", label: "Procedure" },
                  { key: "version", label: "Version" },
                  { key: "subRequirement", label: "Sub-Requirement" },
                  { key: "team", label: "Team" },
                ],
                rows: rows.map((d) => ({
                  id: d.testProcedure.id,
                  procedure: d.testProcedure.title,
                  version: `v${d.versionNumber}`,
                  subRequirement: d.testProcedure.subRequirement.title,
                  team: d.testProcedure.subRequirement.team.name,
                })),
                isTruncated,
                queryType: args.queryType,
                queryParams: {},
              };
            }

            case "allRequirements": {
              const data = await prisma.productRequirement.findMany({
                select: {
                  id: true,
                  title: true,
                  status: true,
                  createdAt: true,
                  creator: { select: { name: true } },
                },
                take: 16,
                orderBy: { createdAt: "desc" },
              });
              const isTruncated = data.length > 15;
              const rows = data.slice(0, 15);
              return {
                type: "table" as const,
                title: "Product Requirements",
                columns: [
                  { key: "id", label: "ID" },
                  { key: "title", label: "Title" },
                  { key: "status", label: "Status" },
                  { key: "created", label: "Created" },
                  { key: "createdBy", label: "Created By" },
                ],
                rows: rows.map((d) => ({
                  id: d.id,
                  title: d.title,
                  status: d.status,
                  created: formatDate(d.createdAt),
                  createdBy: d.creator.name,
                })),
                isTruncated,
                queryType: args.queryType,
                queryParams: {},
              };
            }

            case "allSubRequirements": {
              // Optional team filter - case-insensitive partial match
              const where = args.team
                ? { team: { name: { contains: args.team, mode: "insensitive" as const } } }
                : {};
              const data = await prisma.subRequirement.findMany({
                where,
                select: {
                  id: true,
                  title: true,
                  status: true,
                  team: { select: { name: true } },
                  productRequirement: { select: { title: true, status: true } },
                  creator: { select: { name: true } },
                },
                take: 16,
                orderBy: { createdAt: "desc" },
              });
              const isTruncated = data.length > 15;
              const rows = data.slice(0, 15);
              return {
                type: "table" as const,
                title: args.team ? `Sub-Requirements - ${args.team}` : "Sub-Requirements",
                columns: [
                  { key: "id", label: "ID" },
                  { key: "title", label: "Title" },
                  { key: "status", label: "Status" },
                  { key: "team", label: "Team" },
                  { key: "productRequirement", label: "Product Requirement" },
                  { key: "parentStatus", label: "PR Status" },
                  { key: "createdBy", label: "Created By" },
                ],
                rows: rows.map((d) => ({
                  id: d.id,
                  title: d.title,
                  status: d.status,
                  team: d.team.name,
                  productRequirement: d.productRequirement.title,
                  parentStatus: d.productRequirement.status,
                  createdBy: d.creator.name,
                })),
                isTruncated,
                queryType: args.queryType,
                queryParams: { ...(args.team && { team: args.team }) },
              };
            }

            case "allTestProcedures": {
              // Optional team filter via sub-requirement's team
              const where = args.team
                ? { subRequirement: { team: { name: { contains: args.team, mode: "insensitive" as const } } } }
                : {};
              const data = await prisma.testProcedure.findMany({
                where,
                select: {
                  id: true,
                  title: true,
                  status: true,
                  creator: { select: { name: true } },
                  subRequirement: {
                    select: {
                      title: true,
                      team: { select: { name: true } },
                      productRequirement: { select: { title: true } },
                    },
                  },
                },
                take: 16,
                orderBy: { createdAt: "desc" },
              });
              const isTruncated = data.length > 15;
              const rows = data.slice(0, 15);
              return {
                type: "table" as const,
                title: args.team ? `Test Procedures - ${args.team}` : "Test Procedures",
                columns: [
                  { key: "id", label: "ID" },
                  { key: "title", label: "Title" },
                  { key: "status", label: "Status" },
                  { key: "subRequirement", label: "Sub-Requirement" },
                  { key: "team", label: "Team" },
                  { key: "productRequirement", label: "Product Requirement" },
                  { key: "createdBy", label: "Created By" },
                ],
                rows: rows.map((d) => ({
                  id: d.id,
                  title: d.title,
                  status: d.status,
                  subRequirement: d.subRequirement.title,
                  team: d.subRequirement.team.name,
                  productRequirement: d.subRequirement.productRequirement.title,
                  createdBy: d.creator.name,
                })),
                isTruncated,
                queryType: args.queryType,
                queryParams: { ...(args.team && { team: args.team }) },
              };
            }

            case "allTestCases": {
              const data = await prisma.testCase.findMany({
                select: {
                  id: true,
                  title: true,
                  status: true,
                  result: true,
                  executedAt: true,
                  executor: { select: { name: true } },
                  testProcedureVersion: {
                    select: {
                      testProcedure: {
                        select: {
                          title: true,
                          subRequirement: { select: { title: true } },
                        },
                      },
                    },
                  },
                },
                take: 16,
                orderBy: { createdAt: "desc" },
              });
              const isTruncated = data.length > 15;
              const rows = data.slice(0, 15);
              return {
                type: "table" as const,
                title: "Test Cases",
                columns: [
                  { key: "id", label: "ID" },
                  { key: "title", label: "Title" },
                  { key: "status", label: "Status" },
                  { key: "result", label: "Result" },
                  { key: "procedure", label: "Procedure" },
                  { key: "subRequirement", label: "Sub-Requirement" },
                  { key: "executedBy", label: "Executed By" },
                  { key: "executedAt", label: "Executed" },
                ],
                rows: rows.map((d) => ({
                  id: d.id,
                  title: d.title,
                  status: d.status,
                  result: d.result ?? "-",
                  procedure: d.testProcedureVersion.testProcedure.title,
                  subRequirement: d.testProcedureVersion.testProcedure.subRequirement.title,
                  executedBy: d.executor?.name ?? "-",
                  executedAt: d.executedAt ? formatDate(d.executedAt) : "-",
                })),
                isTruncated,
                queryType: args.queryType,
                queryParams: {},
              };
            }

            case "searchResults": {
              if (!args.searchQuery) {
                return { error: "ValidationError: searchQuery is required for searchResults queryType" };
              }
              const filter = {
                title: { contains: args.searchQuery, mode: "insensitive" as const },
              };
              const types = args.entityType
                ? [args.entityType]
                : ["ProductRequirement", "SubRequirement", "TestProcedure", "TestCase"];

              // Run queries in parallel but collect into separate arrays.
              // Then flatten in a fixed type order for deterministic results.
              const [reqs, subs, procs, cases] = await Promise.all([
                types.includes("ProductRequirement")
                  ? prisma.productRequirement.findMany({
                      where: filter,
                      select: { id: true, title: true, status: true },
                      take: 5,
                      orderBy: { createdAt: "desc" },
                    })
                  : Promise.resolve([]),
                types.includes("SubRequirement")
                  ? prisma.subRequirement.findMany({
                      where: filter,
                      select: { id: true, title: true, status: true },
                      take: 5,
                      orderBy: { createdAt: "desc" },
                    })
                  : Promise.resolve([]),
                types.includes("TestProcedure")
                  ? prisma.testProcedure.findMany({
                      where: filter,
                      select: { id: true, title: true, status: true },
                      take: 5,
                      orderBy: { createdAt: "desc" },
                    })
                  : Promise.resolve([]),
                types.includes("TestCase")
                  ? prisma.testCase.findMany({
                      where: filter,
                      select: { id: true, title: true, status: true },
                      take: 5,
                      orderBy: { createdAt: "desc" },
                    })
                  : Promise.resolve([]),
              ]);

              // Flatten in fixed order: Requirements, Sub-Reqs, Procedures, Test Cases
              const allRows: Record<string, unknown>[] = [
                ...reqs.map((d) => ({ id: d.id, type: "Requirement", entityType: "ProductRequirement", title: d.title, status: d.status })),
                ...subs.map((d) => ({ id: d.id, type: "Sub-Req", entityType: "SubRequirement", title: d.title, status: d.status })),
                ...procs.map((d) => ({ id: d.id, type: "Procedure", entityType: "TestProcedure", title: d.title, status: d.status })),
                ...cases.map((d) => ({ id: d.id, type: "Test Case", entityType: "TestCase", title: d.title, status: d.status })),
              ];
              const isTruncated = allRows.length > 15;

              return {
                type: "table" as const,
                title: `Search: "${args.searchQuery}"`,
                columns: [
                  { key: "id", label: "ID" },
                  { key: "type", label: "Type" },
                  { key: "title", label: "Title" },
                  { key: "status", label: "Status" },
                ],
                rows: allRows.slice(0, 15),
                isTruncated,
                queryType: args.queryType,
                queryParams: {
                  searchQuery: args.searchQuery,
                  ...(args.entityType && { entityType: args.entityType }),
                },
              };
            }

            // ─── New aggregation queries (Issue #24) ─────────────────

            case "testResultSummary": {
              // Pass/fail/blocked/skipped/pending counts grouped by procedure.
              // Only includes ACTIVE procedures (CANCELED ones are excluded).
              // Sorted by failed DESC to surface most-problematic procedures first.
              const procedures = await prisma.testProcedure.findMany({
                where: { status: "ACTIVE" },
                select: {
                  title: true,
                  subRequirement: {
                    select: {
                      title: true,
                      team: { select: { name: true } },
                    },
                  },
                  versions: {
                    select: {
                      testCases: {
                        select: { status: true },
                      },
                    },
                  },
                },
                orderBy: { createdAt: "desc" },
              });

              // Aggregate test case statuses per procedure
              const summaryRows = procedures.map((p) => {
                const counts = { passed: 0, failed: 0, blocked: 0, skipped: 0, pending: 0 };
                for (const v of p.versions) {
                  for (const tc of v.testCases) {
                    if (tc.status === "PASSED") counts.passed++;
                    else if (tc.status === "FAILED") counts.failed++;
                    else if (tc.status === "BLOCKED") counts.blocked++;
                    else if (tc.status === "SKIPPED") counts.skipped++;
                    else counts.pending++;
                  }
                }
                const total = counts.passed + counts.failed + counts.blocked + counts.skipped + counts.pending;
                return {
                  procedure: p.title,
                  subRequirement: p.subRequirement.title,
                  team: p.subRequirement.team.name,
                  passed: counts.passed,
                  failed: counts.failed,
                  blocked: counts.blocked,
                  skipped: counts.skipped,
                  pending: counts.pending,
                  total,
                };
              });

              // Sort by failed count DESC, then total DESC
              summaryRows.sort((a, b) => b.failed - a.failed || b.total - a.total);
              const isTruncated = summaryRows.length > 15;

              return {
                type: "table" as const,
                title: "Test Result Summary by Procedure",
                columns: [
                  { key: "procedure", label: "Procedure" },
                  { key: "subRequirement", label: "Sub-Requirement" },
                  { key: "team", label: "Team" },
                  { key: "passed", label: "Passed" },
                  { key: "failed", label: "Failed" },
                  { key: "blocked", label: "Blocked" },
                  { key: "skipped", label: "Skipped" },
                  { key: "pending", label: "Pending" },
                  { key: "total", label: "Total" },
                ],
                rows: summaryRows.slice(0, 15),
                isTruncated,
                queryType: args.queryType,
                queryParams: {},
              };
            }

            case "coverageByTeam": {
              // SR count, TP count, uncovered count per team.
              // Sorted by uncovered DESC to surface least-covered teams first.
              const teams = await prisma.team.findMany({
                select: {
                  name: true,
                  subRequirements: {
                    select: {
                      id: true,
                      testProcedures: { select: { id: true } },
                    },
                  },
                },
                take: 16, // Fetch one extra to detect truncation
                orderBy: { name: "asc" },
              });

              const coverageRows = teams.map((t) => {
                const srCount = t.subRequirements.length;
                const tpCount = t.subRequirements.reduce(
                  (sum, sr) => sum + sr.testProcedures.length, 0
                );
                const uncovered = t.subRequirements.filter(
                  (sr) => sr.testProcedures.length === 0
                ).length;
                const coveragePercent = srCount > 0
                  ? `${Math.round(((srCount - uncovered) / srCount) * 100)}%`
                  : "-";
                return {
                  team: t.name,
                  subRequirements: srCount,
                  testProcedures: tpCount,
                  uncovered,
                  coveragePercent,
                };
              });

              coverageRows.sort((a, b) => b.uncovered - a.uncovered);
              const isTruncated = coverageRows.length > 15;

              return {
                type: "table" as const,
                title: "Test Coverage by Team",
                columns: [
                  { key: "team", label: "Team" },
                  { key: "subRequirements", label: "Sub-Reqs" },
                  { key: "testProcedures", label: "Procedures" },
                  { key: "uncovered", label: "Uncovered" },
                  { key: "coveragePercent", label: "Coverage" },
                ],
                rows: coverageRows.slice(0, 15),
                isTruncated,
                queryType: args.queryType,
                queryParams: {},
              };
            }

            case "testCasesForRequirement": {
              // Flattened TC list for a given product requirement ID.
              // Skips intermediate layers (SR -> TP -> TPV) for a direct view.
              if (!args.requirementId) {
                return { error: "ValidationError: requirementId is required for testCasesForRequirement. Use searchByTitle first if user gives a name." };
              }

              const data = await prisma.testCase.findMany({
                where: {
                  testProcedureVersion: {
                    testProcedure: {
                      subRequirement: {
                        productRequirementId: args.requirementId,
                      },
                    },
                  },
                },
                select: {
                  id: true,
                  title: true,
                  status: true,
                  result: true,
                  executedAt: true,
                  executor: { select: { name: true } },
                  testProcedureVersion: {
                    select: {
                      testProcedure: {
                        select: {
                          title: true,
                          subRequirement: { select: { title: true } },
                        },
                      },
                    },
                  },
                },
                take: 16,
                // Surface pending/failed first (status ASC: BLOCKED, FAILED, PASSED, PENDING, SKIPPED)
                orderBy: { status: "asc" },
              });
              const isTruncated = data.length > 15;
              const rows = data.slice(0, 15);

              return {
                type: "table" as const,
                title: "Test Cases for Requirement",
                columns: [
                  { key: "id", label: "ID" },
                  { key: "title", label: "Title" },
                  { key: "status", label: "Status" },
                  { key: "result", label: "Result" },
                  { key: "procedure", label: "Procedure" },
                  { key: "subRequirement", label: "Sub-Requirement" },
                  { key: "executedBy", label: "Executed By" },
                  { key: "executedAt", label: "Executed" },
                ],
                rows: rows.map((d) => ({
                  id: d.id,
                  title: d.title,
                  status: d.status,
                  result: d.result ?? "-",
                  procedure: d.testProcedureVersion.testProcedure.title,
                  subRequirement: d.testProcedureVersion.testProcedure.subRequirement.title,
                  executedBy: d.executor?.name ?? "-",
                  executedAt: d.executedAt ? formatDate(d.executedAt) : "-",
                })),
                isTruncated,
                queryType: args.queryType,
                queryParams: { requirementId: args.requirementId },
              };
            }

            default: {
              // Exhaustive check - TypeScript will error if a new enum value is added
              // but not handled above.
              const _exhaustive: never = args.queryType;
              return { error: `ValidationError: Unknown query type: ${_exhaustive}` };
            }
          }
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Show a Mermaid diagram in the context panel --
    showDiagram: tool({
      description:
        "Display a custom Mermaid diagram in the context panel. " +
        "Use ONLY for custom visualizations that don't fit traceability, status, or coverage templates. " +
        "For traceability diagrams, use showTraceabilityDiagram instead. " +
        "For status distribution, use showStatusDiagram instead. " +
        "For team coverage, use showCoverageDiagram instead. " +
        "Generate valid Mermaid syntax (flowchart, graph, or stateDiagram). " +
        "Diagram style rules: " +
        "(1) Prefer `flowchart LR` for trees - left-to-right fits the narrow panel better than top-down. " +
        "(2) Short node labels - use ID + brief title, not full descriptions. " +
        "(3) Do NOT use classDef or style directives - the neutral theme handles colors. " +
        "(4) Do NOT use emoji in node labels. " +
        "(5) Keep labels concise (under ~50 characters per node).",
      inputSchema: z.object({
        title: z.string().trim().describe("Title for the diagram"),
        mermaidSyntax: z.string().trim().describe("Valid Mermaid diagram syntax"),
      }),
      execute: async (args): Promise<DiagramPayload | { error: string }> => {
        try {
          // Strip markdown code fences if the LLM wrapped the syntax in them.
          // LLMs commonly produce ```mermaid\n...\n``` around diagram code.
          let cleaned = args.mermaidSyntax.trim();
          const fenceMatch = cleaned.match(/^```(?:mermaid)?\s*\n([\s\S]*?)```\s*$/);
          if (fenceMatch) {
            cleaned = fenceMatch[1].trim();
          }

          // Basic validation - mermaid syntax should start with a diagram type
          const trimmed = cleaned;
          const validStarts = ["graph", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram", "erDiagram", "gantt", "pie", "gitgraph"];
          const startsValid = validStarts.some((s) => trimmed.startsWith(s));

          if (!startsValid) {
            return {
              error: "ValidationError: Mermaid syntax must start with a valid diagram type (graph, flowchart, stateDiagram, etc.)",
            };
          }

          return {
            type: "diagram" as const,
            title: args.title,
            mermaidSyntax: cleaned,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Show audit log entries in the context panel --
    showAuditLog: tool({
      description:
        "Display audit history visually in the context panel. " +
        "Use this when the user asks to see, show, or display audit logs or activity history. " +
        "Do NOT use getRecentAuditLog for user-facing display - use this tool instead.",
      inputSchema: z.object({
        entityType: AuditEntityTypeEnum
          .optional()
          .describe("Filter by entity type"),
        entityId: z
          .string()
          .uuid()
          .optional()
          .describe("Filter by specific entity ID"),
        actorId: z
          .string()
          .uuid()
          .optional()
          .describe("Filter by actor (user) ID"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(25)
          .describe("Max entries to return (default 25)"),
      }),
      execute: async (args): Promise<AuditPayload | { error: string }> => {
        try {
          const data = await fetchAuditLogForPanel({
            entityType: args.entityType,
            entityId: args.entityId,
            actorId: args.actorId,
            limit: args.limit,
          });

          // Build a descriptive title based on active filters
          let title = "Recent Audit Log";
          if (args.entityType && args.entityId) {
            title = `Audit History - ${args.entityType}`;
          } else if (args.entityType) {
            title = `Audit Log - ${args.entityType}`;
          } else if (args.actorId && data.length > 0) {
            title = `Audit Log - ${data[0].actor.name}`;
          } else if (args.actorId) {
            title = "Audit Log - User Activity";
          }

          return {
            type: "audit" as const,
            title,
            entries: data.map((entry) => ({
              id: entry.id,
              action: entry.action,
              entityType: entry.entityType,
              entityId: entry.entityId,
              actor: { name: entry.actor.name },
              createdAt: entry.createdAt.toISOString(),
              changes: normalizeChanges(entry.changes),
            })),
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Template-based diagram tools (Issue #67) --
    // These produce deterministic Mermaid syntax from DB data.
    // The LLM picks which tool to use; code controls the visual format.

    showTraceabilityDiagram: tool({
      description:
        "Display a traceability diagram showing PR -> SR -> TP -> TC relationships. " +
        "Use this for any traceability, hierarchy, or coverage visualization request. " +
        "Default mode is 'summary' (rolled-up status counts per TP). " +
        "Use 'detailed' mode when the user asks about a specific requirement (shows individual TCs). " +
        "If mode is 'detailed', requirementId is required - defaults to 'summary' if omitted.",
      inputSchema: z.object({
        requirementId: z
          .string()
          .uuid()
          .optional()
          .describe("Product requirement ID. Required for detailed mode, optional for summary."),
        mode: z
          .enum(["summary", "detailed"])
          .default("summary")
          .describe("'summary' shows aggregated status counts per TP. 'detailed' shows individual TC nodes."),
      }),
      execute: async (args): Promise<DiagramPayload | { error: string }> => {
        try {
          // Enforce: detailed mode requires a requirementId to prevent huge graphs
          const effectiveMode =
            args.mode === "detailed" && !args.requirementId
              ? "summary"
              : args.mode;

          const data = await fetchTraceabilityForDiagram(args.requirementId);

          if (data.requirements.length === 0) {
            return { error: "NotFoundError: No product requirements found." };
          }

          const mermaidSyntax = buildTraceabilityDiagram(data, effectiveMode);
          const title = args.requirementId
            ? `Traceability - ${data.requirements[0].id} ${data.requirements[0].title} (${diagramTimestamp()})`
            : `Traceability Overview (${diagramTimestamp()})`;

          return {
            type: "diagram" as const,
            title,
            mermaidSyntax,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    showStatusDiagram: tool({
      description:
        "Display a status distribution diagram showing entity counts by status. " +
        "Use this when the user asks about status breakdown, distribution, or overview. " +
        "Optionally filter to a single entity type (PR, SR, TP, TC).",
      inputSchema: z.object({
        entityType: z
          .enum(["PR", "SR", "TP", "TC"])
          .optional()
          .describe("Filter to one entity type. Omit to show all types."),
      }),
      execute: async (args): Promise<DiagramPayload | { error: string }> => {
        try {
          const entries = await fetchStatusDistribution(args.entityType);

          if (entries.length === 0) {
            return { error: "NotFoundError: No entities found." };
          }

          // Single entity type: build one diagram.
          // Multiple entity types: build combined subgraph diagram.
          if (entries.length === 1) {
            const mermaidSyntax = buildStatusDistributionDiagram(entries[0]);
            return {
              type: "diagram" as const,
              title: `Status Distribution - ${entries[0].entityType} (${diagramTimestamp()})`,
              mermaidSyntax,
            };
          }

          const mermaidSyntax = buildMultiStatusDiagram(entries);

          return {
            type: "diagram" as const,
            title: `Status Distribution - All Entity Types (${diagramTimestamp()})`,
            mermaidSyntax,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    showCoverageDiagram: tool({
      description:
        "Display a team coverage diagram showing SR, TP, and uncovered counts per team. " +
        "Use this when the user asks about test coverage by team, team metrics, or coverage gaps.",
      inputSchema: z.object({}),
      execute: async (): Promise<DiagramPayload | { error: string }> => {
        try {
          const data = await fetchTeamCoverage();

          if (data.teams.length === 0) {
            return { error: "NotFoundError: No teams found." };
          }

          const mermaidSyntax = buildTeamCoverageDiagram(data);

          return {
            type: "diagram" as const,
            title: `Test Coverage by Team (${diagramTimestamp()})`,
            mermaidSyntax,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Inline chat tool (not rendered in panel) --

    presentChoices: tool({
      description:
        "Present 2-5 choices as clickable buttons inline in the chat. " +
        "Use when offering the user multiple substantive options (not yes/no confirmations). " +
        "Call this tool and STOP - do not summarize the choices in plain text.",
      inputSchema: z.object({
        question: z
          .string()
          .min(1)
          .max(200)
          .trim()
          .describe("The question being asked (for LLM context - write it in your text response before calling this tool)"),
        choices: z
          .array(
            z
              .string()
              .min(1)
              .max(100)
              .trim()
              .describe("A self-describing choice label"),
          )
          .min(2)
          .max(5)
          .refine((arr) => new Set(arr).size === arr.length, {
            message: "Choices must be unique",
          })
          .describe("2-5 distinct options for the user to pick from"),
      }),
      execute: async (args): Promise<string> => {
        // Return a context string (not the payload) to signal the LLM to stop
        // and wait for the user's selection. The frontend reads choices from
        // the tool call's input args, not from this return value.
        const labels = args.choices.map((c) => `"${c}"`).join(", ");
        return `Choices presented to user: [${labels}]. Wait for their reply before proceeding.`;
      },
    }),
  };
}
