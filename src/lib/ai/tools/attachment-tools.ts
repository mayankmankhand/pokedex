// LLM tools for attachment mutations.
// Attachments use an Exclusive Arc pattern - exactly one parent ID required.

import { tool } from "ai";
import { z } from "zod";
import type { RequestContext } from "@/lib/request-context";
import {
  addAttachment,
  removeAttachment,
} from "@/services/attachment.service";
import { formatToolError } from "./tool-wrapper";

export function createAttachmentTools(ctx: RequestContext) {
  return {
    // -- Add an attachment --
    addAttachment: tool({
      description:
        "Add a file attachment to a product requirement, sub-requirement, " +
        "test procedure, or test case. Supported file types: DOCUMENT, IMAGE, " +
        "SPREADSHEET, OTHER. Exactly one parent ID must be provided (exclusive arc). " +
        "Do NOT attach files to CANCELED entities - the service will reject it.",
      inputSchema: z.object({
        fileName: z
          .string()
          .trim()
          .min(1)
          .max(255)
          .describe("Name of the file being attached"),
        fileType: z
          .enum(["DOCUMENT", "IMAGE", "SPREADSHEET", "OTHER"])
          .describe("Type of file"),
        productRequirementId: z
          .string()
          .uuid()
          .nullish()
          .describe("Parent product requirement ID (provide exactly one parent)"),
        subRequirementId: z
          .string()
          .uuid()
          .nullish()
          .describe("Parent sub-requirement ID (provide exactly one parent)"),
        testProcedureId: z
          .string()
          .uuid()
          .nullish()
          .describe("Parent test procedure ID (provide exactly one parent)"),
        testCaseId: z
          .string()
          .uuid()
          .nullish()
          .describe("Parent test case ID (provide exactly one parent)"),
      }),
      execute: async (args) => {
        try {
          // Validate exclusive arc: exactly one parent ID required.
          // The DB CHECK constraint is a backstop, but this gives the LLM
          // a clear ValidationError instead of an opaque Prisma error.
          const parentIds = [
            args.productRequirementId,
            args.subRequirementId,
            args.testProcedureId,
            args.testCaseId,
          ];
          const nonNullCount = parentIds.filter(
            (id) => id !== null && id !== undefined
          ).length;
          if (nonNullCount !== 1) {
            return {
              error:
                "ValidationError: Exactly one parent must be specified " +
                "(productRequirementId, subRequirementId, testProcedureId, or testCaseId)",
            };
          }

          const result = await addAttachment(
            {
              fileName: args.fileName,
              fileType: args.fileType,
              productRequirementId: args.productRequirementId,
              subRequirementId: args.subRequirementId,
              testProcedureId: args.testProcedureId,
              testCaseId: args.testCaseId,
            },
            ctx
          );
          return {
            id: result.id,
            fileName: result.fileName,
            fileType: result.fileType,
            status: result.status,
            createdAt: result.createdAt,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Remove an attachment (soft-delete) --
    removeAttachment: tool({
      description:
        "Remove an attachment (soft-delete - marks as REMOVED, does not hard-delete). " +
        "IMPORTANT: Only call this tool after the user has explicitly confirmed " +
        "this action in their last message.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the attachment to remove"),
        confirmRemove: z
          .literal(true)
          .describe("Must be true to confirm removal"),
      }),
      execute: async (args) => {
        try {
          const result = await removeAttachment(args.id, ctx);
          return {
            id: result.id,
            fileName: result.fileName,
            status: result.status,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),
  };
}
