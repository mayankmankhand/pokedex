// Integration tests that run against the real Neon database.
// Tests the full create -> approve -> query chain and verifies audit logs.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
  requestId: "integration-test-request",
  sessionId: "test-session",
  source: "api",
};

// Track all entity IDs created during the test so we can clean them up.
const createdIds = {
  productRequirements: [] as string[],
  subRequirements: [] as string[],
  testProcedures: [] as string[],
  testProcedureVersions: [] as string[],
  testCases: [] as string[],
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
  // Delete in reverse dependency order: test cases, versions, procedures,
  // sub-requirements, product requirements, then audit logs for all.
  const allIds = [
    ...createdIds.testCases,
    ...createdIds.testProcedureVersions,
    ...createdIds.testProcedures,
    ...createdIds.subRequirements,
    ...createdIds.productRequirements,
  ];

  // Delete audit logs for every entity we created
  for (const id of allIds) {
    await prisma.auditLog.deleteMany({ where: { entityId: id } });
  }

  // Delete entities in dependency order
  for (const id of createdIds.testCases) {
    await prisma.testCase.delete({ where: { id } }).catch(() => {});
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
    await prisma.productRequirement
      .delete({ where: { id } })
      .catch(() => {});
  }

  await prisma.$disconnect();
});

// ─── Full Chain Integration ─────────────────────────────

