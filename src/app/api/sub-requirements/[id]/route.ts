import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import { prisma, ACTIVE_ATTACHMENT_FILTER } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subRequirement = await prisma.subRequirement.findUniqueOrThrow({
      where: { id },
      include: {
        productRequirement: true,
        team: true,
        testProcedures: true,
        attachments: { where: ACTIVE_ATTACHMENT_FILTER },
      },
    });
    return NextResponse.json(subRequirement);
  } catch (error) {
    return handleApiError(error);
  }
}
