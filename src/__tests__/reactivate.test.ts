// Reactivation tests for ProductRequirement, SubRequirement, and TestProcedure.
// Tests run against the real Neon test database.
// Covers: happy path, cascade reactivation, status guards, parent guards,
// audit logging, and idempotent cascade behavior.

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import * as prService from "@/services/product-requirement.service";
import * as srService from "@/services/sub-requirement.service";
import * as tpService from "@/services/test-procedure.service";
import * as tcService from "@/services/test-case.service";
import { DEMO_TEAMS, DEMO_USERS } from "@/lib/demo-users";
import type { RequestContext } from "@/lib/request-context";

const prisma = new PrismaClient();

const ctx: RequestContext = {
  userId: DEMO_USERS[0].id,
  teamId: DEMO_TEAMS[0].id,
  role: "pm",
  requestId: "test-reactivate",
  sessionId: "test-session",
  source: "api",
};

const confirmReactivate = true as const;

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
  const srs = await prisma.subRequirement.findMany({
    where: { productRequirementId: prId },
    select: { id: true },
  });

  for (const sr of srs) {
    const tps = await prisma.testProcedure.findMany({
      where: { subRequirementId: sr.id },
      select: { id: true },
    });

    for (const tp of tps) {
      const tpvs = await prisma.testProcedureVersion.findMany({
        where: { testProcedureId: tp.id },
        select: { id: true },
      });

      for (const tpv of tpvs) {
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

// ─── Helper: build a full entity tree and cancel it ──────

async function buildAndCancelTree() {
  // Create PR -> approve -> create SR -> approve -> create TP (auto v1) -> approve v1 -> create TC -> cancel PR (cascades)
  const pr = await prService.createProductRequirement(
    { title: "Reactivation PR", description: "Will be canceled then reactivated" },
    ctx
  );
  await prService.approveProductRequirement(pr.id, ctx);

  const sr = await srService.createSubRequirement(
    {
      title: "Reactivation SR",
      description: "Child SR",
      productRequirementId: pr.id,
      teamId: DEMO_TEAMS[0].id,
    },
    ctx
  );
  await srService.approveSubRequirement(sr.id, ctx);

  const tp = await tpService.createTestProcedure(
    {
      title: "Reactivation TP",
      subRequirementId: sr.id,
      description: "Test procedure",
      steps: "Step 1: Do thing",
    },
    ctx
  );

  // Get the auto-created v1
  const tpv = await prisma.testProcedureVersion.findFirst({
    where: { testProcedureId: tp.id },
  });

  // Approve v1 so we can create a test case
  await tpService.approveTestProcedureVersion(tpv!.id, ctx);

  const tc = await tcService.createTestCase(
    {
      title: "Reactivation TC",
      description: "Test case",
      testProcedureVersionId: tpv!.id,
    },
    ctx
  );

  // Cancel the entire tree from the top
  await prService.cancelProductRequirement(pr.id, ctx);

  return { pr, sr, tp, tpv: tpv!, tc };
}

// ─── ProductRequirement Reactivation ─────────────────────

describe("ProductRequirement reactivation", () => {
  const createdPrIds: string[] = [];

  afterEach(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
    createdPrIds.length = 0;
  });

  it("reactivates a canceled PR to DRAFT", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Cancel Me", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    await prService.cancelProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const result = await prService.reactivateProductRequirement(
      pr.id, { confirmReactivate }, ctx
    );

    expect(result.status).toBe("DRAFT");
  });

  it("blocks reactivating a non-canceled PR", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Draft PR", description: "Desc" }, ctx
    );
    createdPrIds.push(pr.id);

    await expect(
      prService.reactivateProductRequirement(pr.id, { confirmReactivate }, ctx)
    ).rejects.toThrow("DRAFT");
  });

  it("writes REACTIVATE audit log", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Audit PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    await prService.cancelProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    await prService.reactivateProductRequirement(pr.id, { confirmReactivate }, ctx);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: pr.id, action: "REACTIVATE" },
    });

    expect(audit).not.toBeNull();
    expect(audit!.entityType).toBe("ProductRequirement");
    const changes = audit!.changes as Record<string, unknown>;
    const statusChange = changes.status as { from: string; to: string };
    expect(statusChange.from).toBe("CANCELED");
    expect(statusChange.to).toBe("DRAFT");
  });
});

// ─── SubRequirement Reactivation ─────────────────────────

