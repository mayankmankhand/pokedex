// Panel payload types for the context panel.
// Uses a Zod-backed discriminated union so the same shapes
// can validate tool output and type-narrow in React renderers.

import { z } from "zod";

// -- Detail payload: shows a single entity with its fields and related items --
export const DetailPayloadSchema = z.object({
  type: z.literal("detail"),
  entityType: z.enum([
    "ProductRequirement",
    "SubRequirement",
    "TestProcedure",
    "TestProcedureVersion",
    "TestCase",
  ]),
  title: z.string(),
  // The entity's database ID (used for API calls like edits and actions)
  entityId: z.string(),
  // Key-value fields to display (e.g. status, description, createdAt).
  // Values are stringified for display - keeps the schema simple.
  fields: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ),
  // Optional list of related entities (e.g. sub-requirements under a requirement).
  relatedEntities: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        entityType: z.string(),
      }),
    )
    .optional(),
  // Optional list of active attachments (files uploaded to this entity).
  attachments: z
    .array(
      z.object({
        id: z.string(),
        fileName: z.string(),
        fileType: z.string(),
        uploadedBy: z.string(),
        createdAt: z.string(),
      }),
    )
    .optional(),
  // Fields the user can edit inline (populated based on entity status and lifecycle rules)
  editableFields: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        value: z.string(),
        fieldType: z.enum(["text", "textarea"]),
      }),
    )
    .optional(),
  // Lifecycle actions available for this entity (e.g. approve, cancel)
  availableActions: z
    .array(
      z.object({
        action: z.string(),
        label: z.string(),
        requiresConfirmation: z.boolean(),
        variant: z.enum(["default", "destructive"]),
      }),
    )
    .optional(),
});

// -- Table payload: shows rows and columns (query results, search results) --
// isTruncated is optional for backward compatibility with historical chat logs.
// When true, the LLM should warn the user that more results exist.
export const TablePayloadSchema = z.object({
  type: z.literal("table"),
  title: z.string(),
  columns: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
    }),
  ),
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .max(200, "Rows accumulate client-side via Show More; capped to prevent runaway"),
  isTruncated: z.boolean().optional(),
  // Identifies the query type for "Show more" pagination
  queryType: z.string().optional(),
  // Query parameters for replaying the query (e.g. filters, team)
  queryParams: z.record(z.string(), z.unknown()).optional(),
});

// -- Diagram payload: Mermaid syntax string for visual rendering --
export const DiagramPayloadSchema = z.object({
  type: z.literal("diagram"),
  title: z.string(),
  mermaidSyntax: z.string(),
});

// -- Audit payload: shows a timeline of audit log entries for an entity --
export const AuditChangeItemSchema = z.object({
  field: z.string(),
  old: z.string().optional(),
  new: z.string().optional(),
});

export const AuditEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  actor: z.object({ name: z.string() }),
  createdAt: z.string(),
  changes: z.array(AuditChangeItemSchema).max(10).default([]),
});

export const AuditPayloadSchema = z.object({
  type: z.literal("audit"),
  title: z.string(),
  entries: z.array(AuditEntrySchema).max(50, "Audit entries capped at 50"),
});

// -- Reserved types (defined now, implemented later - see spec Section 9) --
export const DocumentPayloadSchema = z.object({
  type: z.literal("document"),
  title: z.string(),
  markdown: z.string(),
});

export const ComparisonPayloadSchema = z.object({
  type: z.literal("comparison"),
  title: z.string(),
  left: z.record(z.string(), z.unknown()),
  right: z.record(z.string(), z.unknown()),
});

export const TimelinePayloadSchema = z.object({
  type: z.literal("timeline"),
  title: z.string(),
  milestones: z.array(z.object({
    label: z.string(),
    date: z.string(),
    status: z.string().optional(),
  })),
});

// -- Choices payload: inline multi-choice buttons in chat (not panel) --
// Unlike other UI intent payloads that render in the side panel,
// this renders inline in the chat message (like ConfirmButtons).
export const ChoicesPayloadSchema = z.object({
  type: z.literal("choices"),
  question: z.string().min(1).max(200).trim(),
  choices: z
    .array(z.string().min(1).max(100).trim())
    .min(2)
    .max(5)
    .refine(
      (arr) => new Set(arr).size === arr.length,
      { message: "Choices must be unique" }
    ),
});

// -- Discriminated union of all panel content types --
export const PanelContentSchema = z.discriminatedUnion("type", [
  DetailPayloadSchema,
  TablePayloadSchema,
  DiagramPayloadSchema,
  AuditPayloadSchema,
  DocumentPayloadSchema,
  ComparisonPayloadSchema,
  TimelinePayloadSchema,
]);

// -- Error state (not part of the discriminated union - separate concern) --
export const PanelErrorSchema = z.object({
  type: z.literal("error"),
  toolName: z.string(),
  message: z.string(),
});

// TypeScript types derived from Zod schemas
export type DetailPayload = z.infer<typeof DetailPayloadSchema>;
export type TablePayload = z.infer<typeof TablePayloadSchema>;
export type DiagramPayload = z.infer<typeof DiagramPayloadSchema>;
export type PanelContent = z.infer<typeof PanelContentSchema>;
export type AuditChangeItem = z.infer<typeof AuditChangeItemSchema>;
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export type AuditPayload = z.infer<typeof AuditPayloadSchema>;
export type DocumentPayload = z.infer<typeof DocumentPayloadSchema>;
export type ComparisonPayload = z.infer<typeof ComparisonPayloadSchema>;
export type TimelinePayload = z.infer<typeof TimelinePayloadSchema>;
export type ChoicesPayload = z.infer<typeof ChoicesPayloadSchema>;
export type PanelError = z.infer<typeof PanelErrorSchema>;

// The panel can show content or an error state
export type PanelState = PanelContent | PanelError;

// Shared shape for SDK tool parts (used in page.tsx and message-bubble.tsx).
// The AI SDK's tool part types are generic and complex, so we cast to this
// lightweight shape at the consumption boundary. (R17: single source of truth)
export type ToolPartShape = {
  type: string;
  toolName?: string;
  toolCallId: string;
  state: string;
  output?: unknown;
  errorText?: string;
};
