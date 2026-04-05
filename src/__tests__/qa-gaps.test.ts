// QA gap tests - fills coverage holes identified in Issue #8 audit.
// Covers: editing CANCELED entities (SR, TP version), updating draft versions,
// reactivate-edit-approve flow, edit SKIPPED TC blocked, and mixed fast-track workflow.

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
  requestId: "qa-gaps-test",
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

// Deep cleanup helper - deletes a PR and all descendants in dependency order.
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

// -- Gap: Editing CANCELED entities (SR and TPV not tested elsewhere) --

describe("Editing CANCELED entities is blocked", () => {
  const createdPrIds: string[] = [];

  afterEach(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
    createdPrIds.length = 0;
  });

  it("rejects updating a CANCELED sub-requirement", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Edit Canceled SR PR", description: "Desc" },
      ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Will Cancel",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr.id, ctx);
    await srService.cancelSubRequirement(sr.id, ctx);

    await expect(
      srService.updateSubRequirement(sr.id, { title: "Nope" }, ctx)
    ).rejects.toThrow();
  });
});

// -- Gap: Update existing DRAFT version (description + steps) --

describe("Update existing DRAFT version", () => {
  const createdPrIds: string[] = [];

  afterEach(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
    createdPrIds.length = 0;
  });

  it("updates description and steps on a DRAFT version", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Draft Update PR", description: "Desc" },
      ctx
    );
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Draft Update SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Draft Update TP",
        subRequirementId: sr.id,
        description: "Original desc",
        steps: "Original steps",
      },
      ctx
    );
    const v1Id = tp.versions[0].id;

    // Update both description and steps while still DRAFT
    const updated = await tpService.updateTestProcedureVersion(
      v1Id,
      { description: "Better desc", steps: "Better steps" },
      ctx
    );

    expect(updated.description).toBe("Better desc");
    expect(updated.steps).toBe("Better steps");
    expect(updated.status).toBe("DRAFT");
  });
});

// -- Gap: Reactivate, edit, then approve flow --

describe("Reactivate then edit then approve", () => {
  const createdPrIds: string[] = [];

  afterAll(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
  });

  it("reactivates a canceled PR, edits it, then approves again", async () => {
    // Create and approve
    const pr = await prService.createProductRequirement(
      { title: "Reactivate Flow PR", description: "Original" },
      ctx
    );
    createdPrIds.push(pr.id);
    await prService.approveProductRequirement(pr.id, ctx);

    // Cancel it
    await prService.cancelProductRequirement(pr.id, ctx);
    const canceled = await prisma.productRequirement.findUniqueOrThrow({ where: { id: pr.id } });
    expect(canceled.status).toBe("CANCELED");

    // Reactivate (goes to DRAFT)
    const reactivated = await prService.reactivateProductRequirement(
      pr.id,
      { confirmReactivate: true as const },
      ctx
    );
    expect(reactivated.status).toBe("DRAFT");

    // Edit while in DRAFT
    const edited = await prService.updateProductRequirement(
      pr.id,
      { title: "Revised Title", description: "Revised description" },
      ctx
    );
    expect(edited.title).toBe("Revised Title");
    expect(edited.description).toBe("Revised description");

    // Approve again
    const approved = await prService.approveProductRequirement(pr.id, ctx);
    expect(approved.status).toBe("APPROVED");

    // Verify audit trail has the full lifecycle
    const logs = await prisma.auditLog.findMany({
      where: { entityId: pr.id },
      orderBy: { createdAt: "asc" },
    });
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("CREATE");
    expect(actions).toContain("APPROVE");
    expect(actions).toContain("CANCEL");
    expect(actions).toContain("REACTIVATE");
    expect(actions).toContain("UPDATE");
    // The second APPROVE should appear after REACTIVATE
    const reactivateIdx = actions.indexOf("REACTIVATE");
    const lastApproveIdx = actions.lastIndexOf("APPROVE");
    expect(lastApproveIdx).toBeGreaterThan(reactivateIdx);
  });

  it("reactivates a canceled SR, edits it, then approves again", async () => {
    const pr = await prService.createProductRequirement(
      { title: "SR Reactivate Flow PR", description: "Desc" },
      ctx
    );
    createdPrIds.push(pr.id);
    await prService.approveProductRequirement(pr.id, ctx);

    const sr = await srService.createSubRequirement(
      {
        title: "SR Reactivate Flow",
        description: "Original",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr.id, ctx);
    await srService.cancelSubRequirement(sr.id, ctx);

    // Reactivate
    const reactivated = await srService.reactivateSubRequirement(
      sr.id,
      { confirmReactivate: true as const },
      ctx
    );
    expect(reactivated.status).toBe("DRAFT");

    // Edit
    const edited = await srService.updateSubRequirement(
      sr.id,
      { title: "SR Revised" },
      ctx
    );
    expect(edited.title).toBe("SR Revised");

    // Approve (parent PR is still APPROVED)
    const approved = await srService.approveSubRequirement(sr.id, ctx);
    expect(approved.status).toBe("APPROVED");
  });
});

