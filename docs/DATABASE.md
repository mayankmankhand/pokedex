# Pokedex PLM Database Structure & Seed Data

## Entity Relationship

```
Team
 └── User (many)
 └── SubRequirement (many)

ProductRequirement
 └── SubRequirement (many)
      └── TestProcedure (many)
           └── TestProcedureVersion (many)
                └── TestCase (many)

Attachment (Exclusive Arc - exactly one parent FK is non-null)
 ├── ProductRequirement?
 ├── SubRequirement?
 ├── TestProcedure?
 └── TestCase?

AuditLog
 └── User (actor)
```

---

## Enums

| Enum | Values |
|------|--------|
| RequirementStatus | `DRAFT`, `APPROVED`, `CANCELED` |
| ProcedureStatus | `ACTIVE`, `CANCELED` |
| ProcedureVersionStatus | `DRAFT`, `APPROVED` |
| TestCaseStatus | `PENDING`, `PASSED`, `FAILED`, `BLOCKED`, `SKIPPED` |
| TestCaseResult | `PASS`, `FAIL`, `BLOCKED`, `SKIPPED` |
| AuditAction | `CREATE`, `UPDATE`, `APPROVE`, `CANCEL`, `SKIP`, `ADD_ATTACHMENT`, `REMOVE_ATTACHMENT`, `CREATE_VERSION`, `RECORD_RESULT`, `CORRECT_RESULT`, `RE_EXECUTE`, `UPDATE_NOTES`, `RE_PARENT`, `REACTIVATE` |
| AttachmentStatus | `ACTIVE`, `REMOVED` |
| AttachmentType | `DOCUMENT`, `IMAGE`, `SPREADSHEET`, `OTHER` |

---

## Models

### Team

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| name | String | Unique |
| created_at | DateTime | Auto-set |

### User

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| name | String | |
| email | String | Unique |
| role | String | e.g. "pm", "engineer", "qa_lead" |
| team_id | UUID (FK) | References Team |
| created_at | DateTime | Auto-set |

### ProductRequirement

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| title | String | |
| description | String | |
| status | RequirementStatus | Default: DRAFT |
| created_by | UUID (FK) | References User |
| created_at | DateTime | Auto-set |
| updated_at | DateTime | Auto-updated |

### SubRequirement

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| title | String | |
| description | String | |
| status | RequirementStatus | Default: DRAFT |
| product_requirement_id | UUID (FK) | References ProductRequirement |
| team_id | UUID (FK) | References Team |
| created_by | UUID (FK) | References User |
| created_at | DateTime | Auto-set |
| updated_at | DateTime | Auto-updated |

### TestProcedure

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| title | String | |
| status | ProcedureStatus | Default: ACTIVE |
| sub_requirement_id | UUID (FK) | References SubRequirement |
| created_by | UUID (FK) | References User |
| created_at | DateTime | Auto-set |
| updated_at | DateTime | Auto-updated |

### TestProcedureVersion

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| version_number | Int | |
| description | String | |
| steps | String | Plain text (newline-separated steps) |
| status | ProcedureVersionStatus | Default: DRAFT |
| test_procedure_id | UUID (FK) | References TestProcedure |
| created_by | UUID (FK) | References User |
| created_at | DateTime | Auto-set |
| updated_at | DateTime | Auto-updated |

**Unique constraint**: (test_procedure_id, version_number) - no duplicate version numbers per procedure.

**Partial unique index**: Only one DRAFT version per procedure - `WHERE status = 'DRAFT'`.

### TestCase

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| title | String | |
| description | String | |
| status | TestCaseStatus | Default: PENDING |
| result | TestCaseResult? | Nullable - set when executed |
| notes | String? | Optional execution notes |
| test_procedure_version_id | UUID (FK) | References TestProcedureVersion |
| executed_by | UUID? (FK) | References User (nullable) |
| executed_at | DateTime? | When the test was run |
| created_by | UUID (FK) | References User |
| created_at | DateTime | Auto-set |
| updated_at | DateTime | Auto-updated |

