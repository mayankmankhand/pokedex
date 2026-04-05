import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { ReParentTestProcedureInput } from "@/schemas/test-procedure.schema";
import { reParentTestProcedure } from "@/services/test-procedure.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    const { id } = await params;
    const body = await request.json();
    const input = ReParentTestProcedureInput.parse(body);
    const result = await reParentTestProcedure(id, input, ctx);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
