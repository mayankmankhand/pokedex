# AI Agent Setup Instructions

This file is written for AI agents (Claude, ChatGPT, Cursor) with shell access. If a user asks you to set up Pokedex PLM on their machine, follow the steps below exactly.

---

## What This Is

Pokedex PLM is a chat-based Product Lifecycle Management demo built on Next.js and Anthropic Claude. It runs locally against a Neon Postgres database. The user provides their own Neon connection string and Anthropic API key; nothing is provisioned for them.

---

## Environment

Assume shell access on the user's machine. Use bash on macOS/Linux/WSL or PowerShell on native Windows. The user's machine needs:

- `node` >= 20
- `npm` (ships with Node)
- `git`
- A Neon Postgres connection string (free tier works; user creates one at [neon.tech](https://neon.tech))
- An Anthropic API key (user creates one at [console.anthropic.com](https://console.anthropic.com))

If any of those are missing, stop and tell the user which ones to set up. Do not try to install Node or provision Neon/Anthropic accounts yourself.

---

## Setup Steps

### Step 1: Clone the repo

```bash
git clone https://github.com/mayankmankhand/pokedex.git
cd pokedex
```

### Step 2: Install dependencies

```bash
npm install
```

This may take 60-90 seconds.

### Step 3: Configure environment

The app needs THREE env files:

- `.env` - just `DATABASE_URL` (the Prisma CLI reads this file, not `.env.local`)
- `.env.local` - `DATABASE_URL` plus `ANTHROPIC_API_KEY`. Optional: `ANTHROPIC_MODEL` (defaults to Haiku 4.5), `SESSION_COOKIE_SECRET` (required in production, safe to leave blank in dev)
- `.env.test` - `DATABASE_URL` pointing to a SEPARATE test database (only needed if running tests)

Do not paste secrets into the agent's response or commit them.

```bash
cp .env.local.example .env.local
# Then have the user open .env.local and fill in DATABASE_URL and ANTHROPIC_API_KEY.
# Also create .env containing only the DATABASE_URL line (the Prisma CLI looks for it there).
```

If the user gets stuck on env file shape, point them at [.env.local.example](.env.local.example) for the canonical layout.

### Step 4: Set up the database

```bash
npx prisma migrate deploy
```

This applies migrations including custom SQL constraints (CHECK constraints for attachment exclusive-arc, partial unique index for single-draft-per-procedure). DO NOT use `prisma db push` - it skips the custom SQL.

### Step 5: Seed demo data

```bash
npx prisma db seed
```

This loads the Pokedex hardware PLM dataset: 6 teams, 10 product requirements, 21 sub-requirements, 18 test procedures, 19 versions, 20 test cases, 6 attachments, ~155 audit entries, 7 demo users.

### Step 6: Start the dev server

```bash
npm run dev
```

The server starts on `http://localhost:3000`. Tell the user to open that URL in their browser.

---

## Hand off to the user

Once the server is running:

1. The chat interface loads. The user picks a demo user from the dropdown in the top right (Ash, Misty, Brock, Gary, Professor Oak, Jessie, James).
2. Suggest a few prompts so they see the system working:
   - "Show me the details for Pokemon Scanner Module"
   - "What did Brock work on last week?"
   - "Show me a traceability diagram for Power System"
3. Point them at [docs/USER-GUIDE.md](docs/USER-GUIDE.md) for more.

Stop here. Do NOT chat with the app on the user's behalf. The whole point is for them to drive it.

---

## Troubleshooting

**Port 3000 in use:** ask the user to stop the conflicting process or run `PORT=3001 npm run dev`.

**`prisma migrate deploy` fails on a connection error:** verify `DATABASE_URL` in `.env` is correct and the Neon database is reachable. Neon's free tier suspends idle databases; opening the Neon console wakes it.

**`prisma db seed` fails:** check that migrations ran first. If the schema looks partial, run `npx prisma migrate deploy` again before re-seeding.

**Anthropic API errors (401):** verify `ANTHROPIC_API_KEY` in `.env.local`. Make sure the key has credit available.

**Anthropic API errors (429):** rate limit. Wait a minute or check usage at [console.anthropic.com](https://console.anthropic.com).

**Blank page in browser:** stale Next build cache. Run `rm -rf .next && npm run dev`.

**`npm install` fails on a peer dep:** show the user the exact error and stop. Do not paper over it with `--force`.

---

## What This File Does Not Do

- Does not set up Neon (the user does that at [neon.tech](https://neon.tech)).
- Does not provision API keys (the user does that at [console.anthropic.com](https://console.anthropic.com)).
- Does not deploy to production (the live demo runs on Vercel; local users don't need that).
- Does not run the test suite (covered separately; tests require a SEPARATE test database via `.env.test`).
- Does not configure GPU or CUDA (the app makes no local model calls).
