import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { CreateAttachmentInput } from "@/schemas/attachment.schema";
import { addAttachment } from "@/services/attachment.service";

export async function POST(request: NextRequest) {
  try {
    const ctx = getRequestContext(request);
    const body = await request.json();
    const input = CreateAttachmentInput.parse(body);
    const result = await addAttachment(input, ctx);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
