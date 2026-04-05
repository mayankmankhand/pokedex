import { z } from "zod";

// ─── Create Test Procedure ─────────────────────────────
// Creates the logical procedure AND its first draft version (v1)
// in a single request. This keeps the API simple for callers.

export const CreateTestProcedureInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  subRequirementId: z.string().uuid("Must be a valid UUID"),
  description: z.string().trim().min(1, "Description is required"),
  steps: z.string().trim().min(1, "Steps are required"),
});

export type CreateTestProcedureInput = z.infer<
  typeof CreateTestProcedureInput
>;

// ─── Update Procedure ────────────────────────────────────
// Updates the logical procedure metadata (currently just title).

export const UpdateTestProcedureInput = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty").max(255).optional(),
  })
  .refine((data) => data.title !== undefined, {
    message: "At least one field (title) must be provided",
  });

export type UpdateTestProcedureInput = z.infer<
  typeof UpdateTestProcedureInput
>;

// ─── Create Version ────────────────────────────────────
// Creates a new DRAFT version on an existing procedure.
// The version number is auto-incremented by the service layer.

export const CreateTestProcedureVersionInput = z.object({
  description: z.string().trim().min(1, "Description is required"),
  steps: z.string().trim().min(1, "Steps are required"),
});

export type CreateTestProcedureVersionInput = z.infer<
  typeof CreateTestProcedureVersionInput
>;

// ─── Update Version ────────────────────────────────────
// Only allowed while the version is still in DRAFT status.

export const UpdateTestProcedureVersionInput = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, "Description cannot be empty")
      .optional(),
    steps: z.string().trim().min(1, "Steps cannot be empty").optional(),
  })
  .refine((data) => data.description !== undefined || data.steps !== undefined, {
    message: "At least one field (description or steps) must be provided",
  });

export type UpdateTestProcedureVersionInput = z.infer<
  typeof UpdateTestProcedureVersionInput
>;

// ─── Approve Version ──────────────────────────────────
// Locks the version - no more edits allowed after this.

export const ApproveTestProcedureVersionInput = z.object({
  confirmApprove: z.literal(true, {
    errorMap: () => ({ message: "confirmApprove must be true" }),
  }),
});

export type ApproveTestProcedureVersionInput = z.infer<
  typeof ApproveTestProcedureVersionInput
>;

// ─── Cancel Procedure ─────────────────────────────────
// Marks the entire logical procedure as canceled.

export const CancelTestProcedureInput = z.object({
  confirmCancel: z.literal(true, {
    errorMap: () => ({ message: "confirmCancel must be true" }),
  }),
});

export type CancelTestProcedureInput = z.infer<
  typeof CancelTestProcedureInput
>;

// ─── Reactivate Procedure ───────────────────────────
// Transitions CANCELED -> ACTIVE. Same confirmation pattern.

export const ReactivateTestProcedureInput = z.object({
  confirmReactivate: z.literal(true, {
    errorMap: () => ({ message: "confirmReactivate must be true" }),
  }),
});

export type ReactivateTestProcedureInput = z.infer<
  typeof ReactivateTestProcedureInput
>;

// ─── Re-Parent Procedure ────────────────────────────────
// Moves this test procedure to a different sub-requirement.
// Confirm-before-act: structural change affects hierarchy visibility.

export const ReParentTestProcedureInput = z.object({
  newSubRequirementId: z.string().uuid("Must be a valid UUID"),
  confirmReParent: z.literal(true, {
    errorMap: () => ({ message: "confirmReParent must be true" }),
  }),
});

export type ReParentTestProcedureInput = z.infer<
  typeof ReParentTestProcedureInput
>;
