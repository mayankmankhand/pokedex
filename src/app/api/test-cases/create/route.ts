import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { CreateTestCaseInput } from "@/schemas/test-case.schema";
import { createTestCase } from "@/services/test-case.service";

export async function POST(request: NextRequest) {
  try {
    const ctx = getRequestContext(request);
    const body = await request.json();
    const input = CreateTestCaseInput.parse(body);
    const result = await createTestCase(input, ctx);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
