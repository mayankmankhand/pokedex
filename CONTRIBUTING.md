# Contributing

Thanks for your interest in PLM. Here is how to get involved.

## Setup

Follow the Quick Start in [README.md](README.md#quick-start) to get a local dev environment running. You will need Node.js, a Neon PostgreSQL database, and an Anthropic API key.

## Coding Conventions

- **Domain commands over generic CRUD.** Each API endpoint maps to one business action (e.g., `POST /api/product-requirements/:id/approve`).
- **Service layer owns lifecycle rules and transactions.** Route handlers stay thin: parse input, call service, return response.
- **Confirm-before-act on destructive operations.** The system prompt instructs the AI to ask before making changes, and tool schemas enforce it with `z.literal(true)`.
- **Zod schemas are shared** between API validation and LLM tool definitions.
- **No hard deletes.** Use cancel/skip status transitions. Attachments use soft-delete with ACTIVE/REMOVED status.

## Opening Issues

Use [GitHub Issues](https://github.com/mayankmankhand/pokedex/issues) to report bugs or suggest features. Keep issues focused: one problem or one feature per issue. Include steps to reproduce for bugs.

## Submitting Pull Requests

- One branch per issue.
- Run `npm run test` before opening a PR. All 229 tests should pass.
- Run `npm run lint` to check for style issues.
- Keep PRs focused. If your change touches multiple concerns, split it into separate PRs.

## Documentation

If your change affects user-facing behavior, update the relevant docs:

- [USER-GUIDE.md](docs/USER-GUIDE.md) for feature changes
- [STATUS-GUIDE.md](docs/STATUS-GUIDE.md) for lifecycle rule changes
- [DATABASE.md](docs/DATABASE.md) for schema changes
- [ROADMAP.md](ROADMAP.md) for new planned features

## Questions

Open an issue with the "question" label or start a discussion in the repo.
