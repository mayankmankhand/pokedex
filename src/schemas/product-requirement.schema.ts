import { z } from "zod";

// ─── Create ────────────────────────────────────────────
// Used when creating a new product requirement (starts as DRAFT).

export const CreateProductRequirementInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  description: z.string().trim().min(1, "Description is required"),
});

export type CreateProductRequirementInput = z.infer<
  typeof CreateProductRequirementInput
>;

// ─── Update ────────────────────────────────────────────
// Partial update - at least one field must be provided.

export const UpdateProductRequirementInput = z
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

export type UpdateProductRequirementInput = z.infer<
  typeof UpdateProductRequirementInput
>;

// ─── Approve ──────────────────────────────────────────
// Transitions DRAFT -> APPROVED. The literal(true) forces the caller
// to explicitly confirm, preventing accidental approvals.

export const ApproveProductRequirementInput = z.object({
  confirmApprove: z.literal(true, {
    errorMap: () => ({ message: "confirmApprove must be true" }),
  }),
});

export type ApproveProductRequirementInput = z.infer<
  typeof ApproveProductRequirementInput
>;

// ─── Cancel ───────────────────────────────────────────
// Transitions APPROVED -> CANCELED. Same confirmation pattern.

export const CancelProductRequirementInput = z.object({
  confirmCancel: z.literal(true, {
    errorMap: () => ({ message: "confirmCancel must be true" }),
  }),
});

export type CancelProductRequirementInput = z.infer<
  typeof CancelProductRequirementInput
>;

// ─── Reactivate ─────────────────────────────────────
// Transitions CANCELED -> DRAFT. Same confirmation pattern.

export const ReactivateProductRequirementInput = z.object({
  confirmReactivate: z.literal(true, {
    errorMap: () => ({ message: "confirmReactivate must be true" }),
  }),
});

export type ReactivateProductRequirementInput = z.infer<
  typeof ReactivateProductRequirementInput
>;
