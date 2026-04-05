// Test Procedure service - two-entity versioning with lifecycle rules.
// Creating a procedure also creates a draft v1 version.
// Only one draft version is allowed per procedure (enforced here + DB partial unique index).

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RequestContext } from "@/lib/request-context";
import { LifecycleError, NotFoundError } from "@/lib/errors";
import { writeAuditLog } from "./audit.service";
import type {
  CreateTestProcedureInput,
  UpdateTestProcedureInput,
  CreateTestProcedureVersionInput,
  UpdateTestProcedureVersionInput,
  ReParentTestProcedureInput,
  ReactivateTestProcedureInput,
} from "@/schemas/test-procedure.schema";

// ─── Cascade helpers (used by parent cancel functions) ──────

/**
 * Skip all non-SKIPPED test cases under a test procedure.
 * Uses a Prisma relation filter to find TCs across all versions in one query.
 * Already-SKIPPED TCs are silently skipped. Call within an existing transaction.
 */
export async function cascadeSkipTestCases(
  tx: Prisma.TransactionClient,
  testProcedureId: string,
  ctx: RequestContext
) {
  const testCases = await tx.testCase.findMany({
    where: {
      testProcedureVersion: { testProcedureId },
      status: { not: "SKIPPED" },
    },
    select: { id: true, status: true },
  });

  await Promise.all(
    testCases.map(async (tc) => {
      await tx.testCase.update({
        where: { id: tc.id },
        data: { status: "SKIPPED" },
      });

      await writeAuditLog(tx, {
        actorId: ctx.userId,
        action: "SKIP",
        entityType: "TestCase",
        entityId: tc.id,
        source: ctx.source,
        requestId: ctx.requestId,
        changes: { status: { from: tc.status, to: "SKIPPED" } },
      });
    })
  );
}

/**
 * Cancel a single test procedure and skip all its test cases.
 * Already-CANCELED TPs are silently skipped. Cancels regardless of current
 * status (bypasses the entry-point ACTIVE-only guard for cascade scenarios).
 * Call within an existing transaction.
 */
export async function cascadeCancelTestProcedure(
  tx: Prisma.TransactionClient,
  testProcedureId: string,
  ctx: RequestContext
) {
  const tp = await tx.testProcedure.findUniqueOrThrow({
    where: { id: testProcedureId },
  });

  // Already canceled - skip silently
  if (tp.status === "CANCELED") return;

  await tx.testProcedure.update({
    where: { id: testProcedureId },
    data: { status: "CANCELED" },
  });

  await writeAuditLog(tx, {
    actorId: ctx.userId,
    action: "CANCEL",
    entityType: "TestProcedure",
    entityId: testProcedureId,
    source: ctx.source,
    requestId: ctx.requestId,
    changes: { status: { from: tp.status, to: "CANCELED" } },
  });

  await cascadeSkipTestCases(tx, testProcedureId, ctx);
}

// ─── Cascade reactivation helpers (used by parent reactivate functions) ──

/**
 * Un-skip all SKIPPED test cases under a test procedure, resetting them to PENDING.
 * Non-SKIPPED TCs are silently skipped. Call within an existing transaction.
 */
export async function cascadeReactivateTestCases(
  tx: Prisma.TransactionClient,
  testProcedureId: string,
  ctx: RequestContext
) {
  const testCases = await tx.testCase.findMany({
    where: {
      testProcedureVersion: { testProcedureId },
      status: "SKIPPED",
    },
    select: { id: true },
  });

  await Promise.all(
    testCases.map(async (tc) => {
      await tx.testCase.update({
        where: { id: tc.id },
        data: { status: "PENDING" },
      });

      await writeAuditLog(tx, {
        actorId: ctx.userId,
        action: "REACTIVATE",
        entityType: "TestCase",
        entityId: tc.id,
        source: ctx.source,
        requestId: ctx.requestId,
        changes: { status: { from: "SKIPPED", to: "PENDING" } },
      });
    })
  );
}

/**
 * Reactivate a single test procedure and un-skip all its test cases.
 * Already-ACTIVE TPs are silently skipped. Call within an existing transaction.
 */
export async function cascadeReactivateTestProcedure(
  tx: Prisma.TransactionClient,
  testProcedureId: string,
  ctx: RequestContext
) {
  const tp = await tx.testProcedure.findUniqueOrThrow({
    where: { id: testProcedureId },
  });

  // Already active - skip silently
  if (tp.status === "ACTIVE") return;

  await tx.testProcedure.update({
    where: { id: testProcedureId },
    data: { status: "ACTIVE" },
  });

  await writeAuditLog(tx, {
    actorId: ctx.userId,
    action: "REACTIVATE",
    entityType: "TestProcedure",
    entityId: testProcedureId,
    source: ctx.source,
    requestId: ctx.requestId,
    changes: { status: { from: "CANCELED", to: "ACTIVE" } },
  });

  await cascadeReactivateTestCases(tx, testProcedureId, ctx);
}

