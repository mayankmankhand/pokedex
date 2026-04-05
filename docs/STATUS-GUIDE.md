# Status Guide

How statuses and lifecycle transitions work in the PLM system, and *why* each rule exists.

## Requirements (Product Requirements & Sub-Requirements)

| Status | Meaning | What you can do | Rationale |
|--------|---------|-----------------|-----------|
| **DRAFT** | Work in progress, not yet finalized | Edit freely, then approve when ready | Allows iteration before committing to a baseline |
| **APPROVED** | Finalized, structurally locked | Edit title and description (for typo fixes). Create sub-requirements or test procedures against it. Cancel if no longer needed | Locks the baseline so downstream work builds on a stable foundation. Title/description edits are allowed because they don't affect downstream structure |
| **CANCELED** | No longer relevant | Nothing - this is a terminal state | Preserves history instead of deleting, so audit trail stays intact |

**Flow:** DRAFT -> APPROVED -> CANCELED (DRAFT can also be canceled directly)

**Rules:**

| Rule | Rationale |
|------|-----------|
| Sub-requirements can only be approved when their parent product requirement is already approved | Prevents finalizing child work against a requirement that might still change |
| Approved requirements allow title and description edits only (no structural changes) | Fixes typos without breaking downstream dependencies. All edits are logged in the audit trail |
| Canceling is permanent and cannot be undone | Prevents flip-flopping that would confuse downstream status tracking |
| DRAFT requirements can be canceled only if they have no children | Prevents orphaning sub-requirements. Clean up children first, then cancel |
| Canceling an APPROVED requirement cascades to all children | Children lose their purpose when the parent is retired |

## Test Procedures

Test procedures use **two-entity versioning**: a logical procedure (the container) and immutable version snapshots (the content).

### Procedure (container)

| Status | Meaning | Rationale |
|--------|---------|-----------|
| **ACTIVE** | The procedure is in use | Default state - the procedure exists and can hold versions. Title can be edited |
| **CANCELED** | The procedure is retired | Soft-retirement preserves history while signaling the procedure should not be used |

### Procedure Version (content snapshot)

| Status | Meaning | What you can do | Rationale |
|--------|---------|-----------------|-----------|
| **DRAFT** | Version is being written | Edit description and steps, then approve when ready | Allows iteration on test steps before they become the official procedure |
| **APPROVED** | Version is locked and ready for testing | Create test cases against it. Description can be edited for typo fixes, but steps are locked | Ensures test cases execute against a fixed set of steps - no moving target. Description edits are safe because they don't change what testers execute |

**Flow:** DRAFT -> APPROVED (per version)

**Rules:**

| Rule | Rationale |
|------|-----------|
| Only one draft version is allowed per procedure at a time | Prevents confusion about which draft is "current" and avoids merge conflicts between parallel edits |
| Approving a version locks the steps permanently - description can still be edited for typo fixes. To change steps, create a new version | Guarantees test results can always be traced back to the exact steps that were executed |
| You cannot create versions on a canceled procedure | A retired procedure should not accumulate new work - create a new procedure instead |

## Test Cases

| Status | Meaning | What you can do | Rationale |
|--------|---------|-----------------|-----------|
| **PENDING** | Waiting to be executed | Edit title and description. Record a result (PASS, FAIL, BLOCKED, or SKIPPED) or skip it | Default state for newly created test cases. Editable until a result is recorded |
| **PASSED** | Test executed successfully | Correct result, update notes | Records a positive result against the procedure version. Not fully terminal - result can be corrected if recorded wrong, and notes can be updated |
| **FAILED** | Test found a defect | Correct result, re-execute, update notes | Flags the defect for follow-up. Can be corrected if the wrong result was recorded, or re-executed (reset to PENDING) after a fix |
| **BLOCKED** | Cannot execute due to external dependency | Record a result when unblocked, correct result, re-execute, update notes | Distinguishes "can't test yet" from "chose not to test" (SKIPPED). Can also be corrected or re-executed |
| **SKIPPED** | Intentionally not executed | Cannot record results, but attachments can still be added | Permanent opt-out so skipped tests don't show up as incomplete work |

**Rules:**

