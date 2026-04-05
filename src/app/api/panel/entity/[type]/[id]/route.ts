// GET /api/panel/entity/[type]/[id]
// Returns an enriched DetailPayload for the context panel.
// Thin wrapper over shared-queries fetch functions (single source of truth).
// The same fetch + transform logic that showEntityDetail uses in the LLM tool.

import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { formatDate } from "@/lib/format-utils";
import {
  fetchProductRequirement,
  fetchSubRequirement,
  fetchTestProcedure,
  fetchTestProcedureVersion,
  fetchTestCase,
  computeEditableFields,
  computeAvailableActions,
} from "@/lib/ai/tools/shared-queries";
import type { DetailPayload } from "@/types/panel";

// Whitelist of valid entity types (must match shared-queries fetch functions)
const VALID_TYPES = new Set([
  "ProductRequirement",
  "SubRequirement",
  "TestProcedure",
  "TestProcedureVersion",
  "TestCase",
]);

// Map Prisma attachment rows to the DetailPayload attachment shape
function mapAttachments(
  attachments: Array<{
    id: string;
    fileName: string;
    fileType: string;
    createdAt: Date;
    uploader: { name: string };
  }>,
): Array<{
  id: string;
  fileName: string;
  fileType: string;
  uploadedBy: string;
  createdAt: string;
}> {
  return attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    fileType: a.fileType,
    uploadedBy: a.uploader.name,
    createdAt: formatDate(a.createdAt),
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  try {
    // Auth check - same as all other routes
    getRequestContext(request);

    const { type, id } = await params;

    if (!VALID_TYPES.has(type)) {
      return NextResponse.json(
        { error: `Unknown entity type: ${type}` },
        { status: 400 },
      );
    }

    // Each branch mirrors the showEntityDetail LLM tool's payload shape
    let payload: DetailPayload;

    switch (type) {
      case "ProductRequirement": {
        const data = await fetchProductRequirement(id);
        payload = {
          type: "detail",
          entityType: type,
          entityId: data.id,
          title: data.title,
          fields: [
            { label: "ID", value: data.id },
            { label: "Status", value: data.status },
            { label: "Description", value: data.description },
            { label: "Created", value: formatDate(data.createdAt) },
          ],
          relatedEntities: data.subRequirements.map((sr) => ({
            id: sr.id,
            title: sr.title,
            status: sr.status,
            entityType: "SubRequirement",
          })),
          attachments: mapAttachments(data.attachments),
          editableFields: computeEditableFields(type, data.status, data),
          availableActions: computeAvailableActions(type, data.status),
        };
        break;
      }

      case "SubRequirement": {
        const data = await fetchSubRequirement(id);
        payload = {
          type: "detail",
          entityType: type,
          entityId: data.id,
          title: data.title,
          fields: [
            { label: "ID", value: data.id },
            { label: "Status", value: data.status },
            { label: "Description", value: data.description },
            { label: "Team", value: data.team.name },
            { label: "Parent Requirement", value: data.productRequirement.title },
            { label: "Created", value: formatDate(data.createdAt) },
          ],
          relatedEntities: data.testProcedures.map((tp) => ({
            id: tp.id,
            title: tp.title,
            status: tp.status,
            entityType: "TestProcedure",
          })),
          attachments: mapAttachments(data.attachments),
          editableFields: computeEditableFields(type, data.status, data),
          availableActions: computeAvailableActions(type, data.status),
        };
        break;
      }

      case "TestProcedure": {
        const data = await fetchTestProcedure(id);
        payload = {
          type: "detail",
          entityType: type,
          entityId: data.id,
          title: data.title,
          fields: [
            { label: "ID", value: data.id },
            { label: "Status", value: data.status },
            { label: "Parent Sub-Requirement", value: data.subRequirement.title },
            { label: "Created", value: formatDate(data.createdAt) },
          ],
          relatedEntities: data.versions.map((v) => ({
            id: v.id,
            title: `v${v.versionNumber}${v.description ? ` - ${v.description}` : ""}`,
            status: v.status,
            entityType: "TestProcedureVersion",
          })),
          attachments: mapAttachments(data.attachments),
          editableFields: computeEditableFields(type, data.status, data),
          availableActions: computeAvailableActions(type, data.status),
        };
        break;
      }

      case "TestProcedureVersion": {
        const data = await fetchTestProcedureVersion(id);
        payload = {
          type: "detail",
          entityType: type,
          entityId: data.id,
          title: `${data.testProcedure.title} v${data.versionNumber}`,
          fields: [
            { label: "ID", value: data.id },
            { label: "Status", value: data.status },
            { label: "Version", value: String(data.versionNumber) },
            { label: "Description", value: data.description },
            { label: "Steps", value: data.steps },
            { label: "Procedure", value: data.testProcedure.title },
            { label: "Created", value: formatDate(data.createdAt) },
          ],
          relatedEntities: data.testCases.map((tc) => ({
            id: tc.id,
            title: tc.title,
            status: tc.status,
            entityType: "TestCase",
          })),
          editableFields: computeEditableFields(type, data.status, data),
          availableActions: computeAvailableActions(type, data.status),
        };
        break;
      }

      case "TestCase": {
        const data = await fetchTestCase(id);
        const fields = [
          { label: "ID", value: data.id },
          { label: "Status", value: data.status },
          { label: "Description", value: data.description },
          { label: "Procedure", value: data.testProcedureVersion.testProcedure.title },
          { label: "Version", value: `v${data.testProcedureVersion.versionNumber}` },
        ];
        if (data.result) fields.push({ label: "Result", value: data.result });
        if (data.notes) fields.push({ label: "Notes", value: data.notes });
        if (data.executedAt) fields.push({ label: "Executed", value: formatDate(data.executedAt) });

        payload = {
          type: "detail",
          entityType: type,
          entityId: data.id,
          title: data.title,
          fields,
          attachments: mapAttachments(data.attachments),
          editableFields: computeEditableFields(type, data.status, data),
          availableActions: computeAvailableActions(type, data.status),
        };
        break;
      }

      default:
        // Exhaustive check - should never reach here due to VALID_TYPES guard
        return NextResponse.json(
          { error: "Unknown entity type" },
          { status: 400 },
        );
    }

    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
