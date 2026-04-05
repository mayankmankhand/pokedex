// Unit tests for Context Panel V2 features: navigation history, append rows,
// replaceContent, editable fields, available actions, panel utils, and
// updated schema validation (entityId, editableFields, availableActions).

import { describe, it, expect, beforeEach } from "vitest";
import { usePanelStore } from "@/stores/panel-store";
import {
  DetailPayloadSchema,
  TablePayloadSchema,
} from "@/types/panel";
import type { DetailPayload, TablePayload } from "@/types/panel";
import {
  computeEditableFields,
  computeAvailableActions,
} from "@/lib/ai/tools/shared-queries";
import { buildMutationUrl, buildEditPayload } from "@/lib/panel-utils";
import { getRequestContext } from "@/lib/request-context";
import { DEMO_USERS } from "@/lib/demo-users";

// ---------------------------------------------------------------------------
// Helpers: reusable fixture factories
// ---------------------------------------------------------------------------

function makeDetail(overrides?: Partial<DetailPayload>): DetailPayload {
  return {
    type: "detail",
    entityId: "pr-001",
    entityType: "ProductRequirement",
    title: "Default PR",
    fields: [{ label: "Status", value: "DRAFT" }],
    ...overrides,
  };
}

function makeTable(overrides?: Partial<TablePayload>): TablePayload {
  return {
    type: "table",
    title: "Default Table",
    columns: [{ key: "name", label: "Name" }],
    rows: [{ name: "Row 1" }],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Panel store: navigation history
// ═══════════════════════════════════════════════════════════════════════════

describe("Panel store - navigation history", () => {
  beforeEach(() => {
    usePanelStore.getState().reset();
  });

  it("starts with empty history and canGoBack false", () => {
    const state = usePanelStore.getState();
    expect(state.history).toEqual([]);
    expect(state.canGoBack).toBe(false);
  });

  it("showDetail pushes previous content onto history", () => {
    const detailA = makeDetail({ entityId: "pr-A", title: "Detail A" });
    const detailB = makeDetail({ entityId: "pr-B", title: "Detail B" });

    usePanelStore.getState().showDetail(detailA);
    usePanelStore.getState().showDetail(detailB);

    const state = usePanelStore.getState();
    expect(state.content).toEqual(detailB);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toEqual(detailA);
    expect(state.canGoBack).toBe(true);
  });

  it("showTable pushes previous content onto history", () => {
    const detail = makeDetail({ entityId: "pr-1", title: "First" });
    const table = makeTable({ title: "Second" });

    usePanelStore.getState().showDetail(detail);
    usePanelStore.getState().showTable(table);

    const state = usePanelStore.getState();
    expect(state.content).toEqual(table);
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toEqual(detail);
    expect(state.canGoBack).toBe(true);
  });

  it("navigateBack restores previous content", () => {
    const detailA = makeDetail({ entityId: "pr-A", title: "Detail A" });
    const detailB = makeDetail({ entityId: "pr-B", title: "Detail B" });

    usePanelStore.getState().showDetail(detailA);
    usePanelStore.getState().showDetail(detailB);
    usePanelStore.getState().navigateBack();

    const state = usePanelStore.getState();
    expect(state.content).toEqual(detailA);
  });

  it("navigateBack clears canGoBack when history is empty", () => {
    const detailA = makeDetail({ entityId: "pr-A", title: "Detail A" });
    const detailB = makeDetail({ entityId: "pr-B", title: "Detail B" });

    usePanelStore.getState().showDetail(detailA);
    usePanelStore.getState().showDetail(detailB);

    // First back: restores A, history becomes empty
    usePanelStore.getState().navigateBack();
    expect(usePanelStore.getState().canGoBack).toBe(false);

    // Second back: no-op (history is already empty)
    usePanelStore.getState().navigateBack();
    expect(usePanelStore.getState().content).toEqual(detailA);
    expect(usePanelStore.getState().canGoBack).toBe(false);
  });

  it("caps history at 20 entries", () => {
    // Show 25 different details (each push adds previous to history)
    for (let i = 0; i < 25; i++) {
      usePanelStore
        .getState()
        .showDetail(makeDetail({ entityId: `pr-${i}`, title: `Detail ${i}` }));
    }

    const state = usePanelStore.getState();
    expect(state.history.length).toBeLessThanOrEqual(20);
  });

  it("skips duplicate consecutive pushes", () => {
    const detail = makeDetail({ entityId: "pr-same", title: "Same Detail" });

    usePanelStore.getState().showDetail(detail);
    usePanelStore.getState().showDetail(detail);

    const state = usePanelStore.getState();
    // Second showDetail with identical content should not push to history
    expect(state.history).toHaveLength(0);
    expect(state.canGoBack).toBe(false);
  });

  it("replaceContent does NOT push history", () => {
    const detailA = makeDetail({ entityId: "pr-A", title: "Detail A" });
    const detailB = makeDetail({ entityId: "pr-B", title: "Detail B" });

    usePanelStore.getState().showDetail(detailA);
    usePanelStore.getState().replaceContent(detailB);

    const state = usePanelStore.getState();
    expect(state.content).toEqual(detailB);
    expect(state.history).toHaveLength(0);
    expect(state.canGoBack).toBe(false);
  });

  it("reset clears history", () => {
    const detailA = makeDetail({ entityId: "pr-A", title: "Detail A" });
    const detailB = makeDetail({ entityId: "pr-B", title: "Detail B" });

    usePanelStore.getState().showDetail(detailA);
    usePanelStore.getState().showDetail(detailB);
    expect(usePanelStore.getState().canGoBack).toBe(true);

    usePanelStore.getState().reset();

    const state = usePanelStore.getState();
    expect(state.history).toEqual([]);
    expect(state.canGoBack).toBe(false);
    expect(state.content).toBeNull();
  });

  it("appendTableRows does NOT push history", () => {
    const table = makeTable({ rows: [{ name: "Row 1" }] });

    usePanelStore.getState().showTable(table);
    usePanelStore.getState().appendTableRows([{ name: "Row 2" }], false);

    const state = usePanelStore.getState();
    expect(state.history).toHaveLength(0);
    expect(state.canGoBack).toBe(false);
  });

  it("appendTableRows adds rows to current table", () => {
    const table = makeTable({
      rows: [{ name: "A" }, { name: "B" }, { name: "C" }],
    });

    usePanelStore.getState().showTable(table);
    usePanelStore.getState().appendTableRows([{ name: "D" }, { name: "E" }], false);

    const state = usePanelStore.getState();
    expect(state.content?.type).toBe("table");
    if (state.content?.type === "table") {
      expect(state.content.rows).toHaveLength(5);
      expect(state.content.rows[3]).toEqual({ name: "D" });
      expect(state.content.rows[4]).toEqual({ name: "E" });
    }
  });

  it("appendTableRows updates isTruncated flag", () => {
    const table = makeTable({ rows: [{ name: "A" }], isTruncated: true });

    usePanelStore.getState().showTable(table);
    usePanelStore.getState().appendTableRows([{ name: "B" }], false);

    const state = usePanelStore.getState();
    if (state.content?.type === "table") {
      expect(state.content.isTruncated).toBe(false);
    }
  });

  it("appendTableRows deduplicates rows", () => {
    const table = makeTable({
      rows: [{ name: "A" }, { name: "B" }],
    });

    usePanelStore.getState().showTable(table);
    // Append one duplicate and one new row
    usePanelStore.getState().appendTableRows([{ name: "B" }, { name: "C" }], false);

    const state = usePanelStore.getState();
    if (state.content?.type === "table") {
      expect(state.content.rows).toHaveLength(3);
      expect(state.content.rows.map((r) => r.name)).toEqual(["A", "B", "C"]);
    }
  });

  it("appendTableRows is a no-op when content is not a table", () => {
    const detail = makeDetail({ entityId: "pr-1" });

    usePanelStore.getState().showDetail(detail);
    usePanelStore.getState().appendTableRows([{ name: "X" }], false);

    const state = usePanelStore.getState();
    // Content should remain the detail, unchanged
    expect(state.content?.type).toBe("detail");
  });

  it("multi-step history navigation works correctly", () => {
    const detailA = makeDetail({ entityId: "pr-A", title: "A" });
    const detailB = makeDetail({ entityId: "pr-B", title: "B" });
    const detailC = makeDetail({ entityId: "pr-C", title: "C" });

    usePanelStore.getState().showDetail(detailA);
    usePanelStore.getState().showDetail(detailB);
    usePanelStore.getState().showDetail(detailC);

    // History: [A, B], current: C
    expect(usePanelStore.getState().history).toHaveLength(2);

    usePanelStore.getState().navigateBack();
    // History: [A], current: B
    expect(usePanelStore.getState().content).toEqual(detailB);
    expect(usePanelStore.getState().canGoBack).toBe(true);

    usePanelStore.getState().navigateBack();
    // History: [], current: A
    expect(usePanelStore.getState().content).toEqual(detailA);
    expect(usePanelStore.getState().canGoBack).toBe(false);
  });

  it("showDiagram also pushes history", () => {
    const detail = makeDetail({ entityId: "pr-1" });

    usePanelStore.getState().showDetail(detail);
    usePanelStore.getState().showDiagram({
      type: "diagram",
      title: "Trace",
      mermaidSyntax: "flowchart LR\n  A-->B",
    });

    const state = usePanelStore.getState();
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toEqual(detail);
    expect(state.content?.type).toBe("diagram");
  });

  it("showAudit also pushes history", () => {
    const detail = makeDetail({ entityId: "pr-1" });

    usePanelStore.getState().showDetail(detail);
    usePanelStore.getState().showAudit({
      type: "audit",
      title: "Log",
      entries: [],
    });

    const state = usePanelStore.getState();
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toEqual(detail);
    expect(state.content?.type).toBe("audit");
  });

  it("showError pushes previous content onto history", () => {
    const detail = makeDetail({ entityId: "pr-1" });

    usePanelStore.getState().showDetail(detail);
    usePanelStore.getState().showError("showEntityDetail", "NotFoundError: gone");

    const state = usePanelStore.getState();
    expect(state.content?.type).toBe("error");
    // showError now pushes history so the user can navigate back
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toEqual(detail);
    expect(state.canGoBack).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Schema validation: V2 fields
// ═══════════════════════════════════════════════════════════════════════════

describe("DetailPayloadSchema - V2 fields", () => {
  it("requires entityId", () => {
    const result = DetailPayloadSchema.safeParse({
      type: "detail",
      // entityId is missing
      entityType: "ProductRequirement",
      title: "No ID",
      fields: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts editableFields", () => {
    const result = DetailPayloadSchema.safeParse({
      type: "detail",
      entityId: "pr-001",
      entityType: "ProductRequirement",
      title: "Editable PR",
      fields: [{ label: "Status", value: "DRAFT" }],
      editableFields: [
        { key: "title", label: "Title", value: "Editable PR", fieldType: "text" },
        { key: "description", label: "Description", value: "Some text", fieldType: "textarea" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.editableFields).toHaveLength(2);
      expect(result.data.editableFields![0].fieldType).toBe("text");
      expect(result.data.editableFields![1].fieldType).toBe("textarea");
    }
  });

  it("accepts availableActions", () => {
    const result = DetailPayloadSchema.safeParse({
      type: "detail",
      entityId: "pr-001",
      entityType: "ProductRequirement",
      title: "PR with actions",
      fields: [],
      availableActions: [
        { action: "approve", label: "Approve", requiresConfirmation: true, variant: "default" },
        { action: "cancel", label: "Cancel", requiresConfirmation: true, variant: "destructive" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.availableActions).toHaveLength(2);
      expect(result.data.availableActions![0].variant).toBe("default");
      expect(result.data.availableActions![1].variant).toBe("destructive");
    }
  });

  it("accepts detail without editableFields/availableActions (optional)", () => {
    const result = DetailPayloadSchema.safeParse({
      type: "detail",
      entityId: "pr-001",
      entityType: "ProductRequirement",
      title: "Plain Detail",
      fields: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.editableFields).toBeUndefined();
      expect(result.data.availableActions).toBeUndefined();
    }
  });

  it("rejects editableFields with invalid fieldType", () => {
    const result = DetailPayloadSchema.safeParse({
      type: "detail",
      entityId: "pr-001",
      entityType: "ProductRequirement",
      title: "Bad fieldType",
      fields: [],
      editableFields: [
        { key: "title", label: "Title", value: "x", fieldType: "number" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects availableActions with invalid variant", () => {
    const result = DetailPayloadSchema.safeParse({
      type: "detail",
      entityId: "pr-001",
      entityType: "ProductRequirement",
      title: "Bad variant",
      fields: [],
      availableActions: [
        { action: "approve", label: "Approve", requiresConfirmation: true, variant: "warning" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts editableFields and availableActions together", () => {
    const result = DetailPayloadSchema.safeParse({
      type: "detail",
      entityId: "pr-001",
      entityType: "ProductRequirement",
      title: "Full V2",
      fields: [{ label: "Status", value: "DRAFT" }],
      editableFields: [
        { key: "title", label: "Title", value: "Full V2", fieldType: "text" },
      ],
      availableActions: [
        { action: "approve", label: "Approve", requiresConfirmation: true, variant: "default" },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("TablePayloadSchema - V2 fields", () => {
  it("accepts queryType and queryParams", () => {
    const result = TablePayloadSchema.safeParse({
      type: "table",
      title: "Requirements",
      columns: [{ key: "title", label: "Title" }],
      rows: [{ title: "PR-001" }],
      queryType: "productRequirements",
      queryParams: { team: "Electrical" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.queryType).toBe("productRequirements");
      expect(result.data.queryParams).toEqual({ team: "Electrical" });
    }
  });

  it("allows up to 200 rows", () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ name: `Row ${i}` }));
    const result = TablePayloadSchema.safeParse({
      type: "table",
      title: "Max Rows",
      columns: [{ key: "name", label: "Name" }],
      rows,
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

  it("accepts table without queryType/queryParams (backward compatible)", () => {
    const result = TablePayloadSchema.safeParse({
      type: "table",
      title: "Old Format",
      columns: [{ key: "name", label: "Name" }],
      rows: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.queryType).toBeUndefined();
      expect(result.data.queryParams).toBeUndefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. computeEditableFields
// ═══════════════════════════════════════════════════════════════════════════

describe("computeEditableFields", () => {
  it("returns title + description for DRAFT ProductRequirement", () => {
    const result = computeEditableFields("ProductRequirement", "DRAFT", {
      title: "Core Features",
      description: "Main features",
    });
    expect(result).toHaveLength(2);
    expect(result![0]).toEqual({
      key: "title",
      label: "Title",
      value: "Core Features",
      fieldType: "text",
    });
    expect(result![1]).toEqual({
      key: "description",
      label: "Description",
      value: "Main features",
      fieldType: "textarea",
    });
  });

  it("returns title + description for APPROVED ProductRequirement", () => {
    const result = computeEditableFields("ProductRequirement", "APPROVED", {
      title: "Approved PR",
      description: "Locked-in features",
    });
    expect(result).toHaveLength(2);
    expect(result![0].key).toBe("title");
    expect(result![1].key).toBe("description");
  });

  it("returns undefined for CANCELED ProductRequirement", () => {
    const result = computeEditableFields("ProductRequirement", "CANCELED", {
      title: "Gone",
      description: "N/A",
    });
    expect(result).toBeUndefined();
  });

  it("returns title + description for DRAFT SubRequirement", () => {
    const result = computeEditableFields("SubRequirement", "DRAFT", {
      title: "Sub Req",
      description: "Details",
    });
    expect(result).toHaveLength(2);
  });

  it("returns title + description for APPROVED SubRequirement", () => {
    const result = computeEditableFields("SubRequirement", "APPROVED", {
      title: "Approved Sub",
      description: "Approved details",
    });
    expect(result).toHaveLength(2);
  });

  it("returns undefined for CANCELED SubRequirement", () => {
    const result = computeEditableFields("SubRequirement", "CANCELED", {
      title: "Gone",
    });
    expect(result).toBeUndefined();
  });

  it("returns title only for ACTIVE TestProcedure", () => {
    const result = computeEditableFields("TestProcedure", "ACTIVE", {
      title: "GPS Test",
    });
    expect(result).toHaveLength(1);
    expect(result![0]).toEqual({
      key: "title",
      label: "Title",
      value: "GPS Test",
      fieldType: "text",
    });
  });

  it("returns undefined for CANCELED TestProcedure", () => {
    const result = computeEditableFields("TestProcedure", "CANCELED", {
      title: "Old",
    });
    expect(result).toBeUndefined();
  });

  it("returns description only for DRAFT TestProcedureVersion", () => {
    const result = computeEditableFields("TestProcedureVersion", "DRAFT", {
      title: "v2 draft",
      description: "New steps",
    });
    expect(result).toHaveLength(1);
    expect(result![0].key).toBe("description");
    expect(result![0].fieldType).toBe("textarea");
  });

  it("returns description only for APPROVED TestProcedureVersion", () => {
    const result = computeEditableFields("TestProcedureVersion", "APPROVED", {
      title: "v1 approved",
      description: "Final steps",
    });
    expect(result).toHaveLength(1);
    expect(result![0]).toEqual({
      key: "description",
      label: "Description",
      value: "Final steps",
      fieldType: "textarea",
    });
  });

  it("returns title + description for PENDING TestCase", () => {
    const result = computeEditableFields("TestCase", "PENDING", {
      title: "TC-001",
      description: "Verify GPS accuracy",
    });
    expect(result).toHaveLength(2);
    expect(result![0].key).toBe("title");
    expect(result![1].key).toBe("description");
  });

  it("returns undefined for PASSED TestCase", () => {
    const result = computeEditableFields("TestCase", "PASSED", {
      title: "TC-001",
      description: "Already done",
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined for FAILED TestCase", () => {
    const result = computeEditableFields("TestCase", "FAILED", {
      title: "TC-002",
    });
    expect(result).toBeUndefined();
  });

  it("returns undefined for unknown entity type", () => {
    const result = computeEditableFields("UnknownType", "DRAFT", {
      title: "Mystery",
    });
    expect(result).toBeUndefined();
  });

  it("handles null description gracefully", () => {
    const result = computeEditableFields("ProductRequirement", "DRAFT", {
      title: "No desc",
      description: null,
    });
    expect(result).toHaveLength(2);
    expect(result![1].value).toBe("");
  });

  it("handles undefined title gracefully", () => {
    const result = computeEditableFields("ProductRequirement", "DRAFT", {
      description: "Some desc",
    });
    expect(result).toHaveLength(2);
    expect(result![0].value).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. computeAvailableActions
// ═══════════════════════════════════════════════════════════════════════════

describe("computeAvailableActions", () => {
  it("returns approve + cancel for DRAFT ProductRequirement", () => {
    const result = computeAvailableActions("ProductRequirement", "DRAFT");
    expect(result).toHaveLength(2);
    expect(result![0].action).toBe("approve");
    expect(result![0].variant).toBe("default");
    expect(result![0].requiresConfirmation).toBe(true);
    expect(result![1].action).toBe("cancel");
    expect(result![1].variant).toBe("destructive");
  });

  it("returns cancel for APPROVED ProductRequirement", () => {
    const result = computeAvailableActions("ProductRequirement", "APPROVED");
    expect(result).toHaveLength(1);
    expect(result![0].action).toBe("cancel");
    expect(result![0].variant).toBe("destructive");
  });

  it("returns reactivate for CANCELED ProductRequirement", () => {
    const result = computeAvailableActions("ProductRequirement", "CANCELED");
    expect(result).toHaveLength(1);
    expect(result![0].action).toBe("reactivate");
    expect(result![0].variant).toBe("default");
  });

  it("returns approve + cancel for DRAFT SubRequirement", () => {
    const result = computeAvailableActions("SubRequirement", "DRAFT");
    expect(result).toHaveLength(2);
    expect(result![0].action).toBe("approve");
    expect(result![1].action).toBe("cancel");
  });

  it("returns cancel for APPROVED SubRequirement", () => {
    const result = computeAvailableActions("SubRequirement", "APPROVED");
    expect(result).toHaveLength(1);
    expect(result![0].action).toBe("cancel");
  });

  it("returns reactivate for CANCELED SubRequirement", () => {
    const result = computeAvailableActions("SubRequirement", "CANCELED");
    expect(result).toHaveLength(1);
    expect(result![0].action).toBe("reactivate");
  });

  it("returns cancel for ACTIVE TestProcedure", () => {
    const result = computeAvailableActions("TestProcedure", "ACTIVE");
    expect(result).toHaveLength(1);
    expect(result![0].action).toBe("cancel");
    expect(result![0].label).toBe("Cancel");
  });

  it("returns reactivate for CANCELED TestProcedure", () => {
    const result = computeAvailableActions("TestProcedure", "CANCELED");
    expect(result).toHaveLength(1);
    expect(result![0].action).toBe("reactivate");
  });

  it("returns approve for DRAFT TestProcedureVersion", () => {
    const result = computeAvailableActions("TestProcedureVersion", "DRAFT");
    expect(result).toHaveLength(1);
    expect(result![0].action).toBe("approve");
    expect(result![0].label).toBe("Approve");
  });

  it("returns undefined for APPROVED TestProcedureVersion", () => {
    const result = computeAvailableActions("TestProcedureVersion", "APPROVED");
    expect(result).toBeUndefined();
  });

  it("returns skip for PENDING TestCase", () => {
    const result = computeAvailableActions("TestCase", "PENDING");
    expect(result).toHaveLength(1);
    expect(result![0].action).toBe("skip");
    expect(result![0].variant).toBe("destructive");
  });

  it("returns correct + re-execute for FAILED TestCase", () => {
    const result = computeAvailableActions("TestCase", "FAILED");
    expect(result).toHaveLength(2);
    expect(result![0].action).toBe("correct");
    expect(result![0].label).toBe("Correct Result");
    expect(result![1].action).toBe("re-execute");
    expect(result![1].label).toBe("Re-execute");
  });

  it("returns correct + re-execute for PASSED TestCase", () => {
    const result = computeAvailableActions("TestCase", "PASSED");
    expect(result).toHaveLength(2);
    expect(result![0].action).toBe("correct");
    expect(result![1].action).toBe("re-execute");
  });

  it("returns correct + re-execute for BLOCKED TestCase", () => {
    const result = computeAvailableActions("TestCase", "BLOCKED");
    expect(result).toHaveLength(2);
    expect(result![0].action).toBe("correct");
    expect(result![1].action).toBe("re-execute");
  });

  it("returns undefined for SKIPPED TestCase", () => {
    const result = computeAvailableActions("TestCase", "SKIPPED");
    expect(result).toBeUndefined();
  });

  it("returns undefined for unknown entity type", () => {
    const result = computeAvailableActions("Attachment", "ACTIVE");
    expect(result).toBeUndefined();
  });

  it("returns undefined for unknown status on known entity type", () => {
    const result = computeAvailableActions("ProductRequirement", "UNKNOWN_STATUS");
    expect(result).toBeUndefined();
  });

  it("all actions require confirmation", () => {
    // Every action in the system requires confirm-before-act
    const allCombinations: Array<[string, string]> = [
      ["ProductRequirement", "DRAFT"],
      ["ProductRequirement", "APPROVED"],
      ["ProductRequirement", "CANCELED"],
      ["TestProcedure", "ACTIVE"],
      ["TestProcedure", "CANCELED"],
      ["TestProcedureVersion", "DRAFT"],
      ["TestCase", "PENDING"],
      ["TestCase", "FAILED"],
    ];
    for (const [entityType, status] of allCombinations) {
      const actions = computeAvailableActions(entityType, status);
      if (actions) {
        for (const action of actions) {
          expect(action.requiresConfirmation).toBe(true);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Panel utils: buildMutationUrl and buildEditPayload
// ═══════════════════════════════════════════════════════════════════════════

describe("buildMutationUrl", () => {
  it("builds update URL when no action specified", () => {
    const url = buildMutationUrl("ProductRequirement", "abc-123");
    expect(url).toBe("/api/product-requirements/abc-123/update");
  });

  it("builds approve URL", () => {
    const url = buildMutationUrl("ProductRequirement", "abc-123", "approve");
    expect(url).toBe("/api/product-requirements/abc-123/approve");
  });

  it("builds cancel URL", () => {
    const url = buildMutationUrl("SubRequirement", "sr-456", "cancel");
    expect(url).toBe("/api/sub-requirements/sr-456/cancel");
  });

  it("builds reactivate URL", () => {
    const url = buildMutationUrl("TestProcedure", "tp-789", "reactivate");
    expect(url).toBe("/api/test-procedures/tp-789/reactivate");
  });

  it("builds skip URL for test case", () => {
    const url = buildMutationUrl("TestCase", "tc-001", "skip");
    expect(url).toBe("/api/test-cases/tc-001/skip");
  });

  it("builds correct-result URL for test case", () => {
    const url = buildMutationUrl("TestCase", "tc-001", "correct");
    expect(url).toBe("/api/test-cases/tc-001/correct-result");
  });

  it("handles re-execute action path correctly", () => {
    const url = buildMutationUrl("TestCase", "tc-002", "re-execute");
    expect(url).toBe("/api/test-cases/tc-002/re-execute");
  });

  it("builds URL for TestProcedureVersion", () => {
    const url = buildMutationUrl("TestProcedureVersion", "tpv-001", "approve");
    expect(url).toBe("/api/test-procedure-versions/tpv-001/approve");
  });

  it("throws for unknown entity type", () => {
    expect(() => buildMutationUrl("UnknownEntity", "x-1")).toThrow(
      "Unknown entity type: UnknownEntity",
    );
  });

  it("throws for unknown lifecycle action", () => {
    expect(() => buildMutationUrl("ProductRequirement", "abc-123", "delete")).toThrow(
      "Unknown lifecycle action: delete",
    );
  });

  it("maps all five entity types correctly", () => {
    const expected: Record<string, string> = {
      ProductRequirement: "/api/product-requirements",
      SubRequirement: "/api/sub-requirements",
      TestProcedure: "/api/test-procedures",
      TestProcedureVersion: "/api/test-procedure-versions",
      TestCase: "/api/test-cases",
    };

    for (const [entityType, basePath] of Object.entries(expected)) {
      const url = buildMutationUrl(entityType, "test-id");
      expect(url).toBe(`${basePath}/test-id/update`);
    }
  });
});

describe("buildEditPayload", () => {
  it("extracts key-value pairs from editableFields", () => {
    const fields = [
      { key: "title", label: "Title", value: "Updated Title", fieldType: "text" as const },
      { key: "description", label: "Description", value: "New desc", fieldType: "textarea" as const },
    ];
    const payload = buildEditPayload(fields);
    expect(payload).toEqual({
      title: "Updated Title",
      description: "New desc",
    });
  });

  it("returns empty object for empty array", () => {
    const payload = buildEditPayload([]);
    expect(payload).toEqual({});
  });

  it("handles single field", () => {
    const fields = [
      { key: "title", label: "Title", value: "Solo", fieldType: "text" as const },
    ];
    const payload = buildEditPayload(fields);
    expect(payload).toEqual({ title: "Solo" });
  });

  it("preserves empty string values", () => {
    const fields = [
      { key: "description", label: "Description", value: "", fieldType: "textarea" as const },
    ];
    const payload = buildEditPayload(fields);
    expect(payload).toEqual({ description: "" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. AuditSource type
// ═══════════════════════════════════════════════════════════════════════════

describe("AuditSource - request context", () => {
  // Testing getRequestContext requires a mock Request with proper headers.
  // The function depends on getUserById from demo-users.ts, which has
  // hardcoded users. We test the X-Audit-Source header parsing.

  function makeRequest(headers: Record<string, string>): Request {
    return new Request("http://localhost/api/test", { headers });
  }

  const validHeaders = {
    "x-demo-user-id": DEMO_USERS[0].id,
    "x-request-id": "req-123",
    "x-session-id": "test-session-123",
  };

  it("defaults source to 'api' when no X-Audit-Source header", () => {
    const ctx = getRequestContext(makeRequest(validHeaders));
    expect(ctx.source).toBe("api");
  });

  it("reads X-Audit-Source: panel", () => {
    const ctx = getRequestContext(
      makeRequest({ ...validHeaders, "x-audit-source": "panel" }),
    );
    expect(ctx.source).toBe("panel");
  });

  it("reads X-Audit-Source: chat", () => {
    const ctx = getRequestContext(
      makeRequest({ ...validHeaders, "x-audit-source": "chat" }),
    );
    expect(ctx.source).toBe("chat");
  });

  it("ignores invalid X-Audit-Source values (defaults to api)", () => {
    const ctx = getRequestContext(
      makeRequest({ ...validHeaders, "x-audit-source": "unknown" }),
    );
    expect(ctx.source).toBe("api");
  });
});