| Rule | Rationale |
|------|-----------|
| Test cases can only be created against approved procedure versions | Prevents running tests against steps that might still change |
| Recording a result (PASS/FAIL/BLOCKED) changes the status automatically | Keeps status in sync with the actual outcome - no manual status management needed |
| Recording a SKIPPED result returns the test case to PENDING | Temporary deferment ("not right now") vs. the permanent `skipTestCase` action ("never running this") |
| Results can only be recorded when the parent procedure version is APPROVED | Same reason as creation - results must trace back to a locked set of steps |
| Skipping a test case is permanent | Prevents gaming metrics by skipping failures and then un-skipping later |
| You cannot record results on a skipped test case | Once a test is opted out, its status should not change - create a new test case if needed |
| BLOCKED is re-executable (not terminal) | A blocked test should eventually be run once the blocker is resolved |
| Results on PASSED, FAILED, and BLOCKED test cases can be corrected | Mistakes happen - recording the wrong result should not require creating a new test case |
| FAILED and BLOCKED test cases can be re-executed (reset to PENDING) | After fixing a defect or resolving a blocker, re-running the same test case keeps history cleaner than creating a new one |
| Notes on executed test cases can be updated without changing the result | Allows adding context (e.g., linking a bug ticket) after execution without disrupting the recorded outcome |

### Recovery Operations

PASSED, FAILED, and BLOCKED test cases are not fully terminal. Three recovery operations are available:

| Operation | Applies to | What it does | Requires confirmation |
|-----------|-----------|-------------|----------------------|
| **Correct result** | PASSED, FAILED, BLOCKED | Changes the recorded result to a different one (e.g., FAIL to PASS). All pairwise transitions are allowed. Keeps execution data intact. | Yes |
| **Re-execute** | FAILED, BLOCKED | Resets the test case to PENDING, clearing all execution data (result, executor, notes). Used after a fix or when a blocker is resolved. | Yes |
| **Update notes** | PASSED, FAILED, BLOCKED | Adds or edits notes on an executed test case without changing the result. | No |

**Why not PASSED for re-execute?** A passing test does not need re-execution. If the result was wrong, use "correct result" instead.

**Why not SKIPPED?** SKIPPED is a permanent opt-out. Recovery operations do not apply. If you need to run a skipped test, create a new test case.

### Result vs Status Mapping

The user provides a **result** (the input), and the system derives the **status** (the stored state) automatically:

| Result (input) | Status (derived) | Notes |
|----------------|-----------------|-------|
| PASS | PASSED | Successful execution |
| FAIL | FAILED | Defect found |
| BLOCKED | BLOCKED | External dependency prevents execution |
| SKIPPED | PENDING | Temporary deferment only (via recordTestResult). The permanent skip is a separate action (skipTestCase) that sets status to SKIPPED |

## Attachments

Attachments are files linked to any entity. They use **soft-delete** instead of hard-delete.

| Status | Meaning | What you can do | Rationale |
|--------|---------|-----------------|-----------|
| **ACTIVE** | File is visible and linked | Remove it (soft-delete) | Default state for attached files |
| **REMOVED** | Soft-deleted, hidden from all queries | Nothing - the record is preserved but invisible | Keeps the audit trail intact while hiding the file from normal views |

**Rules:**

| Rule | Rationale |
|------|-----------|
| Each attachment must have exactly one parent (product requirement, sub-requirement, test procedure, or test case) | The exclusive arc pattern prevents orphaned files and ambiguous ownership |
| You cannot attach files to a CANCELED entity (product requirement, sub-requirement, or test procedure) | Adding files to retired entities creates confusing audit records and suggests work is still happening |
| Removing an attachment sets its status to REMOVED instead of deleting the row | Preserves the audit trail - you can always see what was attached and when it was removed |
| All queries automatically filter out REMOVED attachments | Keeps the UI clean without requiring every caller to remember the filter |

## Cascade Rules

When a parent entity is canceled, its children are automatically canceled or skipped down the chain. This prevents orphaned work from appearing active when its parent is no longer relevant.

