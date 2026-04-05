// Unit tests for the context panel: Zustand store actions,
// panel payload type validation, and discriminated union narrowing.

import { describe, it, expect, beforeEach } from "vitest";
import { usePanelStore } from "@/stores/panel-store";
import {
  DetailPayloadSchema,
  TablePayloadSchema,
  DiagramPayloadSchema,
  AuditPayloadSchema,
  AuditChangeItemSchema,
  AuditEntrySchema,
  PanelContentSchema,
  PanelErrorSchema,
} from "@/types/panel";
import type {
  DetailPayload,
  TablePayload,
  DiagramPayload,
  AuditPayload,
  PanelContent,
} from "@/types/panel";

// ─── Panel Store Tests ──────────────────────────────────

describe("usePanelStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    usePanelStore.getState().reset();
  });

  it("starts closed with no content", () => {
    const state = usePanelStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.content).toBeNull();
  });

  it("showDetail opens panel with detail content", () => {
    const payload: DetailPayload = {
      type: "detail",
      entityId: "pr-001",
      entityType: "ProductRequirement",
      title: "Test Requirement",
      fields: [
        { label: "Status", value: "DRAFT" },
        { label: "ID", value: "abc-123" },
      ],
    };

    usePanelStore.getState().showDetail(payload);
    const state = usePanelStore.getState();

    expect(state.isOpen).toBe(true);
    expect(state.content).toEqual(payload);
    expect(state.content?.type).toBe("detail");
  });

  it("showTable opens panel with table content", () => {
    const payload: TablePayload = {
      type: "table",
      title: "Coverage Gaps",
      columns: [
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
      ],
      rows: [{ title: "Sub-req 1", status: "DRAFT" }],
    };

    usePanelStore.getState().showTable(payload);
    const state = usePanelStore.getState();

    expect(state.isOpen).toBe(true);
    expect(state.content?.type).toBe("table");
  });

  it("showDiagram opens panel with diagram content", () => {
    const payload: DiagramPayload = {
      type: "diagram",
      title: "Traceability",
      mermaidSyntax: "graph TD\n  A-->B",
    };

    usePanelStore.getState().showDiagram(payload);
    const state = usePanelStore.getState();

    expect(state.isOpen).toBe(true);
    expect(state.content?.type).toBe("diagram");
  });

  it("showError opens panel with error content", () => {
    usePanelStore.getState().showError("showEntityDetail", "NotFoundError: entity not found");
    const state = usePanelStore.getState();

    expect(state.isOpen).toBe(true);
    expect(state.content?.type).toBe("error");
    if (state.content?.type === "error") {
      expect(state.content.toolName).toBe("showEntityDetail");
      expect(state.content.message).toBe("NotFoundError: entity not found");
    }
  });

  it("close hides the panel but keeps content", () => {
    const payload: DetailPayload = {
      type: "detail",
      entityId: "tc-001",
      entityType: "TestCase",
      title: "Test",
      fields: [],
    };

    usePanelStore.getState().showDetail(payload);
    usePanelStore.getState().close();

    const state = usePanelStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.content).toEqual(payload);
  });

  it("reset clears everything", () => {
    usePanelStore.getState().showDetail({
      type: "detail",
      entityId: "tc-001",
      entityType: "TestCase",
      title: "Test",
      fields: [],
    });
    usePanelStore.getState().reset();

    const state = usePanelStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.content).toBeNull();
  });

  it("showAudit opens panel with audit content", () => {
    const payload: AuditPayload = {
      type: "audit",
      title: "Recent Audit Log",
      entries: [
        {
          id: "entry-1",
          action: "CREATE",
          entityType: "ProductRequirement",
          entityId: "req-1",
          actor: { name: "Alice" },
          createdAt: "2026-03-01T10:00:00Z",
          changes: [{ field: "status", new: "DRAFT" }],
        },
      ],
    };

    usePanelStore.getState().showAudit(payload);
    const state = usePanelStore.getState();

    expect(state.isOpen).toBe(true);
    expect(state.content?.type).toBe("audit");
    if (state.content?.type === "audit") {
      expect(state.content.entries).toHaveLength(1);
    }
  });

  it("new tool call replaces previous content", () => {
    usePanelStore.getState().showDetail({
      type: "detail",
      entityId: "tc-001",
      entityType: "TestCase",
      title: "First",
      fields: [],
    });

    usePanelStore.getState().showTable({
      type: "table",
      title: "Second",
      columns: [],
      rows: [],
    });

    const state = usePanelStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.content?.type).toBe("table");
    if (state.content && "title" in state.content) {
      expect(state.content.title).toBe("Second");
    }
  });
});