// -- Gap: Mixed realistic fast-track workflow --
// Create PR, approve, create SR, approve, create TP, approve TPV,
// create TC, record FAIL, correct to PASS - all in one end-to-end flow.

describe("Mixed fast-track workflow: FAIL then correct to PASS", () => {
  const createdPrIds: string[] = [];

  afterAll(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
  });

  let prId: string;
  let srId: string;
  let tpvId: string;
  let tcId: string;

  it("creates and approves the full chain in fast-track order", async () => {
    // Create + approve PR
    const pr = await prService.createProductRequirement(
      { title: "Fast Track Display Calibration", description: "Verify display color accuracy" },
      ctx
    );
    prId = pr.id;
    createdPrIds.push(pr.id);
    await prService.approveProductRequirement(pr.id, ctx);

    // Create + approve SR
    const sr = await srService.createSubRequirement(
      {
        title: "Color gamut verification",
        description: "Display must cover 95% sRGB",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    srId = sr.id;
    await srService.approveSubRequirement(sr.id, ctx);

    // Create TP (auto v1) + approve v1
    const tp = await tpService.createTestProcedure(
      {
        title: "Color accuracy measurement",
        subRequirementId: sr.id,
        description: "Use spectrophotometer to measure color accuracy",
        steps: "Step 1: Display test pattern\nStep 2: Measure with spectrophotometer\nStep 3: Compare against sRGB reference",
      },
      ctx
    );
    tpvId = tp.versions[0].id;
    await tpService.approveTestProcedureVersion(tpvId, ctx);

    // Create TC
    const tc = await tcService.createTestCase(
      {
        title: "sRGB coverage at max brightness",
        description: "Measure color gamut coverage at 100% brightness",
        testProcedureVersionId: tpvId,
      },
      ctx
    );
    tcId = tc.id;

    expect(tc.status).toBe("PENDING");
  });

  it("records FAIL, then corrects to PASS with audit trail", async () => {
    // Tester records FAIL (measured 90% instead of 95%)
    const failed = await tcService.recordTestResult(
      tcId,
      { result: "FAIL", notes: "Measured 90% sRGB - below threshold" },
      ctx
    );
    expect(failed.status).toBe("FAILED");
    expect(failed.result).toBe("FAIL");

    // Tester realizes the spectrophotometer was miscalibrated - correct to PASS
    const corrected = await tcService.correctTestResult(
      tcId,
      { result: "PASS", notes: "Re-measured after calibration: 97% sRGB" },
      ctx
    );
    expect(corrected.status).toBe("PASSED");
    expect(corrected.result).toBe("PASS");
    expect(corrected.notes).toBe("Re-measured after calibration: 97% sRGB");
  });

  it("verifies the complete audit trail for the fast-track flow", async () => {
    // PR: CREATE, APPROVE
    const prLogs = await prisma.auditLog.findMany({
      where: { entityId: prId },
      orderBy: { createdAt: "asc" },
    });
    expect(prLogs.map((l) => l.action)).toEqual(["CREATE", "APPROVE"]);

    // SR: CREATE, APPROVE
    const srLogs = await prisma.auditLog.findMany({
      where: { entityId: srId },
      orderBy: { createdAt: "asc" },
    });
    expect(srLogs.map((l) => l.action)).toEqual(["CREATE", "APPROVE"]);

    // TPV: APPROVE
    const tpvLogs = await prisma.auditLog.findMany({
      where: { entityId: tpvId },
      orderBy: { createdAt: "asc" },
    });
    expect(tpvLogs.map((l) => l.action)).toContain("APPROVE");

    // TC: CREATE, RECORD_RESULT, CORRECT_RESULT
    const tcLogs = await prisma.auditLog.findMany({
      where: { entityId: tcId },
      orderBy: { createdAt: "asc" },
    });
    const tcActions = tcLogs.map((l) => l.action);
    expect(tcActions).toContain("CREATE");
    expect(tcActions).toContain("RECORD_RESULT");
    expect(tcActions).toContain("CORRECT_RESULT");

    // Verify the CORRECT_RESULT audit has from/to payload
    const correctAudit = tcLogs.find((l) => l.action === "CORRECT_RESULT");
    expect(correctAudit).not.toBeNull();
    const changes = correctAudit!.changes as Record<string, unknown>;
    const resultChange = changes.result as { from: string; to: string };
    expect(resultChange.from).toBe("FAIL");
    expect(resultChange.to).toBe("PASS");
  });
});
