import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import { prisma, ACTIVE_ATTACHMENT_FILTER } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const testCase = await prisma.testCase.findUniqueOrThrow({
      where: { id },
      include: {
        testProcedureVersion: true,
        attachments: { where: ACTIVE_ATTACHMENT_FILTER },
      },
    });
    return NextResponse.json(testCase);
  } catch (error) {
    return handleApiError(error);
  }
}
