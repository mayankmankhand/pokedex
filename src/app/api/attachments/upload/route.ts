// Stubbed file upload endpoint.
// Parses multipart form data, reads (but discards) the file buffer,
// creates attachment metadata via the service, returns the record
// with a placeholder URL.

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { addAttachment } from "@/services/attachment.service";
import type { AttachmentType } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const ctx = getRequestContext(request);
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Include a 'file' field in form data." },
        { status: 400 }
      );
    }

    // Read the buffer but discard it (stubbed storage)
    await file.arrayBuffer();

    // Determine file type from the MIME type
    const fileType = resolveFileType(file.type);

    // Read the parent entity ID from form data (exactly one must be provided)
    const productRequirementId = formData.get("productRequirementId") as string | null;
    const subRequirementId = formData.get("subRequirementId") as string | null;
    const testProcedureId = formData.get("testProcedureId") as string | null;
    const testCaseId = formData.get("testCaseId") as string | null;

    const result = await addAttachment(
      {
        fileName: file.name,
        fileType,
        productRequirementId: productRequirementId || undefined,
        subRequirementId: subRequirementId || undefined,
        testProcedureId: testProcedureId || undefined,
        testCaseId: testCaseId || undefined,
      },
      ctx
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function resolveFileType(mimeType: string): AttachmentType {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  ) {
    return "SPREADSHEET";
  }
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text/")
  ) {
    return "DOCUMENT";
  }
  return "OTHER";
}
