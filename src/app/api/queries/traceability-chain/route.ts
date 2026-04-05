// Named query: full traceability chain.
// Returns the nested structure:
//   ProductRequirement -> SubRequirements -> TestProcedures -> Versions -> TestCases

import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import { TraceabilityQueryParams } from "@/schemas/query.schema";
import { prisma, ACTIVE_ATTACHMENT_FILTER } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { requirementId } = TraceabilityQueryParams.parse({
      requirementId: searchParams.get("requirementId") ?? undefined,
    });

    const chain = await prisma.productRequirement.findUniqueOrThrow({
      where: { id: requirementId },
      include: {
        subRequirements: {
          include: {
            team: true,
            testProcedures: {
              include: {
                versions: {
                  orderBy: { versionNumber: "desc" },
                  include: {
                    testCases: true,
                  },
                },
              },
            },
          },
        },
        attachments: { where: ACTIVE_ATTACHMENT_FILTER },
      },
    });

    return NextResponse.json(chain);
  } catch (error) {
    return handleApiError(error);
  }
}
