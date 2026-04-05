import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { UpdateTestProcedureInput } from "@/schemas/test-procedure.schema";
import { updateTestProcedure } from "@/services/test-procedure.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    const { id } = await params;
    const body = await request.json();
    const input = UpdateTestProcedureInput.parse(body);
    const result = await updateTestProcedure(id, input, ctx);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
