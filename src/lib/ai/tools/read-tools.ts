// LLM tools for reading entities by ID and searching by title.
// These use Prisma directly (not services) since services only handle mutations.
// Compact payloads - only return fields the LLM needs.

import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formatToolError } from "./tool-wrapper";

export function createReadTools() {
  return {
    // -- Get a product requirement by ID --
    getProductRequirement: tool({
      description:
        "Fetch a product requirement by its ID. " +
        "Returns the requirement with its sub-requirements.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the product requirement"),
      }),
      execute: async (args) => {
        try {
          return await prisma.productRequirement.findUniqueOrThrow({
            where: { id: args.id },
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
            },
          });
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Get a sub-requirement by ID --
    getSubRequirement: tool({
      description:
        "Fetch a sub-requirement by its ID. " +
        "Returns the sub-requirement with its parent info and linked test procedures.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the sub-requirement"),
      }),
      execute: async (args) => {
        try {
          return await prisma.subRequirement.findUniqueOrThrow({
            where: { id: args.id },
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
            },
          });
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Get a test procedure by ID (with versions) --
    getTestProcedure: tool({
      description:
        "Fetch a test procedure by its ID. " +
        "Returns the procedure with its version history.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the test procedure"),
      }),
      execute: async (args) => {
        try {
          return await prisma.testProcedure.findUniqueOrThrow({
            where: { id: args.id },
            select: {
              id: true,
              title: true,
              status: true,
              subRequirementId: true,
              createdAt: true,
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
            },
          });
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Get a test case by ID --
    getTestCase: tool({
      description:
        "Fetch a test case by its ID. " +
        "Returns the test case with its result and parent version info.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the test case"),
      }),
      execute: async (args) => {
        try {
          return await prisma.testCase.findUniqueOrThrow({
            where: { id: args.id },
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
            },
          });
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Search entities by title --
    searchByTitle: tool({
      description:
        "Search for entities by title (case-insensitive partial match). " +
        "Searches across product requirements, sub-requirements, test procedures, and test cases. " +
        "Returns up to 10 results per entity type.",
      inputSchema: z.object({
        query: z.string().trim().min(1).describe("Search term to match against titles"),
        entityType: z
          .enum([
            "ProductRequirement",
            "SubRequirement",
            "TestProcedure",
            "TestCase",
          ])
          .optional()
          .describe("Narrow search to a specific entity type (optional)"),
      }),
      execute: async (args) => {
        try {
          const filter = {
            title: { contains: args.query, mode: "insensitive" as const },
          };
          const take = 10;

          const results: Record<string, unknown[]> = {};

          // Only query the requested type, or all types if not specified
          const types = args.entityType
            ? [args.entityType]
            : [
                "ProductRequirement",
                "SubRequirement",
                "TestProcedure",
                "TestCase",
              ];

          const queries: Promise<void>[] = [];

          if (types.includes("ProductRequirement")) {
            queries.push(
              prisma.productRequirement
                .findMany({
                  where: filter,
                  select: { id: true, title: true, status: true },
                  take,
                  orderBy: { createdAt: "desc" },
                })
                .then((r) => {
                  results.productRequirements = r;
                })
            );
          }

          if (types.includes("SubRequirement")) {
            queries.push(
              prisma.subRequirement
                .findMany({
                  where: filter,
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    productRequirementId: true,
                  },
                  take,
                  orderBy: { createdAt: "desc" },
                })
                .then((r) => {
                  results.subRequirements = r;
                })
            );
          }

          if (types.includes("TestProcedure")) {
            queries.push(
              prisma.testProcedure
                .findMany({
                  where: filter,
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    subRequirementId: true,
                  },
                  take,
                  orderBy: { createdAt: "desc" },
                })
                .then((r) => {
                  results.testProcedures = r;
                })
            );
          }

          if (types.includes("TestCase")) {
            queries.push(
              prisma.testCase
                .findMany({
                  where: filter,
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    testProcedureVersionId: true,
                  },
                  take,
                  orderBy: { createdAt: "desc" },
                })
                .then((r) => {
                  results.testCases = r;
                })
            );
          }

          await Promise.all(queries);
          return results;
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),
  };
}
