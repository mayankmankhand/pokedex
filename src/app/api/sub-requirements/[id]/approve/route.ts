import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError, getTraceContext, logApiTrace } from "@/lib/api-utils";
import { ApproveSubRequirementInput } from "@/schemas/sub-requirement.schema";
import { approveSubRequirement } from "@/services/sub-requirement.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const traceCtx = getTraceContext(request);
  try {
    const ctx = getRequestContext(request);
    const { id } = await params;
    const body = await request.json();
    ApproveSubRequirementInput.parse(body);
    const result = await approveSubRequirement(id, ctx);
    logApiTrace(traceCtx, 200, "SubRequirement", "approve");
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, traceCtx);
  }
}
