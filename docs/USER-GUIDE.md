# PLM User Guide

PLM is a chat-driven tool for managing product requirements, test procedures, and test results. Ask questions in plain English and the assistant handles the rest.

---

## Quick Start

- Open the app in your browser.
- Pick a user from the dropdown in the top bar (any of the 7 demo users).
- Type a question or command in the chat input at the bottom.
- Results appear in the chat and in the context panel on the right.

---

## What's in the System

PLM tracks five core entity types, organized in a hierarchy. Attachments (PDFs, images, spreadsheets) can be linked to any entity but are not part of the traceability chain.

| Entity | What it is | Example |
|--------|-----------|---------|
| **Product Requirement (PR)** | Org-level feature goal | "Pokemon Scanner Module" |
| **Sub-Requirement (SR)** | Team-scoped breakdown of a PR | "Scanner accuracy within +/-5% species match confidence" |
| **Test Procedure (TP)** | Logical container for a test, linked to a SR | "Pokemon Scanner Accuracy Test" |
| **Test Procedure Version (TPV)** | Immutable snapshot of a procedure. Only one draft allowed at a time. Once approved, locked forever. | "v1 - approved", "v2 - draft" |
| **Test Case (TC)** | Individual test execution linked to a TPV. Records a result. | "Species ID accuracy test - PASSED" |

```
Product Requirement
└── Sub-Requirement (team-scoped)
    └── Test Procedure
        └── Test Procedure Version (immutable once approved)
            └── Test Case (pass/fail/blocked/skipped)
```

---

## What You Can Ask the Assistant

### Create things

- "Create a new product requirement called Power System"
- "Add a sub-requirement for the Product team under Pokemon Scanner Module"
- "Create a test procedure for Wireless Communication Module"

### Edit things

- "Change the title of Pokemon Scanner Module to Advanced Pokemon Scanner Module"
- "Update the description of Habitat Map Display sub-requirement"
- "Fix the typo in the Battery Discharge Cycle Test procedure name"
- "Update the description of test case Species ID accuracy"

Editing works in most states. Draft entities allow full edits. Approved requirements and procedure versions allow title and description changes (for typo fixes). Pending test cases allow title and description edits. All edits are logged in the audit trail.

### Look things up

- "Show me the details for Pokemon Scanner Module"
- "What test procedures exist for the Hardware team?"
- "List all product requirements"

### Find gaps

- "Which sub-requirements have no test procedures?"
- "Show me untested procedures"
- "What requirements are still in draft?"

### Visualize

- "Draw a traceability diagram for Pokemon Scanner Module"
- "Show me the status lifecycle for test cases"

### Track changes

- "Show the audit log for Pokemon Scanner Module"
- "What changes happened today?"
- "Who approved Wireless Communication Module?"

### Manage lifecycle

- "Approve product requirement Power System"
- "Record a PASS result for Species ID accuracy test"
- "Cancel sub-requirement Habitat Map Display"

### Analyze coverage

- "Show test result summary"
- "What's the coverage by team?"
- "Show test cases for requirement Audio System"

---

## The Context Panel

The panel on the right side of the screen displays structured data that the assistant generates. It shows four types of content:

- **Detail views** - A single entity with all its fields and related items.
- **Data tables** - Lists, gap analysis, and coverage reports. Tables show up to 15 rows, with a truncation indicator if there are more results.
- **Mermaid diagrams** - Traceability trees and status flows. Use the zoom controls (+, -, Fit) to navigate large diagrams.
- **Audit logs** - Change history with before/after values for each field.

### Panel controls

- Drag the left edge to resize (540px default, 360-800px range).
- **Cmd+K** - Focus the chat input.
- **Cmd+\\** - Toggle the panel open/closed.
- **Escape** - Close the panel.

---

## Demo Users

Pick any user from the dropdown. All demo users have the "engineer" role. Your choice determines who appears as the creator or actor in audit logs and entity records.

| Name | Team |
|------|------|
| Ash Ketchum | Product |
| Misty Waterflower | Field Testing |
| Brock Harrison | Hardware |
| Gary Oak | Design |
| Professor Oak | Firmware |
| Jessie Rocket | Team Rocket QA |
| James Rocket | Team Rocket QA |

---

## Status Workflows

Each entity type follows a specific lifecycle:

- **Product Requirements and Sub-Requirements**: Draft -> Approved -> Canceled. Draft items can also be canceled directly (if they have no children).
- **Test Procedures**: Active -> Canceled
- **Test Procedure Versions**: Draft -> Approved (locked permanently). To revise an approved version, create a new draft version.
- **Test Cases**: Pending -> Passed / Failed / Blocked / Skipped. Skipped is permanent and cannot be undone.

**Key rules:**
- A sub-requirement can only be approved if its parent product requirement is already approved.
- Only one draft version per test procedure is allowed at a time.

See [STATUS-GUIDE.md](STATUS-GUIDE.md) for the full status reference, including all allowed transitions and restrictions.

---

## Seed Data

The app comes pre-loaded with a Pokedex hardware PLM dataset so you can start exploring immediately:

- 10 product requirements
- 21 sub-requirements
- 18 test procedures
- 19 test procedure versions
- 20 test cases
- 6 attachments
- 155 audit log entries

The data covers 6 teams (7 users) and includes entities in various lifecycle states (including multiple procedure versions), so you can see how approvals, test results, and traceability work without creating anything first.
