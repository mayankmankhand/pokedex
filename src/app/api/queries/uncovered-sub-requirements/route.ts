// Named query: sub-requirements with no linked test procedures.
// Useful for identifying coverage gaps.

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
      testProcedures: { none: {} },
    };

    const [data, total] = await Promise.all([
      prisma.subRequirement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          productRequirement: { select: { id: true, title: true } },
          team: { select: { id: true, name: true } },
        },
      }),
      prisma.subRequirement.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, limit, total },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
