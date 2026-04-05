// Sub-Requirement service - domain commands with lifecycle enforcement.
// Sub-requirements inherit team context and require an approved parent for approval.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RequestContext } from "@/lib/request-context";
import { LifecycleError, NotFoundError } from "@/lib/errors";
import { writeAuditLog } from "./audit.service";
import { cascadeCancelTestProcedure, cascadeReactivateTestProcedure } from "./test-procedure.service";
import type {
  CreateSubRequirementInput,
  UpdateSubRequirementInput,
  ReParentSubRequirementInput,
  ReactivateSubRequirementInput,
} from "@/schemas/sub-requirement.schema";

// ─── Cascade helper (used by PR cancel) ─────────────────

/**
 * Cancel a single sub-requirement and cascade to its TPs and TCs.
 * Already-CANCELED SRs are silently skipped. Cancels regardless of current
 * status (bypasses the entry-point APPROVED-only guard for cascade scenarios
 * where a parent PR is canceled and DRAFT child SRs must also be canceled).
 * Call within an existing transaction.
 */
export async function cascadeCancelSubRequirement(
  tx: Prisma.TransactionClient,
  subRequirementId: string,
  ctx: RequestContext
) {
  const sr = await tx.subRequirement.findUniqueOrThrow({
    where: { id: subRequirementId },
  });

  // Already canceled - skip silently
  if (sr.status === "CANCELED") return;

  await tx.subRequirement.update({
    where: { id: subRequirementId },
    data: { status: "CANCELED" },
  });

  await writeAuditLog(tx, {
    actorId: ctx.userId,
    action: "CANCEL",
    entityType: "SubRequirement",
    entityId: subRequirementId,
    source: ctx.source,
    requestId: ctx.requestId,
    changes: { status: { from: sr.status, to: "CANCELED" } },
  });

  // Cascade to all child test procedures (and their test cases)
  const procedures = await tx.testProcedure.findMany({
    where: { subRequirementId },
    select: { id: true },
  });

  await Promise.all(
    procedures.map((tp) => cascadeCancelTestProcedure(tx, tp.id, ctx))
  );
}

// ─── Cascade reactivation helper (used by PR reactivate) ─

/**
 * Reactivate a single sub-requirement and cascade to its TPs and TCs.
 * Already non-CANCELED SRs are silently skipped. Call within an existing transaction.
 */
export async function cascadeReactivateSubRequirement(
  tx: Prisma.TransactionClient,
  subRequirementId: string,
  ctx: RequestContext
) {
  const sr = await tx.subRequirement.findUniqueOrThrow({
    where: { id: subRequirementId },
  });

  // Already non-canceled - skip silently
  if (sr.status !== "CANCELED") return;

  await tx.subRequirement.update({
    where: { id: subRequirementId },
    data: { status: "DRAFT" },
  });

  await writeAuditLog(tx, {
    actorId: ctx.userId,
    action: "REACTIVATE",
    entityType: "SubRequirement",
    entityId: subRequirementId,
    source: ctx.source,
    requestId: ctx.requestId,
    changes: { status: { from: "CANCELED", to: "DRAFT" } },
  });

  // Cascade to all child test procedures (and their test cases)
  const procedures = await tx.testProcedure.findMany({
    where: { subRequirementId },
    select: { id: true },
  });

  await Promise.all(
    procedures.map((tp) => cascadeReactivateTestProcedure(tx, tp.id, ctx))
  );
}

// ─── Create ──────────────────────────────────────────────

export async function createSubRequirement(
  input: CreateSubRequirementInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    // Verify parent product requirement exists
    await tx.productRequirement.findUniqueOrThrow({
      where: { id: input.productRequirementId },
    });

    const subReq = await tx.subRequirement.create({
      data: {
        title: input.title,
        description: input.description,
        productRequirementId: input.productRequirementId,
        teamId: input.teamId,
        createdBy: ctx.userId,
      },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "CREATE",
      entityType: "SubRequirement",
      entityId: subReq.id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: {
        title: input.title,
        description: input.description,
        productRequirementId: input.productRequirementId,
        teamId: input.teamId,
      },
    });

    return subReq;
  });
}

