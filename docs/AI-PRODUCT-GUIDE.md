# How Do AI Products Work?

This document explains how Pokedex PLM is structured as an AI product. Building an AI product is more than picking a model and calling an API. Four capabilities build on each other.

---

## 1. Context Engineering - Done

The model only knows what you show it. Context engineering is figuring out what information the model needs to see - and in what format - to produce useful outputs. This includes the system prompt (background instructions), the conversation history, tool descriptions, and any data you pull from the database to include in the request.

In PLM, the system prompt gives the model its role, the lifecycle rules, and guidance on when to confirm before acting. Every tool has a description that tells the model when and how to use it. When the model calls a tool, the result (formatted data from the database) becomes part of the context for its next response. Getting this right is the difference between an AI that fumbles through tasks and one that handles them confidently.

## 2. Orchestration - Done

Orchestration is how you sequence model calls, combine their outputs, and handle failures. A single user message might trigger multiple tool calls - the model reads a requirement, checks its status, finds related test procedures, and then summarizes everything. You need to decide: does the model handle all of this in one turn, or do you break it into steps? What happens if a tool call fails halfway through?

In PLM, the model handles orchestration itself through the Vercel AI SDK's multi-step tool calling. It can chain up to 25 tool calls in a single response, deciding on its own which tools to call and in what order. The confirm-before-act pattern is part of orchestration too - the model proposes a change, waits for the user to confirm, then executes it.

## 3. Observability - Done

Once the AI is running, you need to see what it's doing. Observability means logging the model's inputs, outputs, and decision path so you can understand why it gave a particular answer or made a particular tool call. Without this, debugging AI behavior is guesswork.

PLM has a database-backed request tracing system for session observability. A TraceEvent model in Prisma captures 7 event types (USER_MESSAGE, AI_RESPONSE, TOOL_CALL, TOOL_RESULT, PANEL_ACTION, API_CALL, ERROR). Each browser session gets a unique ID via a `demo_session_id` cookie, and all trace events are tagged with that session. Admin pages at `/admin/traces` let you browse sessions and inspect individual events. Centralized session queries (listSessions, getSessionEvents, cleanupOldTraces) sit behind a service layer, and a Vercel cron job runs daily cleanup with 7-day retention.

## 4. Evals and Maintenance - Planned

Evals are automated tests for AI behavior - they detect recurring errors and measure quality over time. Unlike regular unit tests (which check if code runs correctly), evals check if the AI's responses are actually good. Does it use the right tool? Does it ask for confirmation before destructive actions? Does it give accurate answers about entity status?

Maintenance is the ongoing work of keeping the system reliable as models get updated and real-world usage patterns change. A new model version might handle prompts differently. Users might ask questions the system wasn't designed for. You need a plan for prompt tuning, model upgrades, and monitoring for drift.

**Where PLM stands today:** Context engineering, orchestration, and observability are built and working. Evals and maintenance are the remaining pieces to make this a complete AI product.