describe("SubRequirement reactivation", () => {
  const createdPrIds: string[] = [];

  afterEach(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
    createdPrIds.length = 0;
  });

  it("reactivates a canceled SR to DRAFT", async () => {
    const pr = await prService.createProductRequirement(
      { title: "SR Parent", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Cancel SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr.id, ctx);
    await srService.cancelSubRequirement(sr.id, ctx);

    const result = await srService.reactivateSubRequirement(
      sr.id, { confirmReactivate }, ctx
    );

    expect(result.status).toBe("DRAFT");
  });

  it("blocks reactivating SR when parent PR is CANCELED", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Canceled Parent", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Blocked SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr.id, ctx);

    // Cancel the PR (cascades to SR)
    await prService.cancelProductRequirement(pr.id, ctx);

    // Try to reactivate SR without reactivating PR first
    await expect(
      srService.reactivateSubRequirement(sr.id, { confirmReactivate }, ctx)
    ).rejects.toThrow("parent product requirement is CANCELED");
  });

  it("blocks reactivating a non-canceled SR", async () => {
    const pr = await prService.createProductRequirement(
      { title: "PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Active SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    await expect(
      srService.reactivateSubRequirement(sr.id, { confirmReactivate }, ctx)
    ).rejects.toThrow("DRAFT");
  });
});

// ─── TestProcedure Reactivation ──────────────────────────

describe("TestProcedure reactivation", () => {
  const createdPrIds: string[] = [];

  afterEach(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
    createdPrIds.length = 0;
  });

  it("reactivates a canceled TP to ACTIVE", async () => {
    const pr = await prService.createProductRequirement(
      { title: "TP Parent PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "TP Parent SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Cancel TP",
        subRequirementId: sr.id,
        description: "Desc",
        steps: "Step 1",
      },
      ctx
    );
    await tpService.cancelTestProcedure(tp.id, ctx);

    const result = await tpService.reactivateTestProcedure(
      tp.id, { confirmReactivate }, ctx
    );

    expect(result.status).toBe("ACTIVE");
  });

  it("un-skips SKIPPED test cases when TP is reactivated", async () => {
    const pr = await prService.createProductRequirement(
      { title: "TC Cascade PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "TC Cascade SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "TP With TC",
        subRequirementId: sr.id,
        description: "Desc",
        steps: "Step 1",
      },
      ctx
    );

    // Get auto-created v1, approve it, create TC
    const tpv = await prisma.testProcedureVersion.findFirst({
      where: { testProcedureId: tp.id },
    });
    await tpService.approveTestProcedureVersion(tpv!.id, ctx);

    const tc = await tcService.createTestCase(
      {
        title: "Skippable TC",
        description: "Desc",
        testProcedureVersionId: tpv!.id,
      },
      ctx
    );

    // Cancel TP (cascades to skip TC)
    await tpService.cancelTestProcedure(tp.id, ctx);

    // Verify TC is SKIPPED
    const skippedTc = await prisma.testCase.findUniqueOrThrow({ where: { id: tc.id } });
    expect(skippedTc.status).toBe("SKIPPED");

    // Reactivate TP
    await tpService.reactivateTestProcedure(tp.id, { confirmReactivate }, ctx);

    // Verify TC is PENDING
    const reactivatedTc = await prisma.testCase.findUniqueOrThrow({ where: { id: tc.id } });
    expect(reactivatedTc.status).toBe("PENDING");
  });

  it("blocks reactivating TP when parent SR is CANCELED", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Blocked TP PR", description: "Desc" }, ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Canceled SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr.id, ctx);

    const tp = await tpService.createTestProcedure(
      {
        title: "Blocked TP",
        subRequirementId: sr.id,
        description: "Desc",
        steps: "Step 1",
      },
      ctx
    );

    // Cancel SR (cascades to TP)
    await srService.cancelSubRequirement(sr.id, ctx);

    // Try to reactivate TP without reactivating SR first
    await expect(
      tpService.reactivateTestProcedure(tp.id, { confirmReactivate }, ctx)
    ).rejects.toThrow("parent sub-requirement is CANCELED");
  });

  it("blocks reactivating a non-canceled TP", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Active TP PR", description: "Desc" }, ctx
    );
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Active TP SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Active TP",
        subRequirementId: sr.id,
        description: "Desc",
        steps: "Step 1",
      },
      ctx
    );

    await expect(
      tpService.reactivateTestProcedure(tp.id, { confirmReactivate }, ctx)
    ).rejects.toThrow("ACTIVE");
  });
});

// ─── Full Cascade Reactivation ───────────────────────────

