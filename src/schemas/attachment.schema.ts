import { z } from "zod";

// ─── Create ────────────────────────────────────────────
// An attachment belongs to exactly ONE parent entity.
// The Exclusive Arc constraint is enforced via .refine() below -
// exactly one of the four FK fields must be provided.

export const CreateAttachmentInput = z
  .object({
    fileName: z.string().trim().min(1, "File name is required").max(255),
    fileType: z.enum(["DOCUMENT", "IMAGE", "SPREADSHEET", "OTHER"]),
    productRequirementId: z
      .string()
      .uuid("Must be a valid UUID")
      .nullish(),
    subRequirementId: z
      .string()
      .uuid("Must be a valid UUID")
      .nullish(),
    testProcedureId: z
      .string()
      .uuid("Must be a valid UUID")
      .nullish(),
    testCaseId: z
      .string()
      .uuid("Must be a valid UUID")
      .nullish(),
  })
  .refine(
    (data) => {
      // Count how many parent FK fields are non-null
      const parentIds = [
        data.productRequirementId,
        data.subRequirementId,
        data.testProcedureId,
        data.testCaseId,
      ];
      const nonNullCount = parentIds.filter(
        (id) => id !== null && id !== undefined
      ).length;
      return nonNullCount === 1;
    },
    {
      message:
        "Exactly one parent must be specified (productRequirementId, subRequirementId, testProcedureId, or testCaseId)",
    }
  );

export type CreateAttachmentInput = z.infer<typeof CreateAttachmentInput>;