### Attachment (Exclusive Arc)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| file_name | String | |
| file_url | String | |
| file_type | AttachmentType | |
| file_size_bytes | Int? | Optional |
| status | AttachmentStatus | Default: ACTIVE. Soft-delete sets to REMOVED. |
| product_requirement_id | UUID? (FK) | Exactly one of these four FKs is non-null |
| sub_requirement_id | UUID? (FK) | (enforced by DB CHECK constraint) |
| test_procedure_id | UUID? (FK) | |
| test_case_id | UUID? (FK) | |
| uploaded_by | UUID (FK) | References User |
| created_at | DateTime | Auto-set |

**CHECK constraint**: Exactly one parent FK must be non-null (exclusive arc enforced at DB level).

**Soft-delete**: `removeAttachment()` sets `status: REMOVED` instead of deleting the row. All queries filter by `status: ACTIVE`.

### AuditLog

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| actor_id | UUID (FK) | References User |
| action | AuditAction | |
| entity_type | String | e.g. "ProductRequirement", "TestCase" |
| entity_id | String | UUID of the affected entity |
| source | String | Default: "api" (could be "chat" or "panel") |
| request_id | String? | Optional request correlation ID |
| changes | JSON? | Diff of what changed |
| created_at | DateTime | Auto-set |

**Indexes**: (entity_type, entity_id), (actor_id), (created_at)

---

## Custom Database Constraints

Prisma's schema language cannot express partial unique indexes or CHECK constraints. These protections exist in the database but are maintained outside the Prisma schema file.

### What Prisma Can't Model

| Constraint | Type | Purpose |
|-----------|------|---------|
| `test_procedure_versions_single_draft` | Partial unique index (`WHERE status = 'DRAFT'`) | Enforces at most one DRAFT version per test procedure |
| `attachments_exclusive_parent` | CHECK constraint | Ensures exactly one parent FK is non-null (exclusive arc) |

### How They Are Applied

- **All environments**: Included in the `full_schema` migration file. Running `prisma migrate deploy` (or `prisma migrate dev`) applies them automatically.
- **Test database**: `vitest.global-setup.ts` runs `prisma migrate deploy` before each test run.

### Verifying Constraints Exist

```sql
-- Check partial unique index
SELECT indexname FROM pg_indexes
WHERE tablename = 'test_procedure_versions'
  AND indexname = 'test_procedure_versions_single_draft';

-- Check exclusive arc constraint
SELECT conname FROM pg_constraint
WHERE conname = 'attachments_exclusive_parent';
```

### Soft-Delete Convention

All attachment read paths must filter by `status: ACTIVE` to exclude soft-deleted records. Use the shared `ACTIVE_ATTACHMENT_FILTER` constant from `src/lib/prisma.ts`:

```ts
import { ACTIVE_ATTACHMENT_FILTER } from "@/lib/prisma";

// In Prisma include/where clauses:
attachments: { where: ACTIVE_ATTACHMENT_FILTER }
```

### Migration Setup

Custom constraints are included in the `full_schema` migration file (`prisma/migrations/20260312120202_full_schema/migration.sql`). Running `prisma migrate deploy` creates a complete database with all constraints - no separate SQL step needed.

---

## Seeded Demo Data (Pokedex Hardware PLM)

### Teams (6)

| Name |
|------|
| Product |
| Field Testing |
| Hardware |
| Design |
| Firmware |
| Team Rocket QA |

### Users (7, Pokemon cast)

| Name | Email | Role | Team |
|------|-------|------|------|
| Ash Ketchum | ash@example.com | engineer | Product |
| Misty Waterflower | misty@example.com | engineer | Field Testing |
| Brock Harrison | brock@example.com | engineer | Hardware |
| Gary Oak | gary@example.com | engineer | Design |
| Professor Oak | prof.oak@example.com | engineer | Firmware |
| Jessie Rocket | jessie@example.com | engineer | Team Rocket QA |
| James Rocket | james@example.com | engineer | Team Rocket QA |

### Requirement Hierarchy

