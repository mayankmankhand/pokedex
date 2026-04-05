import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { RecordTestResultInput } from "@/schemas/test-case.schema";
import { recordTestResult } from "@/services/test-case.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    const { id } = await params;
    const body = await request.json();
    const input = RecordTestResultInput.parse(body);
    const result = await recordTestResult(id, input, ctx);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
