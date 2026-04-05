// Renders entity detail content in the context panel.
// Shows key-value fields with status badges, optional related entities, and attachments.
// Supports inline edit mode for entities with editable fields.
// Supports lifecycle action buttons (approve, cancel, reactivate, skip, re-execute)
// with inline confirmation flow, driven by availableActions metadata from the server.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Paperclip,
  Pencil,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  SkipForward,
  RefreshCw,
} from "lucide-react";
import type { DetailPayload } from "@/types/panel";
import { humanize } from "@/lib/format-utils";
import { buildMutationUrl, buildEditPayload, fetchPanelDetail } from "@/lib/panel-utils";
import { usePanelStore } from "@/stores/panel-store";
import { StatusBadge } from "./status-badge";

// Status fields are rendered as badges instead of plain text.
const STATUS_FIELD_LABELS = new Set(["status", "Status"]);

// Past-tense forms for lifecycle actions (avoids bad suffixing like "approveed").
const ACTION_PAST_TENSE: Record<string, string> = {
  approve: "approved",
  cancel: "canceled",
  reactivate: "reactivated",
  skip: "skipped",
  "re-execute": "re-executed",
};

// Maps action names to the confirm field the API route expects.
// "correct" is excluded: correct-result requires a result value (PASS/FAIL/BLOCKED)
// and optional notes, so it needs a richer form than a simple confirm button.
// Users should use the chat to correct test results.
const CONFIRM_BODIES: Record<string, Record<string, boolean>> = {
  approve: { confirmApprove: true },
  cancel: { confirmCancel: true },
  reactivate: { confirmReactivate: true },
  skip: { confirmSkip: true },
  "re-execute": { confirmReExecute: true },
};

// Icons for lifecycle action buttons
const ACTION_ICONS: Record<string, React.ReactNode> = {
  approve: <CheckCircle2 size={14} />,
  cancel: <XCircle size={14} />,
  reactivate: <RotateCcw size={14} />,
  skip: <SkipForward size={14} />,
  "re-execute": <RefreshCw size={14} />,
};

interface DetailViewProps {
  payload: DetailPayload;
  notifyChat?: (message: string) => void;
  onNavigate?: (entityType: string, entityId: string) => void;
}

