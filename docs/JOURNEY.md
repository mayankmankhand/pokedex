## Journey

This project started as a learning exercise and grew into a working system. Here's how it came together.

### Phase 1: Foundation

The first question was: what does a PLM system actually need? The answer was a hierarchy - Product Requirements break down into Sub-Requirements, which get verified by Test Procedures (with immutable version snapshots), which produce Test Cases. Every action in the system is a business command ("approve this requirement") rather than a generic database operation ("update row where id = ..."). This was the most important early decision - it made every feature after this easier to build.

The database, API routes, and service layer all went in together. Services own the lifecycle rules and run everything inside database transactions with audit logging. If something fails halfway through, nothing gets saved. If something succeeds, there's a record of who did it and when.

### Phase 2: The AI Layer

Next came the chat interface. The AI has 45 tools - it can create entities, approve them, run queries, show diagrams, and manage attachments. The key decision here was having the AI call the service layer directly instead of going through HTTP routes. This avoided a whole class of problems (auth headers, self-round-trips, error handling duplication).

The confirm-before-act pattern was simple but important: the system prompt tells the AI to always ask before making changes, and the tool schemas enforce it with a required `confirmed: true` field. No complex middleware needed.

### Phase 3: Making It Look Right

The UI went through two major redesigns. The first version looked dated - it worked but nobody would want to use it. The fix was to stop guessing at design and start with a spec: research real products, pick explicit colors and fonts, define spacing rules. That redesign used a slate+teal palette with frosted glass surfaces, DM Sans for text, and a resizable side panel for rich context views.

One lesson learned the hard way: a global CSS reset (`* { margin: 0; padding: 0 }`) was silently breaking every Tailwind spacing utility. Removing two lines of CSS fixed dozens of layout issues.

### Phase 4: Hardening

Security, performance, and edge cases. Rate limiting on the chat endpoint. Security headers. XSS protection on rendered markdown. A separate test database so tests don't pollute dev data.

The Mermaid diagram rendering had two separate bugs - first the diagrams were too small (a CSS constraint forced them into a tiny space), then the text labels disappeared (the HTML sanitizer was stripping the SVG elements that Mermaid uses for text). Both required understanding how the libraries actually work under the hood.

### Phase 5: Real Lifecycle Operations

This is where PLM became genuinely useful. Editing approved entities (with restrictions and audit trails). Canceling with cascade (cancel a requirement and all its children get canceled too). Reactivating canceled entities (the reverse of cascade cancel). Re-parenting (move a sub-requirement to a different parent requirement). Correcting test results after the fact.

Each of these features built on the patterns established in Phase 1 - domain commands, service-layer enforcement, audit logging in transactions, confirm-before-act. The early architecture decisions paid off because none of these features required reworking the foundation.

### Phase 6: Testing and Validation

The system started with 161 automated tests (now 229) covering lifecycle transitions, schema validation, service logic, and panel payloads, all running against an isolated test database. Beyond automated tests, real-life scenario tests walk through multi-user workflows end to end - multiple users creating, approving, canceling, recovering, and re-parenting entities across teams. A headless browser QA setup captures screenshots and checks that the UI actually renders what the code says it should. Manual database integration walkthroughs verify the full stack from chat input to database state.

### Key Decisions That Shaped the System

| Decision | Why |
|----------|-----|
| Domain commands over CRUD | Every API call has clear business intent - easier to audit, test, and extend |
| Services own transactions | No partial writes, no orphaned data, audit log always consistent |
| AI calls services directly | Avoids self-round-trips through HTTP, simpler error handling |
| Confirm-before-act via prompt + schema | Works with zero middleware - just a system prompt rule and a Zod field |
| Two-entity versioning | Test procedures evolve while past versions stay immutable |
| Exclusive arc for attachments | Polymorphic ownership with database-enforced constraints |
| Spec-driven UI design | Explicit hex values and spacing rules instead of "make it look better" |

---
