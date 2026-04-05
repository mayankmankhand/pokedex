// LLM tools for analytical queries.
// These replicate the logic from the named query API routes,
// adapted for tool use with compact payloads.

import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formatToolError } from "./tool-wrapper";
import { AuditEntityTypeEnum } from "@/schemas/query.schema";

export function createQueryTools() {
  return {
    // -- Full traceability chain for a product requirement --
    getTraceabilityChain: tool({
      description:
        "Get the full traceability chain for a product requirement: " +
        "requirement -> sub-requirements -> test procedures -> versions -> test cases. " +
        "Useful for understanding complete test coverage of a requirement.",
      inputSchema: z.object({
        requirementId: z.string().uuid().describe("ID of the product requirement"),
      }),
      execute: async (args) => {
        try {
          return await prisma.productRequirement.findUniqueOrThrow({
            where: { id: args.requirementId },
            select: {
              id: true,
              title: true,
              status: true,
              subRequirements: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  team: { select: { id: true, name: true } },
                  testProcedures: {
                    select: {
                      id: true,
                      title: true,
                      status: true,
                      versions: {
                        select: {
                          id: true,
                          versionNumber: true,
                          status: true,
                          testCases: {
                            select: {
                              id: true,
                              title: true,
                              status: true,
                              result: true,
                            },
                            take: 5,
                          },
                        },
                        orderBy: { versionNumber: "desc" as const },
                        take: 3,
                      },
                    },
                    take: 10,
                  },
                },
                take: 20,
              },
            },
          });
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Sub-requirements with no test procedures (coverage gaps) --
    getUncoveredSubRequirements: tool({
      description:
        "Find sub-requirements that have no linked test procedures. " +
        "These represent coverage gaps that need test procedures written.",
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(10)
          .describe("Max results to return (default 10)"),
      }),
      execute: async (args) => {
        try {
          const where = { testProcedures: { none: {} } };

          // Run data fetch and total count in parallel
          const [data, totalCount] = await Promise.all([
            prisma.subRequirement.findMany({
              where,
              select: {
                id: true,
                title: true,
                status: true,
                productRequirement: {
                  select: { id: true, title: true },
                },
                team: {
                  select: { id: true, name: true },
                },
              },
              take: args.limit,
              orderBy: { createdAt: "desc" },
            }),
            prisma.subRequirement.count({ where }),
          ]);

          return {
            showing: data.length,
            totalCount,
            uncoveredSubRequirements: data,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Approved procedure versions with no test cases --
    getProceduresWithoutTestCases: tool({
      description:
        "Find approved test procedure versions that have no test cases. " +
        "These are procedures that exist but have never been tested.",
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(10)
          .describe("Max results to return (default 10)"),
      }),
      execute: async (args) => {
        try {
          const where = {
            status: "APPROVED" as const,
            testCases: { none: {} },
          };

          // Run data fetch and total count in parallel
          const [data, totalCount] = await Promise.all([
            prisma.testProcedureVersion.findMany({
              where,
              select: {
                id: true,
                versionNumber: true,
                status: true,
                testProcedure: {
                  select: {
                    id: true,
                    title: true,
                    subRequirementId: true,
                  },
                },
              },
              take: args.limit,
              orderBy: { createdAt: "desc" },
            }),
            prisma.testProcedureVersion.count({ where }),
          ]);

          return {
            showing: data.length,
            totalCount,
            untestedVersions: data,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Recent audit log entries --
    getRecentAuditLog: tool({
      description:
        "Fetch recent audit log entries for your own reasoning (not user-facing). " +
        "Optionally filter by entity type or a specific entity ID. " +
        "To SHOW audit logs to the user visually, use showAuditLog instead.",
      inputSchema: z.object({
        entityType: AuditEntityTypeEnum
          .optional()
          .describe("Filter by entity type"),
        entityId: z
          .string()
          .uuid()
          .optional()
          .describe("Filter by specific entity ID"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Max entries to return (default 20)"),
      }),
      execute: async (args) => {
        try {
          const where: Record<string, unknown> = {};
          if (args.entityType) where.entityType = args.entityType;
          if (args.entityId) where.entityId = args.entityId;

          const data = await prisma.auditLog.findMany({
            where,
            take: args.limit,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              action: true,
              entityType: true,
              entityId: true,
              source: true,
              createdAt: true,
              actor: {
                select: { id: true, name: true },
              },
              // Intentionally omit 'changes' - can be very large JSON
              // and would bloat the LLM context window.
            },
          });

          return { entries: data };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),
  };
}
