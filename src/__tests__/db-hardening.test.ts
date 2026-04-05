// DB Hardening tests (Issue #8)
// Verifies that database-level constraints enforce business rules:
// - Partial unique index: single draft per test procedure
// - CHECK constraint: exclusive arc on attachments
// - FK constraints: user IDs must reference valid users
// - Soft-delete: removed attachments excluded from queries

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import * as prService from "@/services/product-requirement.service";
import * as srService from "@/services/sub-requirement.service";
import * as tpService from "@/services/test-procedure.service";
import * as attService from "@/services/attachment.service";
import { DEMO_TEAMS, DEMO_USERS } from "@/lib/demo-users";
import type { RequestContext } from "@/lib/request-context";

const prisma = new PrismaClient();

const ctx: RequestContext = {
  userId: DEMO_USERS[0].id,
  teamId: DEMO_TEAMS[0].id,
  role: "engineer",
  requestId: "db-hardening-test",
  sessionId: "test-session",
  source: "api",
};

// Track created entities for cleanup
const createdIds = {
  productRequirements: [] as string[],
  subRequirements: [] as string[],
  testProcedures: [] as string[],
  testProcedureVersions: [] as string[],
  attachments: [] as string[],
};

beforeAll(async () => {
  // Ensure demo teams and users exist (FK targets)
  for (const team of DEMO_TEAMS) {
    await prisma.team.upsert({
      where: { id: team.id },
      update: {},
      create: { id: team.id, name: team.name },
    });
  }
  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
      },
    });
  }
});

afterAll(async () => {
  // Clean up in reverse dependency order
  const allIds = [
    ...createdIds.attachments,
    ...createdIds.testProcedureVersions,
    ...createdIds.testProcedures,
    ...createdIds.subRequirements,
    ...createdIds.productRequirements,
  ];

  for (const id of allIds) {
    await prisma.auditLog.deleteMany({ where: { entityId: id } });
  }

  for (const id of createdIds.attachments) {
    await prisma.attachment.delete({ where: { id } }).catch(() => {});
  }
  for (const id of createdIds.testProcedureVersions) {
    await prisma.testProcedureVersion.delete({ where: { id } }).catch(() => {});
  }
  for (const id of createdIds.testProcedures) {
    await prisma.testProcedure.delete({ where: { id } }).catch(() => {});
  }
  for (const id of createdIds.subRequirements) {
    await prisma.subRequirement.delete({ where: { id } }).catch(() => {});
  }
  for (const id of createdIds.productRequirements) {
    await prisma.productRequirement.delete({ where: { id } }).catch(() => {});
  }

  await prisma.$disconnect();
});

// ─── Helper: create PR -> SR -> TP chain ───────────────────
// Note: createTestProcedure auto-creates a DRAFT v1.

async function createChain() {
  const pr = await prService.createProductRequirement(
    { title: "DB-Hardening PR", description: "Test PR" },
    ctx
  );
  createdIds.productRequirements.push(pr.id);

  const sr = await srService.createSubRequirement(
    {
      title: "DB-Hardening SR",
      description: "Test SR",
      productRequirementId: pr.id,
      teamId: ctx.teamId,
    },
    ctx
  );
  createdIds.subRequirements.push(sr.id);

  const tp = await tpService.createTestProcedure(
    {
      title: "DB-Hardening TP",
      subRequirementId: sr.id,
      description: "Test procedure for DB hardening",
      steps: "Step 1: Verify constraints",
    },
    ctx
  );
  createdIds.testProcedures.push(tp.id);

  // Track the auto-created v1 for cleanup
  const v1 = tp.versions[0];
  createdIds.testProcedureVersions.push(v1.id);

  return { pr, sr, tp, v1 };
}

// ─── Single Draft Per Procedure (Partial Unique Index) ─────

describe("Single draft per procedure", () => {
  it("rejects a second DRAFT version for the same procedure", async () => {
    // createChain auto-creates a DRAFT v1, so creating v2 as DRAFT should fail
    const { tp } = await createChain();

    await expect(
      tpService.createTestProcedureVersion(
        tp.id,
        { description: "Draft v2", steps: "Step 2" },
        ctx
      )
    ).rejects.toThrow(/already has a draft version/);
  });

  it("allows a new DRAFT after the first is approved", async () => {
    const { tp, v1 } = await createChain();

    // Approve the auto-created v1
    await tpService.approveTestProcedureVersion(v1.id, ctx);

    // Now creating v2 as DRAFT should succeed
    const v2 = await tpService.createTestProcedureVersion(
      tp.id,
      { description: "V2", steps: "Step 2" },
      ctx
    );
    createdIds.testProcedureVersions.push(v2.id);

    expect(v2.status).toBe("DRAFT");
  });
});

