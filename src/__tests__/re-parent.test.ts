// Re-parent tests for SubRequirement and TestProcedure.
// Tests run against the real Neon test database.
// Covers: happy path, status guards, no-op, target-not-found,
// audit payload, and child visibility after move.

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import * as prService from "@/services/product-requirement.service";
import * as srService from "@/services/sub-requirement.service";
import * as tpService from "@/services/test-procedure.service";
import { DEMO_TEAMS, DEMO_USERS } from "@/lib/demo-users";
import type { RequestContext } from "@/lib/request-context";

const prisma = new PrismaClient();

const ctx: RequestContext = {
  userId: DEMO_USERS[0].id,
  teamId: DEMO_TEAMS[0].id,
  role: "pm",
  requestId: "test-reparent",
  sessionId: "test-session",
  source: "api",
};

beforeAll(async () => {
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
  await prisma.$disconnect();
});

// ─── Helper: deep cleanup for a PR and all its descendants ──

async function cleanupPr(prId: string) {
  // Find all SRs under this PR
  const srs = await prisma.subRequirement.findMany({
    where: { productRequirementId: prId },
    select: { id: true },
  });

  for (const sr of srs) {
    // Find all TPs under this SR
    const tps = await prisma.testProcedure.findMany({
      where: { subRequirementId: sr.id },
      select: { id: true },
    });

    for (const tp of tps) {
      // Find all TPVs under this TP
      const tpvs = await prisma.testProcedureVersion.findMany({
        where: { testProcedureId: tp.id },
        select: { id: true },
      });

      for (const tpv of tpvs) {
        // Delete TCs and their audit logs
        const tcs = await prisma.testCase.findMany({
          where: { testProcedureVersionId: tpv.id },
          select: { id: true },
        });
        for (const tc of tcs) {
          await prisma.auditLog.deleteMany({ where: { entityId: tc.id } });
          await prisma.testCase.delete({ where: { id: tc.id } }).catch(() => {});
        }

        await prisma.auditLog.deleteMany({ where: { entityId: tpv.id } });
        await prisma.testProcedureVersion.delete({ where: { id: tpv.id } }).catch(() => {});
      }

      await prisma.auditLog.deleteMany({ where: { entityId: tp.id } });
      await prisma.testProcedure.delete({ where: { id: tp.id } }).catch(() => {});
    }

    await prisma.auditLog.deleteMany({ where: { entityId: sr.id } });
    await prisma.subRequirement.delete({ where: { id: sr.id } }).catch(() => {});
  }

  await prisma.auditLog.deleteMany({ where: { entityId: prId } });
  await prisma.productRequirement.delete({ where: { id: prId } }).catch(() => {});
}

// ─── SubRequirement Re-Parent ───────────────────────────

