// Scenario tests that simulate realistic multi-step user workflows.
// Each describe block is one user journey that chains service-layer
// operations the way a real PLM user would work through the system.
//
// These tests assert EXPECTED behavior (not current behavior).
// If a test fails, it means we found a bug - file it as a new issue.

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import * as prService from "@/services/product-requirement.service";
import * as srService from "@/services/sub-requirement.service";
import * as tpService from "@/services/test-procedure.service";
import * as tcService from "@/services/test-case.service";
import { DEMO_TEAMS, DEMO_USERS } from "@/lib/demo-users";
import type { RequestContext } from "@/lib/request-context";

const prisma = new PrismaClient();

// Simulate a PM user (Ash from Product team)
const ctx: RequestContext = {
  userId: DEMO_USERS[0].id,
  teamId: DEMO_TEAMS[0].id,
  role: "pm",
  requestId: "scenario-test",
  sessionId: "test-session",
  source: "api",
};

// ─── Shared Setup & Cleanup ──────────────────────────────

beforeAll(async () => {
  // Ensure demo users and teams exist for FK constraints
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

/**
 * Deep cleanup helper - deletes a PR and all descendants in dependency order.
 * Handles audit logs first, then entities from leaf to root.
 */
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
        await prisma.testProcedureVersion
          .delete({ where: { id: tpv.id } })
          .catch(() => {});
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

// ─── Scenario 1: Happy Path - Full Lifecycle Journey ─────
// A PM creates a product requirement, adds sub-requirements,
// creates test procedures, approves everything, executes tests,
// and verifies the final state of the entire hierarchy.

describe("Scenario 1: Happy path - full lifecycle journey", () => {
  const createdPrIds: string[] = [];

  // afterAll (not afterEach) because steps share state sequentially
  afterAll(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
  });

  // Shared state across sequential steps within this scenario
  let prId: string;
  let srId: string;
  let tpId: string;
  let tpvId: string;
  let tc1Id: string;
  let tc2Id: string;
  let tc3Id: string;

  it("Step 1: creates a product requirement in DRAFT", async () => {
    const pr = await prService.createProductRequirement(
      {
        title: "Pokedex Battery Life",
        description: "Battery must last 48 hours under normal field usage",
      },
      ctx
    );
    prId = pr.id;
    createdPrIds.push(pr.id);

    expect(pr.status).toBe("DRAFT");
    expect(pr.title).toBe("Pokedex Battery Life");
  });

  it("Step 2: creates a sub-requirement with team assignment", async () => {
    const sr = await srService.createSubRequirement(
      {
        title: "Battery Drain Test",
        description: "Verify battery consumption under continuous scanning",
        productRequirementId: prId,
        teamId: DEMO_TEAMS[0].id, // Hardware team
      },
      ctx
    );
    srId = sr.id;

    expect(sr.status).toBe("DRAFT");
    expect(sr.productRequirementId).toBe(prId);
    expect(sr.teamId).toBe(DEMO_TEAMS[0].id);
  });

  it("Step 3: approves the PR, then the SR", async () => {
    // Approve PR first (SR approval requires parent PR to be APPROVED)
    const approvedPr = await prService.approveProductRequirement(prId, ctx);
    expect(approvedPr.status).toBe("APPROVED");

    const approvedSr = await srService.approveSubRequirement(srId, ctx);
    expect(approvedSr.status).toBe("APPROVED");
  });

  it("Step 4: creates a test procedure (auto-creates draft v1)", async () => {
    const tp = await tpService.createTestProcedure(
      {
        title: "Field Scanning Battery Drain Procedure",
        subRequirementId: srId,
        description: "Measures battery drain during 4-hour field scanning session",
        steps:
          "Step 1: Charge battery to 100%\n" +
          "Step 2: Enable continuous Pokemon scanning\n" +
          "Step 3: Run for 4 hours in field conditions\n" +
          "Step 4: Record remaining battery percentage",
      },
      ctx
    );
    tpId = tp.id;
    tpvId = tp.versions[0].id;

    expect(tp.status).toBe("ACTIVE");
    expect(tp.versions).toHaveLength(1);
    expect(tp.versions[0].status).toBe("DRAFT");
    expect(tp.versions[0].versionNumber).toBe(1);
  });

  it("Step 5: approves the test procedure version", async () => {
    const approvedVersion = await tpService.approveTestProcedureVersion(
      tpvId,
      ctx
    );
    expect(approvedVersion.status).toBe("APPROVED");
  });

  it("Step 6: creates three test cases for the approved version", async () => {
    const tc1 = await tcService.createTestCase(
      {
        title: "Indoor GPS test",
        description: "Test GPS drain indoors with weak signal",
        testProcedureVersionId: tpvId,
      },
      ctx
    );
    tc1Id = tc1.id;

    const tc2 = await tcService.createTestCase(
      {
        title: "Outdoor GPS test",
        description: "Test GPS drain outdoors with strong signal",
        testProcedureVersionId: tpvId,
      },
      ctx
    );
    tc2Id = tc2.id;

    const tc3 = await tcService.createTestCase(
      {
        title: "Mixed GPS test",
        description: "Test GPS drain with alternating indoor/outdoor",
        testProcedureVersionId: tpvId,
      },
      ctx
    );
    tc3Id = tc3.id;

    expect(tc1.status).toBe("PENDING");
    expect(tc2.status).toBe("PENDING");
    expect(tc3.status).toBe("PENDING");
  });

  it("Step 7: executes test cases with mixed results (pass, fail, block)", async () => {
    // TC1: passes
    const passed = await tcService.recordTestResult(
      tc1Id,
      { result: "PASS" },
      ctx
    );
    expect(passed.status).toBe("PASSED");
    expect(passed.result).toBe("PASS");
    expect(passed.executedBy).toBe(ctx.userId);
    expect(passed.executedAt).not.toBeNull();

    // TC2: fails (battery drained too fast indoors)
    const failed = await tcService.recordTestResult(
      tc2Id,
      { result: "FAIL", notes: "Battery dropped to 20% in 3 hours" },
      ctx
    );
    expect(failed.status).toBe("FAILED");
    expect(failed.result).toBe("FAIL");
    expect(failed.notes).toBe("Battery dropped to 20% in 3 hours");

    // TC3: blocked (GPS module had hardware issue)
    const blocked = await tcService.recordTestResult(
      tc3Id,
      { result: "BLOCKED", notes: "GPS module firmware crash during test" },
      ctx
    );
    expect(blocked.status).toBe("BLOCKED");
    expect(blocked.result).toBe("BLOCKED");
  });

  it("Step 8: verifies the full hierarchy state via Prisma query", async () => {
    // Query the entire tree from the top to verify final state
    const tree = await prisma.productRequirement.findUnique({
      where: { id: prId },
      include: {
        subRequirements: {
          include: {
            testProcedures: {
              include: {
                versions: {
                  include: {
                    testCases: {
                      orderBy: { createdAt: "asc" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(tree).not.toBeNull();
    expect(tree!.status).toBe("APPROVED");

    // One SR, approved
    expect(tree!.subRequirements).toHaveLength(1);
    expect(tree!.subRequirements[0].status).toBe("APPROVED");

    // One TP, active
    const tp = tree!.subRequirements[0].testProcedures[0];
    expect(tp.status).toBe("ACTIVE");

    // One version (v1), approved, with 3 test cases
    expect(tp.versions).toHaveLength(1);
    expect(tp.versions[0].status).toBe("APPROVED");
    expect(tp.versions[0].testCases).toHaveLength(3);

    // Verify test case results
    const results = tp.versions[0].testCases.map((tc) => tc.result);
    expect(results).toContain("PASS");
    expect(results).toContain("FAIL");
    expect(results).toContain("BLOCKED");
  });

  it("Step 9: verifies audit trail covers every operation", async () => {
    // PR should have CREATE + APPROVE
    const prLogs = await prisma.auditLog.findMany({
      where: { entityId: prId },
      orderBy: { createdAt: "asc" },
    });
    expect(prLogs.map((l) => l.action)).toEqual(["CREATE", "APPROVE"]);

    // SR should have CREATE + APPROVE
    const srLogs = await prisma.auditLog.findMany({
      where: { entityId: srId },
      orderBy: { createdAt: "asc" },
    });
    expect(srLogs.map((l) => l.action)).toEqual(["CREATE", "APPROVE"]);

    // TP should have CREATE
    const tpLogs = await prisma.auditLog.findMany({
      where: { entityId: tpId },
    });
    expect(tpLogs.map((l) => l.action)).toContain("CREATE");

    // TPV should have APPROVE (CREATE_VERSION logged on TP, not TPV)
    const tpvLogs = await prisma.auditLog.findMany({
      where: { entityId: tpvId },
    });
    expect(tpvLogs.map((l) => l.action)).toContain("APPROVE");

    // Each TC should have CREATE + RECORD_RESULT
    for (const tcId of [tc1Id, tc2Id, tc3Id]) {
      const tcLogs = await prisma.auditLog.findMany({
        where: { entityId: tcId },
        orderBy: { createdAt: "asc" },
      });
      const actions = tcLogs.map((l) => l.action);
      expect(actions).toContain("CREATE");
      expect(actions).toContain("RECORD_RESULT");
    }
  });
});

// ─── Scenario 2: Mistake Recovery ────────────────────────
// A tester records wrong results, corrects them, re-executes
// failed tests, and edits entities at various lifecycle stages.

describe("Scenario 2: Mistake recovery", () => {
  const createdPrIds: string[] = [];

  // afterAll (not afterEach) because steps share state sequentially
  afterAll(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
  });

  // Build a ready-to-test hierarchy for this scenario
  let prId: string;
  let srId: string;
  let tpvId: string;
  let tcId: string;

  it("sets up hierarchy: PR -> SR -> TP -> v1 (approved) -> TC", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Recovery Test PR", description: "For mistake recovery scenario" },
      ctx
    );
    prId = pr.id;
    createdPrIds.push(pr.id);

    await prService.approveProductRequirement(pr.id, ctx);

    const sr = await srService.createSubRequirement(
      {
        title: "Recovery Test SR",
        description: "Sub-requirement for recovery",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    srId = sr.id;
    await srService.approveSubRequirement(sr.id, ctx);

    const tp = await tpService.createTestProcedure(
      {
        title: "Recovery Test Procedure",
        subRequirementId: sr.id,
        description: "Procedure for recovery tests",
        steps: "Step 1: Run test\nStep 2: Record result",
      },
      ctx
    );
    tpvId = tp.versions[0].id;
    await tpService.approveTestProcedureVersion(tp.versions[0].id, ctx);

    const tc = await tcService.createTestCase(
      {
        title: "Recovery TC",
        description: "Test case that will have wrong results",
        testProcedureVersionId: tp.versions[0].id,
      },
      ctx
    );
    tcId = tc.id;
  });

  it("records a wrong result (PASS), then corrects it to FAIL", async () => {
    // Tester accidentally records PASS
    const wrong = await tcService.recordTestResult(
      tcId,
      { result: "PASS" },
      ctx
    );
    expect(wrong.status).toBe("PASSED");

    // Realize the mistake and correct it
    const corrected = await tcService.correctTestResult(
      tcId,
      { result: "FAIL", notes: "Actually failed - wrong button clicked" },
      ctx
    );
    expect(corrected.status).toBe("FAILED");
    expect(corrected.result).toBe("FAIL");
    expect(corrected.notes).toBe("Actually failed - wrong button clicked");

    // Verify audit trail shows the correction
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: tcId, action: "CORRECT_RESULT" },
    });
    expect(audit).not.toBeNull();
    const changes = audit!.changes as Record<string, unknown>;
    const resultChange = changes.result as { from: string; to: string };
    expect(resultChange.from).toBe("PASS");
    expect(resultChange.to).toBe("FAIL");
  });

  it("re-executes a FAILED test case, then records the correct result", async () => {
    // Re-execute resets to PENDING
    const reset = await tcService.reExecuteTestCase(
      tcId,
      { confirmReExecute: true as const },
      ctx
    );
    expect(reset.status).toBe("PENDING");
    expect(reset.result).toBeNull();
    expect(reset.notes).toBeNull();
    expect(reset.executedBy).toBeNull();
    expect(reset.executedAt).toBeNull();

    // Now record the correct result
    const correct = await tcService.recordTestResult(
      tcId,
      { result: "PASS", notes: "Passed on second run after firmware update" },
      ctx
    );
    expect(correct.status).toBe("PASSED");
    expect(correct.result).toBe("PASS");

    // Verify audit trail shows RE_EXECUTE
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: tcId, action: "RE_EXECUTE" },
    });
    expect(audit).not.toBeNull();
  });

  it("updates notes on an executed test case without changing result", async () => {
    const updated = await tcService.updateTestCaseNotes(
      tcId,
      { notes: "Passed on second run - firmware v2.1 fixed the issue" },
      ctx
    );
    expect(updated.notes).toBe(
      "Passed on second run - firmware v2.1 fixed the issue"
    );
    // Result should not change
    expect(updated.result).toBe("PASS");
    expect(updated.status).toBe("PASSED");

    // Verify UPDATE_NOTES audit
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: tcId, action: "UPDATE_NOTES" },
    });
    expect(audit).not.toBeNull();
  });

  it("edits a DRAFT entity (full field access)", async () => {
    // Create a new draft PR to test editing
    const draftPr = await prService.createProductRequirement(
      { title: "Editable PR", description: "Original description" },
      ctx
    );
    createdPrIds.push(draftPr.id);

    const updated = await prService.updateProductRequirement(
      draftPr.id,
      { title: "Updated PR Title", description: "Updated description" },
      ctx
    );
    expect(updated.title).toBe("Updated PR Title");
    expect(updated.description).toBe("Updated description");
  });

  it("edits an APPROVED entity (limited to title + description)", async () => {
    // The PR from setup is already APPROVED - edit it
    const updated = await prService.updateProductRequirement(
      prId,
      { title: "Recovery Test PR - Updated", description: "Updated description" },
      ctx
    );
    expect(updated.title).toBe("Recovery Test PR - Updated");
    expect(updated.description).toBe("Updated description");
    // Status should remain APPROVED after edit
    expect(updated.status).toBe("APPROVED");

    // Verify UPDATE audit
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: prId, action: "UPDATE" },
    });
    expect(audit).not.toBeNull();
  });

  it("edits a PENDING test case (title + description)", async () => {
    // Create a fresh PENDING TC to test editing
    const tc = await tcService.createTestCase(
      {
        title: "Editable TC",
        description: "Original TC description",
        testProcedureVersionId: tpvId,
      },
      ctx
    );

    const updated = await tcService.updateTestCase(
      tc.id,
      { title: "Renamed TC", description: "Better description" },
      ctx
    );
    expect(updated.title).toBe("Renamed TC");
    expect(updated.description).toBe("Better description");
  });
});

