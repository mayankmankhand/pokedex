// LLM tools for test procedure mutations.
// Test procedures use two-entity versioning: a logical procedure + immutable version snapshots.

import { tool } from "ai";
import { z } from "zod";
import type { RequestContext } from "@/lib/request-context";
import {
  createTestProcedure,
  createTestProcedureVersion,
  updateTestProcedure,
  updateTestProcedureVersion,
  approveTestProcedureVersion,
  cancelTestProcedure,
  reParentTestProcedure,
  reactivateTestProcedure,
} from "@/services/test-procedure.service";
import { formatToolError } from "./tool-wrapper";

export function createTestProcedureTools(ctx: RequestContext) {
  return {
    // -- Create a new test procedure (also creates draft v1) --
    createTestProcedure: tool({
      description:
        "Create a new test procedure linked to a sub-requirement. " +
        "This also creates the first draft version (v1) with the provided description and steps.",
      inputSchema: z.object({
        title: z.string().trim().min(1).max(255).describe("Short title for the procedure"),
        subRequirementId: z.string().uuid().describe("ID of the parent sub-requirement"),
        description: z.string().trim().min(1).describe("What this procedure tests"),
        steps: z.string().trim().min(1).describe("Step-by-step instructions for executing the test"),
      }),
      execute: async (args) => {
        try {
          const result = await createTestProcedure(
            {
              title: args.title,
              subRequirementId: args.subRequirementId,
              description: args.description,
              steps: args.steps,
            },
            ctx
          );
          return {
            id: result.id,
            title: result.title,
            status: result.status,
            subRequirementId: result.subRequirementId,
            versions: result.versions.map((v) => ({
              id: v.id,
              versionNumber: v.versionNumber,
              status: v.status,
            })),
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Create a new version on an existing procedure --
    createTestProcedureVersion: tool({
      description:
        "Create a new draft version on an existing test procedure. " +
        "Only one draft version is allowed per procedure. " +
        "The version number is assigned automatically.",
      inputSchema: z.object({
        procedureId: z.string().uuid().describe("ID of the test procedure"),
        description: z.string().trim().min(1).describe("What changed in this version"),
        steps: z.string().trim().min(1).describe("Updated step-by-step instructions"),
      }),
      execute: async (args) => {
        try {
          const result = await createTestProcedureVersion(
            args.procedureId,
            { description: args.description, steps: args.steps },
            ctx
          );
          return {
            id: result.id,
            testProcedureId: result.testProcedureId,
            versionNumber: result.versionNumber,
            status: result.status,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Update a test procedure title --
    updateTestProcedure: tool({
      description:
        "Update the title of a test procedure. " +
        "Only ACTIVE procedures can be updated (not CANCELED).",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the test procedure to update"),
        title: z.string().trim().min(1).max(255).describe("New title"),
      }),
      execute: async (args) => {
        try {
          const result = await updateTestProcedure(
            args.id,
            { title: args.title },
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

    // -- Update a procedure version (DRAFT or APPROVED) --
    updateTestProcedureVersion: tool({
      description:
        "Update a test procedure version. " +
        "DRAFT: description and steps can be changed. " +
        "APPROVED: only description can be changed (for typo fixes). Steps are locked. " +
        "At least one of description or steps must be provided.",
      inputSchema: z.object({
        versionId: z.string().uuid().describe("ID of the version to update"),
        description: z.string().trim().min(1).optional().describe("New description (optional)"),
        steps: z.string().trim().min(1).optional().describe("New steps (optional)"),
      }).refine(
        (data) => data.description !== undefined || data.steps !== undefined,
        { message: "At least one of description or steps must be provided" }
      ),
      execute: async (args) => {
        try {
          const input: { description?: string; steps?: string } = {};
          if (args.description !== undefined) input.description = args.description;
          if (args.steps !== undefined) input.steps = args.steps;

          const result = await updateTestProcedureVersion(args.versionId, input, ctx);
          return {
            id: result.id,
            versionNumber: result.versionNumber,
            description: result.description,
            status: result.status,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Approve a draft version --
    approveTestProcedureVersion: tool({
      description:
        "Approve a test procedure version, locking it from further edits. " +
        "Only DRAFT versions can be approved. " +
        "IMPORTANT: Only call this tool after the user has explicitly confirmed this action in their last message.",
      inputSchema: z.object({
        versionId: z.string().uuid().describe("ID of the version to approve"),
        confirmApprove: z.literal(true).describe("Must be true to confirm approval"),
      }),
      execute: async (args) => {
        try {
          const result = await approveTestProcedureVersion(args.versionId, ctx);
          return {
            id: result.id,
            versionNumber: result.versionNumber,
            status: result.status,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Cancel an entire procedure --
    cancelTestProcedure: tool({
      description:
        "Mark an entire test procedure as canceled. " +
        "Cannot cancel a procedure that is already canceled. " +
        "If the user wants to move this entity instead of canceling it, use reParentTestProcedure instead. " +
        "IMPORTANT: Only call this tool after the user has explicitly confirmed this action in their last message.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the test procedure to cancel"),
        confirmCancel: z.literal(true).describe("Must be true to confirm canceling"),
      }),
      execute: async (args) => {
        try {
          const result = await cancelTestProcedure(args.id, ctx);
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

    // -- Re-parent a test procedure (move to different SR) --
    reParentTestProcedure: tool({
      description:
        "Move a test procedure to a different sub-requirement. " +
        "All versions and test cases stay attached. " +
        "CANCELED procedures cannot be moved. " +
        "ACTIVE procedures can move to both DRAFT and APPROVED sub-requirements. " +
        "Note: if the target SR is under a different product requirement, " +
        "tell the user this also changes which PR scope the procedure falls under. " +
        "IMPORTANT: Only call this tool after the user has explicitly confirmed this action in their last message.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the test procedure to move"),
        newSubRequirementId: z
          .string()
          .uuid()
          .describe("ID of the target sub-requirement"),
        confirmReParent: z
          .literal(true)
          .describe("Must be true to confirm the move"),
      }),
      execute: async (args) => {
        try {
          const result = await reParentTestProcedure(
            args.id,
            {
              newSubRequirementId: args.newSubRequirementId,
              confirmReParent: args.confirmReParent,
            },
            ctx
          );
          return {
            id: result.id,
            title: result.title,
            status: result.status,
            previousSubRequirementId: result.previousSubRequirementId,
            subRequirementId: result.subRequirementId,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Reactivate a canceled test procedure --
    reactivateTestProcedure: tool({
      description:
        "Reactivate a canceled test procedure, returning it to ACTIVE status. " +
        "All skipped test cases are also reactivated to PENDING. " +
        "The parent sub-requirement must not be CANCELED (reactivate it first). " +
        "If the user wants to undo a cancellation, use this tool. " +
        "IMPORTANT: Only call this tool after the user has explicitly confirmed this action in their last message.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the test procedure to reactivate"),
        confirmReactivate: z.literal(true).describe("Must be true to confirm reactivation"),
      }),
      execute: async (args) => {
        try {
          const result = await reactivateTestProcedure(
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
