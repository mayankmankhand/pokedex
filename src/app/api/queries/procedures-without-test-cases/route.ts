// Named query: approved procedure versions with zero test cases.
// Helps find procedures that exist but have never been tested.

import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import { PaginationParams } from "@/schemas/query.schema";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit } = PaginationParams.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const skip = (page - 1) * limit;

    const where = {
      status: "APPROVED" as const,
      testCases: { none: {} },
    };

    const [data, total] = await Promise.all([
      prisma.testProcedureVersion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          testProcedure: {
            select: { id: true, title: true, subRequirementId: true },
          },
        },
      }),
      prisma.testProcedureVersion.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, limit, total },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
