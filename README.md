# PLM - Product Lifecycle Management

[![Live Demo](https://img.shields.io/badge/Live_Demo-pokedex--plm.vercel.app-teal)](https://pokedex-plm.vercel.app) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Tests](https://img.shields.io/badge/Tests-229_passing-brightgreen)]()

A chat-based tool for managing product requirements, test procedures, and test cases. Instead of clicking through menus and forms, you just type what you need and the AI handles the rest.

<!-- TODO: Add hero screenshot once docs/images/hero-screenshot.png exists -->
<!-- ![PLM Chat Interface](docs/images/hero-screenshot.png) -->

## Why This Exists

The biggest pain with traditional lifecycle management tools is the clicking. Creating a requirement, approving it, writing test procedures, recording results - every action means navigating through multiple screens. Nobody wants to do it, and things fall behind.

PLM replaces all of that with a chat interface. You type "create a requirement for pokemon scanner testing" and it does it. You type "what did Brock work on last week?" and it pulls from the audit log. You get up-to-date context in 25 seconds instead of clicking through 10 screens.

**Nothing gets updated without your confirmation.** Every change the AI proposes, you approve first. The idea is to build trust in this model and eventually move toward more automation - like parsing test procedures and generating test cases automatically.

### Why it's worth considering

1. **Customizable** - The lifecycle rules are your rules. Change them whenever you need to. No vendor lock-in.
2. **No training needed** - Users just type. Even someone from production can update a test case or procedure without learning a new interface.

## What's Built

### Core System
- Full entity hierarchy: Product Requirements, Sub-Requirements, Test Procedures (with versioning), and Test Cases
- PostgreSQL database with lifecycle enforcement, audit logging, and data integrity constraints
- Domain command API (not generic CRUD) - each endpoint maps to one business action

### AI Chat Interface
- Natural language interface powered by Claude (45 tools for creating, updating, querying, and managing entities)
- Confirm-before-act on all destructive operations (cancel, re-parent, reactivate, correct results)
- Context panel that shows entity details, data tables, traceability diagrams, and audit logs
- Drag-to-resize panel, keyboard shortcuts (Cmd+K to focus, Cmd+\ to toggle panel)

### Lifecycle Management
- Full status lifecycle: Draft, Active, Approved, Canceled, with enforced transition rules
- Edit controls: Draft entities fully editable, Approved entities allow limited edits (audited)
- Cancel with cascade (children get canceled too), reactivate with cascade (children come back)
- Re-parent: move sub-requirements or test procedures to a different parent
- Test case recovery: correct wrong results, re-execute failed tests, update notes

### Audit & Traceability
- Every mutation logged with user, timestamp, source (chat vs API), and change details
- AI can summarize audit activity ("what did Jessie do this week?")
- Mermaid traceability diagrams generated on demand
- Cross-entity queries: coverage by team, test result summaries, gap analysis

## What's Missing (Known Limitations)

- **No real authentication** - 7 demo users (Pokemon characters) are hardcoded. You pick a user from a dropdown. Real sign-in with email/password or OAuth is planned ([#62](https://github.com/mayankmankhand/pokedex/issues/62)).
- **No permissions** - All users see all data and can do everything. Role-based access control (admin, editor, commenter) scoped by team is planned ([#63](https://github.com/mayankmankhand/pokedex/issues/63)).
- **No file attachments** - The data model supports attachments, but there's no upload UI. We could add support for Z drive links or file uploads - worth discussing.
- **No real-time panel editing** - You can view entity details in the side panel, but can't edit directly in the panel. Changes go through the chat. Low priority.

## Demo Users

The app ships with a Pokedex hardware PLM dataset and 7 demo users. Switch users from the dropdown in the top-right corner.

| User | Team |
|------|------|
| Ash Ketchum | Product |
| Misty Waterflower | Field Testing |
| Brock Harrison | Hardware |
| Gary Oak | Design |
| Professor Oak | Firmware |
| Jessie Rocket | Team Rocket QA |
| James Rocket | Team Rocket QA |

## What's Coming

- **User authentication** - Sign in with email/password or OAuth, replacing the demo user picker ([#62](https://github.com/mayankmankhand/pokedex/issues/62))
- **Role-based permissions** - Admin, editor, and commenter roles scoped by team ([#63](https://github.com/mayankmankhand/pokedex/issues/63))
- **Team data isolation** - Scope queries so users only see their team's data ([#32](https://github.com/mayankmankhand/pokedex/issues/32))
- **AI observability** - Structured logging and tracing for model inputs, outputs, and decisions ([#64](https://github.com/mayankmankhand/pokedex/issues/64))
- **AI evals** - Automated tests for AI response quality and recurring error detection ([#65](https://github.com/mayankmankhand/pokedex/issues/65))
- **AI maintenance** - Plan for model upgrades, prompt tuning, and data drift ([#66](https://github.com/mayankmankhand/pokedex/issues/66))
- **Frontend resilience** - Error boundaries and retry logic
- **Human-readable IDs** - Short IDs instead of UUIDs (e.g., PR-001)
- **Document parsing** - Upload PDFs or Word docs and extract requirements automatically
- **Interactive panel** - Click table rows to navigate, edit entities directly in the panel

## Journey

This project started as a learning exercise and grew into a working system across 6 phases: foundation, AI layer, UI design, hardening, lifecycle operations, and testing. See the full build story and key architectural decisions in [JOURNEY.md](docs/JOURNEY.md).

---

> For a deeper look at how the AI layer is structured (context engineering, orchestration, observability, and evals), see [AI-PRODUCT-GUIDE.md](docs/AI-PRODUCT-GUIDE.md).

---

## For Developers

### Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Database**: Neon PostgreSQL via Prisma ORM
- **AI**: Vercel AI SDK v6 + Anthropic Claude (streaming chat with 41 LLM tools)
- **UI**: Tailwind CSS v4, Zustand, react-markdown, lucide-react, mermaid
- **Validation**: Zod schemas (shared between API routes and LLM tools)
- **Testing**: Vitest (isolated test database)
- **Auth**: Demo users via Edge Middleware (V1)
- **Security**: Rate limiting (chat endpoint, kill switch via env var), security headers, HTML stripping, UUID validation, generic error responses (no DB detail leakage), robots.txt

### Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Add your Neon DATABASE_URL and ANTHROPIC_API_KEY to .env.local
# Also create .env with just DATABASE_URL (Prisma CLI needs this)
# For tests: create .env.test with DATABASE_URL pointing to a separate test database

# Set up database (uses migration with custom SQL constraints)
npx prisma migrate deploy

# Seed demo data
npx prisma db seed

# Start dev server
npm run dev
```

### API Design

The API uses **domain commands** instead of raw CRUD. Each endpoint maps to one business action:

```
POST /api/product-requirements/create
POST /api/product-requirements/:id/approve
POST /api/product-requirements/:id/cancel
GET  /api/product-requirements
GET  /api/product-requirements/:id
```

#### Entity Hierarchy

```
ProductRequirement (org-wide)
  -> SubRequirement (team-assigned)
    -> TestProcedure (logical container)
      -> TestProcedureVersion (immutable snapshots, one draft at a time)
        -> TestCase (execution records)
```

#### Chat API (LLM)

```
POST /api/chat   # Streaming natural language interface to manage PLM entities
```

Send `{ messages: [{ role, content }] }` with `x-demo-user-id` header. Returns a Vercel AI SDK stream. The LLM has 45 tools (24 mutation, 5 read, 4 query, 8 UI intent, 2 attachment, 2 reserved) and confirms before destructive actions.

### Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run test         # Run tests (229 tests, uses .env.test database)
npm run test:watch   # Watch mode
npm run lint         # ESLint
```

### Project Structure

```
src/
  app/               # Next.js pages + API routes
    api/             # 38 route handlers (domain commands + queries + chat)
    page.tsx         # Chat UI (dual-panel, streaming)
    globals.css      # Tailwind v4 + design tokens
  components/chat/   # Chat UI components (8 files)
  components/panel/  # Context panel views (detail, table, diagram, audit, error)
  hooks/             # Shared React hooks (useDesktopBreakpoint)
  stores/            # Zustand stores (panel state + width)
  types/             # Shared TypeScript types + Zod schemas (panel payloads)
  lib/ai/            # LLM layer: system prompt, 45 tools, trace logger
  lib/               # Shared utilities (prisma, errors, auth, demo-users)
  schemas/           # Zod validation schemas
  services/          # Business logic with lifecycle enforcement + audit logging
  __tests__/         # Vitest tests (lifecycle, schema, integration, panel)
prisma/
  schema.prisma      # Database schema (9 models, 7 enums)
  seed.ts            # Demo data seeder
docs/
  DATABASE.md        # Schema documentation and seed data
  STATUS-GUIDE.md    # Lifecycle status reference
  USER-GUIDE.md      # End-user guide
  design/            # Design specs and HTML prototype
```

### Documentation

- [USER-GUIDE.md](docs/USER-GUIDE.md) - What the app does, how to use the chat, example prompts
- [ROADMAP.md](ROADMAP.md) - V1 summary, V2/V3 planned features
- [STATUS-GUIDE.md](docs/STATUS-GUIDE.md) - Full lifecycle status reference
- [DATABASE.md](docs/DATABASE.md) - Schema documentation and seed data
- [AI-PRODUCT-GUIDE.md](docs/AI-PRODUCT-GUIDE.md) - How context engineering, orchestration, observability, and evals fit together
- [JOURNEY.md](docs/JOURNEY.md) - How the project was built, phase by phase

---

## Issue Log

49 issues tracked. 36 completed, 3 open, 10 planned. See [GitHub Issues](https://github.com/mayankmankhand/pokedex/issues) for the full list.
