import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { CreateSubRequirementInput } from "@/schemas/sub-requirement.schema";
import { createSubRequirement } from "@/services/sub-requirement.service";

export async function POST(request: NextRequest) {
  try {
    const ctx = getRequestContext(request);
    const body = await request.json();
    const input = CreateSubRequirementInput.parse(body);
    const result = await createSubRequirement(input, ctx);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
