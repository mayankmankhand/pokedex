import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { CreateTestProcedureInput } from "@/schemas/test-procedure.schema";
import { createTestProcedure } from "@/services/test-procedure.service";

export async function POST(request: NextRequest) {
  try {
    const ctx = getRequestContext(request);
    const body = await request.json();
    const input = CreateTestProcedureInput.parse(body);
    const result = await createTestProcedure(input, ctx);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