// ─── Zod Schema Validation Tests ────────────────────────

describe("DetailPayloadSchema", () => {
  it("accepts valid detail payload", () => {
    const result = DetailPayloadSchema.safeParse({
      type: "detail",
      entityId: "pr-001",
      entityType: "ProductRequirement",
      title: "My Req",
      fields: [{ label: "Status", value: "DRAFT" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts detail with related entities", () => {
    const result = DetailPayloadSchema.safeParse({
      type: "detail",
      entityId: "sr-001",
      entityType: "SubRequirement",
      title: "Sub Req",
      fields: [],
      relatedEntities: [
        { id: "abc", title: "Proc 1", status: "ACTIVE", entityType: "TestProcedure" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid entity type", () => {
    const result = DetailPayloadSchema.safeParse({
      type: "detail",
      entityId: "bad-001",
      entityType: "InvalidType",
      title: "Bad",
      fields: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("TablePayloadSchema", () => {
  it("accepts valid table payload", () => {
    const result = TablePayloadSchema.safeParse({
      type: "table",
      title: "Results",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "Test" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 200 rows", () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({ name: `Row ${i}` }));
    const result = TablePayloadSchema.safeParse({
      type: "table",
      title: "Too Many",
      columns: [{ key: "name", label: "Name" }],
      rows,
    });
    expect(result.success).toBe(false);
  });

  it("accepts table with isTruncated flag", () => {
    const result = TablePayloadSchema.safeParse({
      type: "table",
      title: "Truncated Results",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "Test" }],
      isTruncated: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isTruncated).toBe(true);
    }
  });

  it("accepts table without isTruncated (backward compatible)", () => {
    const result = TablePayloadSchema.safeParse({
      type: "table",
      title: "Old Format",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ name: "Test" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isTruncated).toBeUndefined();
    }
  });

  it("accepts enriched table with cross-entity columns", () => {
    const result = TablePayloadSchema.safeParse({
      type: "table",
      title: "Product Requirements",
      columns: [
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "created", label: "Created" },
        { key: "createdBy", label: "Created By" },
      ],
      rows: [{
        title: "Core Features",
        status: "APPROVED",
        created: "Feb 1, 2026",
        createdBy: "Ash Ketchum",
      }],
      isTruncated: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts aggregation table with numeric values", () => {
    const result = TablePayloadSchema.safeParse({
      type: "table",
      title: "Test Result Summary by Procedure",
      columns: [
        { key: "procedure", label: "Procedure" },
        { key: "passed", label: "Passed" },
        { key: "failed", label: "Failed" },
        { key: "total", label: "Total" },
      ],
      rows: [{
        procedure: "GPS Accuracy Test",
        passed: 3,
        failed: 1,
        total: 4,
      }],
      isTruncated: false,
    });
    expect(result.success).toBe(true);
  });
});

describe("DiagramPayloadSchema", () => {
  it("accepts valid diagram payload", () => {
    const result = DiagramPayloadSchema.safeParse({
      type: "diagram",
      title: "Flow",
      mermaidSyntax: "graph TD\n  A-->B",
    });
    expect(result.success).toBe(true);
  });
});

describe("AuditPayloadSchema", () => {
  const validEntry = {
    id: "entry-1",
    action: "CREATE",
    entityType: "ProductRequirement",
    entityId: "req-1",
    actor: { name: "Alice" },
    createdAt: "2026-03-01T10:00:00Z",
    changes: [{ field: "status", new: "DRAFT" }],
  };

  it("accepts valid audit payload", () => {
    const result = AuditPayloadSchema.safeParse({
      type: "audit",
      title: "Recent Audit Log",
      entries: [validEntry],
    });
    expect(result.success).toBe(true);
  });

  it("accepts entry without changes (defaults to empty array)", () => {
    const { changes: _, ...entryWithoutChanges } = validEntry;
    const result = AuditEntrySchema.safeParse(entryWithoutChanges);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.changes).toEqual([]);
    }
  });

  it("accepts entry with old and new change values", () => {
    const result = AuditChangeItemSchema.safeParse({
      field: "status",
      old: "DRAFT",
      new: "APPROVED",
    });
    expect(result.success).toBe(true);
  });

  it("accepts change with only field name", () => {
    const result = AuditChangeItemSchema.safeParse({ field: "title" });
    expect(result.success).toBe(true);
  });

  it("rejects changes array with more than 10 items", () => {
    const tooManyChanges = Array.from({ length: 11 }, (_, i) => ({
      field: `field-${i}`,
      new: `value-${i}`,
    }));
    const result = AuditEntrySchema.safeParse({
      ...validEntry,
      changes: tooManyChanges,
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty entries array", () => {
    const result = AuditPayloadSchema.safeParse({
      type: "audit",
      title: "No Activity",
      entries: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("PanelErrorSchema", () => {
  it("accepts valid error payload", () => {
    const result = PanelErrorSchema.safeParse({
      type: "error",
      toolName: "showEntityDetail",
      message: "Not found",
    });
    expect(result.success).toBe(true);
  });
});

// ─── Discriminated Union Narrowing ──────────────────────

describe("PanelContentSchema discriminated union", () => {
  it("narrows to detail type", () => {
    const input = {
      type: "detail",
      entityId: "tc-001",
      entityType: "TestCase",
      title: "TC-001",
      fields: [{ label: "Status", value: "PENDING" }],
    };

    const result = PanelContentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const content: PanelContent = result.data;
      // TypeScript narrows based on discriminant
      if (content.type === "detail") {
        expect(content.entityType).toBe("TestCase");
        expect(content.fields).toHaveLength(1);
      }
    }
  });

  it("narrows to table type", () => {
    const input = {
      type: "table",
      title: "List",
      columns: [{ key: "x", label: "X" }],
      rows: [],
    };

    const result = PanelContentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "table") {
      expect(result.data.columns).toHaveLength(1);
      expect(result.data.rows).toHaveLength(0);
    }
  });

  it("narrows to diagram type", () => {
    const input = {
      type: "diagram",
      title: "Diagram",
      mermaidSyntax: "flowchart LR\n  A-->B",
    };

    const result = PanelContentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "diagram") {
      expect(result.data.mermaidSyntax).toContain("flowchart");
    }
  });

  it("narrows to audit type", () => {
    const input = {
      type: "audit",
      title: "Audit Log",
      entries: [
        {
          id: "e1",
          action: "APPROVE",
          entityType: "TestProcedure",
          entityId: "tp-1",
          actor: { name: "Bob" },
          createdAt: "2026-03-05T14:00:00Z",
          changes: [],
        },
      ],
    };

    const result = PanelContentSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success && result.data.type === "audit") {
      expect(result.data.entries).toHaveLength(1);
      expect(result.data.entries[0].action).toBe("APPROVE");
    }
  });

  it("rejects unknown discriminant", () => {
    const result = PanelContentSchema.safeParse({
      type: "unknown",
      title: "Bad",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Normalizer Tests ───────────────────────────────────

import { normalizeChanges } from "@/lib/ai/tools/ui-intent-tools";

describe("normalizeChanges", () => {
  it("extracts before/after shape", () => {
    const result = normalizeChanges({
      status: { before: "DRAFT", after: "APPROVED" },
    });
    expect(result).toEqual([{ field: "status", old: "DRAFT", new: "APPROVED" }]);
  });

  it("handles simple key-value as new value", () => {
    const result = normalizeChanges({ title: "New Title" });
    expect(result).toEqual([{ field: "title", new: "New Title" }]);
  });

  it("handles before-only (removal)", () => {
    const result = normalizeChanges({
      notes: { before: "old notes" },
    });
    expect(result).toEqual([{ field: "notes", old: "old notes" }]);
  });

  it("returns empty array for null input", () => {
    expect(normalizeChanges(null)).toEqual([]);
  });

  it("returns empty array for non-object input", () => {
    expect(normalizeChanges("not an object")).toEqual([]);
    expect(normalizeChanges(42)).toEqual([]);
    expect(normalizeChanges(undefined)).toEqual([]);
  });

  it("returns empty array for empty object", () => {
    expect(normalizeChanges({})).toEqual([]);
  });

  it("returns empty array for array input", () => {
    expect(normalizeChanges([1, 2, 3])).toEqual([]);
  });

  it("converts null values to (none)", () => {
    const result = normalizeChanges({ status: null });
    expect(result).toEqual([{ field: "status", new: "(none)" }]);
  });

  it("JSON-stringifies object values", () => {
    const result = normalizeChanges({ steps: ["step1", "step2"] });
    expect(result).toEqual([{ field: "steps", new: '["step1","step2"]' }]);
  });

  it("caps at 10 items", () => {
    const raw: Record<string, string> = {};
    for (let i = 0; i < 15; i++) {
      raw[`field-${i}`] = `value-${i}`;
    }
    const result = normalizeChanges(raw);
    expect(result).toHaveLength(10);
  });

  it("handles mixed shapes", () => {
    const result = normalizeChanges({
      status: { before: "DRAFT", after: "APPROVED" },
      title: "Updated Title",
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ field: "status", old: "DRAFT", new: "APPROVED" });
    expect(result[1]).toEqual({ field: "title", new: "Updated Title" });
  });
});