// ─── Exclusive Arc CHECK Constraint ────────────────────────

describe("Attachment exclusive arc constraint", () => {
  it("rejects an attachment with zero parent FKs", async () => {
    // Bypass service-layer Zod validation to test DB constraint directly
    await expect(
      prisma.attachment.create({
        data: {
          fileName: "orphan.pdf",
          fileUrl: "/files/orphan.pdf",
          fileType: "DOCUMENT",
          uploadedBy: ctx.userId,
        },
      })
    ).rejects.toThrow();
  });

  it("rejects an attachment with two parent FKs", async () => {
    const { pr, sr } = await createChain();

    await expect(
      prisma.attachment.create({
        data: {
          fileName: "double-parent.pdf",
          fileUrl: "/files/double-parent.pdf",
          fileType: "DOCUMENT",
          uploadedBy: ctx.userId,
          productRequirementId: pr.id,
          subRequirementId: sr.id,
        },
      })
    ).rejects.toThrow();
  });

  it("accepts an attachment with exactly one parent FK", async () => {
    const { pr } = await createChain();

    const att = await prisma.attachment.create({
      data: {
        fileName: "valid.pdf",
        fileUrl: "/files/valid.pdf",
        fileType: "DOCUMENT",
        uploadedBy: ctx.userId,
        productRequirementId: pr.id,
      },
    });
    createdIds.attachments.push(att.id);

    expect(att.status).toBe("ACTIVE");
  });
});

// ─── User FK Constraints ───────────────────────────────────

describe("User FK constraints", () => {
  it("rejects a product requirement with an invalid createdBy user ID", async () => {
    await expect(
      prisma.productRequirement.create({
        data: {
          title: "Bad user PR",
          description: "Should fail",
          createdBy: "00000000-0000-0000-0000-000000000000",
        },
      })
    ).rejects.toThrow();
  });

  it("rejects an attachment with an invalid uploadedBy user ID", async () => {
    const pr = await prService.createProductRequirement(
      { title: "FK test PR", description: "Test" },
      ctx
    );
    createdIds.productRequirements.push(pr.id);

    await expect(
      prisma.attachment.create({
        data: {
          fileName: "bad-uploader.pdf",
          fileUrl: "/files/bad-uploader.pdf",
          fileType: "DOCUMENT",
          uploadedBy: "00000000-0000-0000-0000-000000000000",
          productRequirementId: pr.id,
        },
      })
    ).rejects.toThrow();
  });
});

// ─── Soft Delete ───────────────────────────────────────────

describe("Attachment soft-delete", () => {
  it("marks attachment as REMOVED instead of deleting", async () => {
    const { pr } = await createChain();

    const att = await attService.addAttachment(
      {
        fileName: "to-remove.pdf",
        fileType: "DOCUMENT",
        productRequirementId: pr.id,
      },
      ctx
    );
    createdIds.attachments.push(att.id);

    await attService.removeAttachment(att.id, ctx);

    // Row still exists but is marked REMOVED
    const row = await prisma.attachment.findUnique({ where: { id: att.id } });
    expect(row).not.toBeNull();
    expect(row!.status).toBe("REMOVED");
  });

  it("excludes removed attachments from parent queries", async () => {
    const { pr } = await createChain();

    const att1 = await attService.addAttachment(
      { fileName: "keep.pdf", fileType: "DOCUMENT", productRequirementId: pr.id },
      ctx
    );
    createdIds.attachments.push(att1.id);

    const att2 = await attService.addAttachment(
      { fileName: "remove.pdf", fileType: "DOCUMENT", productRequirementId: pr.id },
      ctx
    );
    createdIds.attachments.push(att2.id);

    await attService.removeAttachment(att2.id, ctx);

    // Query with ACTIVE filter (same pattern as API routes)
    const result = await prisma.productRequirement.findUniqueOrThrow({
      where: { id: pr.id },
      include: { attachments: { where: { status: "ACTIVE" } } },
    });

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].id).toBe(att1.id);
  });
});