```
PR1: Pokemon Scanner Module [APPROVED]
  SR1.1: Camera Sensor Hardware [APPROVED] -> Hardware (Brock)
    TP1: Camera Sensor Validation [ACTIVE]
      TPV1 v1 [APPROVED] -> TC1: Camera autofocus 3m [PASSED]
      TPV1B v2 [DRAFT] -> TC19: Camera cold-start focus [PENDING]
  SR1.2: Visual Recognition Algorithm [APPROVED] -> Firmware (Prof. Oak)
    TP2: Recognition Algorithm Accuracy [ACTIVE]
      TPV2 [APPROVED] -> TC2: Recognition 95% accuracy [PASSED]

PR2: Species Database System [APPROVED]
  SR2.1: Species Data Storage Engine [APPROVED] -> Firmware (Prof. Oak)
    TP3: Database Load and Query Performance [ACTIVE]
      TPV3 [APPROVED] -> TC3: DB load and query [PASSED]
  SR2.2: Search and Filter Interface [APPROVED] -> Design (Gary)
    TP4: Search Filter Verification [ACTIVE]
      TPV4 [APPROVED] -> TC4: Search results [PENDING]

PR3: Audio System (Cry Playback) [APPROVED]
  SR3.1: Speaker Hardware [APPROVED] -> Hardware (Brock)
    TP5: Speaker Output Quality Test [ACTIVE]
      TPV5 [APPROVED] -> TC5: Speaker THD [FAILED]
                       -> TC20: Speaker frequency sweep [PENDING]
  SR3.2: Audio Codec and Playback Engine [APPROVED] -> Firmware (Prof. Oak)
    TP6: Audio Codec Fidelity Validation [ACTIVE]
      TPV6 [APPROVED] -> TC6: Audio codec [PASSED]

PR4: Casing and Industrial Design [APPROVED]
  SR4.1: Clamshell Enclosure Design [APPROVED] -> Hardware (Brock)
    TP7: Enclosure Seal Integrity Test [ACTIVE]
      TPV7 [APPROVED] -> TC7: IP54 seal [PASSED]
  SR4.2: Drop Resistance Certification [APPROVED] -> Hardware (Brock)
    TP8: Drop Impact Survival Test [ACTIVE]
      TPV8 [APPROVED] -> TC8: Drop impact [PENDING]

PR5: Wireless Communication Module [CANCELED]
  SR5.1: Bluetooth Data Synchronization [CANCELED] -> Firmware (Prof. Oak)
    TP9: Bluetooth Synchronization Test [CANCELED]
      TPV9 [APPROVED] -> TC9: Bluetooth sync [SKIPPED]

PR6: Habitat Map Display [APPROVED]
  SR6.1: Map Rendering Engine [APPROVED] -> Firmware (Prof. Oak)
    TP10: Map Rendering Performance Test [ACTIVE]
      TPV10 [APPROVED] -> TC10: Map 15fps [PASSED]
  SR6.2: Pokemon Area Data Overlay [APPROVED] -> Design (Gary)
    TP11: Area Overlay Accuracy Test [ACTIVE]
      TPV11 [APPROVED] -> TC11: Habitat overlay [PENDING]

PR7: Trainer ID and Authentication [DRAFT]
  SR7.1: RFID Authentication Chip [DRAFT] -> Hardware (Brock) -- no TP
  SR7.2: League Registration Protocol [DRAFT] -> Firmware (Prof. Oak) -- no TP

PR8: Power System [APPROVED]
  SR8.1: Battery Cell Selection [APPROVED] -> Hardware (Brock)
    TP12: Battery Endurance Test [ACTIVE]
      TPV12 [APPROVED] -> TC12: Battery 72hr [PASSED]
  SR8.2: Power Management IC [APPROVED] -> Firmware (Prof. Oak)
    TP13: Power Management Efficiency Test [ACTIVE]
      TPV13 [APPROVED] -> TC13: Power management [BLOCKED]

PR9: Display and Touch Input [APPROVED]
  SR9.1: LCD Panel Integration [APPROVED] -> Hardware (Brock)
    TP14: LCD Brightness and Contrast Test [ACTIVE]
      TPV14 [APPROVED] -> TC14: LCD brightness [PASSED]
  SR9.2: Touchscreen Digitizer [APPROVED] -> Hardware (Brock)
    TP15: Touch Input Accuracy Test [ACTIVE]
      TPV15 [APPROVED] -> TC15: Touch accuracy [FAILED]
  SR9.3: Physical Button Controls [APPROVED] -> Design (Gary)
    TP16: Button Response Time Test [ACTIVE]
      TPV16 [APPROVED] -> TC16: Button response [PENDING]

PR10: Firmware Update System [APPROVED]
  SR10.1: Service Port Update Path [APPROVED] -> Firmware (Prof. Oak)
    TP17: Service Port Firmware Update Test [ACTIVE]
      TPV17 [APPROVED] -> TC17: Service port update [PASSED]
  SR10.2: Firmware Rollback Mechanism [APPROVED] -> Firmware (Prof. Oak)
    TP18: Firmware Rollback Verification Test [ACTIVE]
      TPV18 [DRAFT] -> TC18: Rollback test [PENDING]
  SR10.3: Wireless Update Protocol [DRAFT] -> Firmware (Prof. Oak)
    (no TP - coverage gap)
```

