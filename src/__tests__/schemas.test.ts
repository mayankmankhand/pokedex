// Unit tests for Zod schema validation.
// These are pure in-memory tests - no database needed.

import { describe, it, expect } from "vitest";
import {
  CreateProductRequirementInput,
  ApproveProductRequirementInput,
} from "@/schemas/product-requirement.schema";
import { CreateAttachmentInput } from "@/schemas/attachment.schema";
import { PaginationParams } from "@/schemas/query.schema";

// ─── ProductRequirement Schemas ─────────────────────────

describe("CreateProductRequirementInput", () => {
  it("accepts valid input", () => {
    const result = CreateProductRequirementInput.safeParse({
      title: "My Requirement",
      description: "A detailed description of the requirement.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("My Requirement");
      expect(result.data.description).toBe(
        "A detailed description of the requirement."
      );
    }
  });

  it("rejects empty title", () => {
    const result = CreateProductRequirementInput.safeParse({
      title: "",
      description: "Valid description",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const titleError = result.error.issues.find(
        (i) => i.path[0] === "title"
      );
      expect(titleError).toBeDefined();
      expect(titleError?.message).toBe("Title is required");
    }
  });
});

describe("ApproveProductRequirementInput", () => {
  it("requires confirmApprove to be exactly true", () => {
    const result = ApproveProductRequirementInput.safeParse({
      confirmApprove: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects confirmApprove: false", () => {
    const result = ApproveProductRequirementInput.safeParse({
      confirmApprove: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(
        (i) => i.path[0] === "confirmApprove"
      );
      expect(error).toBeDefined();
      expect(error?.message).toBe("confirmApprove must be true");
    }
  });
});

// ─── Attachment Schema (Exclusive Arc) ──────────────────

describe("CreateAttachmentInput", () => {
  const validUuid = "a1b2c3d4-0001-4000-8000-000000000001";
  const validUuid2 = "a1b2c3d4-0002-4000-8000-000000000002";

  it("accepts when exactly one parent FK is set", () => {
    const result = CreateAttachmentInput.safeParse({
      fileName: "spec.pdf",
      fileType: "DOCUMENT",
      productRequirementId: validUuid,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when zero parent FKs are set", () => {
    const result = CreateAttachmentInput.safeParse({
      fileName: "orphan.pdf",
      fileType: "DOCUMENT",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const arcError = result.error.issues.find((i) =>
        i.message.includes("Exactly one parent")
      );
      expect(arcError).toBeDefined();
    }
  });

  it("rejects when two parent FKs are set", () => {
    const result = CreateAttachmentInput.safeParse({
      fileName: "double-parent.pdf",
      fileType: "DOCUMENT",
      productRequirementId: validUuid,
      subRequirementId: validUuid2,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const arcError = result.error.issues.find((i) =>
        i.message.includes("Exactly one parent")
      );
      expect(arcError).toBeDefined();
    }
  });

  it("rejects invalid file type", () => {
    const result = CreateAttachmentInput.safeParse({
      fileName: "data.exe",
      fileType: "EXECUTABLE",
      productRequirementId: validUuid,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const typeError = result.error.issues.find(
        (i) => i.path[0] === "fileType"
      );
      expect(typeError).toBeDefined();
    }
  });
});

// ─── Query Schemas ──────────────────────────────────────

describe("PaginationParams", () => {
  it("defaults page to 1 and limit to 20", () => {
    const result = PaginationParams.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("coerces string numbers", () => {
    const result = PaginationParams.parse({ page: "3", limit: "50" });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it("rejects page < 1", () => {
    const result = PaginationParams.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects limit > 100", () => {
    const result = PaginationParams.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });
});
