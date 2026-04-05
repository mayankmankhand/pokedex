import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { ReExecuteTestCaseInput } from "@/schemas/test-case.schema";
import { reExecuteTestCase } from "@/services/test-case.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    const { id } = await params;
    const body = await request.json();
    const input = ReExecuteTestCaseInput.parse(body);
    const result = await reExecuteTestCase(id, input, ctx);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