export function DetailView({ payload, notifyChat, onNavigate }: DetailViewProps) {
  // -- Edit mode state --
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // -- Lifecycle action state --
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter to actions we can handle with a simple confirm (exclude "correct")
  const availableActions = (payload.availableActions ?? []).filter(
    (a) => a.action in CONFIRM_BODIES,
  );

  // Whether the user can edit this entity at all
  const canEdit = payload.editableFields && payload.editableFields.length > 0;

  // Set of field labels that are editable (for rendering decisions)
  const editableKeySet = new Set(
    (payload.editableFields ?? []).map((f) => f.label),
  );

  // Derive isDirty: true when any form value differs from original
  const isDirty = (payload.editableFields ?? []).some(
    (f) => formValues[f.key] !== f.value,
  );

  // Reset edit + action state when payload changes (e.g. after navigation or refresh)
  useEffect(() => {
    setIsEditing(false);
    setFormValues({});
    setSaveError(null);
    setConfirmingAction(null);
    setActionLoading(null);
    setActionError(null);
  }, [payload.entityId]);

  // Enter edit mode: initialize form values from editableFields
  const enterEditMode = useCallback(() => {
    if (!payload.editableFields) return;
    const initial: Record<string, string> = {};
    for (const field of payload.editableFields) {
      initial[field.key] = field.value;
    }
    setFormValues(initial);
    setSaveError(null);
    setIsEditing(true);
  }, [payload.editableFields]);

  // Exit edit mode and discard changes
  const exitEditMode = useCallback(() => {
    setIsEditing(false);
    setFormValues({});
    setSaveError(null);
  }, []);

  // Autofocus first input when entering edit mode
  useEffect(() => {
    if (isEditing && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [isEditing]);

  // ESC key exits edit mode (with confirm if dirty, stops propagation so panel does not close)
  useEffect(() => {
    if (!isEditing) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (isDirty) {
          const discard = window.confirm("Discard unsaved changes?");
          if (!discard) return;
        }
        exitEditMode();
      }
    }

    // Use capture phase so we intercept before the panel's global ESC handler
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isEditing, isDirty, exitEditMode]);

  // Update a single form field value
  function updateField(key: string, value: string) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  // Save changes to the server
  async function handleSave() {
    if (!payload.editableFields) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const url = buildMutationUrl(payload.entityType, payload.entityId);

      // Build payload from only changed fields
      const changedFields = payload.editableFields
        .filter((f) => formValues[f.key] !== f.value)
        .map((f) => ({ ...f, value: formValues[f.key] }));

      if (changedFields.length === 0) {
        exitEditMode();
        return;
      }

      const body = buildEditPayload(changedFields);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Audit-Source": "panel",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Update failed (${res.status})`);
      }

      // Refetch canonical detail from server
      const freshDetail = await fetchPanelDetail(
        payload.entityType,
        payload.entityId,
      );

      // Replace panel content without pushing history
      usePanelStore.getState().replaceContent(freshDetail);

      // Exit edit mode
      setIsEditing(false);

      // Notify chat about the update
      notifyChat?.(`${payload.title} was updated via panel`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setIsSaving(false);
    }
  }

  // -- Lifecycle action execution --
  async function executeAction(action: string) {
    setActionLoading(action);
    setActionError(null);

    try {
      const url = buildMutationUrl(payload.entityType, payload.entityId, action);
      const body = CONFIRM_BODIES[action];

      if (!body) {
        throw new Error(`No confirm body for action: ${action}`);
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Audit-Source": "panel",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Action failed (${res.status})`);
      }

      // Refetch fresh detail to reflect new state
      const freshDetail = await fetchPanelDetail(
        payload.entityType,
        payload.entityId,
      );
      usePanelStore.getState().replaceContent(freshDetail);

      // Exit edit mode if active (entity state changed)
      if (isEditing) {
        setIsEditing(false);
        setFormValues({});
      }

      // Notify chat about the lifecycle change
      const pastTense = ACTION_PAST_TENSE[action] ?? `${action}d`;
      notifyChat?.(`${payload.title} was ${pastTense} via panel`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(null);
      setConfirmingAction(null);
    }
  }

  // -- Render helpers --

  // Find the editable field definition for a given display label
  function getEditableField(label: string) {
    return (payload.editableFields ?? []).find((f) => f.label === label);
  }

  // Render a field value - either as an input (edit mode) or read-only text
  function renderFieldValue(
    label: string,
    value: string,
    isFirst: boolean,
  ) {
    const editField = getEditableField(label);

    // In edit mode, render editable fields as form inputs
    if (isEditing && editField) {
      const currentValue = formValues[editField.key] ?? editField.value;

      if (editField.fieldType === "textarea") {
        return (
          <textarea
            ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
            value={currentValue}
            onChange={(e) => updateField(editField.key, e.target.value)}
            rows={4}
            className="mt-1 bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm w-full
                       focus:ring-2 focus:ring-primary focus:border-primary outline-none
                       resize-y"
          />
        );
      }

      return (
        <input
          ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
          type="text"
          value={currentValue}
          onChange={(e) => updateField(editField.key, e.target.value)}
          className="mt-1 bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm w-full
                     focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
      );
    }

    // Read-only rendering
    if (STATUS_FIELD_LABELS.has(label)) {
      return <StatusBadge status={value} />;
    }
    return value;
  }

  // Track whether we have rendered the first editable field (for autofocus)
  const firstEditableRef = useRef(false);

  function isFirstEditable(label: string): boolean {
    if (firstEditableRef.current) return false;
    if (editableKeySet.has(label)) {
      firstEditableRef.current = true;
      return true;
    }
    return false;
  }

  return (
    <div className="space-y-4">
      {/* Entity type label + edit button */}
      <div className="flex items-center gap-2">
        <span className="inline-block text-xs font-medium bg-primary-subtle text-primary px-2 py-0.5 rounded-full">
          {humanize(payload.entityType)}
        </span>

        {/* Edit button - shown only when entity has editable fields */}
        {canEdit && !isEditing && (
          <button
            onClick={enterEditMode}
            aria-label="Edit entity"
            title="Edit"
            className="p-1 rounded-md text-text-muted hover:text-primary hover:bg-primary-subtle
                       transition-colors duration-150
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Pencil size={14} />
          </button>
        )}

        {isEditing && (
          <span className="text-xs font-medium text-primary">Editing...</span>
        )}
      </div>

      {/* Lifecycle action buttons - rendered from availableActions metadata */}
      {availableActions.length > 0 && (
        <div className="space-y-2">
          {confirmingAction ? (
            // Inline confirmation prompt
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-text-muted">
                Are you sure you want to{" "}
                {availableActions.find((a) => a.action === confirmingAction)?.label?.toLowerCase() ?? confirmingAction}?
              </span>
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => executeAction(confirmingAction)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium
                           transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                           ${
                             availableActions.find((a) => a.action === confirmingAction)?.variant === "destructive"
                               ? "border border-danger/30 text-danger hover:bg-danger/10"
                               : "border border-border text-text hover:bg-surface-hover"
                           }`}
              >
                {actionLoading === confirmingAction && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Confirm
              </button>
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => setConfirmingAction(null)}
                className="text-sm text-text-muted hover:text-text transition-colors duration-150
                           disabled:opacity-50 disabled:cursor-not-allowed
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Cancel
              </button>
            </div>
          ) : (
            // Normal action button row
            <div className="flex items-center gap-2 flex-wrap">
              {availableActions.map((actionMeta) => (
                <button
                  key={actionMeta.action}
                  type="button"
                  disabled={(isEditing && isDirty) || !!actionLoading}
                  title={isEditing && isDirty ? "Save or discard edits first" : actionMeta.label}
                  onClick={() => {
                    setActionError(null);
                    if (actionMeta.requiresConfirmation) {
                      setConfirmingAction(actionMeta.action);
                    } else {
                      executeAction(actionMeta.action);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium
                             transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                             ${
                               actionMeta.variant === "destructive"
                                 ? "border border-danger/30 text-danger hover:bg-danger/10"
                                 : "border border-border text-text hover:bg-surface-hover"
                             }`}
                >
                  {actionLoading === actionMeta.action ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    ACTION_ICONS[actionMeta.action]
                  )}
                  {actionMeta.label}
                </button>
              ))}
            </div>
          )}

          {/* Action error message */}
          {actionError && (
            <p className="text-sm text-danger">{actionError}</p>
          )}
        </div>
      )}

      {/* Wrap fields in a form when editing so ESC/Enter work naturally */}
      {isEditing ? (
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          {renderFields()}

          {/* Save error message */}
          {saveError && (
            <p className="text-sm text-danger mt-3">{saveError}</p>
          )}

          {/* Save / Cancel buttons */}
          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border-subtle">
            <button
              type="submit"
              disabled={!isDirty || isSaving}
              className="inline-flex items-center gap-1.5 bg-primary text-white hover:bg-primary/90
                         rounded-lg px-4 py-2 text-sm font-medium
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-150
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={exitEditMode}
              disabled={isSaving}
              className="text-sm text-text-muted hover:text-text
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-150
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        renderFields()
      )}

      {/* Related entities - Dex Entry card with item count */}
      {payload.relatedEntities && payload.relatedEntities.length > 0 && (
        <div className="dex-card">
          <div className="dex-card-header">
            <span className="dex-card-header-title">Related</span>
            <span className="text-[11px] text-text-subtle">
              {payload.relatedEntities.length} {payload.relatedEntities.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="dex-card-body">
            <div className="flex flex-wrap gap-2">
              {payload.relatedEntities.map((entity) =>
                onNavigate ? (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => onNavigate(entity.entityType, entity.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onNavigate(entity.entityType, entity.id);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface text-sm text-text
                               cursor-pointer hover:bg-surface-hover transition-colors duration-150
                               border border-border-subtle
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="truncate max-w-[180px]" title={entity.title}>{entity.title}</span>
                    <span className="text-xs text-text-muted">
                      {humanize(entity.entityType)}
                    </span>
                    {entity.status && <StatusBadge status={entity.status} />}
                  </button>
                ) : (
                  <span
                    key={entity.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface text-sm text-text
                               border border-border-subtle"
                  >
                    <span className="truncate max-w-[180px]" title={entity.title}>{entity.title}</span>
                    <span className="text-xs text-text-muted">
                      {humanize(entity.entityType)}
                    </span>
                    {entity.status && <StatusBadge status={entity.status} />}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attachments - Dex Entry card with file count */}
      {payload.attachments && payload.attachments.length > 0 && (
        <div className="dex-card">
          <div className="dex-card-header">
            <span className="dex-card-header-title">Attachments</span>
            <span className="text-[11px] text-text-subtle">
              {payload.attachments.length} {payload.attachments.length === 1 ? "file" : "files"}
            </span>
          </div>
          <div className="dex-card-body">
            <div className="space-y-1.5">
              {payload.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface text-sm"
                >
                  <Paperclip className="h-3.5 w-3.5 text-text-muted shrink-0" />
                  <span className="truncate text-text" title={att.fileName}>
                    {att.fileName}
                  </span>
                  <span className="shrink-0 text-xs text-text-muted uppercase">
                    {att.fileType}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-text-muted">
                    {att.uploadedBy} - {att.createdAt}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // -- Field rendering (shared between read-only and edit modes) --

  function renderFields() {
    // Reset the first-editable tracker each time we render fields
    firstEditableRef.current = false;

    const shortFields = payload.fields.filter((f) => {
      // In edit mode, editable fields always render full-width for usability
      if (isEditing && editableKeySet.has(f.label)) return false;
      return f.value.length < 40;
    });

    const longFields = payload.fields.filter((f) => {
      if (isEditing && editableKeySet.has(f.label)) return true;
      return f.value.length >= 40;
    });

    return (
      <>
        {/* Properties card - short fields in a two-column grid */}
        {shortFields.length > 0 && (
          <div className="dex-card">
            <div className="dex-card-header">
              <span className="dex-card-header-title">Properties</span>
            </div>
            <div className="dex-card-body">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                {shortFields.map((field) => (
                  <div key={field.label}>
                    <dt className="text-xs font-medium text-text-muted uppercase tracking-wide">
                      {field.label}
                    </dt>
                    <dd className="mt-0.5 text-sm text-text">
                      {renderFieldValue(field.label, field.value, isFirstEditable(field.label))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}

        {/* Description card - long fields stacked vertically */}
        {longFields.length > 0 && (
          <div className="dex-card">
            <div className="dex-card-header">
              <span className="dex-card-header-title">Description</span>
            </div>
            <div className="dex-card-body">
              <dl className="space-y-3">
                {longFields.map((field) => (
                  <div key={field.label} className="border-b border-border-subtle pb-3 last:border-b-0 last:pb-0">
                    <dt className="text-xs font-medium text-text-muted uppercase tracking-wide">
                      {field.label}
                    </dt>
                    <dd className="mt-1 text-sm text-text whitespace-pre-wrap">
                      {renderFieldValue(field.label, field.value, isFirstEditable(field.label))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </>
    );
  }
}