// ─── Scenario 3: Cancellation & Reactivation Cascades ────
// A PM builds a full hierarchy, cancels from the top, verifies
// the cascade, then reactivates and verifies everything is restored.

describe("Scenario 3: Cancellation and reactivation cascades", () => {
  const createdPrIds: string[] = [];

  // afterAll (not afterEach) because steps share state sequentially
  afterAll(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
  });

  let prId: string;
  let srId: string;
  let tpId: string;
  let tpvId: string;
  let tc1Id: string;
  let tc2Id: string;

  it("builds and approves a full hierarchy with executed test cases", async () => {
    // Create and approve PR
    const pr = await prService.createProductRequirement(
      { title: "Cascade Test PR", description: "Will be canceled and reactivated" },
      ctx
    );
    prId = pr.id;
    createdPrIds.push(pr.id);
    await prService.approveProductRequirement(pr.id, ctx);

    // Create and approve SR
    const sr = await srService.createSubRequirement(
      {
        title: "Cascade Test SR",
        description: "Child of cascade PR",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    srId = sr.id;
    await srService.approveSubRequirement(sr.id, ctx);

    // Create TP, approve v1
    const tp = await tpService.createTestProcedure(
      {
        title: "Cascade Test TP",
        subRequirementId: sr.id,
        description: "Procedure for cascade test",
        steps: "Step 1: Test\nStep 2: Verify",
      },
      ctx
    );
    tpId = tp.id;
    tpvId = tp.versions[0].id;
    await tpService.approveTestProcedureVersion(tp.versions[0].id, ctx);

    // Create two test cases - one executed, one pending
    const tc1 = await tcService.createTestCase(
      {
        title: "Executed TC",
        description: "Already has a result",
        testProcedureVersionId: tpvId,
      },
      ctx
    );
    tc1Id = tc1.id;
    await tcService.recordTestResult(tc1Id, { result: "PASS" }, ctx);

    const tc2 = await tcService.createTestCase(
      {
        title: "Pending TC",
        description: "Not yet executed",
        testProcedureVersionId: tpvId,
      },
      ctx
    );
    tc2Id = tc2.id;

    // Verify initial state
    expect((await prisma.productRequirement.findUniqueOrThrow({ where: { id: prId } })).status).toBe("APPROVED");
    expect((await prisma.subRequirement.findUniqueOrThrow({ where: { id: srId } })).status).toBe("APPROVED");
    expect((await prisma.testProcedure.findUniqueOrThrow({ where: { id: tpId } })).status).toBe("ACTIVE");
    expect((await prisma.testCase.findUniqueOrThrow({ where: { id: tc1Id } })).status).toBe("PASSED");
    expect((await prisma.testCase.findUniqueOrThrow({ where: { id: tc2Id } })).status).toBe("PENDING");
  });

  it("cancels PR and verifies cascade to all descendants", async () => {
    await prService.cancelProductRequirement(prId, ctx);

    // Everything should be canceled/skipped
    const pr = await prisma.productRequirement.findUniqueOrThrow({ where: { id: prId } });
    const sr = await prisma.subRequirement.findUniqueOrThrow({ where: { id: srId } });
    const tp = await prisma.testProcedure.findUniqueOrThrow({ where: { id: tpId } });
    const tc1 = await prisma.testCase.findUniqueOrThrow({ where: { id: tc1Id } });
    const tc2 = await prisma.testCase.findUniqueOrThrow({ where: { id: tc2Id } });

    expect(pr.status).toBe("CANCELED");
    expect(sr.status).toBe("CANCELED");
    expect(tp.status).toBe("CANCELED");
    expect(tc1.status).toBe("SKIPPED");
    expect(tc2.status).toBe("SKIPPED");
  });

  it("reactivates PR and verifies cascade restores all descendants", async () => {
    await prService.reactivateProductRequirement(
      prId,
      { confirmReactivate: true as const },
      ctx
    );

    // PR and SR should be DRAFT (reactivation resets to DRAFT)
    const pr = await prisma.productRequirement.findUniqueOrThrow({ where: { id: prId } });
    const sr = await prisma.subRequirement.findUniqueOrThrow({ where: { id: srId } });
    const tp = await prisma.testProcedure.findUniqueOrThrow({ where: { id: tpId } });
    const tc1 = await prisma.testCase.findUniqueOrThrow({ where: { id: tc1Id } });
    const tc2 = await prisma.testCase.findUniqueOrThrow({ where: { id: tc2Id } });

    expect(pr.status).toBe("DRAFT");
    expect(sr.status).toBe("DRAFT");
    expect(tp.status).toBe("ACTIVE");
    expect(tc1.status).toBe("PENDING");
    expect(tc2.status).toBe("PENDING");
  });

  it("verifies CANCEL and REACTIVATE audit entries exist for each entity", async () => {
    // Each entity should have both CANCEL and REACTIVATE audit entries
    for (const [entityId, entityType] of [
      [prId, "ProductRequirement"],
      [srId, "SubRequirement"],
      [tpId, "TestProcedure"],
    ] as const) {
      const cancelAudit = await prisma.auditLog.findFirst({
        where: { entityId, action: "CANCEL" },
      });
      expect(cancelAudit).not.toBeNull();
      expect(cancelAudit!.entityType).toBe(entityType);

      const reactivateAudit = await prisma.auditLog.findFirst({
        where: { entityId, action: "REACTIVATE" },
      });
      expect(reactivateAudit).not.toBeNull();
    }

    // Test cases get SKIP (not CANCEL) and REACTIVATE
    for (const tcId of [tc1Id, tc2Id]) {
      const skipAudit = await prisma.auditLog.findFirst({
        where: { entityId: tcId, action: "SKIP" },
      });
      expect(skipAudit).not.toBeNull();

      const reactivateAudit = await prisma.auditLog.findFirst({
        where: { entityId: tcId, action: "REACTIVATE" },
      });
      expect(reactivateAudit).not.toBeNull();
    }
  });
});

// ─── Scenario 4: Re-parenting ────────────────────────────
// A PM reorganizes the hierarchy by moving sub-requirements
// and test procedures between parents.

describe("Scenario 4: Re-parenting", () => {
  const createdPrIds: string[] = [];

  afterEach(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
    createdPrIds.length = 0;
  });

  it("moves a sub-requirement from one PR to another, children follow", async () => {
    // Create two approved PRs
    const pr1 = await prService.createProductRequirement(
      { title: "Source PR", description: "Original home" },
      ctx
    );
    await prService.approveProductRequirement(pr1.id, ctx);
    createdPrIds.push(pr1.id);

    const pr2 = await prService.createProductRequirement(
      { title: "Target PR", description: "New home" },
      ctx
    );
    await prService.approveProductRequirement(pr2.id, ctx);
    createdPrIds.push(pr2.id);

    // Create SR with a child TP under PR1
    const sr = await srService.createSubRequirement(
      {
        title: "Mobile SR",
        description: "Moving this to a different PR",
        productRequirementId: pr1.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Child TP",
        subRequirementId: sr.id,
        description: "Should follow SR",
        steps: "Step 1: Verify",
      },
      ctx
    );

    // Move SR from PR1 to PR2
    const moved = await srService.reParentSubRequirement(
      sr.id,
      { newProductRequirementId: pr2.id, confirmReParent: true as const },
      ctx
    );
    expect(moved.productRequirementId).toBe(pr2.id);

    // Verify: TP is now under PR2's hierarchy
    const pr2Tree = await prisma.productRequirement.findUnique({
      where: { id: pr2.id },
      include: {
        subRequirements: {
          include: { testProcedures: true },
        },
      },
    });
    expect(pr2Tree!.subRequirements).toHaveLength(1);
    expect(pr2Tree!.subRequirements[0].testProcedures).toHaveLength(1);
    expect(pr2Tree!.subRequirements[0].testProcedures[0].id).toBe(tp.id);

    // Verify: PR1 has no children
    const pr1Tree = await prisma.subRequirement.findMany({
      where: { productRequirementId: pr1.id },
    });
    expect(pr1Tree).toHaveLength(0);
  });

  it("moves a test procedure from one SR to another", async () => {
    const pr = await prService.createProductRequirement(
      { title: "TP Move PR", description: "Parent for TP move test" },
      ctx
    );
    await prService.approveProductRequirement(pr.id, ctx);
    createdPrIds.push(pr.id);

    const sr1 = await srService.createSubRequirement(
      {
        title: "Source SR",
        description: "TP starts here",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const sr2 = await srService.createSubRequirement(
      {
        title: "Target SR",
        description: "TP moves here",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Movable TP",
        subRequirementId: sr1.id,
        description: "Will be re-parented",
        steps: "Step 1: Test",
      },
      ctx
    );

    // Approve v1, create a test case to verify it follows
    await tpService.approveTestProcedureVersion(tp.versions[0].id, ctx);
    const tc = await tcService.createTestCase(
      {
        title: "Child TC",
        description: "Should follow TP",
        testProcedureVersionId: tp.versions[0].id,
      },
      ctx
    );

    // Move TP from SR1 to SR2
    const moved = await tpService.reParentTestProcedure(
      tp.id,
      { newSubRequirementId: sr2.id, confirmReParent: true as const },
      ctx
    );
    expect(moved.subRequirementId).toBe(sr2.id);

    // Verify: TC is still attached to the TP under SR2
    const sr2Children = await prisma.testProcedure.findMany({
      where: { subRequirementId: sr2.id },
      include: {
        versions: {
          include: { testCases: true },
        },
      },
    });
    expect(sr2Children).toHaveLength(1);
    expect(sr2Children[0].versions[0].testCases).toHaveLength(1);
    expect(sr2Children[0].versions[0].testCases[0].id).toBe(tc.id);
  });

  it("blocks re-parenting a CANCELED entity", async () => {
    const pr1 = await prService.createProductRequirement(
      { title: "Cancel Move PR1", description: "Source" },
      ctx
    );
    await prService.approveProductRequirement(pr1.id, ctx);
    createdPrIds.push(pr1.id);

    const pr2 = await prService.createProductRequirement(
      { title: "Cancel Move PR2", description: "Target" },
      ctx
    );
    await prService.approveProductRequirement(pr2.id, ctx);
    createdPrIds.push(pr2.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Canceled SR",
        description: "Cannot be moved",
        productRequirementId: pr1.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr.id, ctx);
    await srService.cancelSubRequirement(sr.id, ctx);

    // Trying to move a CANCELED SR should fail
    await expect(
      srService.reParentSubRequirement(
        sr.id,
        { newProductRequirementId: pr2.id, confirmReParent: true as const },
        ctx
      )
    ).rejects.toThrow("canceled");
  });

  it("blocks moving an APPROVED SR to a DRAFT PR", async () => {
    const approvedPr = await prService.createProductRequirement(
      { title: "Approved Source", description: "Has approved SR" },
      ctx
    );
    await prService.approveProductRequirement(approvedPr.id, ctx);
    createdPrIds.push(approvedPr.id);

    const draftPr = await prService.createProductRequirement(
      { title: "Draft Target", description: "Not yet approved" },
      ctx
    );
    createdPrIds.push(draftPr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Approved SR",
        description: "Cannot move to draft PR",
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

  it("verifies RE_PARENT audit logs with from/to payload", async () => {
    const pr1 = await prService.createProductRequirement(
      { title: "Audit From", description: "Source" },
      ctx
    );
    await prService.approveProductRequirement(pr1.id, ctx);
    createdPrIds.push(pr1.id);

    const pr2 = await prService.createProductRequirement(
      { title: "Audit To", description: "Target" },
      ctx
    );
    await prService.approveProductRequirement(pr2.id, ctx);
    createdPrIds.push(pr2.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Audit Move SR",
        description: "Check audit payload",
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
    const changes = audit!.changes as Record<string, unknown>;
    const prChange = changes.productRequirementId as { from: string; to: string };
    expect(prChange.from).toBe(pr1.id);
    expect(prChange.to).toBe(pr2.id);
  });
});

// ─── Scenario 5: Versioning Workflow ─────────────────────
// A PM creates a test procedure, approves v1, creates v2,
// verifies the single-draft rule, and confirms version independence.

describe("Scenario 5: Versioning workflow", () => {
  const createdPrIds: string[] = [];

  // afterAll (not afterEach) because steps share state sequentially
  afterAll(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
  });

  let tpId: string;
  let v1Id: string;
  let v2Id: string;

  it("creates TP with auto-generated draft v1, then approves v1", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Versioning PR", description: "For version tests" },
      ctx
    );
    createdPrIds.push(pr.id);
    await prService.approveProductRequirement(pr.id, ctx);

    const sr = await srService.createSubRequirement(
      {
        title: "Versioning SR",
        description: "Parent of versioned TP",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Versioned Procedure",
        subRequirementId: sr.id,
        description: "Will have multiple versions",
        steps: "V1 Step 1: Original test steps",
      },
      ctx
    );
    tpId = tp.id;
    v1Id = tp.versions[0].id;

    expect(tp.versions[0].versionNumber).toBe(1);
    expect(tp.versions[0].status).toBe("DRAFT");

    // Approve v1
    const approved = await tpService.approveTestProcedureVersion(v1Id, ctx);
    expect(approved.status).toBe("APPROVED");
  });

  it("creates v2 as a new draft", async () => {
    const v2 = await tpService.createTestProcedureVersion(
      tpId,
      {
        description: "Updated procedure with better steps",
        steps: "V2 Step 1: Improved test methodology\nV2 Step 2: New validation",
      },
      ctx
    );
    v2Id = v2.id;

    expect(v2.versionNumber).toBe(2);
    expect(v2.status).toBe("DRAFT");
  });

  it("enforces single-draft rule (cannot create v3 while v2 is draft)", async () => {
    await expect(
      tpService.createTestProcedureVersion(
        tpId,
        {
          description: "Should fail",
          steps: "V3 steps",
        },
        ctx
      )
    ).rejects.toThrow(); // single-draft rule violation
  });

  it("approves v2 and creates test cases on both versions independently", async () => {
    // Approve v2
    await tpService.approveTestProcedureVersion(v2Id, ctx);

    // Create test cases on v1
    const tcV1 = await tcService.createTestCase(
      {
        title: "V1 Test Case",
        description: "Testing against v1 steps",
        testProcedureVersionId: v1Id,
      },
      ctx
    );

    // Create test cases on v2
    const tcV2 = await tcService.createTestCase(
      {
        title: "V2 Test Case",
        description: "Testing against v2 steps",
        testProcedureVersionId: v2Id,
      },
      ctx
    );

    // Execute both
    await tcService.recordTestResult(tcV1.id, { result: "PASS" }, ctx);
    await tcService.recordTestResult(tcV2.id, { result: "FAIL" }, ctx);

    // Verify versions are independent
    const v1Cases = await prisma.testCase.findMany({
      where: { testProcedureVersionId: v1Id },
    });
    const v2Cases = await prisma.testCase.findMany({
      where: { testProcedureVersionId: v2Id },
    });

    expect(v1Cases).toHaveLength(1);
    expect(v1Cases[0].result).toBe("PASS");
    expect(v2Cases).toHaveLength(1);
    expect(v2Cases[0].result).toBe("FAIL");
  });

  it("verifies both versions exist on the same procedure", async () => {
    const tp = await prisma.testProcedure.findUnique({
      where: { id: tpId },
      include: {
        versions: {
          orderBy: { versionNumber: "asc" },
          include: { testCases: true },
        },
      },
    });

    expect(tp).not.toBeNull();
    expect(tp!.versions).toHaveLength(2);
    expect(tp!.versions[0].versionNumber).toBe(1);
    expect(tp!.versions[0].status).toBe("APPROVED");
    expect(tp!.versions[1].versionNumber).toBe(2);
    expect(tp!.versions[1].status).toBe("APPROVED");

    // Each version has its own test cases
    expect(tp!.versions[0].testCases).toHaveLength(1);
    expect(tp!.versions[1].testCases).toHaveLength(1);
  });
});

// ─── Scenario 6: Lifecycle Guards ────────────────────────
// Verifies that the system prevents invalid operations -
// the "you can't do that" error paths that protect data integrity.

describe("Scenario 6: Lifecycle guards", () => {
  const createdPrIds: string[] = [];

  afterEach(async () => {
    for (const prId of createdPrIds) {
      await cleanupPr(prId);
    }
    createdPrIds.length = 0;
  });

  it("blocks approving SR when parent PR is still DRAFT", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Draft Parent", description: "Not yet approved" },
      ctx
    );
    createdPrIds.push(pr.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Eager SR",
        description: "Trying to approve before parent",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    // Parent PR is still DRAFT - SR approval should fail
    await expect(
      srService.approveSubRequirement(sr.id, ctx)
    ).rejects.toThrow();
  });

  it("blocks executing TC when parent version is still DRAFT", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Draft Version PR", description: "For draft version test" },
      ctx
    );
    createdPrIds.push(pr.id);
    await prService.approveProductRequirement(pr.id, ctx);

    const sr = await srService.createSubRequirement(
      {
        title: "Draft Version SR",
        description: "Parent of draft TP",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Draft Version TP",
        subRequirementId: sr.id,
        description: "Version not yet approved",
        steps: "Step 1: Test",
      },
      ctx
    );

    // v1 is still DRAFT - create TC but can't execute
    const tc = await tcService.createTestCase(
      {
        title: "Blocked TC",
        description: "Cannot execute against draft version",
        testProcedureVersionId: tp.versions[0].id,
      },
      ctx
    );

    await expect(
      tcService.recordTestResult(tc.id, { result: "PASS" }, ctx)
    ).rejects.toThrow();
  });

  it("blocks canceling a DRAFT PR that has children", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Draft with Kids", description: "Has sub-requirements" },
      ctx
    );
    createdPrIds.push(pr.id);

    // Add a child SR while PR is still DRAFT
    await srService.createSubRequirement(
      {
        title: "Child SR",
        description: "Prevents parent cancel",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    // DRAFT PR with children cannot be canceled (must delete children first)
    await expect(
      prService.cancelProductRequirement(pr.id, ctx)
    ).rejects.toThrow();
  });

  it("blocks reactivating SR when parent PR is still CANCELED", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Canceled Parent", description: "Will stay canceled" },
      ctx
    );
    createdPrIds.push(pr.id);
    await prService.approveProductRequirement(pr.id, ctx);

    const sr = await srService.createSubRequirement(
      {
        title: "Orphan SR",
        description: "Parent canceled",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    await srService.approveSubRequirement(sr.id, ctx);

    // Cancel PR (cascades to SR)
    await prService.cancelProductRequirement(pr.id, ctx);

    // Try to reactivate SR without reactivating PR first (top-down rule)
    await expect(
      srService.reactivateSubRequirement(
        sr.id,
        { confirmReactivate: true as const },
        ctx
      )
    ).rejects.toThrow("parent product requirement is CANCELED");
  });

  it("blocks re-parenting to a CANCELED target", async () => {
    const pr1 = await prService.createProductRequirement(
      { title: "Good PR", description: "Source" },
      ctx
    );
    await prService.approveProductRequirement(pr1.id, ctx);
    createdPrIds.push(pr1.id);

    const pr2 = await prService.createProductRequirement(
      { title: "Dead PR", description: "Canceled target" },
      ctx
    );
    await prService.approveProductRequirement(pr2.id, ctx);
    await prService.cancelProductRequirement(pr2.id, ctx);
    createdPrIds.push(pr2.id);

    const sr = await srService.createSubRequirement(
      {
        title: "Homeless SR",
        description: "Trying to move to canceled PR",
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

  it("blocks correcting a PENDING test case (no result yet)", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Correct Guard PR", description: "For correction guard test" },
      ctx
    );
    createdPrIds.push(pr.id);
    await prService.approveProductRequirement(pr.id, ctx);

    const sr = await srService.createSubRequirement(
      {
        title: "Correct Guard SR",
        description: "Parent",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Correct Guard TP",
        subRequirementId: sr.id,
        description: "For guard test",
        steps: "Step 1",
      },
      ctx
    );
    await tpService.approveTestProcedureVersion(tp.versions[0].id, ctx);

    const tc = await tcService.createTestCase(
      {
        title: "Pending TC",
        description: "No result recorded yet",
        testProcedureVersionId: tp.versions[0].id,
      },
      ctx
    );

    // Cannot correct a test case that hasn't been executed
    await expect(
      tcService.correctTestResult(tc.id, { result: "FAIL" }, ctx)
    ).rejects.toThrow("PENDING");
  });

  it("blocks re-executing a PASSED test case (use correctTestResult instead)", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Re-exec Guard PR", description: "For re-execute guard test" },
      ctx
    );
    createdPrIds.push(pr.id);
    await prService.approveProductRequirement(pr.id, ctx);

    const sr = await srService.createSubRequirement(
      {
        title: "Re-exec Guard SR",
        description: "Parent",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );

    const tp = await tpService.createTestProcedure(
      {
        title: "Re-exec Guard TP",
        subRequirementId: sr.id,
        description: "For guard test",
        steps: "Step 1",
      },
      ctx
    );
    await tpService.approveTestProcedureVersion(tp.versions[0].id, ctx);

    const tc = await tcService.createTestCase(
      {
        title: "Passed TC",
        description: "Cannot re-execute a passing test",
        testProcedureVersionId: tp.versions[0].id,
      },
      ctx
    );
    await tcService.recordTestResult(tc.id, { result: "PASS" }, ctx);

    // PASSED test cases cannot be re-executed (only FAILED/BLOCKED)
    await expect(
      tcService.reExecuteTestCase(
        tc.id,
        { confirmReExecute: true as const },
        ctx
      )
    ).rejects.toThrow("PASSED");
  });
});
