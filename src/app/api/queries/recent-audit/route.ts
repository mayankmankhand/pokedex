// Named query: recent audit log entries with optional entity filter.

import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import { AuditQueryParams } from "@/schemas/query.schema";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { entityType, entityId, limit } = AuditQueryParams.parse({
      entityType: searchParams.get("entityType") ?? undefined,
      entityId: searchParams.get("entityId") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const data = await prisma.auditLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
