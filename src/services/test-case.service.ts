// Test Case service - record results, correct, re-execute, skip, update notes.
// Test cases belong to a TestProcedureVersion. Results can only be recorded
// when the parent version is APPROVED.

import { prisma } from "@/lib/prisma";
import { TestCaseResult, TestCaseStatus } from "@prisma/client";
import { RequestContext } from "@/lib/request-context";
import { LifecycleError } from "@/lib/errors";
import { writeAuditLog } from "./audit.service";
import type {
  CreateTestCaseInput,
  UpdateTestCaseInput,
  RecordTestResultInput,
  CorrectTestResultInput,
  UpdateTestCaseNotesInput,
} from "@/schemas/test-case.schema";

// ─── Create ──────────────────────────────────────────────

export async function createTestCase(
  input: CreateTestCaseInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    // Verify parent version exists
    await tx.testProcedureVersion.findUniqueOrThrow({
      where: { id: input.testProcedureVersionId },
    });

    const testCase = await tx.testCase.create({
      data: {
        title: input.title,
        description: input.description,
        testProcedureVersionId: input.testProcedureVersionId,
        createdBy: ctx.userId,
      },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "CREATE",
      entityType: "TestCase",
      entityId: testCase.id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: {
        title: input.title,
        description: input.description,
        testProcedureVersionId: input.testProcedureVersionId,
      },
    });

    return testCase;
  });
}

// ─── Update (PENDING only, title + description) ──────────

export async function updateTestCase(
  id: string,
  input: UpdateTestCaseInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testCase.findUniqueOrThrow({
      where: { id },
    });

    if (existing.status !== "PENDING") {
      throw new LifecycleError(
        `Cannot update test case in ${existing.status} status. Only PENDING test cases can be edited.`
      );
    }

    const changes: Record<string, unknown> = {};
    if (input.title !== undefined) changes.title = { from: existing.title, to: input.title };
    if (input.description !== undefined) changes.description = { from: existing.description, to: input.description };

    const updated = await tx.testCase.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "UPDATE",
      entityType: "TestCase",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes,
    });

    return updated;
  });
}

// ─── Shared: result-to-status mapping ────────────────────
// SKIPPED result means "skip this round, return to PENDING" - it's a temporary
// deferment, not a terminal outcome. The test case can be re-executed later.

const statusMap: Record<TestCaseResult, TestCaseStatus> = {
  PASS: "PASSED",
  FAIL: "FAILED",
  BLOCKED: "BLOCKED",
  SKIPPED: "PENDING",
};

// ─── Record result (parent version must be approved) ─────

export async function recordTestResult(
  id: string,
  input: RecordTestResultInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testCase.findUniqueOrThrow({
      where: { id },
      include: { testProcedureVersion: true },
    });

    if (existing.testProcedureVersion.status !== "APPROVED") {
      throw new LifecycleError(
        `Cannot record result: parent procedure version is ${existing.testProcedureVersion.status}. It must be APPROVED.`
      );
    }

    if (existing.status === "SKIPPED") {
      throw new LifecycleError("Cannot record result for a skipped test case.");
    }

    const updated = await tx.testCase.update({
      where: { id },
      data: {
        result: input.result,
        status: statusMap[input.result],
        notes: input.notes,
        executedBy: ctx.userId,
        executedAt: new Date(),
      },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "RECORD_RESULT",
      entityType: "TestCase",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: {
        result: input.result,
        status: { from: existing.status, to: statusMap[input.result] },
        notes: input.notes,
      },
    });

    return updated;
  });
}

// ─── Skip ───────────────────────────────────────────────

export async function skipTestCase(
  id: string,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testCase.findUniqueOrThrow({
      where: { id },
    });

    if (existing.status === "SKIPPED") {
      throw new LifecycleError("Test case is already skipped.");
    }

    const updated = await tx.testCase.update({
      where: { id },
      data: { status: "SKIPPED" },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "SKIP",
      entityType: "TestCase",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: { status: { from: existing.status, to: "SKIPPED" } },
    });

    return updated;
  });
}

