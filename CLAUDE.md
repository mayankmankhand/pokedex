# Project Instructions for Claude

## About This Project

**Pokedex PLM** is a chat-based product lifecycle management tool: chat is the surface, AI handles the entity work, every change is confirmed first.

**Tech stack:** Next.js 16 (App Router) + TypeScript + Prisma + Neon Postgres + Tailwind v4 + Zod + Vitest. AI via Vercel AI SDK v6 + Anthropic Claude (45 tools, model via `ANTHROPIC_MODEL`, default Haiku 4.5).

**UI shell:** Dual-panel chat app with `@ai-sdk/react` useChat hook, Zustand panel store, react-markdown, lucide-react icons, ThinkingIndicator (cycling Pokemon battle phrases plus Pokeball spinner while waiting for AI response and during tool execution).

**Who it's for:** Hardware product teams that want to manage requirements, test procedures, and test cases through a single AI chat surface instead of clicking through forms.

**Distribution:** Demo deployed at pokedex-plm.vercel.app. Open source, BYO Neon DB plus Anthropic API key.

### v1 scope (shipped)
- AI chat assistant with 45 tools for managing requirements, test procedures, and test cases
- Context panel with detail views, data tables, Mermaid diagrams, and audit logs
- Status workflows with lifecycle rules (Draft -> Approved -> Canceled)
- Attachment metadata tracking with soft-delete
- Two-entity versioning for test procedures (immutable snapshots)
- Full audit logging on every mutation
- Cross-entity queries (coverage analysis, test result summaries, gap detection)
- Pokedex hardware demo dataset (6 teams, 10 PRs, 21 SRs, 18 TPs, 19 TPVs, 20 TCs, 6 attachments, ~155 audit entries, 7 demo users)
- 7 hardcoded demo users (Pokemon cast) via Edge Middleware
- Rate limiting and security headers
- Editable context panel with inline editing in detail views, server-driven `editableFields` metadata, panel mutation notes injected into chat as `[System Note]`
- Requirements traceability via three template-based diagram tools (`showTraceabilityDiagram`, `showCoverageDiagram`, `showStatusDiagram`) and 10 query types in `showTable` with cross-entity columns
- AI observability with database-backed request tracing (`TraceEvent` model, 7 event types, session tracking, `/admin/traces` UI, cron cleanup)

### v2 scope (planned)
- **Document Parsing** - Expand the attachment system with file upload and AI-powered content extraction (PDFs, Word docs, referenceable in conversations)
- **User Authentication** - Replace the demo dropdown with real sign-in (email/password or OAuth via Google or GitHub); hardcoded demo users go away in production
- **Role-Based Permissions** - Three roles scoped by team: admin (full control), editor (create and modify within team), commenter (view and notes only); depends on auth shipping first
- **Notifications** - In-app and/or email alerts when entities you care about change status, need your approval, or get assigned to you
- **Document Version Control** - Version uploaded documents (not just test procedures); new revisions tracked, current version surfaced
- **AI Evals** - Automated tests that check AI response quality, detect recurring errors, and track metrics over time (different from unit tests; measure behavior, not just code)
- **AI Maintenance** - A plan for handling model version upgrades, prompt tuning, and data drift; keeps the system reliable as models and usage patterns change

### v3 scope (future)
- **Configurable Approval Chains** - Multi-step, multi-role approval workflows (e.g. team lead plus quality manager sign-off on safety-critical requirements); sequential and parallel approval steps
- **Baseline Snapshots** - Point-in-time snapshot of all requirements, test procedures, and test results at a milestone (e.g. "Design Review 2"); compare baselines to see what changed between gates
- **Quality Management (CAPA)** - Track quality issues and nonconformances when tests fail; investigate root causes, assign corrective actions, verify fixes with a structured closure workflow

### Explicitly not planned
- **Bill of Materials (BOM)** - Focus is on requirements and testing, not manufacturing
- **Engineering Change Orders (ECO)** - Approval chains in v3 cover the core workflow
- **Project Milestones/Timelines** - Out of scope for a requirements-focused tool
- **Dashboards** - The AI chat and context panel tables serve this purpose

## Who I Am

PM learning to code. Explain things simply. Show your work.

## My Preferences