### Demo Scenarios

| Scenario | Where to find it |
|----------|-----------------|
| Multi-version procedure | TP1 has v1 (APPROVED) + v2 (DRAFT) |
| Coverage gap | SR7.1, SR7.2 (DRAFT PR), SR10.3 (no TP) |
| Failed test | TC5 (speaker THD at max volume), TC15 (touch accuracy with finger input) |
| Blocked test | TC13 (waiting on power management IC samples from Silph Co.) |
| Skipped test | TC9 (parent PR canceled) |
| Cancellation cascade | PR5 -> SR5.1 -> TP9 -> TC9 |
| Multiple TCs per version | TPV5 has TC5 + TC20 |
| Attachments | 6 files across PR, SR, TP, TC entities |

### Status Distribution

| Entity Type | Status Counts |
|-------------|--------------|
| Product Requirements (10) | 8 APPROVED, 1 CANCELED, 1 DRAFT |
| Sub-Requirements (21) | 17 APPROVED, 1 CANCELED, 3 DRAFT |
| Test Procedures (18) | 17 ACTIVE, 1 CANCELED |
| Procedure Versions (19) | 17 APPROVED, 2 DRAFT |
| Test Cases (20) | 9 PASSED, 2 FAILED, 7 PENDING, 1 BLOCKED, 1 SKIPPED |

### Audit Log Timeline

Anchor date: 2026-02-01. All 7 users participate across the timeline.

| Days | Actors | Activity |
|------|--------|----------|
| 0-2 | Ash, Brock, Gary, Prof. Oak | Create and approve 10 product requirements |
| 3-6 | All 7 | Create and approve 21 sub-requirements |
| 7-10 | Jessie, James, Brock, Prof. Oak, Gary | Create 18 test procedures and 19 versions |
| 11-13 | All 7 | Create 20 test cases |
| 14-18 | All 7 | Execute tests (9 PASS, 2 FAIL, 1 BLOCKED, 1 SKIP) |
| 19 | Ash, Jessie | Cancel PR5 cascade (PR -> SR -> TP -> TC) |
| 20 | Jessie, Brock | Create TP1 v2 (DRAFT) + investigation TC for speaker failure |

Total: 155 audit log entries.

### Attachments (6)

| File | Type | Attached to |
|------|------|-------------|
| scanner-calibration-data.xlsx | SPREADSHEET | PR1 (Pokemon Scanner) |
| casing-drop-test-report.pdf | DOCUMENT | TC7 (Enclosure seal) |
| speaker-frequency-response.png | IMAGE | TC5 (Speaker distortion) |
| clamshell-hinge-diagram.png | IMAGE | SR4.1 (Clamshell Enclosure) |
| pokemon-silhouette-test-set.pdf | DOCUMENT | TP2 (Recognition Accuracy) |
| battery-discharge-curve.xlsx | SPREADSHEET | TC12 (Battery endurance) |
