import { z } from "zod";

// ─── Create ────────────────────────────────────────────
// Links to a parent ProductRequirement and a responsible Team.

export const CreateSubRequirementInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  description: z.string().trim().min(1, "Description is required"),
  productRequirementId: z.string().uuid("Must be a valid UUID"),
  teamId: z.string().uuid("Must be a valid UUID"),
});

export type CreateSubRequirementInput = z.infer<
  typeof CreateSubRequirementInput
>;

// ─── Update ────────────────────────────────────────────
// Partial update - at least one field must be provided.

export const UpdateSubRequirementInput = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty").max(255).optional(),
    description: z
      .string()
      .trim()
      .min(1, "Description cannot be empty")
      .optional(),
  })
  .refine((data) => data.title !== undefined || data.description !== undefined, {
    message: "At least one field (title or description) must be provided",
  });

export type UpdateSubRequirementInput = z.infer<
  typeof UpdateSubRequirementInput
>;

// ─── Approve ──────────────────────────────────────────

export const ApproveSubRequirementInput = z.object({
  confirmApprove: z.literal(true, {
    errorMap: () => ({ message: "confirmApprove must be true" }),
  }),
});

export type ApproveSubRequirementInput = z.infer<
  typeof ApproveSubRequirementInput
>;

// ─── Cancel ───────────────────────────────────────────

export const CancelSubRequirementInput = z.object({
  confirmCancel: z.literal(true, {
    errorMap: () => ({ message: "confirmCancel must be true" }),
  }),
});

export type CancelSubRequirementInput = z.infer<
  typeof CancelSubRequirementInput
>;

// ─── Reactivate ─────────────────────────────────────

export const ReactivateSubRequirementInput = z.object({
  confirmReactivate: z.literal(true, {
    errorMap: () => ({ message: "confirmReactivate must be true" }),
  }),
});

export type ReactivateSubRequirementInput = z.infer<
  typeof ReactivateSubRequirementInput
>;

// ─── Re-Parent ──────────────────────────────────────────
// Moves this sub-requirement to a different product requirement.
// Confirm-before-act: structural change affects hierarchy visibility.

export const ReParentSubRequirementInput = z.object({
  newProductRequirementId: z.string().uuid("Must be a valid UUID"),
  confirmReParent: z.literal(true, {
    errorMap: () => ({ message: "confirmReParent must be true" }),
  }),
});

export type ReParentSubRequirementInput = z.infer<
  typeof ReParentSubRequirementInput
>;