- Domain commands over generic CRUD endpoints (e.g. `POST /api/product-requirements/:id/approve`)
- Service layer owns lifecycle rules and transaction boundaries
- Route handlers stay thin (parse, delegate, respond)
- Centralized error handling via `handleApiError()` in [src/lib/api-utils.ts](src/lib/api-utils.ts)
- Zod schemas shared between API validation and LLM tool definitions
- No hard deletes - use cancel/skip status transitions (attachments use soft-delete with ACTIVE/REMOVED status)
- Exclusive Arc pattern for polymorphic ownership (attachments) - enforced by DB CHECK constraint plus Zod
- Single-draft-per-procedure enforced at service layer plus DB partial unique index
- `ACTIVE_ATTACHMENT_FILTER` constant in [src/lib/prisma.ts](src/lib/prisma.ts) - use in all attachment queries
- LLM tools call services directly (not HTTP routes) for mutations
- Confirm-before-act for destructive LLM operations via prompt engineering plus `z.literal(true)`
- Compact Prisma `select` payloads in LLM tools to protect context window
- Stable error prefixes in tool responses: `LifecycleError:`, `NotFoundError:`, `ValidationError:`
- Database setup via `prisma migrate deploy` (not `db push`) - migration includes custom SQL constraints
- Panel barrel export at [src/components/panel/index.ts](src/components/panel/index.ts)

## Design Principles

1. **Chrome bold, data restrained.** Full-saturation color on small accents (buttons, badges, links); muted parchment on large surfaces. This is the slogan-grade rule.
2. **Solid opaque surfaces with thick borders.** No frosted glass, no translucency, no blur. The interface should feel like a Game Boy cartridge, not a glassmorphism showcase.
3. **Pokemon Indigo League warm parchment.** This is the visual identity, not a skin. Warm cream backgrounds (`#F5F0EA`), Pokemon Red primary (`#DC2626`), accent blue (`#3D7DCA`).
4. **Confirm before destructive action.** Both LLM and UI sides require explicit confirmation for cancel, re-parent, reactivate, correct, re-execute. LLM uses `z.literal(true)` plus prompt engineering; UI uses the Gen 1 Yes/No box or `ChoiceButtons`.
5. **Audit every mutation in the same transaction.** No mutation without a corresponding audit row, written inside the same Prisma transaction. `AuditSource` (`"api" | "chat" | "panel"`) threads through `RequestContext` to `writeAuditLog`.
6. **Reduced motion respected on every animation.** Every animation (streaming dots, iris wipe, skeleton shimmer, hover transitions) checks `prefers-reduced-motion`.
7. **Fan-inspired original designs only.** No copied sprites or assets. IP hygiene comments in sprite files and [src/app/globals.css](src/app/globals.css).

### Anti-patterns to actively reject
- Generic CRUD endpoints (use domain commands)
- Hard deletes (use cancel/skip status transitions; attachments use ACTIVE/REMOVED soft-delete)
- Mocking the chat API in tests (run against real services)
- Frosted-glass or translucent surfaces (solid opaque only)
- Animations without `prefers-reduced-motion` guards
- Em dashes or en dashes anywhere (use regular hyphens or rewrite)
- Raw IDs or Prisma/DB detail in error messages from `handleApiError` (no leakage)
- Audit-source drift (always thread `AuditSource` through `RequestContext`; chat route overrides to `"chat"`, panel sets `X-Audit-Source: panel` header)

## Design Decisions

Locked-in visual and interaction choices. Apply consistently across new components.

