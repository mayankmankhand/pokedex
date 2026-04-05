// LLM tools for test case mutations.
// Test cases belong to a specific TestProcedureVersion.

import { tool } from "ai";
import { z } from "zod";
import type { RequestContext } from "@/lib/request-context";
import {
  createTestCase,
  updateTestCase,
  recordTestResult,
  skipTestCase,
  correctTestResult,
  reExecuteTestCase,
  updateTestCaseNotes,
} from "@/services/test-case.service";
import { formatToolError } from "./tool-wrapper";

export function createTestCaseTools(ctx: RequestContext) {
  return {
    // -- Create a new test case --
    createTestCase: tool({
      description:
        "Create a new test case linked to a test procedure version. " +
        "Starts in PENDING status with no result.",
      inputSchema: z.object({
        title: z.string().trim().min(1).max(255).describe("Short title for the test case"),
        description: z.string().trim().min(1).describe("What this test case verifies"),
        testProcedureVersionId: z.string().uuid().describe("ID of the parent test procedure version"),
      }),
      execute: async (args) => {
        try {
          const result = await createTestCase(
            {
              title: args.title,
              description: args.description,
              testProcedureVersionId: args.testProcedureVersionId,
            },
            ctx
          );
          return {
            id: result.id,
            title: result.title,
            status: result.status,
            testProcedureVersionId: result.testProcedureVersionId,
            createdAt: result.createdAt,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Update a pending test case --
    updateTestCase: tool({
      description:
        "Update a test case that is still in PENDING status. " +
        "Once a result has been recorded or the test case has been skipped, it cannot be edited. " +
        "At least one of title or description must be provided.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the test case to update"),
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

          const result = await updateTestCase(args.id, input, ctx);
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

    // -- Record a test result --
    recordTestResult: tool({
      description:
        "Record a result (PASS, FAIL, BLOCKED, or SKIPPED) on a test case. " +
        "The parent procedure version must be APPROVED. " +
        "SKIPPED returns the test case to PENDING (temporary deferral). " +
        "To permanently skip, use skipTestCase instead.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the test case"),
        result: z.enum(["PASS", "FAIL", "BLOCKED", "SKIPPED"]).describe("Test result"),
        notes: z.string().trim().optional().describe("Optional notes about the result"),
      }),
      execute: async (args) => {
        try {
          const updated = await recordTestResult(
            args.id,
            { result: args.result, notes: args.notes },
            ctx
          );
          return {
            id: updated.id,
            title: updated.title,
            status: updated.status,
            result: updated.result,
            notes: updated.notes,
            executedAt: updated.executedAt,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Skip a test case --
    skipTestCase: tool({
      description:
        "Mark a test case as skipped. Cannot record results after this. " +
        "IMPORTANT: Only call this tool after the user has explicitly confirmed this action in their last message.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the test case to skip"),
        confirmSkip: z.literal(true).describe("Must be true to confirm skipping"),
      }),
      execute: async (args) => {
        try {
          const result = await skipTestCase(args.id, ctx);
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

    // -- Correct a wrong test result --
    correctTestResult: tool({
      description:
        "Correct a wrong result on a test case that has a PASS, FAIL, or BLOCKED result. " +
        "All pairwise transitions are allowed (PASS to FAIL, FAIL to BLOCKED, etc). " +
        "Cannot correct to the same result. Use this when the user says they recorded the wrong result. " +
        "For re-running a test after a bug fix, use reExecuteTestCase instead. " +
        "IMPORTANT: Only call this tool after the user has explicitly confirmed this action in their last message.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the test case to correct"),
        confirmCorrection: z.literal(true).describe("Must be true to confirm correction"),
        result: z.enum(["PASS", "FAIL", "BLOCKED"]).describe("The correct result"),
        notes: z
          .union([z.string().trim().min(1), z.null()])
          .optional()
          .describe("New notes (string to set, null to clear, omit to keep unchanged)"),
      }),
      execute: async (args) => {
        try {
          const input: { result: "PASS" | "FAIL" | "BLOCKED"; notes?: string | null } = {
            result: args.result,
          };
          if (args.notes !== undefined) input.notes = args.notes;

          const updated = await correctTestResult(args.id, input, ctx);
          return {
            id: updated.id,
            title: updated.title,
            status: updated.status,
            result: updated.result,
            notes: updated.notes,
            executedAt: updated.executedAt,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Re-execute a failed or blocked test case --
    reExecuteTestCase: tool({
      description:
        "Reset a FAILED or BLOCKED test case back to PENDING for a fresh execution. " +
        "Clears result, notes, executor, and execution timestamp. " +
        "Use this when a bug was fixed and the team wants to re-run the test. " +
        "For correcting a wrong result without re-running, use correctTestResult instead. " +
        "IMPORTANT: Only call this tool after the user has explicitly confirmed this action in their last message.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the test case to re-execute"),
        confirmReExecute: z.literal(true).describe("Must be true to confirm re-execution"),
      }),
      execute: async (args) => {
        try {
          const result = await reExecuteTestCase(
            args.id,
            { confirmReExecute: args.confirmReExecute },
            ctx
          );
          return {
            id: result.id,
            title: result.title,
            status: result.status,
            result: result.result,
            notes: result.notes,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),

    // -- Update notes on an executed test case --
    updateTestCaseNotes: tool({
      description:
        "Add or edit notes on an already-executed test case (PASSED, FAILED, or BLOCKED) " +
        "without changing the result. Use this when the executor wants to add context after recording a result. " +
        "Pass null to clear notes.",
      inputSchema: z.object({
        id: z.string().uuid().describe("ID of the test case"),
        notes: z
          .union([z.string().trim().min(1), z.null()])
          .describe("Notes to set (string) or clear (null)"),
      }),
      execute: async (args) => {
        try {
          const updated = await updateTestCaseNotes(
            args.id,
            { notes: args.notes },
            ctx
          );
          return {
            id: updated.id,
            title: updated.title,
            status: updated.status,
            notes: updated.notes,
          };
        } catch (error) {
          return { error: formatToolError(error) };
        }
      },
    }),
  };
}
