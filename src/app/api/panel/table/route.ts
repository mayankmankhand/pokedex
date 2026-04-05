// POST /api/panel/table
// Handles "Show more" pagination for table views.
// Re-runs the same Prisma query with skip/take to fetch the next batch.
// Only supports paginated entity-list query types (not aggregations).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { formatDate } from "@/lib/format-utils";
import { prisma } from "@/lib/prisma";

// Query types that support offset pagination (entity lists)
const PAGINATED_QUERY_TYPES = new Set([
  "allRequirements",
  "allSubRequirements",
  "allTestProcedures",
  "allTestCases",
  "uncoveredSubRequirements",
  "untestedProcedures",
  "testCasesForRequirement",
]);

const RequestBodySchema = z.object({
  queryType: z.string(),
  queryParams: z.record(z.string(), z.unknown()).optional().default({}),
  offset: z.number().int().min(0),
  limit: z.number().int().min(1).max(50).default(15),
});

export async function POST(request: NextRequest) {
  try {
    // Auth check
    getRequestContext(request);

    const body = await request.json();
    const { queryType, queryParams, offset, limit } = RequestBodySchema.parse(body);

    if (!PAGINATED_QUERY_TYPES.has(queryType)) {
      return NextResponse.json(
        { error: "Pagination not supported for this query type" },
        { status: 400 },
      );
    }

    // Fetch one extra row to detect if more pages exist
    const take = limit + 1;

    let rows: Record<string, unknown>[] = [];
    let isTruncated = false;

    switch (queryType) {
      case "allRequirements": {
        const data = await prisma.productRequirement.findMany({
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            creator: { select: { name: true } },
          },
          skip: offset,
          take,
          orderBy: { createdAt: "desc" },
        });
        isTruncated = data.length > limit;
        rows = data.slice(0, limit).map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          created: formatDate(d.createdAt),
          createdBy: d.creator.name,
        }));
        break;
      }

      case "allSubRequirements": {
        const team = typeof queryParams.team === "string" ? queryParams.team : undefined;
        const where = team
          ? { team: { name: { contains: team, mode: "insensitive" as const } } }
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
          skip: offset,
          take,
          orderBy: { createdAt: "desc" },
        });
        isTruncated = data.length > limit;
        rows = data.slice(0, limit).map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          team: d.team.name,
          productRequirement: d.productRequirement.title,
          parentStatus: d.productRequirement.status,
          createdBy: d.creator.name,
        }));
        break;
      }

      case "allTestProcedures": {
        const team = typeof queryParams.team === "string" ? queryParams.team : undefined;
        const where = team
          ? { subRequirement: { team: { name: { contains: team, mode: "insensitive" as const } } } }
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
          skip: offset,
          take,
          orderBy: { createdAt: "desc" },
        });
        isTruncated = data.length > limit;
        rows = data.slice(0, limit).map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          subRequirement: d.subRequirement.title,
          team: d.subRequirement.team.name,
          productRequirement: d.subRequirement.productRequirement.title,
          createdBy: d.creator.name,
        }));
        break;
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
          skip: offset,
          take,
          orderBy: { createdAt: "desc" },
        });
        isTruncated = data.length > limit;
        rows = data.slice(0, limit).map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          result: d.result ?? "-",
          procedure: d.testProcedureVersion.testProcedure.title,
          subRequirement: d.testProcedureVersion.testProcedure.subRequirement.title,
          executedBy: d.executor?.name ?? "-",
          executedAt: d.executedAt ? formatDate(d.executedAt) : "-",
        }));
        break;
      }

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
          skip: offset,
          take,
          orderBy: { createdAt: "desc" },
        });
        isTruncated = data.length > limit;
        rows = data.slice(0, limit).map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          team: d.team.name,
          productRequirement: d.productRequirement.title,
          parentStatus: d.productRequirement.status,
        }));
        break;
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
          skip: offset,
          take,
          orderBy: { createdAt: "desc" },
        });
        isTruncated = data.length > limit;
        rows = data.slice(0, limit).map((d) => ({
          id: d.testProcedure.id,
          procedure: d.testProcedure.title,
          version: `v${d.versionNumber}`,
          subRequirement: d.testProcedure.subRequirement.title,
          team: d.testProcedure.subRequirement.team.name,
        }));
        break;
      }

      case "testCasesForRequirement": {
        const requirementId = typeof queryParams.requirementId === "string"
          ? queryParams.requirementId
          : undefined;
        if (!requirementId) {
          return NextResponse.json(
            { error: "requirementId is required for testCasesForRequirement" },
            { status: 400 },
          );
        }
        const data = await prisma.testCase.findMany({
          where: {
            testProcedureVersion: {
              testProcedure: {
                subRequirement: { productRequirementId: requirementId },
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
          skip: offset,
          take,
          orderBy: { status: "asc" },
        });
        isTruncated = data.length > limit;
        rows = data.slice(0, limit).map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          result: d.result ?? "-",
          procedure: d.testProcedureVersion.testProcedure.title,
          subRequirement: d.testProcedureVersion.testProcedure.subRequirement.title,
          executedBy: d.executor?.name ?? "-",
          executedAt: d.executedAt ? formatDate(d.executedAt) : "-",
        }));
        break;
      }

      // searchResults is excluded from PAGINATED_QUERY_TYPES (returns 400 above).
      // Cross-entity search doesn't paginate correctly with per-entity-type skip.
    }

    return NextResponse.json({ rows, isTruncated });
  } catch (error) {
    return handleApiError(error);
  }
}