| Area | Decision |
|---|---|
| Theme | Pokemon Indigo League: warm parchment (`#F5F0EA` bg, `#DC2626` Pokemon Red primary, `#3D7DCA` accent blue). Light only. |
| Typography | DM Sans for chrome, JetBrains Mono for code and IDs. |
| Surfaces | Solid opaque, thick borders, no frosted glass. |
| Color principle | Chrome bold, data restrained: full saturation on small accents (buttons, badges, links), muted parchment on large surfaces. |
| Chat surface | `.chat-markdown` CSS class for assistant messages. `StatusBadge` with Pokemon type colors. `PokeballIcon` shared component. CSS Pokeball spinner for loading states. |
| Panel | Always-fixed overlay, solid opaque, drag-to-resize (540px default, 360-800px via Zustand `panelWidth`). Keyboard shortcuts: Cmd+K focus, Cmd+\\ toggle, Escape close. Shared `useDesktopBreakpoint` hook for hydration-safe media queries. Navigation history stack (cap 20, snapshot-based, back button). |
| Panel surfaces | `.dex-card` / `.dex-card-header` / `.dex-card-body` (Framed Dex Entry cards for detail view sections). `.audit-source-badge` (chat/panel/api source indicators). `.pokeball-fainted` (grayed-out error state icon). Panel primitives live in [src/app/globals.css](src/app/globals.css) via `@layer components`. |
| Panel views | 7 panel tools plus 1 inline (`presentChoices`): detail view, table, diagram, audit, error, plus navigation, edit mode, lifecycle actions. Edit mode driven by server `editableFields` metadata. Lifecycle action buttons (Approve, Cancel, Reactivate, Skip, Re-execute) driven by server `availableActions` with inline confirmation. Panel mutations inject `[System Note]` into chat via `setMessages()` so the AI stays aware. |
| Diagrams | 3 template-based tools (`showTraceabilityDiagram`, `showStatusDiagram`, `showCoverageDiagram`) produce deterministic Mermaid from DB data via pure functions in `diagram-templates.ts`. Freehand `showDiagram` kept for ad hoc or novel diagrams. Render at natural SVG size (no max-w-full) with zoom controls (+/-, Fit button, Copy source), max-h-[60vh] container. `classDef` color-coding with WCAG AA contrast. `escapeMermaidLabel` sanitizes DB strings. `MAX_DIAGRAM_NODES=300` guard prevents browser crashes. Themed toolbar plus parchment dot-grid background. |
| Tables | `showTable` supports 10 query types (7 enriched list/gap queries plus 3 aggregations) with cross-entity columns, team filter, fetch-16-return-15 truncation detection (`isTruncated` flag on `TablePayload`), ID columns for row navigation. Thick borders, clickable rows, "Show more" button for offset-based pagination. |
| Audit log | ACTOR ACTION Target pattern with Pokemon type color tokens. |
| Choice buttons | Gen 1 multi-choice buttons (`ChoiceButtons` component) for `presentChoices` tool: 2-5 inline options, four states (active/selected/answered/superseded), `role="group"` a11y, collapses to a one-liner after resolution. Confirm-Yes/No box suppressed when choices are present. |
| Confirmation | Gen 1 Yes/No box with `>` arrow cursor on hover and focus-visible. |
| Animations | Bouncing mini-Pokeball streaming dots (`.streaming-pokeballs`), iris-wipe panel transition via `clip-path: circle()` (`.panel-iris-wipe`, open-only, 200ms), warmer skeleton shimmer. All respect `prefers-reduced-motion`. |
| Branding | Pokeball `icon.svg` favicon (App Router auto-metadata), "Pokedex PLM" page title, Game Boy button styled `<kbd>` hints. |
| Trainer identity | `spriteId` and `accentColor` on `DemoUser`. `TrainerSprite` lookup component in [src/components/sprites/](src/components/sprites/) (fan-inspired monocolor SVG icons, `currentColor` fill, fallback silhouette). Trainer avatars on user chat messages. |
| User picker | Custom WAI-ARIA listbox dropdown (replaces native `<select>`). |
| Performance | Zustand individual selectors (not bare `usePanelStore()`), `React.memo` on `MessageBubble`, `useCallback` for chip handlers, `.trim()` on all Zod string inputs. |
| Accessibility | `aria-expanded` on toggle buttons, `aria-label` on icon-only buttons, `title` tooltips on truncated text. |

Do not re-litigate these without amending [docs/JOURNEY.md](docs/JOURNEY.md) first.

## Lifecycle Rules

**Editing.** DRAFT entities fully editable. APPROVED entities allow title/description edits (audited). APPROVED TPV allows description only (steps locked). ACTIVE TPs allow title edits. PENDING TCs allow title/description edits. DRAFT PR/SR can be canceled (blocked if children exist).

**Re-parenting.** SubRequirements can move to a different ProductRequirement. TestProcedures can move to a different SubRequirement. Children stay attached (lineage changes transitively). CANCELED entities cannot move. APPROVED SR cannot move to DRAFT PR. Confirm-before-act on both. All moves audited with `RE_PARENT` action.