describe("Full traceability chain", () => {
  let prId: string;
  let srId: string;
  let tpId: string;
  let tpvId: string;
  let tcId: string;

  it("creates and approves the full chain: PR -> SubReq -> TestProc -> TestCase with PASS", async () => {
    // 1. Create a product requirement
    const pr = await prService.createProductRequirement(
      { title: "Integration PR", description: "Top-level requirement" },
      ctx
    );
    prId = pr.id;
    createdIds.productRequirements.push(pr.id);
    expect(pr.status).toBe("DRAFT");

    // 2. Approve it
    const approvedPr = await prService.approveProductRequirement(pr.id, ctx);
    expect(approvedPr.status).toBe("APPROVED");

    // 3. Create a sub-requirement
    const sr = await srService.createSubRequirement(
      {
        title: "Integration SubReq",
        description: "Child requirement",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    srId = sr.id;
    createdIds.subRequirements.push(sr.id);
    expect(sr.status).toBe("DRAFT");

    // 4. Approve the sub-requirement
    const approvedSr = await srService.approveSubRequirement(sr.id, ctx);
    expect(approvedSr.status).toBe("APPROVED");

    // 5. Create a test procedure (comes with draft v1)
    const tp = await tpService.createTestProcedure(
      {
        title: "Integration Proc",
        subRequirementId: sr.id,
        description: "Procedure description",
        steps: "Step 1: Do thing\nStep 2: Verify",
      },
      ctx
    );
    tpId = tp.id;
    tpvId = tp.versions[0].id;
    createdIds.testProcedures.push(tp.id);
    createdIds.testProcedureVersions.push(tp.versions[0].id);
    expect(tp.versions[0].status).toBe("DRAFT");

    // 6. Approve v1
    const approvedVersion = await tpService.approveTestProcedureVersion(
      tp.versions[0].id,
      ctx
    );
    expect(approvedVersion.status).toBe("APPROVED");

    // 7. Create a test case
    const tc = await tcService.createTestCase(
      {
        title: "Integration TC",
        description: "Test case for the procedure",
        testProcedureVersionId: tp.versions[0].id,
      },
      ctx
    );
    tcId = tc.id;
    createdIds.testCases.push(tc.id);
    expect(tc.status).toBe("PENDING");

    // 8. Record a PASS result
    const result = await tcService.recordTestResult(
      tc.id,
      { result: "PASS" },
      ctx
    );
    expect(result.result).toBe("PASS");
    expect(result.status).toBe("PASSED");
  });

  it("queries the full traceability chain via Prisma", async () => {
    // Query the full nested structure starting from the product requirement
    const chain = await prisma.productRequirement.findUnique({
      where: { id: prId },
      include: {
        subRequirements: {
          include: {
            testProcedures: {
              include: {
                versions: {
                  include: {
                    testCases: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    expect(chain).not.toBeNull();
    expect(chain!.status).toBe("APPROVED");
    expect(chain!.subRequirements).toHaveLength(1);

    const subReq = chain!.subRequirements[0];
    expect(subReq.status).toBe("APPROVED");
    expect(subReq.testProcedures).toHaveLength(1);

    const proc = subReq.testProcedures[0];
    expect(proc.versions).toHaveLength(1);

    const version = proc.versions[0];
    expect(version.status).toBe("APPROVED");
    expect(version.testCases).toHaveLength(1);

    const testCase = version.testCases[0];
    expect(testCase.result).toBe("PASS");
    expect(testCase.status).toBe("PASSED");
  });

  // ─── Audit Log Verification ─────────────────────────────

  it("records correct audit log actions for each entity", async () => {
    // Product requirement: CREATE, APPROVE
    const prLogs = await prisma.auditLog.findMany({
      where: { entityId: prId },
      orderBy: { createdAt: "asc" },
    });
    const prActions = prLogs.map((l) => l.action);
    expect(prActions).toContain("CREATE");
    expect(prActions).toContain("APPROVE");

    // Sub-requirement: CREATE, APPROVE
    const srLogs = await prisma.auditLog.findMany({
      where: { entityId: srId },
      orderBy: { createdAt: "asc" },
    });
    const srActions = srLogs.map((l) => l.action);
    expect(srActions).toContain("CREATE");
    expect(srActions).toContain("APPROVE");

    // Test procedure: CREATE (logged on the procedure entity)
    const tpLogs = await prisma.auditLog.findMany({
      where: { entityId: tpId },
    });
    const tpActions = tpLogs.map((l) => l.action);
    expect(tpActions).toContain("CREATE");

    // Test procedure version: APPROVE
    const tpvLogs = await prisma.auditLog.findMany({
      where: { entityId: tpvId },
    });
    const tpvActions = tpvLogs.map((l) => l.action);
    expect(tpvActions).toContain("APPROVE");

    // Test case: CREATE, RECORD_RESULT
    const tcLogs = await prisma.auditLog.findMany({
      where: { entityId: tcId },
      orderBy: { createdAt: "asc" },
    });
    const tcActions = tcLogs.map((l) => l.action);
    expect(tcActions).toContain("CREATE");
    expect(tcActions).toContain("RECORD_RESULT");
  });
});

// ─── Audit Source Threading ─────────────────────────────

describe("Audit source threading", () => {
  it("logs source: 'api' for API-context mutations", async () => {
    // Create a requirement with the default API context
    const pr = await prService.createProductRequirement(
      { title: "Source Test PR", description: "Verify source field" },
      ctx
    );
    createdIds.productRequirements.push(pr.id);

    const logs = await prisma.auditLog.findMany({
      where: { entityId: pr.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].source).toBe("api");
  });

  it("logs source: 'chat' for chat-context mutations", async () => {
    // Create a context that simulates the chat route override
    const chatCtx: RequestContext = { ...ctx, source: "chat" };

    const pr = await prService.createProductRequirement(
      { title: "Chat Source PR", description: "Verify chat source" },
      chatCtx
    );
    createdIds.productRequirements.push(pr.id);

    const logs = await prisma.auditLog.findMany({
      where: { entityId: pr.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].source).toBe("chat");
  });
});

// ─── Named Query: Uncovered Sub-Requirements ───────────

describe("Uncovered sub-requirements query", () => {
  let prId: string;
  let srId: string;

  it("finds sub-requirements with no test procedures", async () => {
    // Create an approved product requirement
    const pr = await prService.createProductRequirement(
      { title: "Uncovered PR", description: "For uncovered query test" },
      ctx
    );
    prId = pr.id;
    createdIds.productRequirements.push(pr.id);
    await prService.approveProductRequirement(pr.id, ctx);

    // Create an approved sub-requirement with NO test procedures
    const sr = await srService.createSubRequirement(
      {
        title: "Uncovered SubReq",
        description: "Has no test procedures",
        productRequirementId: pr.id,
        teamId: DEMO_TEAMS[0].id,
      },
      ctx
    );
    srId = sr.id;
    createdIds.subRequirements.push(sr.id);
    await srService.approveSubRequirement(sr.id, ctx);

    // Query for sub-requirements that have zero test procedures
    const uncovered = await prisma.subRequirement.findMany({
      where: {
        productRequirementId: pr.id,
        status: "APPROVED",
        testProcedures: {
          none: {},
        },
      },
    });

    expect(uncovered.length).toBeGreaterThanOrEqual(1);
    const found = uncovered.find((s) => s.id === srId);
    expect(found).toBeDefined();
    expect(found!.title).toBe("Uncovered SubReq");
  });
});
