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

    const [data, total] = await Promise.all([
      prisma.testProcedure.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.testProcedure.count(),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, limit, total },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
