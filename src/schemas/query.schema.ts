import { z } from "zod";

// ─── Pagination ────────────────────────────────────────
// Shared pagination params for list endpoints.

export const PaginationParams = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof PaginationParams>;

// ─── Traceability Query ────────────────────────────────
// Fetches the full chain: requirement -> sub-requirements ->
// test procedures -> versions -> test cases.

export const TraceabilityQueryParams = z.object({
  requirementId: z.string().uuid("Must be a valid UUID"),
});

export type TraceabilityQueryParams = z.infer<typeof TraceabilityQueryParams>;

// ─── Audit Entity Types ───────────────────────────────
// Shared enum for entity types that appear in the audit log.
// Used by both getRecentAuditLog (query tool) and showAuditLog (UI intent tool).

export const AuditEntityTypeEnum = z.enum([
  "ProductRequirement",
  "SubRequirement",
  "TestProcedure",
  "TestProcedureVersion",
  "TestCase",
  "Attachment",
]);

// ─── Audit Query ───────────────────────────────────────
// Filters audit log entries by entity type and/or entity ID.

export const AuditQueryParams = z.object({
  entityType: AuditEntityTypeEnum.optional(),
  entityId: z.string().uuid("Must be a valid UUID").optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type AuditQueryParams = z.infer<typeof AuditQueryParams>;
