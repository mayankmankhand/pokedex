# PLM Roadmap

What's built, what's next, and what's out of scope for the PLM system.

## V1 - Current Release

- AI chat assistant with 45 tools for managing requirements, test procedures, and test cases
- Context panel with detail views, data tables, Mermaid diagrams, and audit logs
- Status workflows with lifecycle rules (Draft -> Approved -> Canceled)
- Attachment metadata tracking with soft-delete
- Two-entity versioning for test procedures (immutable snapshots)
- Full audit logging on every mutation
- Cross-entity queries (coverage analysis, test result summaries, gap detection)
- Pokedex hardware demo dataset with 6 teams and 7 users
- Rate limiting and security headers

## V2 - Planned

**Document Parsing** - Expand the existing attachment system with file upload and AI-powered content extraction. The assistant will be able to read PDFs, Word docs, and other files, then reference their contents in conversations.

**Editable Context Panel** - Edit entity fields directly in the panel's detail views and tables. Changes save to the database without switching to chat, preserving all existing audit logging and validation rules.

**Requirements Traceability Matrix** - A single table view mapping every requirement to its sub-requirements, test procedures, and test results. Shows coverage gaps at a glance across the entire project.

**User Authentication (#62)** - Replace the demo user dropdown with real sign-in. Users create accounts with email/password or OAuth (Google, GitHub). The hardcoded demo users go away in production.

**Role-Based Permissions (#63)** - Three roles scoped by team: admin (full control), editor (create and modify within their team), commenter (view and add notes only). Depends on authentication shipping first.

**Notifications** - In-app and/or email alerts when entities you care about change status, need your approval, or get assigned to you.

**Document Version Control** - Version uploaded documents (not just test procedures). Upload a new revision of a spec and see the full version history. Know which version is current.

**AI Observability (#64)** `NEXT` - Structured logging and tracing for model inputs, outputs, and tool call sequences. See exactly what the AI received and why it made each decision. Currently only a development trace logger exists.

**AI Evals (#65)** `NEXT` - Automated tests that check AI response quality, detect recurring errors, and track metrics over time. Different from unit tests - these measure whether the AI's behavior is actually good, not just whether code runs.

**AI Maintenance (#66)** - A plan for handling model version upgrades, prompt tuning, and data drift. Ensures the system stays reliable as models change and real-world usage patterns evolve.

## V3 - Future

**Configurable Approval Chains** - Define multi-step, multi-role approval workflows. For example, require sign-off from both the team lead and quality manager before a safety-critical requirement is approved. Supports sequential and parallel approval steps.

**Baseline Snapshots** - Capture a point-in-time snapshot of all requirements, test procedures, and test results at a milestone (e.g., "Design Review 2"). Compare baselines to see what changed between review gates.

**Quality Management (CAPA)** - Track quality issues and nonconformances when tests fail. Investigate root causes, assign corrective actions, and verify fixes with a structured closure workflow.

## Not Planned

- **Bill of Materials (BOM)** - Focus is on requirements and testing, not manufacturing
- **Engineering Change Orders (ECO)** - Approval chains in V3 cover the core workflow
- **Project Milestones/Timelines** - Out of scope for a requirements-focused tool
- **Dashboards** - The AI chat and context panel tables serve this purpose
