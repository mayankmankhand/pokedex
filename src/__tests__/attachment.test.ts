// Attachment hardening tests (Issue #33).
// Verifies that addAttachment rejects CANCELED parent entities
// and succeeds on non-canceled entities.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import * as attachService from "@/services/attachment.service";
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
  requestId: "test-attachment",
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

// Helper: clean up an attachment and its audit entries
async function cleanupAttachment(id: string) {
  await prisma.auditLog.deleteMany({ where: { entityId: id } });
  await prisma.attachment.delete({ where: { id } });
}

// Helper: clean up a product requirement and its audit entries
async function cleanupPR(id: string) {
  await prisma.auditLog.deleteMany({ where: { entityId: id } });
  await prisma.productRequirement.delete({ where: { id } });
}

// Helper: clean up a sub-requirement and its audit entries
async function cleanupSR(id: string) {
  await prisma.auditLog.deleteMany({ where: { entityId: id } });
  await prisma.subRequirement.delete({ where: { id: id } });
}

// Helper: clean up a test procedure hierarchy (versions, TCs, audit, TP)
async function cleanupTP(tpId: string) {
  const versions = await prisma.testProcedureVersion.findMany({
    where: { testProcedureId: tpId },
  });
  for (const v of versions) {
    const tcs = await prisma.testCase.findMany({
      where: { testProcedureVersionId: v.id },
    });
    for (const tc of tcs) {
      await prisma.auditLog.deleteMany({ where: { entityId: tc.id } });
    }
    await prisma.testCase.deleteMany({ where: { testProcedureVersionId: v.id } });
    await prisma.auditLog.deleteMany({ where: { entityId: v.id } });
    await prisma.testProcedureVersion.delete({ where: { id: v.id } });
  }
  await prisma.auditLog.deleteMany({ where: { entityId: tpId } });
  await prisma.testProcedure.delete({ where: { id: tpId } });
}

// ─── CANCELED parent blocks addAttachment ────────────────

describe("addAttachment - CANCELED parent rejection", () => {
  it("rejects attachment on CANCELED ProductRequirement", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Att test PR", description: "test" },
      ctx
    );

    try {
      await prService.approveProductRequirement(pr.id, ctx);
      await prService.cancelProductRequirement(pr.id, ctx);

      await expect(
        attachService.addAttachment(
          { fileName: "test.pdf", fileType: "DOCUMENT", productRequirementId: pr.id },
          ctx
        )
      ).rejects.toThrow("Cannot add attachment to a canceled product requirement");
    } finally {
      await cleanupPR(pr.id);
    }
  });

  it("rejects attachment on CANCELED SubRequirement", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Att test PR2", description: "test" },
      ctx
    );

    let srId: string | undefined;
    try {
      await prService.approveProductRequirement(pr.id, ctx);

      const sr = await srService.createSubRequirement(
        {
          title: "Att test SR",
          description: "test",
          productRequirementId: pr.id,
          teamId: DEMO_TEAMS[0].id,
        },
        ctx
      );
      srId = sr.id;
      await srService.approveSubRequirement(sr.id, ctx);
      await srService.cancelSubRequirement(sr.id, ctx);

      await expect(
        attachService.addAttachment(
          { fileName: "test.pdf", fileType: "DOCUMENT", subRequirementId: sr.id },
          ctx
        )
      ).rejects.toThrow("Cannot add attachment to a canceled sub-requirement");
    } finally {
      if (srId) await cleanupSR(srId);
      await cleanupPR(pr.id);
    }
  });

  it("rejects attachment on CANCELED TestProcedure", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Att test PR3", description: "test" },
      ctx
    );

    let srId: string | undefined;
    let tpId: string | undefined;
    try {
      await prService.approveProductRequirement(pr.id, ctx);

      const sr = await srService.createSubRequirement(
        {
          title: "Att test SR2",
          description: "test",
          productRequirementId: pr.id,
          teamId: DEMO_TEAMS[0].id,
        },
        ctx
      );
      srId = sr.id;

      const tp = await tpService.createTestProcedure(
        { title: "Att test TP", subRequirementId: sr.id, description: "test", steps: "Step 1" },
        ctx
      );
      tpId = tp.id;
      await tpService.cancelTestProcedure(tp.id, ctx);

      await expect(
        attachService.addAttachment(
          { fileName: "test.pdf", fileType: "DOCUMENT", testProcedureId: tp.id },
          ctx
        )
      ).rejects.toThrow("Cannot add attachment to a canceled test procedure");
    } finally {
      if (tpId) await cleanupTP(tpId);
      if (srId) await cleanupSR(srId);
      await cleanupPR(pr.id);
    }
  });
});

// ─── Non-canceled parent allows addAttachment ────────────

describe("addAttachment - non-canceled parent succeeds", () => {
  it("allows attachment on DRAFT ProductRequirement", async () => {
    const pr = await prService.createProductRequirement(
      { title: "Att success PR", description: "test" },
      ctx
    );

    let attId: string | undefined;
    try {
      const att = await attachService.addAttachment(
        { fileName: "spec.pdf", fileType: "DOCUMENT", productRequirementId: pr.id },
        ctx
      );
      attId = att.id;

      expect(att.fileName).toBe("spec.pdf");
      expect(att.fileType).toBe("DOCUMENT");
      expect(att.status).toBe("ACTIVE");
    } finally {
      if (attId) await cleanupAttachment(attId);
      await cleanupPR(pr.id);
    }
  });
});