**Recovery.** Executed test cases (PASSED/FAILED/BLOCKED) support three recovery operations: `correctTestResult` (fix wrong result in place), `reExecuteTestCase` (reset FAILED/BLOCKED to PENDING), `updateTestCaseNotes` (add/edit notes without changing result). All corrections audited. Confirm-before-act on correct and re-execute.

**Reactivation.** Canceled entities can be reactivated (PR/SR to DRAFT, TP to ACTIVE, TC SKIPPED to PENDING). Cascade reactivation brings back all canceled/skipped children. Top-down rule: parent must be non-canceled before children can reactivate. Confirm-before-act on all. Audited with `REACTIVATE` action.

**Audit.** Every mutation logged in the same Prisma transaction. `AuditSource` type (`"api" | "chat" | "panel"`) on `RequestContext` threads source through to `writeAuditLog` (chat route overrides to `"chat"`, panel sets `X-Audit-Source: panel` header).

**Tracing.** Database-backed request tracing for session observability (Issue #11). `TraceEvent` model in Prisma with 7 event types (USER_MESSAGE, AI_RESPONSE, TOOL_CALL, TOOL_RESULT, PANEL_ACTION, API_CALL, ERROR). Session ID via `demo_session_id` cookie (UUID, 24h expiry, parsed in Edge Middleware, injected into `RequestContext`). Typed payload builders in [src/services/trace.service.ts](src/services/trace.service.ts) with discriminated union. Critical events (USER_MESSAGE, ERROR) awaited; deferred events (TOOL_CALL, TOOL_RESULT) use `after()` from `next/server` with arrow function wrappers. AI_RESPONSE captured via `onFinish` callback on `streamText()`. Deep payload truncation before serialization (2000 chars, `...[truncated]` marker). Centralized session queries (`listSessions`, `getSessionEvents`, `cleanupOldTraces`) behind service layer for future `trace_sessions` table swap. Observability data, not audit-grade; deferred writes are best-effort. Admin pages at `/admin/traces` with `ADMIN_SECRET_KEY` env var access control (timing-safe comparison via `crypto.timingSafeEqual`). Shared auth policy functions (`isAdminAccessConfigured`, `isValidAdminKey`, `isAdminPageAccessAllowed`) in [src/lib/admin-guard.ts](src/lib/admin-guard.ts) prevent drift between API and page auth. Vercel cron cleanup (daily, 7-day retention) via `CRON_SECRET` Bearer token. `handleApiError` accepts optional `TraceContext` for fire-and-forget error tracing (`void writeTraceEvent`). API routes opt in incrementally.

**Security.** Rate limiting on `/api/chat` (10 req/min per IP via in-memory sliding window in [src/lib/rate-limit.ts](src/lib/rate-limit.ts), `RATE_LIMIT_DISABLED` env var kill switch; note: per-instance only on Vercel serverless). Session-based demo limit (25 msgs/session via HMAC-SHA256 signed httpOnly cookie in [src/lib/session-limit.ts](src/lib/session-limit.ts), `SESSION_LIMIT_DISABLED` env var kill switch, configurable via `DEMO_SESSION_LIMIT` and `DEMO_WARNING_THRESHOLD` env vars, `SESSION_COOKIE_SECRET` required in production). Security headers in [next.config.ts](next.config.ts) (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy). `skipHtml` on ReactMarkdown. DOMPurify on Mermaid SVG (`ADD_TAGS: ["foreignObject", "style"]` to preserve text labels while sanitizing). Trace logging guarded behind `NODE_ENV !== 'production'`. UUID format validation on `x-demo-user-id` header in Edge Middleware. Generic error messages in `handleApiError()` (no Prisma/DB detail leakage). `robots.txt` blocks `/api/` and `/admin/` from crawlers. Chat body size enforced via `TextEncoder` byte length (not string length). Graceful error for Anthropic API quota exhaustion.

## Skills

Review commands and other slash commands live in [.claude/commands/](.claude/commands/). Toolkit rules (collaboration rules, slash command list, git workflow) live in [.claude/rules/toolkit.md](.claude/rules/toolkit.md). UI references live in [.claude/ui-reference/](.claude/ui-reference/).
