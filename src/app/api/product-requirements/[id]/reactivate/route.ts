import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { ReactivateProductRequirementInput } from "@/schemas/product-requirement.schema";
import { reactivateProductRequirement } from "@/services/product-requirement.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = getRequestContext(request);
    const { id } = await params;
    const body = await request.json();
    ReactivateProductRequirementInput.parse(body);
    const result = await reactivateProductRequirement(id, body, ctx);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