| When this happens | Children affected | Child status becomes | Rationale |
|-------------------|-------------------|---------------------|-----------|
| Product Requirement is canceled | All its Sub-Requirements | CANCELED | Sub-requirements lose their purpose when the parent requirement is retired |
| Sub-Requirement is canceled | All its Test Procedures | CANCELED | Test procedures can't validate a canceled requirement |
| Test Procedure is canceled | All its Test Cases | SKIPPED | Test cases can't be executed against a retired procedure - SKIPPED (not CANCELED) because test cases don't have a CANCELED status |

**How cascades work:**
- Cascades skip children that are already in the target terminal state (no duplicate operations)
- Cascade cancellation bypasses the normal status guards - for example, a DRAFT sub-requirement can be cascade-canceled even though direct DRAFT cancellation would normally be blocked if it has children. This is because the parent's cancellation makes the child's current status irrelevant.
- Direct DRAFT cancellation (not cascade) does NOT cascade - it is blocked if the entity has children. This forces the user to clean up intentionally.
- Cascades run inside the same database transaction as the parent's status change, so either everything succeeds or nothing does

## Database Safety Nets

The service layer enforces lifecycle rules, but the database provides a second line of defense for the most critical constraints.

| Constraint | What it prevents | How it works |
|------------|-----------------|--------------|
| **Single-draft unique index** | Two DRAFT versions existing on the same procedure | A partial unique index on `test_procedure_versions(test_procedure_id) WHERE status = 'DRAFT'` - the database rejects any insert that would create a second draft |
| **Exclusive arc CHECK constraint** | An attachment having zero or multiple parents | A CHECK constraint counts non-null parent FK columns and requires exactly one - the database rejects any insert or update that violates this |
| **Foreign key RESTRICT** | Deleting an entity that has children pointing to it | Most FK relationships use `ON DELETE RESTRICT`, which blocks the delete at the database level |

## Confirmation Pattern

Destructive or hard-to-reverse actions require explicit user confirmation before execution. This applies to both the API (via Zod validation) and the AI chat assistant (via prompt engineering).

**Actions that require confirmation:** approve, cancel, skip, remove attachment, correct result, re-execute

**How it works:**
1. The user requests an action (e.g., "cancel this requirement")
2. The system explains what will happen, including any cascade effects
3. The user explicitly confirms (e.g., "yes", "go ahead")
4. Only then is the action executed with the confirmation flag set to `true`

**Why:** These actions are either irreversible (cancel, skip) or lock content permanently (approve). The confirmation step prevents accidental data loss, especially important when cascade effects would cancel multiple child entities.

## Audit Actions

Every change in the system is logged in the same database transaction as the change itself. This means audit records are never out of sync with the data they describe.

| Action | When it's logged | Which entities | Rationale |
|--------|-----------------|----------------|-----------|
| CREATE | A new entity is created | All entity types | Tracks who created what and when |
| UPDATE | An entity is edited | Requirements, Sub-Requirements, Test Procedures, Procedure Versions, Test Cases | Records what changed so edits can be reviewed (applies to both draft and approved edits) |
| APPROVE | A draft is approved (locked) | Requirements, Sub-Requirements, Procedure Versions | Marks the moment content became the official baseline |
| CANCEL | An entity is canceled (retired) | Requirements, Sub-Requirements, Test Procedures | Records the retirement decision and who made it |
| SKIP | A test case is skipped | Test Cases | Distinguishes intentional skip from incomplete work |
| CREATE_VERSION | A new version is created on a test procedure | Test Procedure Versions | Tracks the version history of a procedure |
| RECORD_RESULT | A test result (PASS/FAIL/BLOCKED) is recorded | Test Cases | Captures the outcome and who executed the test |
| CORRECT_RESULT | A previously recorded result is changed | Test Cases | Tracks what the old and new results were |
| RE_EXECUTE | A failed or blocked test case is reset to PENDING | Test Cases | Records that execution data was cleared for a re-run |
| ADD_ATTACHMENT | A file is attached to an entity | Attachments | Records file additions with metadata |
| REMOVE_ATTACHMENT | A file attachment is removed (soft-deleted) | Attachments | Records who removed the file and when |

**Source tracking:** Each audit entry records whether the action came from the API (`"api"`) or the AI chat assistant (`"chat"`), so you can distinguish human-initiated actions from AI-assisted ones.
