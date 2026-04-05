import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { ReactivateTestProcedureInput } from "@/schemas/test-procedure.schema";
import { reactivateTestProcedure } from "@/services/test-procedure.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    const { id } = await params;
    const body = await request.json();
    ReactivateTestProcedureInput.parse(body);
    const result = await reactivateTestProcedure(id, body, ctx);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
