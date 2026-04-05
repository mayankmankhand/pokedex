// Product Requirement service - domain commands with lifecycle enforcement.
// Every mutation runs inside a Prisma interactive transaction with an audit log entry.

import { prisma } from "@/lib/prisma";
import { RequestContext } from "@/lib/request-context";
import { LifecycleError } from "@/lib/errors";
import { writeAuditLog } from "./audit.service";
import { cascadeCancelSubRequirement, cascadeReactivateSubRequirement } from "./sub-requirement.service";
import type {
  CreateProductRequirementInput,
  UpdateProductRequirementInput,
  ReactivateProductRequirementInput,
} from "@/schemas/product-requirement.schema";

// ─── Create ──────────────────────────────────────────────

export async function createProductRequirement(
  input: CreateProductRequirementInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const requirement = await tx.productRequirement.create({
      data: {
        title: input.title,
        description: input.description,
        createdBy: ctx.userId,
      },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "CREATE",
      entityType: "ProductRequirement",
      entityId: requirement.id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: { title: input.title, description: input.description },
    });

    return requirement;
  });
}

// ─── Update (DRAFT: all fields, APPROVED: title + description only) ──

export async function updateProductRequirement(
  id: string,
  input: UpdateProductRequirementInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.productRequirement.findUniqueOrThrow({
      where: { id },
    });

    if (existing.status !== "DRAFT" && existing.status !== "APPROVED") {
      throw new LifecycleError(
        `Cannot update product requirement in ${existing.status} status. Only DRAFT or APPROVED requirements can be edited.`
      );
    }

    // APPROVED requirements can only update title and description.
    // If the input contains any other fields, reject the request.
    if (existing.status === "APPROVED") {
      const allowedKeys = new Set(["title", "description"]);
      const extraKeys = Object.keys(input).filter((k) => !allowedKeys.has(k) && input[k as keyof typeof input] !== undefined);
      if (extraKeys.length > 0) {
        throw new LifecycleError(
          `Cannot update fields [${extraKeys.join(", ")}] on an APPROVED product requirement. Only title and description can be edited.`
        );
      }
    }

    const changes: Record<string, unknown> = {};
    if (input.title !== undefined) changes.title = { from: existing.title, to: input.title };
    if (input.description !== undefined) changes.description = { from: existing.description, to: input.description };

    const updated = await tx.productRequirement.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "ProductRequirement",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes,
    });

    return updated;
  });
}

// ─── Approve ─────────────────────────────────────────────

export async function approveProductRequirement(
  id: string,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.productRequirement.findUniqueOrThrow({
      where: { id },
    });

    if (existing.status !== "DRAFT") {
      throw new LifecycleError(
        `Cannot approve product requirement in ${existing.status} status. Only DRAFT requirements can be approved.`
      );
    }

    const updated = await tx.productRequirement.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "APPROVE",
      entityType: "ProductRequirement",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: { status: { from: "DRAFT", to: "APPROVED" } },
    });

    return updated;
  });
}

// ─── Cancel (with cascade to SRs, TPs, and TCs) ────────

export async function cancelProductRequirement(
  id: string,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.productRequirement.findUniqueOrThrow({
      where: { id },
    });

    if (existing.status !== "DRAFT" && existing.status !== "APPROVED") {
      throw new LifecycleError(
        `Cannot cancel product requirement in ${existing.status} status. Only DRAFT or APPROVED requirements can be canceled.`
      );
    }

    // DRAFT cancellation: block if children exist (user must remove them first)
    if (existing.status === "DRAFT") {
      const childCount = await tx.subRequirement.count({
        where: { productRequirementId: id },
      });
      if (childCount > 0) {
        throw new LifecycleError(
          "Cannot cancel DRAFT product requirement with existing sub-requirements. Remove or cancel sub-requirements first."
        );
      }
    }

    // Cancel the PR itself
    await tx.productRequirement.update({
      where: { id },
      data: { status: "CANCELED" },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "CANCEL",
      entityType: "ProductRequirement",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: { status: { from: existing.status, to: "CANCELED" } },
    });

    // Cascade to all child sub-requirements (only relevant for APPROVED)
    if (existing.status === "APPROVED") {
      const subReqs = await tx.subRequirement.findMany({
        where: { productRequirementId: id },
        select: { id: true },
      });

      for (const sr of subReqs) {
        await cascadeCancelSubRequirement(tx, sr.id, ctx);
      }
    }

    return tx.productRequirement.findUniqueOrThrow({ where: { id } });
  });
}

// ─── Reactivate (CANCELED -> DRAFT, with cascade to SRs, TPs, TCs) ──

/**
 * Reactivate a canceled product requirement and cascade to all children.
 * PR has no parent, so no parent guard is needed.
 *
 * Cascade: CANCELED SRs -> DRAFT, CANCELED TPs -> ACTIVE, SKIPPED TCs -> PENDING
 *
 * Guard: PR must be CANCELED
 */
export async function reactivateProductRequirement(
  id: string,
  _input: ReactivateProductRequirementInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.productRequirement.findUniqueOrThrow({
      where: { id },
    });

    if (existing.status !== "CANCELED") {
      throw new LifecycleError(
        `Cannot reactivate product requirement in ${existing.status} status. Only CANCELED requirements can be reactivated.`
      );
    }

    // Reactivate the PR itself
    await tx.productRequirement.update({
      where: { id },
      data: { status: "DRAFT" },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "REACTIVATE",
      entityType: "ProductRequirement",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: { status: { from: "CANCELED", to: "DRAFT" } },
    });

    // Cascade to all child sub-requirements (and their TPs and TCs)
    const subReqs = await tx.subRequirement.findMany({
      where: { productRequirementId: id },
      select: { id: true },
    });

    for (const sr of subReqs) {
      await cascadeReactivateSubRequirement(tx, sr.id, ctx);
    }

    return tx.productRequirement.findUniqueOrThrow({ where: { id } });
  });
}