// ─── Update (ACTIVE only, title only) ─────────────────────

export async function updateTestProcedure(
  id: string,
  input: UpdateTestProcedureInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testProcedure.findUniqueOrThrow({
      where: { id },
    });

    if (existing.status === "CANCELED") {
      throw new LifecycleError(
        "Cannot update a canceled test procedure."
      );
    }

    const changes: Record<string, unknown> = {};
    if (input.title !== undefined) changes.title = { from: existing.title, to: input.title };

    const updated = await tx.testProcedure.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
      },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "TestProcedure",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes,
    });

    return updated;
  });
}

// ─── Create (logical procedure + draft v1) ───────────────

export async function createTestProcedure(
  input: CreateTestProcedureInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    // Verify parent sub-requirement exists
    await tx.subRequirement.findUniqueOrThrow({
      where: { id: input.subRequirementId },
    });

    const procedure = await tx.testProcedure.create({
      data: {
        title: input.title,
        subRequirementId: input.subRequirementId,
        createdBy: ctx.userId,
      },
    });

    // Auto-create draft v1.
    // Note: this v1 creation is bundled into the TestProcedure CREATE audit event
    // (not a separate CREATE_VERSION event). CREATE_VERSION is only used for v2+.
    const version = await tx.testProcedureVersion.create({
      data: {
        testProcedureId: procedure.id,
        versionNumber: 1,
        description: input.description,
        steps: input.steps,
        status: "DRAFT",
        createdBy: ctx.userId,
      },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "CREATE",
      entityType: "TestProcedure",
      entityId: procedure.id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: {
        title: input.title,
        subRequirementId: input.subRequirementId,
        initialVersion: { versionNumber: 1, description: input.description },
      },
    });

    return { ...procedure, versions: [version] };
  });
}

// ─── Create new version (enforce one draft per procedure) ─

export async function createTestProcedureVersion(
  procedureId: string,
  input: CreateTestProcedureVersionInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const procedure = await tx.testProcedure.findUniqueOrThrow({
      where: { id: procedureId },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });

    if (procedure.status === "CANCELED") {
      throw new LifecycleError("Cannot create a version for a canceled procedure.");
    }

    // Enforce single-draft rule
    const existingDraft = procedure.versions.find((v) => v.status === "DRAFT");
    if (existingDraft) {
      throw new LifecycleError(
        `Procedure already has a draft version (v${existingDraft.versionNumber}). Approve or discard it first.`
      );
    }

    const nextVersion = (procedure.versions[0]?.versionNumber ?? 0) + 1;

    const version = await tx.testProcedureVersion.create({
      data: {
        testProcedureId: procedureId,
        versionNumber: nextVersion,
        description: input.description,
        steps: input.steps,
        status: "DRAFT",
        createdBy: ctx.userId,
      },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "CREATE_VERSION",
      entityType: "TestProcedureVersion",
      entityId: version.id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: {
        testProcedureId: procedureId,
        versionNumber: nextVersion,
        description: input.description,
      },
    });

    return version;
  });
}

// ─── Update version (DRAFT: all fields, APPROVED: description only) ──

export async function updateTestProcedureVersion(
  versionId: string,
  input: UpdateTestProcedureVersionInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testProcedureVersion.findUniqueOrThrow({
      where: { id: versionId },
    });

    if (existing.status !== "DRAFT" && existing.status !== "APPROVED") {
      throw new LifecycleError(
        `Cannot update version in ${existing.status} status. Only DRAFT or APPROVED versions can be edited.`
      );
    }

    // APPROVED versions can only update description (not steps).
    if (existing.status === "APPROVED" && input.steps !== undefined) {
      throw new LifecycleError(
        "Cannot update steps on an APPROVED version. Only description can be edited."
      );
    }

    const changes: Record<string, unknown> = {};
    if (input.description !== undefined) changes.description = { from: existing.description, to: input.description };
    if (input.steps !== undefined) changes.steps = { from: existing.steps, to: input.steps };

    const updated = await tx.testProcedureVersion.update({
      where: { id: versionId },
      data: {
        ...(input.description !== undefined && { description: input.description }),
        ...(input.steps !== undefined && { steps: input.steps }),
      },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "TestProcedureVersion",
      entityId: versionId,
      source: ctx.source,
      requestId: ctx.requestId,
      changes,
    });

    return updated;
  });
}

// ─── Approve version ─────────────────────────────────────

