import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { CreateProductRequirementInput } from "@/schemas/product-requirement.schema";
import { createProductRequirement } from "@/services/product-requirement.service";

export async function POST(request: NextRequest) {
  try {
    const ctx = getRequestContext(request);
    const body = await request.json();
    const input = CreateProductRequirementInput.parse(body);
    const result = await createProductRequirement(input, ctx);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
