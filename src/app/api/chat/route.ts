// Chat endpoint - streams LLM responses with tool execution.
// Uses Vercel AI SDK streamText with stopWhen for automatic ReAct looping.

import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/request-context";
import { handleApiError } from "@/lib/api-utils";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createAllTools } from "@/lib/ai/tools";
import { createTraceLogger } from "@/lib/ai/trace-logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  checkSessionLimit,
  createSessionCookie,
  getSessionLimitHeaders,
  getLimit,
} from "@/lib/session-limit";
import {
  writeTraceEvent,
  userMessagePayload,
  aiResponsePayload,
  errorPayload,
} from "@/services/trace.service";

// 50KB cap - prevents oversized payloads from burning LLM tokens.
const MAX_BODY_BYTES = 51_200;

export async function POST(request: NextRequest) {
  // Read session ID early so error handlers can use it for trace logging.
  // Falls back gracefully if middleware hasn't set it yet.
  const sessionId = request.headers.get("x-session-id") ?? "unknown";

  try {
    // Rate limit by IP before doing any real work.
    // Protects the Anthropic API bill from abuse.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      // Trace: log rate limit hit (awaited - critical error event)
      await writeTraceEvent(
        sessionId, "ERROR",
        errorPayload(`Rate limited (retry in ${rateCheck.retryAfter}s)`, "RATE_LIMIT", "/api/chat"),
      );
      return new Response(
        JSON.stringify({
          error: `Too many requests. Please try again in ${rateCheck.retryAfter} seconds.`,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateCheck.retryAfter),
          },
        },
      );
    }

    // Session limit - enforce per-visitor message cap.
    // Protects Anthropic API costs when the demo is shared publicly.
    const sessionCheck = checkSessionLimit(request);
    if (!sessionCheck.allowed) {
      // Trace: log session limit hit (awaited - critical error event)
      await writeTraceEvent(
        sessionId, "ERROR",
        errorPayload("Session message limit reached", "SESSION_LIMIT", "/api/chat"),
      );
      return new Response(
        JSON.stringify({
          error:
            "Thanks for trying Pokedex PLM! You've reached the demo limit. Your session resets in 24 hours, or check out the code at github.com/mayankmankhand/pokedex.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": createSessionCookie(sessionCheck.count),
            ...getSessionLimitHeaders(0),
          },
        },
      );
    }

    // Fast-path: reject obviously oversized payloads via Content-Length header.
    // This is cheap (no body read) but advisory - the header can be spoofed.
    const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
    if (contentLength > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ error: "Request too large. Maximum size is 50KB." }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      );
    }

    // Build RequestContext from middleware headers (same pattern as other routes).
    // This identifies which demo user is chatting.
    const ctx = { ...getRequestContext(request), source: "chat" as const };

    // Real enforcement: read body as text and check actual byte length.
    // Catches cases where Content-Length is missing, spoofed, or stripped by proxies.
    // Uses TextEncoder to measure UTF-8 bytes (not JS string length, which counts
    // UTF-16 code units and would undercount multi-byte characters).
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return new Response(
        JSON.stringify({ error: "Request too large. Maximum size is 50KB." }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      );
    }

    // Parse the request body. The Vercel AI SDK's useChat sends UIMessages
    // with a `parts` array (text, tool calls, tool results). We use
    // convertToModelMessages() to transform them into the format streamText expects.
    // No custom Zod validation here - the SDK handles the message contract.
    const body = JSON.parse(rawBody);
    const { messages: uiMessages } = body;

    if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Convert UIMessages (with parts) to ModelMessages (with content/tool_calls)
    // that streamText can process. This handles the format difference between
    // what useChat sends and what the LLM expects.
    const modelMessages = await convertToModelMessages(uiMessages);

    // Create all tools bound to the current user's context.
    // Mutation tools use ctx for auth and audit logging.
    const tools = createAllTools(ctx);

    // Create a trace logger for this request.
    // Logs tool call sequences as structured JSON for debugging (console)
    // AND writes tool events to the trace DB (deferred via after()).
    const tracer = createTraceLogger(ctx.requestId, ctx.userId, ctx.sessionId);

    // Trace: log the user's message (awaited - critical event).
    // Extract the last user message text for the trace.
    const lastUserMsg = uiMessages.findLast(
      (m: { role: string }) => m.role === "user",
    );
    const userText =
      lastUserMsg?.content ??
      lastUserMsg?.parts?.find((p: { type: string }) => p.type === "text")?.text ??
      "[no text]";
    await writeTraceEvent(
      ctx.sessionId, "USER_MESSAGE",
      userMessagePayload(typeof userText === "string" ? userText : String(userText)),
      ctx.requestId, undefined, "chat",
    );

    // Stream the response with automatic tool execution.
    // stopWhen: stepCountIs(10) allows up to 10 tool-call rounds per message.
    // For example, "create a requirement and publish it" needs 2 steps.
    // Default is stepCountIs(1) which would stop after one tool call.
    const result = streamText({
      // Model is configurable via ANTHROPIC_MODEL env var in .env.local.
      // Defaults to Haiku 4.5 - swap to Sonnet 4.6 when ready.
      model: anthropic(process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001"),
      system: buildSystemPrompt(),
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(10),
      onStepFinish: tracer.onStepFinish,
      // Trace: log the AI response when the stream finishes.
      // Using onFinish instead of after() + result.text because onFinish
      // handles client disconnection gracefully (the SDK manages stream
      // consumption lifecycle) and avoids "stream already consumed" errors.
      onFinish({ text, finishReason }) {
        void writeTraceEvent(
          ctx.sessionId, "AI_RESPONSE",
          aiResponsePayload(text, String(finishReason)),
          ctx.requestId, undefined, "chat",
        );
      },
    });

    // Return the streaming response in Vercel AI SDK UIMessage stream format.
    // This format supports tool call/result streaming for frontend consumption.
    const response = result.toUIMessageStreamResponse();

    // Increment session count and set cookie + remaining header.
    const newCount = sessionCheck.count + 1;
    const remaining = Math.max(0, getLimit() - newCount);
    response.headers.set("Set-Cookie", createSessionCookie(newCount));
    response.headers.set("x-remaining-messages", String(remaining));

    return response;
  } catch (error) {
    // Trace: log the error (awaited - critical event)
    const errMsg = error instanceof Error ? error.message : String(error);
    await writeTraceEvent(
      sessionId, "ERROR",
      errorPayload(errMsg, "CHAT_ERROR", "/api/chat"),
    );

    // Detect Anthropic API quota exhaustion (credit/billing errors).
    // Shows a friendly message instead of a generic server error.
    if (
      error instanceof Error &&
      (error.message?.includes("credit") ||
        error.message?.includes("quota") ||
        error.message?.includes("billing"))
    ) {
      return new Response(
        JSON.stringify({
          error:
            "This demo got popular! Global capacity reached for today. Try again tomorrow.",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }
    return handleApiError(error);
  }
}