export async function approveTestProcedureVersion(
  versionId: string,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testProcedureVersion.findUniqueOrThrow({
      where: { id: versionId },
    });

    if (existing.status !== "DRAFT") {
      throw new LifecycleError(
        `Cannot approve version in ${existing.status} status. Only DRAFT versions can be approved.`
      );
    }

    const updated = await tx.testProcedureVersion.update({
      where: { id: versionId },
      data: { status: "APPROVED" },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "APPROVE",
      entityType: "TestProcedureVersion",
      entityId: versionId,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: { status: { from: "DRAFT", to: "APPROVED" } },
    });

    return updated;
  });
}

// ─── Cancel procedure (with cascade to test cases) ──────

export async function cancelTestProcedure(
  id: string,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testProcedure.findUniqueOrThrow({
      where: { id },
    });

    if (existing.status === "CANCELED") {
      throw new LifecycleError("Procedure is already canceled.");
    }

    // Cancel TP + skip all child TCs (skip the re-fetch since we already checked status)
    await tx.testProcedure.update({
      where: { id },
      data: { status: "CANCELED" },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "CANCEL",
      entityType: "TestProcedure",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: { status: { from: existing.status, to: "CANCELED" } },
    });

    await cascadeSkipTestCases(tx, id, ctx);

    return tx.testProcedure.findUniqueOrThrow({ where: { id } });
  });
}

// ─── Re-Parent (move to different SR) ───────────────────

/**
 * Move a test procedure to a different sub-requirement.
 * Only the TP's subRequirementId FK changes - child TPVs/TCs stay attached
 * to this TP via their own FKs (lineage changes transitively).
 * TP lifecycle is independent of SR approval state, so ACTIVE TPs
 * can move to both DRAFT and APPROVED SRs (matches creation rules).
 *
 * Status guards:
 *   - TP must not be CANCELED
 *   - Target SR must exist and not be CANCELED
 *   - No-op moves are rejected (already under this parent)
 */
export async function reParentTestProcedure(
  id: string,
  input: ReParentTestProcedureInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testProcedure.findUniqueOrThrow({
      where: { id },
    });

    if (existing.status === "CANCELED") {
      throw new LifecycleError(
        "Cannot re-parent a canceled test procedure."
      );
    }

    // Validate target parent exists and is not canceled (before no-op check
    // so that a CANCELED same-parent gets the more informative error message)
    const targetSr = await tx.subRequirement.findUnique({
      where: { id: input.newSubRequirementId },
    });

    if (!targetSr) {
      throw new NotFoundError(
        `Target sub-requirement ${input.newSubRequirementId} not found.`
      );
    }

    if (targetSr.status === "CANCELED") {
      throw new LifecycleError(
        "Cannot move test procedure to a canceled sub-requirement."
      );
    }

    // No-op guard (after target validation for better error messages)
    if (existing.subRequirementId === input.newSubRequirementId) {
      throw new LifecycleError(
        "Test procedure is already under this sub-requirement."
      );
    }

    const previousSubRequirementId = existing.subRequirementId;

    const updated = await tx.testProcedure.update({
      where: { id },
      data: { subRequirementId: input.newSubRequirementId },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "RE_PARENT",
      entityType: "TestProcedure",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: {
        subRequirementId: {
          from: previousSubRequirementId,
          to: input.newSubRequirementId,
        },
      },
    });

    return { ...updated, previousSubRequirementId };
  });
}

// ─── Reactivate (CANCELED -> ACTIVE, with cascade to TCs) ──

/**
 * Reactivate a canceled test procedure and un-skip all its SKIPPED test cases.
 * Entry point for direct TP reactivation (not cascade).
 *
 * Guards:
 *   - TP must be CANCELED
 *   - Parent SR must not be CANCELED (top-down reactivation required)
 */
export async function reactivateTestProcedure(
  id: string,
  _input: ReactivateTestProcedureInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testProcedure.findUniqueOrThrow({
      where: { id },
      include: { subRequirement: { select: { status: true } } },
    });

    if (existing.status !== "CANCELED") {
      throw new LifecycleError(
        `Cannot reactivate test procedure in ${existing.status} status. Only CANCELED procedures can be reactivated.`
      );
    }

    // Parent SR must be non-canceled (top-down reactivation)
    if (existing.subRequirement.status === "CANCELED") {
      throw new LifecycleError(
        "Cannot reactivate test procedure: parent sub-requirement is CANCELED. Reactivate the parent first."
      );
    }

    // Reactivate TP + un-skip all child TCs
    await tx.testProcedure.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "REACTIVATE",
      entityType: "TestProcedure",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: { status: { from: "CANCELED", to: "ACTIVE" } },
    });

    await cascadeReactivateTestCases(tx, id, ctx);

    return tx.testProcedure.findUniqueOrThrow({ where: { id } });
  });
}