// ─── Update (DRAFT: all fields, APPROVED: title + description only) ──

export async function updateSubRequirement(
  id: string,
  input: UpdateSubRequirementInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.subRequirement.findUniqueOrThrow({
      where: { id },
    });

    if (existing.status !== "DRAFT" && existing.status !== "APPROVED") {
      throw new LifecycleError(
        `Cannot update sub-requirement in ${existing.status} status. Only DRAFT or APPROVED sub-requirements can be edited.`
      );
    }

    // APPROVED sub-requirements can only update title and description.
    if (existing.status === "APPROVED") {
      const allowedKeys = new Set(["title", "description"]);
      const extraKeys = Object.keys(input).filter((k) => !allowedKeys.has(k) && input[k as keyof typeof input] !== undefined);
      if (extraKeys.length > 0) {
        throw new LifecycleError(
          `Cannot update fields [${extraKeys.join(", ")}] on an APPROVED sub-requirement. Only title and description can be edited.`
        );
      }
    }

    const changes: Record<string, unknown> = {};
    if (input.title !== undefined) changes.title = { from: existing.title, to: input.title };
    if (input.description !== undefined) changes.description = { from: existing.description, to: input.description };

    const updated = await tx.subRequirement.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "SubRequirement",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes,
    });

    return updated;
  });
}

// ─── Approve (requires parent to be approved) ────────────

export async function approveSubRequirement(
  id: string,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.subRequirement.findUniqueOrThrow({
      where: { id },
      include: { productRequirement: true },
    });

    if (existing.status !== "DRAFT") {
      throw new LifecycleError(
        `Cannot approve sub-requirement in ${existing.status} status. Only DRAFT sub-requirements can be approved.`
      );
    }

    if (existing.productRequirement.status !== "APPROVED") {
      throw new LifecycleError(
        `Cannot approve sub-requirement: parent product requirement is ${existing.productRequirement.status}. It must be APPROVED first.`
      );
    }

    const updated = await tx.subRequirement.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "APPROVE",
      entityType: "SubRequirement",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: { status: { from: "DRAFT", to: "APPROVED" } },
    });

    return updated;
  });
}

// ─── Cancel (with cascade to TPs and TCs) ──────────────

export async function cancelSubRequirement(
  id: string,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.subRequirement.findUniqueOrThrow({
      where: { id },
    });

    if (existing.status !== "DRAFT" && existing.status !== "APPROVED") {
      throw new LifecycleError(
        `Cannot cancel sub-requirement in ${existing.status} status. Only DRAFT or APPROVED sub-requirements can be canceled.`
      );
    }

    // DRAFT cancellation: block if children exist (user must remove them first)
    if (existing.status === "DRAFT") {
      const childCount = await tx.testProcedure.count({
        where: { subRequirementId: id },
      });
      if (childCount > 0) {
        throw new LifecycleError(
          "Cannot cancel DRAFT sub-requirement with existing test procedures. Remove or cancel test procedures first."
        );
      }
    }

    // Cancel SR
    await tx.subRequirement.update({
      where: { id },
      data: { status: "CANCELED" },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "CANCEL",
      entityType: "SubRequirement",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: { status: { from: existing.status, to: "CANCELED" } },
    });

    // Cascade to all child TPs and TCs (only relevant for APPROVED)
    if (existing.status === "APPROVED") {
      const procedures = await tx.testProcedure.findMany({
        where: { subRequirementId: id },
        select: { id: true },
      });

      await Promise.all(
        procedures.map((tp) => cascadeCancelTestProcedure(tx, tp.id, ctx))
      );
    }

    return tx.subRequirement.findUniqueOrThrow({ where: { id } });
  });
}

// ─── Re-Parent (move to different PR) ───────────────────