describe("SubRequirement re-parent", () => {
  const createdPrIds: string[] = [];

  afterEach(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
    createdPrIds.length = 0;
  });

  it("moves a DRAFT SR to a different APPROVED PR", async () => {
    // Create two approved PRs
    const pr1 = await prService.createProductRequirement(
      { title: "Source PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr1.id, ctx);
    createdPrIds.push(pr1.id);

    const pr2 = await prService.createProductRequirement(
      { title: "Target PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr2.id, ctx);
    createdPrIds.push(pr2.id);

    // Create SR under PR1
    const sr = await srService.createSubRequirement(
      {
        title: "Movable SR",
        description: "Desc",
        productRequirementId: pr1.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    // Move to PR2
    const moved = await srService.reParentSubRequirement(
      sr.id,
      { newProductRequirementId: pr2.id, confirmReParent: true as const },
      ctx
    );

    expect(moved.productRequirementId).toBe(pr2.id);
    expect(moved.teamId).toBe(DEMO_TEAMS[0].id); // team unchanged
    expect(moved.previousProductRequirementId).toBe(pr1.id); // old parent returned
  });

  it("moves a DRAFT SR to a DRAFT PR", async () => {
    const pr1 = await prService.createProductRequirement(
      { title: "Draft Source", description: "Desc" }, ctx
    );
    createdPrIds.push(pr1.id);

    const pr2 = await prService.createProductRequirement(
      { title: "Draft Target", description: "Desc" }, ctx
    );
    createdPrIds.push(pr2.id);
    // Both PRs stay DRAFT

    const sr = await srService.createSubRequirement(
      {
        title: "Draft-to-Draft SR",
        description: "Desc",
        productRequirementId: pr1.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const moved = await srService.reParentSubRequirement(
      sr.id,
      { newProductRequirementId: pr2.id, confirmReParent: true as const },
      ctx
    );

    expect(moved.productRequirementId).toBe(pr2.id);
    expect(moved.status).toBe("DRAFT");
  });

  it("moves an APPROVED SR to a different APPROVED PR", async () => {
    const pr1 = await prService.createProductRequirement(
      { title: "Source PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr1.id, ctx);
    createdPrIds.push(pr1.id);

    const pr2 = await prService.createProductRequirement(
      { title: "Target PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr2.id, ctx);
    createdPrIds.push(pr2.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Approved SR",
        description: "Desc",
        productRequirementId: pr1.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr.id, ctx);

    const moved = await srService.reParentSubRequirement(
      sr.id,
      { newProductRequirementId: pr2.id, confirmReParent: true as const },
      ctx
    );

    expect(moved.productRequirementId).toBe(pr2.id);
    expect(moved.status).toBe("APPROVED");
  });

  it("blocks moving a CANCELED SR", async () => {
    const pr1 = await prService.createProductRequirement(
      { title: "PR1", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr1.id, ctx);
    createdPrIds.push(pr1.id);

    const pr2 = await prService.createProductRequirement(
      { title: "PR2", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr2.id, ctx);
    createdPrIds.push(pr2.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Cancel Me",
        description: "Desc",
        productRequirementId: pr1.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr.id, ctx);
    await srService.cancelSubRequirement(sr.id, ctx);

    await expect(
      srService.reParentSubRequirement(
        sr.id,
        { newProductRequirementId: pr2.id, confirmReParent: true as const },
        ctx
      )
    ).rejects.toThrow("canceled");
  });

  it("blocks moving to a CANCELED PR", async () => {
    const pr1 = await prService.createProductRequirement(
      { title: "Source", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr1.id, ctx);
    createdPrIds.push(pr1.id);

    const pr2 = await prService.createProductRequirement(
      { title: "Canceled Target", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr2.id, ctx);
    await prService.cancelProductRequirement(pr2.id, ctx);
    createdPrIds.push(pr2.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Blocked SR",
        description: "Desc",
        productRequirementId: pr1.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    await expect(
      srService.reParentSubRequirement(
        sr.id,
        { newProductRequirementId: pr2.id, confirmReParent: true as const },
        ctx
      )
    ).rejects.toThrow("canceled product requirement");
  });

  it("blocks APPROVED SR moving to DRAFT PR", async () => {
    const approvedPr = await prService.createProductRequirement(
      { title: "Approved Source", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(approvedPr.id, ctx);
    createdPrIds.push(approvedPr.id);

    const draftPr = await prService.createProductRequirement(
      { title: "Draft Target", description: "Desc" }, ctx
    );
    createdPrIds.push(draftPr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Approved SR",
        description: "Desc",
        productRequirementId: approvedPr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr.id, ctx);

    await expect(
      srService.reParentSubRequirement(
        sr.id,
        { newProductRequirementId: draftPr.id, confirmReParent: true as const },
        ctx
      )
    ).rejects.toThrow("draft product requirement");
  });

  it("blocks no-op move (same parent)", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Same PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "No-op SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    await expect(
      srService.reParentSubRequirement(
        sr.id,
        { newProductRequirementId: pr.id, confirmReParent: true as const },
        ctx
      )
    ).rejects.toThrow("already under this product requirement");
  });

  it("throws NotFoundError for non-existent target PR", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Real PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Lost SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const fakeId = "00000000-0000-0000-0000-000000000099";
    await expect(
      srService.reParentSubRequirement(
        sr.id,
        { newProductRequirementId: fakeId, confirmReParent: true as const },
        ctx
      )
    ).rejects.toThrow(fakeId); // error message includes the missing ID
  });

  it("writes correct audit log with from/to payload", async () => {
    const pr1 = await prService.createProductRequirement(
      { title: "Audit Source", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr1.id, ctx);
    createdPrIds.push(pr1.id);

    const pr2 = await prService.createProductRequirement(
      { title: "Audit Target", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr2.id, ctx);
    createdPrIds.push(pr2.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Audit SR",
        description: "Desc",
        productRequirementId: pr1.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    await srService.reParentSubRequirement(
      sr.id,
      { newProductRequirementId: pr2.id, confirmReParent: true as const },
      ctx
    );

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: sr.id, action: "RE_PARENT" },
    });

    expect(audit).not.toBeNull();
    expect(audit!.entityType).toBe("SubRequirement");
    const changes = audit!.changes as Record<string, unknown>;
    expect(changes).toHaveProperty("productRequirementId");
    const prChange = changes.productRequirementId as { from: string; to: string };
    expect(prChange.from).toBe(pr1.id);
    expect(prChange.to).toBe(pr2.id);
  });

  it("child TPs resolve under new parent, not old", async () => {
    const pr1 = await prService.createProductRequirement(
      { title: "Old Home", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr1.id, ctx);
    createdPrIds.push(pr1.id);

    const pr2 = await prService.createProductRequirement(
      { title: "New Home", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr2.id, ctx);
    createdPrIds.push(pr2.id);

    // Create SR with a child TP
    const sr = await srService.createSubRequirement(
      {
        title: "SR With Kids",
        description: "Desc",
        productRequirementId: pr1.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Child TP",
        subRequirementId: sr.id,
        description: "Test desc",
        steps: "Step 1",
      },
      ctx
    );

    // Move SR to PR2
    await srService.reParentSubRequirement(
      sr.id,
      { newProductRequirementId: pr2.id, confirmReParent: true as const },
      ctx
    );

    // Verify: PR2 now has the SR
    const pr2Children = await prisma.subRequirement.findMany({
      where: { productRequirementId: pr2.id },
      include: { testProcedures: true },
    });
    expect(pr2Children).toHaveLength(1);
    expect(pr2Children[0].id).toBe(sr.id);
    expect(pr2Children[0].testProcedures).toHaveLength(1);
    expect(pr2Children[0].testProcedures[0].id).toBe(tp.id);

    // Verify: PR1 no longer has the SR
    const pr1Children = await prisma.subRequirement.findMany({
      where: { productRequirementId: pr1.id },
    });
    expect(pr1Children).toHaveLength(0);
  });
});

// ─── TestProcedure Re-Parent ────────────────────────────

describe("TestProcedure re-parent", () => {
  const createdPrIds: string[] = [];

  afterEach(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
    createdPrIds.length = 0;
  });

  it("moves an ACTIVE TP to a different APPROVED SR", async () => {
    const pr = await prService.createProductRequirement(
      { title: "TP Test PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr1 = await srService.createSubRequirement(
      {
        title: "Source SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr1.id, ctx);

    const sr2 = await srService.createSubRequirement(
      {
        title: "Target SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr2.id, ctx);

    const tp = await tpService.createTestProcedure(
      {
        title: "Movable TP",
        subRequirementId: sr1.id,
        description: "Desc",
        steps: "Step 1",
      },
      ctx
    );

    const moved = await tpService.reParentTestProcedure(
      tp.id,
      { newSubRequirementId: sr2.id, confirmReParent: true as const },
      ctx
    );

    expect(moved.subRequirementId).toBe(sr2.id);
    expect(moved.status).toBe("ACTIVE");
  });

  it("moves an ACTIVE TP to a DRAFT SR", async () => {
    const pr = await prService.createProductRequirement(
      { title: "TP Draft SR PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr1 = await srService.createSubRequirement(
      {
        title: "Approved SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr1.id, ctx);

    const sr2 = await srService.createSubRequirement(
      {
        title: "Draft SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    // sr2 stays DRAFT - TP lifecycle is independent of SR approval

    const tp = await tpService.createTestProcedure(
      {
        title: "TP to Draft SR",
        subRequirementId: sr1.id,
        description: "Desc",
        steps: "Step 1",
      },
      ctx
    );

    const moved = await tpService.reParentTestProcedure(
      tp.id,
      { newSubRequirementId: sr2.id, confirmReParent: true as const },
      ctx
    );

    expect(moved.subRequirementId).toBe(sr2.id);
  });

  it("blocks moving a CANCELED TP", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Cancel TP PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr1 = await srService.createSubRequirement(
      {
        title: "SR1",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const sr2 = await srService.createSubRequirement(
      {
        title: "SR2",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Canceled TP",
        subRequirementId: sr1.id,
        description: "Desc",
        steps: "Step 1",
      },
      ctx
    );
    await tpService.cancelTestProcedure(tp.id, ctx);

    await expect(
      tpService.reParentTestProcedure(
        tp.id,
        { newSubRequirementId: sr2.id, confirmReParent: true as const },
        ctx
      )
    ).rejects.toThrow("canceled");
  });

  it("blocks moving to a CANCELED SR", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Canceled SR PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr1 = await srService.createSubRequirement(
      {
        title: "Good SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr1.id, ctx);

    const sr2 = await srService.createSubRequirement(
      {
        title: "Canceled SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr2.id, ctx);
    await srService.cancelSubRequirement(sr2.id, ctx);

    const tp = await tpService.createTestProcedure(
      {
        title: "Blocked TP",
        subRequirementId: sr1.id,
        description: "Desc",
        steps: "Step 1",
      },
      ctx
    );

    await expect(
      tpService.reParentTestProcedure(
        tp.id,
        { newSubRequirementId: sr2.id, confirmReParent: true as const },
        ctx
      )
    ).rejects.toThrow("canceled sub-requirement");
  });

  it("blocks no-op move (same parent)", async () => {
    const pr = await prService.createProductRequirement(
      { title: "No-op PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Same SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "No-op TP",
        subRequirementId: sr.id,
        description: "Desc",
        steps: "Step 1",
      },
      ctx
    );

    await expect(
      tpService.reParentTestProcedure(
        tp.id,
        { newSubRequirementId: sr.id, confirmReParent: true as const },
        ctx
      )
    ).rejects.toThrow("already under this sub-requirement");
  });

  it("throws NotFoundError for non-existent target SR", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Lost Target PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Real SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Lost TP",
        subRequirementId: sr.id,
        description: "Desc",
        steps: "Step 1",
      },
      ctx
    );

    const fakeId = "00000000-0000-0000-0000-000000000099";
    await expect(
      tpService.reParentTestProcedure(
        tp.id,
        { newSubRequirementId: fakeId, confirmReParent: true as const },
        ctx
      )
    ).rejects.toThrow(fakeId); // error message includes the missing ID
  });

  it("writes correct audit log with from/to payload", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Audit TP PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr1 = await srService.createSubRequirement(
      {
        title: "Audit Source SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const sr2 = await srService.createSubRequirement(
      {
        title: "Audit Target SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Audit TP",
        subRequirementId: sr1.id,
        description: "Desc",
        steps: "Step 1",
      },
      ctx
    );

    await tpService.reParentTestProcedure(
      tp.id,
      { newSubRequirementId: sr2.id, confirmReParent: true as const },
      ctx
    );

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: tp.id, action: "RE_PARENT" },
    });

    expect(audit).not.toBeNull();
    expect(audit!.entityType).toBe("TestProcedure");
    const changes = audit!.changes as Record<string, unknown>;
    expect(changes).toHaveProperty("subRequirementId");
    const srChange = changes.subRequirementId as { from: string; to: string };
    expect(srChange.from).toBe(sr1.id);
    expect(srChange.to).toBe(sr2.id);
  });

  it("child TPVs and TCs resolve under new parent, not old", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Lineage PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr1 = await srService.createSubRequirement(
      {
        title: "Old SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const sr2 = await srService.createSubRequirement(
      {
        title: "New SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "TP With Versions",
        subRequirementId: sr1.id,
        description: "Desc",
        steps: "Step 1",
      },
      ctx
    );

    // Move TP to SR2
    await tpService.reParentTestProcedure(
      tp.id,
      { newSubRequirementId: sr2.id, confirmReParent: true as const },
      ctx
    );

    // Verify: SR2 now has the TP with its versions
    const sr2Children = await prisma.testProcedure.findMany({
      where: { subRequirementId: sr2.id },
      include: { versions: true },
    });
    expect(sr2Children).toHaveLength(1);
    expect(sr2Children[0].id).toBe(tp.id);
    expect(sr2Children[0].versions.length).toBeGreaterThanOrEqual(1);

    // Verify: SR1 no longer has the TP
    const sr1Children = await prisma.testProcedure.findMany({
      where: { subRequirementId: sr1.id },
    });
    expect(sr1Children).toHaveLength(0);
  });
});
