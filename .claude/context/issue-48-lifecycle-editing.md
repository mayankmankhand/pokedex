# No Way to Edit DRAFT or Fix Approved Typos

## Context File
Created: 2026-03-15
Status: Implementation complete, reviews in progress

---

## The Problem

Every entity in the PLM system was effectively read-only from the moment it was created:

- **DRAFT**: Documented as "edit freely" but no update operations existed for test procedures or test cases. PR/SR/TPV had DRAFT-only updates.
- **APPROVED**: Fully immutable by design. A typo in an approved requirement meant canceling the entire entity tree and recreating from scratch.
- **CANCELED**: Terminal state, nothing allowed.

The only lifecycle actions available were create, approve, and cancel. No update semantics existed beyond DRAFT.

## Discovery & Discussion

### How we found it
During a review of the STATUS-GUIDE.md, we noticed the gap between documented behavior ("DRAFT = edit freely") and actual implementation (no update path for many entities, no edit path at all for approved entities).

### Key user scenarios that were broken
1. "I made a typo in a DRAFT requirement" - no update operation for some entities
2. "I approved a requirement with a typo" - cancel and recreate entire tree
3. "Can I cancel this DRAFT?" - No, only APPROVED can be canceled
4. "Can I unapprove back to DRAFT?" - No, approval is one-way

### Design options considered

**For APPROVED editing:**
- Option A: Allow title/description edits on APPROVED (chosen - simplest, audited)
- Option B: Add "unapprove" action back to DRAFT (rejected - breaks downstream test cases)
- Option C: Accept "cancel and recreate" for V1 (rejected - unusable)

**For DRAFT cancellation:**
- Option A: Cascade cancel everything (rejected)
- Option B: Block if children exist (chosen - safer, forces intentional cleanup)

### Broader lifecycle analysis

During the discussion, we identified three buckets of lifecycle gaps:
1. **Typo fixes** (this issue) - edit DRAFT/APPROVED, cancel DRAFT
2. **Undo mistakes** - restore attachments, correct test results, un-skip, re-run failed tests
3. **Structural changes** - re-parent entities, reactivate canceled trees

## Critical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| APPROVED editing scope | Title + description only | Structural fields (team, parent) affect downstream relationships |
| APPROVED TPV steps | NOT editable | Steps are what testers execute - silently changing them could invalidate results |
| DRAFT cancel behavior | Block if children exist | Safer than cascade, forces intentional cleanup |
| Test procedure title | Editable when ACTIVE | TPs have no DRAFT state, title is just a label |
| Test case editing | PENDING only | Once executed, the description was what was tested |

## What Was Built

### New capabilities by entity

| Entity | State | What's editable | New? |
|--------|-------|----------------|------|
| Product Requirement | DRAFT | title, description | existed |
| Product Requirement | APPROVED | title, description | **new** |
| Product Requirement | DRAFT | can be canceled (no children) | **new** |
| Sub-Requirement | DRAFT | title, description | existed |
| Sub-Requirement | APPROVED | title, description | **new** |
| Sub-Requirement | DRAFT | can be canceled (no children) | **new** |
| Test Procedure | ACTIVE | title | **new** |
| Test Procedure Version | DRAFT | description, steps | existed |
| Test Procedure Version | APPROVED | description only | **new** |
| Test Case | PENDING | title, description | **new** |

### Files changed

**Service layer (status guard changes):**
- `src/services/product-requirement.service.ts` - relaxed update + cancel guards
- `src/services/sub-requirement.service.ts` - relaxed update + cancel guards
- `src/services/test-procedure.service.ts` - new updateTestProcedure, relaxed version update
- `src/services/test-case.service.ts` - new updateTestCase

**Schemas (new validation):**
- `src/schemas/test-procedure.schema.ts` - UpdateTestProcedureInput
- `src/schemas/test-case.schema.ts` - UpdateTestCaseInput

**API routes (new endpoints):**
- `src/app/api/test-procedures/[id]/update/route.ts`
- `src/app/api/test-cases/[id]/update/route.ts`

**LLM tools (new tools + updated descriptions):**
- `src/lib/ai/tools/product-requirement-tools.ts` - updated descriptions
- `src/lib/ai/tools/sub-requirement-tools.ts` - updated descriptions
- `src/lib/ai/tools/test-procedure-tools.ts` - new updateTestProcedure tool + updated descriptions
- `src/lib/ai/tools/test-case-tools.ts` - new updateTestCase tool

**System prompt + documentation:**
- `src/lib/ai/system-prompt.ts` - updated lifecycle rules
- `docs/STATUS-GUIDE.md` - revised editing rules and rationales
- `docs/USER-GUIDE.md` - added "Edit things" section with example prompts

**Tests:**
- `src/__tests__/lifecycle.test.ts` - 9 new tests (39 total, all passing)

### Test coverage

| Test | What it verifies |
|------|-----------------|
| APPROVED PR update | title + description edits succeed |
| CANCELED PR update | rejects all edits |
| DRAFT PR cancel (no children) | succeeds |
| DRAFT PR cancel (has children) | blocked with error |
| APPROVED SR update | title + description edits succeed |
| DRAFT SR cancel (no children) | succeeds |
| DRAFT SR cancel (has children) | blocked with error |
| APPROVED TPV description update | succeeds |
| APPROVED TPV steps update | rejected |
| ACTIVE TP title update | succeeds |
| CANCELED TP title update | rejected |
| PENDING TC update | title + description succeed |
| Executed TC update | rejected |

### Metrics
- Tool count: 33 (was 31, added updateTestProcedure + updateTestCase)
- Lifecycle tests: 39 (was 30, added 9)
- No database migration needed - all changes are application-layer logic
- TypeScript compiles clean

## Related Topics
- Undo mistakes (restore, correct, re-run) - priority-high improvement
- Structural changes (re-parent and reactivate) - priority-high improvement