// ─── Correct Result (fix a wrong result in place) ─────

export async function correctTestResult(
  id: string,
  input: CorrectTestResultInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testCase.findUniqueOrThrow({
      where: { id },
    });

    // Only executed test cases can be corrected
    const correctable: TestCaseStatus[] = ["PASSED", "FAILED", "BLOCKED"];
    if (!correctable.includes(existing.status)) {
      throw new LifecycleError(
        `Cannot correct test case in ${existing.status} status. Only PASSED, FAILED, or BLOCKED test cases can be corrected. ${existing.status === "PENDING" ? "No result has been recorded yet - record a result first." : ""}`
      );
    }

    // Reject same-result correction (no-op)
    if (existing.result === input.result) {
      throw new LifecycleError(
        `Test case result is already ${input.result}. Provide a different result to correct.`
      );
    }

    const newStatus = statusMap[input.result];

    // Build data payload - notes is optional: omit = no change, null = clear, string = set
    const data: Record<string, unknown> = {
      result: input.result,
      status: newStatus,
    };
    if (input.notes !== undefined) {
      data.notes = input.notes;
    }

    const updated = await tx.testCase.update({
      where: { id },
      data,
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "CORRECT_RESULT",
      entityType: "TestCase",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: {
        result: { from: existing.result, to: input.result },
        status: { from: existing.status, to: newStatus },
        ...(input.notes !== undefined && {
          notes: { from: existing.notes, to: input.notes },
        }),
        originalExecutor: existing.executedBy,
      },
    });

    return updated;
  });
}

// ─── Re-Execute (reset to PENDING for a fresh run) ─────

export async function reExecuteTestCase(
  id: string,
  _input: { confirmReExecute: true },
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testCase.findUniqueOrThrow({
      where: { id },
    });

    // Only FAILED or BLOCKED test cases can be re-executed
    const reExecutable: TestCaseStatus[] = ["FAILED", "BLOCKED"];
    if (!reExecutable.includes(existing.status)) {
      throw new LifecycleError(
        `Cannot re-execute test case in ${existing.status} status. Only FAILED or BLOCKED test cases can be re-executed. ${existing.status === "PASSED" ? "If the result was recorded incorrectly, use correctTestResult instead." : ""}`
      );
    }

    // Clear all execution-scoped fields and reset to PENDING
    const updated = await tx.testCase.update({
      where: { id },
      data: {
        status: "PENDING",
        result: null,
        notes: null,
        executedBy: null,
        executedAt: null,
      },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "RE_EXECUTE",
      entityType: "TestCase",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: {
        status: { from: existing.status, to: "PENDING" },
        result: { from: existing.result, to: null },
        previousExecutor: existing.executedBy,
        previousExecutedAt: existing.executedAt,
        previousNotes: existing.notes,
      },
    });

    return updated;
  });
}

// ─── Update Notes (add/edit notes without changing result) ──

export async function updateTestCaseNotes(
  id: string,
  input: UpdateTestCaseNotesInput,
  ctx: RequestContext
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.testCase.findUniqueOrThrow({
      where: { id },
    });

    // Only executed test cases can have notes updated
    const notesEditable: TestCaseStatus[] = ["PASSED", "FAILED", "BLOCKED"];
    if (!notesEditable.includes(existing.status)) {
      throw new LifecycleError(
        `Cannot update notes for test case in ${existing.status} status. Only PASSED, FAILED, or BLOCKED test cases can have notes updated.`
      );
    }

    const updated = await tx.testCase.update({
      where: { id },
      data: { notes: input.notes },
    });

    await writeAuditLog(tx, {
      actorId: ctx.userId,
      action: "UPDATE_NOTES",
      entityType: "TestCase",
      entityId: id,
      source: ctx.source,
      requestId: ctx.requestId,
      changes: {
        notes: { from: existing.notes, to: input.notes },
      },
    });

    return updated;
  });
}
