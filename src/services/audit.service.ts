// Audit logging utility.
// Called inside Prisma interactive transactions so that every mutation
// and its audit record are committed atomically.

import { Prisma, AuditAction } from "@prisma/client";
import type { AuditSource } from "@/lib/request-context";

export interface AuditEntry {
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  source?: AuditSource; // defaults to "api" if omitted
  requestId?: string;
  changes?: Record<string, unknown>;
}

/**
 * Write an audit log entry inside an existing Prisma transaction.
 * This keeps the mutation and its audit record in the same transaction,
 * so they either both commit or both roll back.
 */
export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  entry: AuditEntry
) {
  return tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      source: entry.source ?? "api",
      requestId: entry.requestId,
      changes: entry.changes
        ? (entry.changes as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
}