describe("Full cascade reactivation", () => {
  const createdPrIds: string[] = [];

  afterEach(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
    createdPrIds.length = 0;
  });

  it("reactivating PR cascades to SR, TP, and TC", async () => {
    const { pr, sr, tp, tc } = await buildAndCancelTree();
    createdPrIds.push(pr.id);

    // Verify everything is canceled/skipped
    const canceledPr = await prisma.productRequirement.findUniqueOrThrow({ where: { id: pr.id } });
    const canceledSr = await prisma.subRequirement.findUniqueOrThrow({ where: { id: sr.id } });
    const canceledTp = await prisma.testProcedure.findUniqueOrThrow({ where: { id: tp.id } });
    const skippedTc = await prisma.testCase.findUniqueOrThrow({ where: { id: tc.id } });

    expect(canceledPr.status).toBe("CANCELED");
    expect(canceledSr.status).toBe("CANCELED");
    expect(canceledTp.status).toBe("CANCELED");
    expect(skippedTc.status).toBe("SKIPPED");

    // Reactivate PR (should cascade to all)
    await prService.reactivateProductRequirement(pr.id, { confirmReactivate }, ctx);

    const reactivatedPr = await prisma.productRequirement.findUniqueOrThrow({ where: { id: pr.id } });
    const reactivatedSr = await prisma.subRequirement.findUniqueOrThrow({ where: { id: sr.id } });
    const reactivatedTp = await prisma.testProcedure.findUniqueOrThrow({ where: { id: tp.id } });
    const reactivatedTc = await prisma.testCase.findUniqueOrThrow({ where: { id: tc.id } });

    expect(reactivatedPr.status).toBe("DRAFT");
    expect(reactivatedSr.status).toBe("DRAFT");
    expect(reactivatedTp.status).toBe("ACTIVE");
    expect(reactivatedTc.status).toBe("PENDING");
  });

  it("cascade skips already-active children", async () => {
    // Create PR with two SRs, cancel both, then use raw Prisma to manually
    // set one SR back to DRAFT (simulating it was independently reactivated).
    // Reactivating the PR should skip the DRAFT SR and only reactivate the CANCELED one.
    const pr = await prService.createProductRequirement(
      { title: "Idempotent PR", description: "Desc" }, ctx
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
    await srService.approveSubRequirement(sr1.id, ctx);

    const sr2 = await srService.createSubRequirement(
      {
        title: "SR2",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr2.id, ctx);

    // Cancel the PR (cascades to both SRs)
    await prService.cancelProductRequirement(pr.id, ctx);

    // Simulate SR1 was independently reactivated (set back to DRAFT via raw update)
    await prisma.subRequirement.update({
      where: { id: sr1.id },
      data: { status: "DRAFT" },
    });

    // Reactivate PR - cascade should skip SR1 (already DRAFT) and reactivate SR2
    await prService.reactivateProductRequirement(pr.id, { confirmReactivate }, ctx);

    const finalSr1 = await prisma.subRequirement.findUniqueOrThrow({ where: { id: sr1.id } });
    const finalSr2 = await prisma.subRequirement.findUniqueOrThrow({ where: { id: sr2.id } });

    expect(finalSr1.status).toBe("DRAFT");
    expect(finalSr2.status).toBe("DRAFT");

    // SR1 should NOT have a REACTIVATE audit entry (it was already DRAFT)
    const sr1ReactivateAudit = await prisma.auditLog.findFirst({
      where: { entityId: sr1.id, action: "REACTIVATE" },
    });
    expect(sr1ReactivateAudit).toBeNull();

    // SR2 SHOULD have a REACTIVATE audit entry
    const sr2ReactivateAudit = await prisma.auditLog.findFirst({
      where: { entityId: sr2.id, action: "REACTIVATE" },
    });
    expect(sr2ReactivateAudit).not.toBeNull();
  });

  it("writes REACTIVATE audit entries for each entity in cascade", async () => {
    const { pr, sr, tp, tc } = await buildAndCancelTree();
    createdPrIds.push(pr.id);

    await prService.reactivateProductRequirement(pr.id, { confirmReactivate }, ctx);

    // Check audit logs for each entity
    const prAudit = await prisma.auditLog.findFirst({
      where: { entityId: pr.id, action: "REACTIVATE" },
    });
    const srAudit = await prisma.auditLog.findFirst({
      where: { entityId: sr.id, action: "REACTIVATE" },
    });
    const tpAudit = await prisma.auditLog.findFirst({
      where: { entityId: tp.id, action: "REACTIVATE" },
    });
    const tcAudit = await prisma.auditLog.findFirst({
      where: { entityId: tc.id, action: "REACTIVATE" },
    });

    expect(prAudit).not.toBeNull();
    expect(srAudit).not.toBeNull();
    expect(tpAudit).not.toBeNull();
    expect(tcAudit).not.toBeNull();

    // Verify entity types
    expect(prAudit!.entityType).toBe("ProductRequirement");
    expect(srAudit!.entityType).toBe("SubRequirement");
    expect(tpAudit!.entityType).toBe("TestProcedure");
    expect(tcAudit!.entityType).toBe("TestCase");
  });
});