/**
 * Move a sub-requirement to a different product requirement.
 * Only the SR's productRequirementId FK changes - child TPs/TPVs/TCs
 * stay attached to this SR via their own FKs (lineage changes transitively).
 *
 * Status guards:
 *   - SR must not be CANCELED
 *   - Target PR must exist and not be CANCELED
 *   - APPROVED SR cannot move to a DRAFT PR (breaks approval hierarchy)
 *   - No-op moves are rejected (already under this parent)
 */
export async function reParentSubRequirement(
  id: string,
  input: ReParentSubRequirementInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.subRequirement.findUniqueOrThrow({
      where: { id },
    });

    if (existing.status === "CANCELED") {
      throw new LifecycleError(
        "Cannot re-parent a canceled sub-requirement."
      );
    }

    // Validate target parent exists and is not canceled (before no-op check
    // so that a CANCELED same-parent gets the more informative error message)
    const targetPr = await tx.productRequirement.findUnique({
      where: { id: input.newProductRequirementId },
    });

    if (!targetPr) {
      throw new NotFoundError(
        `Target product requirement ${input.newProductRequirementId} not found.`
      );
    }

    if (targetPr.status === "CANCELED") {
      throw new LifecycleError(
        "Cannot move sub-requirement to a canceled product requirement."
      );
    }

    // No-op guard (after target validation for better error messages)
    if (existing.productRequirementId === input.newProductRequirementId) {
      throw new LifecycleError(
        "Sub-requirement is already under this product requirement."
      );
    }

    // APPROVED SR cannot move to DRAFT PR (would break approval hierarchy)
    if (existing.status === "APPROVED" && targetPr.status === "DRAFT") {
      throw new LifecycleError(
        "Cannot move an approved sub-requirement to a draft product requirement. The target must be approved."
      );
    }

    const previousProductRequirementId = existing.productRequirementId;

    const updated = await tx.subRequirement.update({
      where: { id },
      data: { productRequirementId: input.newProductRequirementId },
      include: { team: { select: { name: true } } },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "RE_PARENT",
      entityType: "SubRequirement",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: {
        productRequirementId: {
          from: previousProductRequirementId,
          to: input.newProductRequirementId,
        },
      },
    });

    return { ...updated, previousProductRequirementId };
  });
}

// ─── Reactivate (CANCELED -> DRAFT, with cascade to TPs and TCs) ──

/**
 * Reactivate a canceled sub-requirement and cascade to its TPs and TCs.
 * Entry point for direct SR reactivation (not cascade).
 *
 * Guards:
 *   - SR must be CANCELED
 *   - Parent PR must not be CANCELED (top-down reactivation required)
 */
export async function reactivateSubRequirement(
  id: string,
  _input: ReactivateSubRequirementInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.subRequirement.findUniqueOrThrow({
      where: { id },
      include: { productRequirement: { select: { status: true } } },
    });

    if (existing.status !== "CANCELED") {
      throw new LifecycleError(
        `Cannot reactivate sub-requirement in ${existing.status} status. Only CANCELED sub-requirements can be reactivated.`
      );
    }

    // Parent PR must be non-canceled (top-down reactivation)
    if (existing.productRequirement.status === "CANCELED") {
      throw new LifecycleError(
        "Cannot reactivate sub-requirement: parent product requirement is CANCELED. Reactivate the parent first."
      );
    }

    // Reactivate SR
    await tx.subRequirement.update({
      where: { id },
      data: { status: "DRAFT" },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "REACTIVATE",
      entityType: "SubRequirement",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: { status: { from: "CANCELED", to: "DRAFT" } },
    });

    // Cascade to all child TPs and TCs
    const procedures = await tx.testProcedure.findMany({
      where: { subRequirementId: id },
      select: { id: true },
    });

    await Promise.all(
      procedures.map((tp) => cascadeReactivateTestProcedure(tx, tp.id, ctx))
    );

    return tx.subRequirement.findUniqueOrThrow({ where: { id } });
  });
}
