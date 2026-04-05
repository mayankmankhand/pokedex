import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { ReParentSubRequirementInput } from "@/schemas/sub-requirement.schema";
import { reParentSubRequirement } from "@/services/sub-requirement.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    const { id } = await params;
    const body = await request.json();
    const input = ReParentSubRequirementInput.parse(body);
    const result = await reParentSubRequirement(id, input, ctx);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
