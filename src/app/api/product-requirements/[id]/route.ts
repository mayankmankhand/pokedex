import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import { prisma, ACTIVE_ATTACHMENT_FILTER } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requirement = await prisma.productRequirement.findUniqueOrThrow({
      where: { id },
      include: {
        subRequirements: true,
        attachments: { where: ACTIVE_ATTACHMENT_FILTER },
      },
    });
    return NextResponse.json(requirement);
  } catch (error) {
    return handleApiError(error);
  }
}
