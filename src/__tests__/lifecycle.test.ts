// Lifecycle rule unit tests for all services.
// Tests run against the real Neon database using the DATABASE_URL from .env.
// Each test uses a transaction that gets rolled back to keep the DB clean.

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import * as prService from "@/services/product-requirement.service";
import * as srService from "@/services/sub-requirement.service";
import * as tpService from "@/services/test-procedure.service";
import * as tcService from "@/services/test-case.service";
import { DEMO_TEAMS, DEMO_USERS } from "@/lib/demo-users";
import type { RequestContext } from "@/lib/request-context";

// We need the seed data in the DB for FK constraints.
// The beforeAll block seeds teams and users if they don't exist.
const prisma = new PrismaClient();

const ctx: RequestContext = {
  userId: DEMO_USERS[0].id,
  teamId: DEMO_TEAMS[0].id,
  role: "pm",
  requestId: "test-request-id",
  sessionId: "test-session",
  source: "api",
};

beforeAll(async () => {
  // Upsert teams and users so FK constraints are satisfied
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

// ─── Product Requirement Lifecycle ───────────────────────

describe("ProductRequirement lifecycle", () => {
  const createdPrIds: string[] = [];

  afterEach(async () => {
    for (const id of createdPrIds) {
      await prisma.auditLog.deleteMany({ where: { entityId: id } });
      await prisma.productRequirement.delete({ where: { id } }).catch(() => {});
    }
    createdPrIds.length = 0;
  });

  it("creates a draft requirement", async () => {
    const req = await prService.createProductRequirement(
      { title: "Test PR", description: "Desc" },
      ctx
    );
    createdPrIds.push(req.id);
    expect(req.status).toBe("DRAFT");
    expect(req.title).toBe("Test PR");
  });

  it("allows updating a draft requirement", async () => {
    const req = await prService.createProductRequirement(
      { title: "Original", description: "Desc" },
      ctx
    );
    createdPrIds.push(req.id);
    const updated = await prService.updateProductRequirement(
      req.id,
      { title: "Updated" },
      ctx
    );
    expect(updated.title).toBe("Updated");
  });

  it("approves a draft requirement", async () => {
    const req = await prService.createProductRequirement(
      { title: "Approve Test", description: "Desc" },
      ctx
    );
    createdPrIds.push(req.id);
    const approved = await prService.approveProductRequirement(req.id, ctx);
    expect(approved.status).toBe("APPROVED");
  });

  it("allows updating title and description on an approved requirement", async () => {
    const req = await prService.createProductRequirement(
      { title: "Typo Here", description: "Old desc" },
      ctx
    );
    createdPrIds.push(req.id);
    await prService.approveProductRequirement(req.id, ctx);

    const updated = await prService.updateProductRequirement(
      req.id,
      { title: "Fixed Title", description: "New desc" },
      ctx
    );
    expect(updated.title).toBe("Fixed Title");
    expect(updated.description).toBe("New desc");
    expect(updated.status).toBe("APPROVED");
  });

  it("rejects approving an already approved requirement", async () => {
    const req = await prService.createProductRequirement(
      { title: "Double Approve", description: "Desc" },
      ctx
    );
    createdPrIds.push(req.id);
    await prService.approveProductRequirement(req.id, ctx);

    await expect(
      prService.approveProductRequirement(req.id, ctx)
    ).rejects.toThrow("Only DRAFT");
  });

  it("cancels an approved requirement", async () => {
    const req = await prService.createProductRequirement(
      { title: "Cancel Test", description: "Desc" },
      ctx
    );
    createdPrIds.push(req.id);
    await prService.approveProductRequirement(req.id, ctx);
    const canceled = await prService.cancelProductRequirement(req.id, ctx);
    expect(canceled.status).toBe("CANCELED");
  });

  it("cancels a draft requirement with no children", async () => {
    const req = await prService.createProductRequirement(
      { title: "Draft Cancel", description: "Desc" },
      ctx
    );
    createdPrIds.push(req.id);

    const canceled = await prService.cancelProductRequirement(req.id, ctx);
    expect(canceled.status).toBe("CANCELED");
  });

  it("rejects canceling a draft requirement that has children", async () => {
    const req = await prService.createProductRequirement(
      { title: "Draft With Kids", description: "Desc" },
      ctx
    );
    createdPrIds.push(req.id);

    // Create a child sub-requirement
    const sr = await srService.createSubRequirement(
      {
        title: "Child SR",
        description: "Desc",
        productRequirementId: req.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    await expect(
      prService.cancelProductRequirement(req.id, ctx)
    ).rejects.toThrow("sub-requirements");

    // Cleanup the SR so the PR can be cleaned up in afterEach
    await prisma.auditLog.deleteMany({ where: { entityId: sr.id } });
    await prisma.subRequirement.delete({ where: { id: sr.id } });
  });

  it("rejects updating a canceled requirement", async () => {
    const req = await prService.createProductRequirement(
      { title: "Cancel Then Edit", description: "Desc" },
      ctx
    );
    createdPrIds.push(req.id);
    await prService.approveProductRequirement(req.id, ctx);
    await prService.cancelProductRequirement(req.id, ctx);

    await expect(
      prService.updateProductRequirement(req.id, { title: "Nope" }, ctx)
    ).rejects.toThrow();
  });
});

// ─── Sub-Requirement Lifecycle ───────────────────────────

describe("SubRequirement lifecycle", () => {
  let parentId: string;
  const extraPrIds: string[] = [];

  beforeAll(async () => {
    const parent = await prService.createProductRequirement(
      { title: "Parent PR", description: "For sub-req tests" },
      ctx
    );
    await prService.approveProductRequirement(parent.id, ctx);
    parentId = parent.id;
  });

  afterEach(async () => {
    // Clean up any extra PRs created within individual tests
    for (const prId of extraPrIds) {
      const srs = await prisma.subRequirement.findMany({ where: { productRequirementId: prId } });
      for (const sr of srs) {
        await prisma.auditLog.deleteMany({ where: { entityId: sr.id } });
        await prisma.subRequirement.delete({ where: { id: sr.id } }).catch(() => {});
      }
      await prisma.auditLog.deleteMany({ where: { entityId: prId } });
      await prisma.productRequirement.delete({ where: { id: prId } }).catch(() => {});
    }
    extraPrIds.length = 0;
  });

  afterAll(async () => {
    // Clean up sub-requirements, audit logs, and parent
    const subReqs = await prisma.subRequirement.findMany({
      where: { productRequirementId: parentId },
    });
    for (const sr of subReqs) {
      await prisma.auditLog.deleteMany({ where: { entityId: sr.id } });
      await prisma.subRequirement.delete({ where: { id: sr.id } }).catch(() => {});
    }
    await prisma.auditLog.deleteMany({ where: { entityId: parentId } });
    await prisma.productRequirement.delete({ where: { id: parentId } }).catch(() => {});
  });

  it("creates a draft sub-requirement", async () => {
    const sr = await srService.createSubRequirement(
      {
        title: "Sub Test",
        description: "Desc",
        productRequirementId: parentId,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    expect(sr.status).toBe("DRAFT");
  });

  it("approves a sub-requirement when parent is approved", async () => {
    const sr = await srService.createSubRequirement(
      {
        title: "Approve Sub",
        description: "Desc",
        productRequirementId: parentId,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    const approved = await srService.approveSubRequirement(sr.id, ctx);
    expect(approved.status).toBe("APPROVED");
  });

  it("rejects approving when parent is not approved", async () => {
    // Create a draft parent
    const draftParent = await prService.createProductRequirement(
      { title: "Draft Parent", description: "Not approved" },
      ctx
    );
    extraPrIds.push(draftParent.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Bad Approve",
        description: "Desc",
        productRequirementId: draftParent.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    await expect(
      srService.approveSubRequirement(sr.id, ctx)
    ).rejects.toThrow("parent product requirement");
  });

  it("allows updating an approved sub-requirement title and description", async () => {
    const sr = await srService.createSubRequirement(
      {
        title: "Typo SR",
        description: "Old desc",
        productRequirementId: parentId,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr.id, ctx);

    const updated = await srService.updateSubRequirement(
      sr.id,
      { title: "Fixed SR", description: "New desc" },
      ctx
    );
    expect(updated.title).toBe("Fixed SR");
    expect(updated.status).toBe("APPROVED");
  });

  it("cancels a draft sub-requirement with no children", async () => {
    const draftParent = await prService.createProductRequirement(
      { title: "Draft Parent For Cancel", description: "Desc" },
      ctx
    );
    extraPrIds.push(draftParent.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Draft SR Cancel",
        description: "Desc",
        productRequirementId: draftParent.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const canceled = await srService.cancelSubRequirement(sr.id, ctx);
    expect(canceled.status).toBe("CANCELED");
  });

  it("rejects canceling a draft sub-requirement that has children", async () => {
    const draftParent = await prService.createProductRequirement(
      { title: "Draft Parent For Block", description: "Desc" },
      ctx
    );
    extraPrIds.push(draftParent.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Draft SR With TP",
        description: "Desc",
        productRequirementId: draftParent.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    // Create a test procedure under the SR
    await tpService.createTestProcedure(
      {
        title: "Child TP",
        subRequirementId: sr.id,
        description: "Desc",
        steps: "Steps",
      },
      ctx
    );

    await expect(
      srService.cancelSubRequirement(sr.id, ctx)
    ).rejects.toThrow("test procedures");
  });
});

// ─── Test Procedure Lifecycle ────────────────────────────

describe("TestProcedure lifecycle", () => {
  let subReqId: string;
  let parentId: string;

  beforeAll(async () => {
    const parent = await prService.createProductRequirement(
      { title: "TP Parent", description: "For procedure tests" },
      ctx
    );
    await prService.approveProductRequirement(parent.id, ctx);
    parentId = parent.id;

    const sr = await srService.createSubRequirement(
      {
        title: "TP Sub",
        description: "Desc",
        productRequirementId: parent.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    subReqId = sr.id;
  });

  afterAll(async () => {
    // Clean up all test data in reverse dependency order
    const procedures = await prisma.testProcedure.findMany({
      where: { subRequirementId: subReqId },
      include: { versions: { include: { testCases: true } } },
    });
    for (const proc of procedures) {
      for (const ver of proc.versions) {
        for (const tc of ver.testCases) {
          await prisma.auditLog.deleteMany({ where: { entityId: tc.id } });
          await prisma.testCase.delete({ where: { id: tc.id } });
        }
        await prisma.auditLog.deleteMany({ where: { entityId: ver.id } });
        await prisma.testProcedureVersion.delete({ where: { id: ver.id } });
      }
      await prisma.auditLog.deleteMany({ where: { entityId: proc.id } });
      await prisma.testProcedure.delete({ where: { id: proc.id } });
    }
    await prisma.auditLog.deleteMany({ where: { entityId: subReqId } });
    await prisma.subRequirement.delete({ where: { id: subReqId } });
    await prisma.auditLog.deleteMany({ where: { entityId: parentId } });
    await prisma.productRequirement.delete({ where: { id: parentId } });
  });

  it("creates a procedure with draft v1", async () => {
    const result = await tpService.createTestProcedure(
      {
        title: "Proc 1",
        subRequirementId: subReqId,
        description: "Procedure description",
        steps: "Step 1\nStep 2",
      },
      ctx
    );
    expect(result.status).toBe("ACTIVE");
    expect(result.versions).toHaveLength(1);
    expect(result.versions[0].versionNumber).toBe(1);
    expect(result.versions[0].status).toBe("DRAFT");
  });

  it("approves a draft version", async () => {
    const proc = await tpService.createTestProcedure(
      {
        title: "Proc Approve",
        subRequirementId: subReqId,
        description: "Desc",
        steps: "Steps",
      },
      ctx
    );
    const approved = await tpService.approveTestProcedureVersion(
      proc.versions[0].id,
      ctx
    );
    expect(approved.status).toBe("APPROVED");
  });

  it("rejects creating a second draft when one exists", async () => {
    const proc = await tpService.createTestProcedure(
      {
        title: "Single Draft",
        subRequirementId: subReqId,
        description: "Desc",
        steps: "Steps",
      },
      ctx
    );

    // v1 is already a draft, so creating v2 should fail
    await expect(
      tpService.createTestProcedureVersion(
        proc.id,
        { description: "V2", steps: "New steps" },
        ctx
      )
    ).rejects.toThrow("already has a draft version");
  });

  it("allows creating v2 after approving v1", async () => {
    const proc = await tpService.createTestProcedure(
      {
        title: "Multi Version",
        subRequirementId: subReqId,
        description: "V1 desc",
        steps: "V1 steps",
      },
      ctx
    );
    await tpService.approveTestProcedureVersion(proc.versions[0].id, ctx);

    const v2 = await tpService.createTestProcedureVersion(
      proc.id,
      { description: "V2 desc", steps: "V2 steps" },
      ctx
    );
    expect(v2.versionNumber).toBe(2);
    expect(v2.status).toBe("DRAFT");
  });

  it("allows updating description on an approved version", async () => {
    const proc = await tpService.createTestProcedure(
      {
        title: "Edit Approved Desc",
        subRequirementId: subReqId,
        description: "Old desc",
        steps: "Steps",
      },
      ctx
    );
    await tpService.approveTestProcedureVersion(proc.versions[0].id, ctx);

    const updated = await tpService.updateTestProcedureVersion(
      proc.versions[0].id,
      { description: "Fixed desc" },
      ctx
    );
    expect(updated.description).toBe("Fixed desc");
    expect(updated.status).toBe("APPROVED");
  });

  it("rejects updating steps on an approved version", async () => {
    const proc = await tpService.createTestProcedure(
      {
        title: "No Steps Edit",
        subRequirementId: subReqId,
        description: "Desc",
        steps: "Original steps",
      },
      ctx
    );
    await tpService.approveTestProcedureVersion(proc.versions[0].id, ctx);

    await expect(
      tpService.updateTestProcedureVersion(
        proc.versions[0].id,
        { steps: "New steps" },
        ctx
      )
    ).rejects.toThrow("steps");
  });

  it("allows updating title on an active procedure", async () => {
    const proc = await tpService.createTestProcedure(
      {
        title: "Old Title",
        subRequirementId: subReqId,
        description: "Desc",
        steps: "Steps",
      },
      ctx
    );

    const updated = await tpService.updateTestProcedure(
      proc.id,
      { title: "New Title" },
      ctx
    );
    expect(updated.title).toBe("New Title");
    expect(updated.status).toBe("ACTIVE");
  });

  it("rejects updating title on a canceled procedure", async () => {
    const proc = await tpService.createTestProcedure(
      {
        title: "Cancel Then Edit",
        subRequirementId: subReqId,
        description: "Desc",
        steps: "Steps",
      },
      ctx
    );
    await tpService.cancelTestProcedure(proc.id, ctx);

    await expect(
      tpService.updateTestProcedure(proc.id, { title: "Nope" }, ctx)
    ).rejects.toThrow();
  });
});

// ─── Test Case Lifecycle ─────────────────────────────────

describe("TestCase lifecycle", () => {
  let approvedVersionId: string;
  let draftVersionId: string;
  let cleanupIds: { parentId: string; subReqId: string; procId: string };

  beforeAll(async () => {
    const parent = await prService.createProductRequirement(
      { title: "TC Parent", description: "For test case tests" },
      ctx
    );
    await prService.approveProductRequirement(parent.id, ctx);

    const sr = await srService.createSubRequirement(
      {
        title: "TC Sub",
        description: "Desc",
        productRequirementId: parent.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const proc = await tpService.createTestProcedure(
      {
        title: "TC Proc",
        subRequirementId: sr.id,
        description: "Desc",
        steps: "Steps",
      },
      ctx
    );
    draftVersionId = proc.versions[0].id;

    await tpService.approveTestProcedureVersion(proc.versions[0].id, ctx);
    approvedVersionId = proc.versions[0].id;

    // Create a new draft version for testing draft-version restrictions
    const v2 = await tpService.createTestProcedureVersion(
      proc.id,
      { description: "Draft v2", steps: "V2 steps" },
      ctx
    );
    draftVersionId = v2.id;

    cleanupIds = { parentId: parent.id, subReqId: sr.id, procId: proc.id };
  });

  afterAll(async () => {
    // Clean up everything
    const versions = await prisma.testProcedureVersion.findMany({
      where: { testProcedureId: cleanupIds.procId },
      include: { testCases: true },
    });
    for (const ver of versions) {
      for (const tc of ver.testCases) {
        await prisma.auditLog.deleteMany({ where: { entityId: tc.id } });
        await prisma.testCase.delete({ where: { id: tc.id } });
      }
      await prisma.auditLog.deleteMany({ where: { entityId: ver.id } });
      await prisma.testProcedureVersion.delete({ where: { id: ver.id } });
    }
    await prisma.auditLog.deleteMany({ where: { entityId: cleanupIds.procId } });
    await prisma.testProcedure.delete({ where: { id: cleanupIds.procId } });
    await prisma.auditLog.deleteMany({ where: { entityId: cleanupIds.subReqId } });
    await prisma.subRequirement.delete({ where: { id: cleanupIds.subReqId } });
    await prisma.auditLog.deleteMany({ where: { entityId: cleanupIds.parentId } });
    await prisma.productRequirement.delete({ where: { id: cleanupIds.parentId } });
  });

  it("creates a test case", async () => {
    const tc = await tcService.createTestCase(
      {
        title: "TC 1",
        description: "Test case desc",
        testProcedureVersionId: approvedVersionId,
      },
      ctx
    );
    expect(tc.status).toBe("PENDING");
  });

  it("records a PASS result on an approved version", async () => {
    const tc = await tcService.createTestCase(
      {
        title: "Pass Test",
        description: "Desc",
        testProcedureVersionId: approvedVersionId,
      },
      ctx
    );
    const result = await tcService.recordTestResult(
      tc.id,
      { result: "PASS" },
      ctx
    );
    expect(result.result).toBe("PASS");
    expect(result.status).toBe("PASSED");
  });

  it("rejects recording result on a draft version's test case", async () => {
    const tc = await tcService.createTestCase(
      {
        title: "Draft TC",
        description: "Desc",
        testProcedureVersionId: draftVersionId,
      },
      ctx
    );

    await expect(
      tcService.recordTestResult(tc.id, { result: "PASS" }, ctx)
    ).rejects.toThrow("must be APPROVED");
  });

  it("skips a test case", async () => {
    const tc = await tcService.createTestCase(
      {
        title: "Skip TC",
        description: "Desc",
        testProcedureVersionId: approvedVersionId,
      },
      ctx
    );
    const skipped = await tcService.skipTestCase(tc.id, ctx);
    expect(skipped.status).toBe("SKIPPED");
  });

  it("allows updating a pending test case", async () => {
    const tc = await tcService.createTestCase(
      {
        title: "Old Title",
        description: "Old desc",
        testProcedureVersionId: approvedVersionId,
      },
      ctx
    );
    const updated = await tcService.updateTestCase(
      tc.id,
      { title: "New Title", description: "New desc" },
      ctx
    );
    expect(updated.title).toBe("New Title");
    expect(updated.description).toBe("New desc");
    expect(updated.status).toBe("PENDING");
  });

  it("rejects updating a test case after recording a result", async () => {
    const tc = await tcService.createTestCase(
      {
        title: "Passed TC",
        description: "Desc",
        testProcedureVersionId: approvedVersionId,
      },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "PASS" }, ctx);

    await expect(
      tcService.updateTestCase(tc.id, { title: "Nope" }, ctx)
    ).rejects.toThrow();
  });

  it("rejects updating a skipped test case", async () => {
    const tc = await tcService.createTestCase(
      {
        title: "Skipped TC",
        description: "Desc",
        testProcedureVersionId: approvedVersionId,
      },
      ctx
    );
    await tcService.skipTestCase(tc.id, ctx);

    await expect(
      tcService.updateTestCase(tc.id, { title: "Nope" }, ctx)
    ).rejects.toThrow();
  });

  it("rejects recording result on skipped test case", async () => {
    const tc = await tcService.createTestCase(
      {
        title: "No Result After Skip",
        description: "Desc",
        testProcedureVersionId: approvedVersionId,
      },
      ctx
    );
    await tcService.skipTestCase(tc.id, ctx);

    await expect(
      tcService.recordTestResult(tc.id, { result: "PASS" }, ctx)
    ).rejects.toThrow("skipped");
  });

  // ─── Correct Result ─────────────────────────────────────

  it("corrects a PASS to FAIL", async () => {
    const tc = await tcService.createTestCase(
      { title: "Correct PASS->FAIL", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "PASS" }, ctx);

    const corrected = await tcService.correctTestResult(tc.id, { result: "FAIL" }, ctx);
    expect(corrected.result).toBe("FAIL");
    expect(corrected.status).toBe("FAILED");
  });

  it("corrects a FAIL to PASS", async () => {
    const tc = await tcService.createTestCase(
      { title: "Correct FAIL->PASS", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "FAIL" }, ctx);

    const corrected = await tcService.correctTestResult(tc.id, { result: "PASS" }, ctx);
    expect(corrected.result).toBe("PASS");
    expect(corrected.status).toBe("PASSED");
  });

  it("corrects a BLOCKED to PASS", async () => {
    const tc = await tcService.createTestCase(
      { title: "Correct BLOCKED->PASS", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "BLOCKED" }, ctx);

    const corrected = await tcService.correctTestResult(tc.id, { result: "PASS" }, ctx);
    expect(corrected.result).toBe("PASS");
    expect(corrected.status).toBe("PASSED");
  });

  it("corrects result with notes update", async () => {
    const tc = await tcService.createTestCase(
      { title: "Correct With Notes", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "PASS", notes: "Old notes" }, ctx);

    const corrected = await tcService.correctTestResult(
      tc.id,
      { result: "FAIL", notes: "Actually failed" },
      ctx
    );
    expect(corrected.result).toBe("FAIL");
    expect(corrected.notes).toBe("Actually failed");
  });

  it("corrects result and clears notes with null", async () => {
    const tc = await tcService.createTestCase(
      { title: "Correct Clear Notes", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "PASS", notes: "Some notes" }, ctx);

    const corrected = await tcService.correctTestResult(
      tc.id,
      { result: "FAIL", notes: null },
      ctx
    );
    expect(corrected.result).toBe("FAIL");
    expect(corrected.notes).toBeNull();
  });

  it("rejects correcting to the same result", async () => {
    const tc = await tcService.createTestCase(
      { title: "Same Result", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "PASS" }, ctx);

    await expect(
      tcService.correctTestResult(tc.id, { result: "PASS" }, ctx)
    ).rejects.toThrow("already PASS");
  });

  it("rejects correcting a PENDING test case", async () => {
    const tc = await tcService.createTestCase(
      { title: "Pending Correct", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );

    await expect(
      tcService.correctTestResult(tc.id, { result: "FAIL" }, ctx)
    ).rejects.toThrow("PENDING");
  });

  it("rejects correcting a SKIPPED test case", async () => {
    const tc = await tcService.createTestCase(
      { title: "Skipped Correct", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.skipTestCase(tc.id, ctx);

    await expect(
      tcService.correctTestResult(tc.id, { result: "FAIL" }, ctx)
    ).rejects.toThrow("SKIPPED");
  });

  it("logs CORRECT_RESULT audit entry", async () => {
    const tc = await tcService.createTestCase(
      { title: "Correct Audit", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "PASS" }, ctx);
    await tcService.correctTestResult(tc.id, { result: "FAIL" }, ctx);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: tc.id, action: "CORRECT_RESULT" },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actorId).toBe(ctx.userId);
  });

  it("preserves notes when correcting without passing notes", async () => {
    const tc = await tcService.createTestCase(
      { title: "Preserve Notes", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "PASS", notes: "Keep these notes" }, ctx);

    const corrected = await tcService.correctTestResult(tc.id, { result: "FAIL" }, ctx);
    expect(corrected.result).toBe("FAIL");
    expect(corrected.notes).toBe("Keep these notes");
  });

  // ─── Re-Execute ─────────────────────────────────────────

  it("re-executes a FAILED test case", async () => {
    const tc = await tcService.createTestCase(
      { title: "Re-execute FAIL", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "FAIL", notes: "Bug found" }, ctx);

    const reset = await tcService.reExecuteTestCase(tc.id, { confirmReExecute: true }, ctx);
    expect(reset.status).toBe("PENDING");
    expect(reset.result).toBeNull();
    expect(reset.notes).toBeNull();
    expect(reset.executedBy).toBeNull();
    expect(reset.executedAt).toBeNull();
  });

  it("re-executes a BLOCKED test case", async () => {
    const tc = await tcService.createTestCase(
      { title: "Re-execute BLOCKED", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "BLOCKED" }, ctx);

    const reset = await tcService.reExecuteTestCase(tc.id, { confirmReExecute: true }, ctx);
    expect(reset.status).toBe("PENDING");
    expect(reset.result).toBeNull();
  });

  it("rejects re-executing a PENDING test case", async () => {
    const tc = await tcService.createTestCase(
      { title: "Re-execute PENDING", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );

    await expect(
      tcService.reExecuteTestCase(tc.id, { confirmReExecute: true }, ctx)
    ).rejects.toThrow("PENDING");
  });

  it("rejects re-executing a PASSED test case", async () => {
    const tc = await tcService.createTestCase(
      { title: "Re-execute PASSED", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "PASS" }, ctx);

    await expect(
      tcService.reExecuteTestCase(tc.id, { confirmReExecute: true }, ctx)
    ).rejects.toThrow("PASSED");
  });

  it("rejects re-executing a SKIPPED test case", async () => {
    const tc = await tcService.createTestCase(
      { title: "Re-execute SKIPPED", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.skipTestCase(tc.id, ctx);

    await expect(
      tcService.reExecuteTestCase(tc.id, { confirmReExecute: true }, ctx)
    ).rejects.toThrow("SKIPPED");
  });

  it("logs RE_EXECUTE audit entry", async () => {
    const tc = await tcService.createTestCase(
      { title: "Re-execute Audit", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "FAIL" }, ctx);
    await tcService.reExecuteTestCase(tc.id, { confirmReExecute: true }, ctx);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: tc.id, action: "RE_EXECUTE" },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actorId).toBe(ctx.userId);
  });

  // ─── Update Notes ───────────────────────────────────────

  it("updates notes on a PASSED test case", async () => {
    const tc = await tcService.createTestCase(
      { title: "Update Notes PASS", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "PASS" }, ctx);

    const updated = await tcService.updateTestCaseNotes(tc.id, { notes: "Added context" }, ctx);
    expect(updated.notes).toBe("Added context");
    expect(updated.status).toBe("PASSED");
  });

  it("clears notes with null", async () => {
    const tc = await tcService.createTestCase(
      { title: "Clear Notes", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "PASS", notes: "Old notes" }, ctx);

    const updated = await tcService.updateTestCaseNotes(tc.id, { notes: null }, ctx);
    expect(updated.notes).toBeNull();
  });

  it("updates notes on a FAILED test case", async () => {
    const tc = await tcService.createTestCase(
      { title: "Update Notes FAIL", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "FAIL" }, ctx);

    const updated = await tcService.updateTestCaseNotes(tc.id, { notes: "Bug details" }, ctx);
    expect(updated.notes).toBe("Bug details");
    expect(updated.status).toBe("FAILED");
  });

  it("rejects updating notes on a PENDING test case", async () => {
    const tc = await tcService.createTestCase(
      { title: "Notes PENDING", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );

    await expect(
      tcService.updateTestCaseNotes(tc.id, { notes: "Nope" }, ctx)
    ).rejects.toThrow("PENDING");
  });

  it("rejects updating notes on a SKIPPED test case", async () => {
    const tc = await tcService.createTestCase(
      { title: "Notes SKIPPED", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.skipTestCase(tc.id, ctx);

    await expect(
      tcService.updateTestCaseNotes(tc.id, { notes: "Nope" }, ctx)
    ).rejects.toThrow("SKIPPED");
  });

  it("logs UPDATE_NOTES audit entry", async () => {
    const tc = await tcService.createTestCase(
      { title: "Notes Audit", description: "Desc", testProcedureVersionId: approvedVersionId },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "PASS" }, ctx);
    await tcService.updateTestCaseNotes(tc.id, { notes: "Post-execution note" }, ctx);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: tc.id, action: "UPDATE_NOTES" },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actorId).toBe(ctx.userId);
  });
});

// ─── Cascade Cancellation ───────────────────────────────

describe("Cascade cancellation", () => {
  // Track PR IDs created by each test for cleanup
  const createdPrIds: string[] = [];

  // Helper: build a full PR -> SR -> TP (with approved version) -> TC hierarchy
  async function buildHierarchy() {
    const pr = await prService.createProductRequirement(
      { title: "Cascade PR", description: "For cascade tests" },
      ctx
    );
    createdPrIds.push(pr.id);
    await prService.approveProductRequirement(pr.id, ctx);

    const sr = await srService.createSubRequirement(
      {
        title: "Cascade SR",
        description: "Desc",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr.id, ctx);

    const tp = await tpService.createTestProcedure(
      {
        title: "Cascade TP",
        subRequirementId: sr.id,
        description: "Desc",
        steps: "Steps",
      },
      ctx
    );
    await tpService.approveTestProcedureVersion(tp.versions[0].id, ctx);

    const tc1 = await tcService.createTestCase(
      {
        title: "Cascade TC1",
        description: "Desc",
        testProcedureVersionId: tp.versions[0].id,
      },
      ctx
    );
    const tc2 = await tcService.createTestCase(
      {
        title: "Cascade TC2",
        description: "Desc",
        testProcedureVersionId: tp.versions[0].id,
      },
      ctx
    );

    return { pr, sr, tp, versionId: tp.versions[0].id, tc1, tc2 };
  }

  // Helper: clean up a full hierarchy
  async function cleanupHierarchy(prId: string) {
    const srs = await prisma.subRequirement.findMany({
      where: { productRequirementId: prId },
    });
    for (const sr of srs) {
      const procs = await prisma.testProcedure.findMany({
        where: { subRequirementId: sr.id },
        include: { versions: { include: { testCases: true } } },
      });
      for (const proc of procs) {
        for (const ver of proc.versions) {
          for (const tc of ver.testCases) {
            await prisma.auditLog.deleteMany({ where: { entityId: tc.id } });
            await prisma.testCase.delete({ where: { id: tc.id } }).catch(() => {});
          }
          await prisma.auditLog.deleteMany({ where: { entityId: ver.id } });
          await prisma.testProcedureVersion.delete({ where: { id: ver.id } }).catch(() => {});
        }
        await prisma.auditLog.deleteMany({ where: { entityId: proc.id } });
        await prisma.testProcedure.delete({ where: { id: proc.id } }).catch(() => {});
      }
      await prisma.auditLog.deleteMany({ where: { entityId: sr.id } });
      await prisma.subRequirement.delete({ where: { id: sr.id } }).catch(() => {});
    }
    await prisma.auditLog.deleteMany({ where: { entityId: prId } });
    await prisma.productRequirement.delete({ where: { id: prId } }).catch(() => {});
  }

  afterEach(async () => {
    for (const prId of createdPrIds) {
      await cleanupHierarchy(prId);
    }
    createdPrIds.length = 0;
  });

  it("cancel TP cascades to skip all TCs", async () => {
    const h = await buildHierarchy();

    await tpService.cancelTestProcedure(h.tp.id, ctx);

    const tc1 = await prisma.testCase.findUniqueOrThrow({ where: { id: h.tc1.id } });
    const tc2 = await prisma.testCase.findUniqueOrThrow({ where: { id: h.tc2.id } });
    expect(tc1.status).toBe("SKIPPED");
    expect(tc2.status).toBe("SKIPPED");
  });

  it("cancel TP silently skips already-SKIPPED TCs", async () => {
    const h = await buildHierarchy();

    // Pre-skip one TC
    await tcService.skipTestCase(h.tc1.id, ctx);

    await tpService.cancelTestProcedure(h.tp.id, ctx);

    const tc1 = await prisma.testCase.findUniqueOrThrow({ where: { id: h.tc1.id } });
    const tc2 = await prisma.testCase.findUniqueOrThrow({ where: { id: h.tc2.id } });
    expect(tc1.status).toBe("SKIPPED");
    expect(tc2.status).toBe("SKIPPED");

    // Only one SKIP audit log for tc1 (the pre-skip), not two
    const tc1Logs = await prisma.auditLog.findMany({
      where: { entityId: h.tc1.id, action: "SKIP" },
    });
    expect(tc1Logs).toHaveLength(1);
  });

  it("cancel SR cascades to TPs and TCs", async () => {
    const h = await buildHierarchy();

    await srService.cancelSubRequirement(h.sr.id, ctx);

    const sr = await prisma.subRequirement.findUniqueOrThrow({ where: { id: h.sr.id } });
    const tp = await prisma.testProcedure.findUniqueOrThrow({ where: { id: h.tp.id } });
    const tc1 = await prisma.testCase.findUniqueOrThrow({ where: { id: h.tc1.id } });
    const tc2 = await prisma.testCase.findUniqueOrThrow({ where: { id: h.tc2.id } });

    expect(sr.status).toBe("CANCELED");
    expect(tp.status).toBe("CANCELED");
    expect(tc1.status).toBe("SKIPPED");
    expect(tc2.status).toBe("SKIPPED");
  });

  it("cancel PR cascades to SRs, TPs, and TCs", async () => {
    const h = await buildHierarchy();

    await prService.cancelProductRequirement(h.pr.id, ctx);

    const pr = await prisma.productRequirement.findUniqueOrThrow({ where: { id: h.pr.id } });
    const sr = await prisma.subRequirement.findUniqueOrThrow({ where: { id: h.sr.id } });
    const tp = await prisma.testProcedure.findUniqueOrThrow({ where: { id: h.tp.id } });
    const tc1 = await prisma.testCase.findUniqueOrThrow({ where: { id: h.tc1.id } });

    expect(pr.status).toBe("CANCELED");
    expect(sr.status).toBe("CANCELED");
    expect(tp.status).toBe("CANCELED");
    expect(tc1.status).toBe("SKIPPED");
  });

  it("cascade silently skips already-CANCELED children", async () => {
    const h = await buildHierarchy();

    // Pre-cancel the TP directly
    await tpService.cancelTestProcedure(h.tp.id, ctx);

    // Now cancel the SR - TP should be silently skipped
    await srService.cancelSubRequirement(h.sr.id, ctx);

    const tp = await prisma.testProcedure.findUniqueOrThrow({ where: { id: h.tp.id } });
    expect(tp.status).toBe("CANCELED");

    // Only one CANCEL audit log for the TP (the pre-cancel), not two
    const tpLogs = await prisma.auditLog.findMany({
      where: { entityId: h.tp.id, action: "CANCEL" },
    });
    expect(tpLogs).toHaveLength(1);
  });

  it("cascade creates audit logs for every changed entity", async () => {
    const h = await buildHierarchy();

    await prService.cancelProductRequirement(h.pr.id, ctx);

    // PR gets a CANCEL log
    const prLogs = await prisma.auditLog.findMany({
      where: { entityId: h.pr.id, action: "CANCEL" },
    });
    expect(prLogs).toHaveLength(1);

    // SR gets a CANCEL log
    const srLogs = await prisma.auditLog.findMany({
      where: { entityId: h.sr.id, action: "CANCEL" },
    });
    expect(srLogs).toHaveLength(1);

    // TP gets a CANCEL log
    const tpLogs = await prisma.auditLog.findMany({
      where: { entityId: h.tp.id, action: "CANCEL" },
    });
    expect(tpLogs).toHaveLength(1);

    // Both TCs get SKIP logs
    const tc1Logs = await prisma.auditLog.findMany({
      where: { entityId: h.tc1.id, action: "SKIP" },
    });
    const tc2Logs = await prisma.auditLog.findMany({
      where: { entityId: h.tc2.id, action: "SKIP" },
    });
    expect(tc1Logs).toHaveLength(1);
    expect(tc2Logs).toHaveLength(1);
  });

  it("cancel TP skips TCs across multiple versions", async () => {
    const h = await buildHierarchy();

    // Create v2 (draft) with its own TC
    const v2 = await tpService.createTestProcedureVersion(
      h.tp.id,
      { description: "V2 desc", steps: "V2 steps" },
      ctx
    );
    const tc3 = await tcService.createTestCase(
      {
        title: "Cascade TC3 on v2",
        description: "Desc",
        testProcedureVersionId: v2.id,
      },
      ctx
    );

    await tpService.cancelTestProcedure(h.tp.id, ctx);

    // TCs on v1 (approved) and v2 (draft) both get skipped
    const tc1 = await prisma.testCase.findUniqueOrThrow({ where: { id: h.tc1.id } });
    const tc2 = await prisma.testCase.findUniqueOrThrow({ where: { id: h.tc2.id } });
    const tc3After = await prisma.testCase.findUniqueOrThrow({ where: { id: tc3.id } });
    expect(tc1.status).toBe("SKIPPED");
    expect(tc2.status).toBe("SKIPPED");
    expect(tc3After.status).toBe("SKIPPED");
  });

  it("cancel PR with no children succeeds", async () => {
    // PR with zero SRs - cascade loop just doesn't execute
    const pr = await prService.createProductRequirement(
      { title: "Empty PR", description: "No children" },
      ctx
    );
    createdPrIds.push(pr.id);
    await prService.approveProductRequirement(pr.id, ctx);

    await prService.cancelProductRequirement(pr.id, ctx);

    const result = await prisma.productRequirement.findUniqueOrThrow({ where: { id: pr.id } });
    expect(result.status).toBe("CANCELED");
  });

  it("cancel PR cascades to multiple SRs and their children", async () => {
    const h = await buildHierarchy();

    // Add a second SR (DRAFT, no TPs) under the same PR
    const sr2 = await srService.createSubRequirement(
      {
        title: "Cascade SR2",
        description: "Desc",
        productRequirementId: h.pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    await prService.cancelProductRequirement(h.pr.id, ctx);

    const sr1After = await prisma.subRequirement.findUniqueOrThrow({ where: { id: h.sr.id } });
    const sr2After = await prisma.subRequirement.findUniqueOrThrow({ where: { id: sr2.id } });
    const tpAfter = await prisma.testProcedure.findUniqueOrThrow({ where: { id: h.tp.id } });

    expect(sr1After.status).toBe("CANCELED");
    expect(sr2After.status).toBe("CANCELED"); // DRAFT SR also gets cascade-canceled
    expect(tpAfter.status).toBe("CANCELED");
  });
});
