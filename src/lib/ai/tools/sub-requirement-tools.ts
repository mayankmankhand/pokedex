// LLM tools for sub-requirement mutations.
// Sub-requirements belong to a product requirement and a team.

import { tool } from "ai";
import { z } from "zod";
import type { RequestContext } from "@/lib/request-context";
import {
  createSubRequirement,
  updateSubRequirement,
  approveSubRequirement,
  cancelSubRequirement,
  reParentSubRequirement,
  reactivateSubRequirement,
} from "@/services/sub-requirement.service";
import { formatToolError } from "./tool-wrapper";

export function createSubRequirementTools(ctx: RequestContext) {
  return {
    // -- Create a new sub-requirement under a product requirement --
    createSubRequirement: tool({
      description:
        "Create a new sub-requirement linked to a parent product requirement and a team. " +
        "Starts in DRAFT status.",
      inputSchema: z.object({
        title: z.string().trim().min(1).max(255).describe("Short title for the sub-requirement"),
        description: z.string().trim().min(1).describe("Detailed description"),
        productRequirementId: z.string().uuid().describe("ID of the parent product requirement"),
        teamId: z.string().uuid().describe("ID of the team responsible for this sub-requirement"),
      }),
      execute: async (args) => {
        try {
          const result = await createSubRequirement(
            {
              title: args.title,
              description: args.description,
              productRequirementId: args.productRequirementId,
              teamId: args.teamId,
            },
            ctx
          );
          return {
            id: result.id,
            title: result.title,
            status: result.status,
            productRequirementId: result.productRequirementId,
            teamId: result.teamId,
            createdAt: result.createdAt,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Update a sub-requirement (DRAFT or APPROVED) --
    updateSubRequirement: tool({
      description:
        "Update a sub-requirement (DRAFT or APPROVED). " +
        "Title and description can be changed. CANCELED sub-requirements cannot be edited. " +
        "At least one of title or description must be provided.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the sub-requirement to update"),
        title: z.string().trim().min(1).max(255).optional().describe("New title (optional)"),
        description: z.string().trim().min(1).optional().describe("New description (optional)"),
      }).refine(
        (data) => data.title !== undefined || data.description !== undefined,
        { message: "At least one of title or description must be provided" }
      ),
      execute: async (args) => {
        try {
          const input: { title?: string; description?: string } = {};
          if (args.title !== undefined) input.title = args.title;
          if (args.description !== undefined) input.description = args.description;

          const result = await updateSubRequirement(args.id, input, ctx);
          return {
            id: result.id,
            title: result.title,
            description: result.description,
            status: result.status,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Approve a draft sub-requirement --
    approveSubRequirement: tool({
      description:
        "Approve a sub-requirement, changing its status from DRAFT to APPROVED. " +
        "The parent product requirement must already be APPROVED. " +
        "IMPORTANT: Only call this tool after the user has explicitly confirmed this action in their last message.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the sub-requirement to approve"),
        confirmApprove: z.literal(true).describe("Must be true to confirm approval"),
      }),
      execute: async (args) => {
        try {
          const result = await approveSubRequirement(args.id, ctx);
          return {
            id: result.id,
            title: result.title,
            status: result.status,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Cancel a sub-requirement (DRAFT or APPROVED) --
    cancelSubRequirement: tool({
      description:
        "Mark a sub-requirement as canceled. " +
        "DRAFT sub-requirements can be canceled only if they have no test procedures. " +
        "APPROVED sub-requirements can be canceled (cascades to children). " +
        "If the user wants to move this entity instead of canceling it, use reParentSubRequirement instead. " +
        "IMPORTANT: Only call this tool after the user has explicitly confirmed this action in their last message.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the sub-requirement to cancel"),
        confirmCancel: z.literal(true).describe("Must be true to confirm canceling"),
      }),
      execute: async (args) => {
        try {
          const result = await cancelSubRequirement(args.id, ctx);
          return {
            id: result.id,
            title: result.title,
            status: result.status,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Re-parent a sub-requirement (move to different PR) --
    reParentSubRequirement: tool({
      description:
        "Move a sub-requirement to a different product requirement. " +
        "The SR keeps its team, and all child test procedures stay attached. " +
        "CANCELED SRs cannot be moved. APPROVED SRs cannot move to a DRAFT PR. " +
        "IMPORTANT: Only call this tool after the user has explicitly confirmed this action in their last message.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the sub-requirement to move"),
        newProductRequirementId: z
          .string()
          .uuid()
          .describe("ID of the target product requirement"),
        confirmReParent: z
          .literal(true)
          .describe("Must be true to confirm the move"),
      }),
      execute: async (args) => {
        try {
          const result = await reParentSubRequirement(
            args.id,
            {
              newProductRequirementId: args.newProductRequirementId,
              confirmReParent: args.confirmReParent,
            },
            ctx
          );
          return {
            id: result.id,
            title: result.title,
            status: result.status,
            previousProductRequirementId: result.previousProductRequirementId,
            productRequirementId: result.productRequirementId,
            teamId: result.teamId,
            teamName: result.team.name,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Reactivate a canceled sub-requirement --
    reactivateSubRequirement: tool({
      description:
        "Reactivate a canceled sub-requirement, returning it to DRAFT status. " +
        "All canceled child test procedures and skipped test cases are also reactivated " +
        "(TPs to ACTIVE, TCs to PENDING). " +
        "The parent product requirement must not be CANCELED (reactivate it first). " +
        "If the user wants to undo a cancellation, use this tool. " +
        "IMPORTANT: Only call this tool after the user has explicitly confirmed this action in their last message.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the sub-requirement to reactivate"),
        confirmReactivate: z.literal(true).describe("Must be true to confirm reactivation"),
      }),
      execute: async (args) => {
        try {
          const result = await reactivateSubRequirement(
            args.id,
            { confirmReactivate: args.confirmReactivate },
            ctx
          );
          return {
            id: result.id,
            title: result.title,
            status: result.status,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),
  };
}
