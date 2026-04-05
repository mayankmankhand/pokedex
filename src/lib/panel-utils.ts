// Panel utility functions: entity-to-API-path mapping and form-to-API adapters.
// Used by panel components to call existing REST mutation routes.

import type { DetailPayload } from "@/types/panel";

// ---------------------------------------------------------------------------
// Entity type -> base API path mapping
// ---------------------------------------------------------------------------

const ENTITY_API_PATHS: Record<string, string> = {
  ProductRequirement: "/api/product-requirements",
  SubRequirement: "/api/sub-requirements",
  TestProcedure: "/api/test-procedures",
  TestProcedureVersion: "/api/test-procedure-versions",
  TestCase: "/api/test-cases",
};

// ---------------------------------------------------------------------------
// Lifecycle action -> route suffix mapping
// ---------------------------------------------------------------------------

const LIFECYCLE_ACTION_PATHS: Record<string, string> = {
  approve: "/approve",
  cancel: "/cancel",
  reactivate: "/reactivate",
  skip: "/skip",
  correct: "/correct-result",
  "re-execute": "/re-execute",
};

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

/**
 * Build the full mutation URL for an entity action.
 * If no action is provided, defaults to "/update".
 *
 * Examples:
 *   buildMutationUrl("ProductRequirement", "abc-123", "approve")
 *     -> "/api/product-requirements/abc-123/approve"
 *   buildMutationUrl("ProductRequirement", "abc-123")
 *     -> "/api/product-requirements/abc-123/update"
 */
export function buildMutationUrl(
  entityType: string,
  entityId: string,
  action?: string,
): string {
  const basePath = ENTITY_API_PATHS[entityType];
  if (!basePath) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const suffix = action
    ? LIFECYCLE_ACTION_PATHS[action]
    : "/update";

  if (action && !suffix) {
    throw new Error(`Unknown lifecycle action: ${action}`);
  }

  return `${basePath}/${entityId}${suffix}`;
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

/**
 * Translate generic editableFields into the JSON body the update endpoint expects.
 * Extracts key-value pairs from the fields array.
 * Dirty detection (only sending changed fields) is left to the caller.
 */
export function buildEditPayload(
  editableFields: NonNullable<DetailPayload["editableFields"]>,
): Record<string, string> {
  const body: Record<string, string> = {};
  for (const field of editableFields) {
    body[field.key] = field.value;
  }
  return body;
}

// ---------------------------------------------------------------------------
// Panel data fetching
// ---------------------------------------------------------------------------

/**
 * Fetch a fresh DetailPayload from the panel read API.
 * The Edge Middleware automatically attaches auth headers,
 * so no manual header wiring needed for same-origin fetches.
 */
export async function fetchPanelDetail(
  entityType: string,
  entityId: string,
): Promise<DetailPayload> {
  const res = await fetch(`/api/panel/entity/${entityType}/${entityId}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to fetch ${entityType} ${entityId}`);
  }

  return res.json();
}
