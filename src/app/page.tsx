// Main chat page - dual-panel layout with chat left and context panel right.
// Uses Vercel AI SDK's useChat hook for message state and streaming.
// Sends the selected demo user ID via custom headers on every request.
// Panel is controlled by the AI via UI intent tools (Zustand store).

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  MessageList,
  ChatInput,
  UserPicker,
  DEFAULT_USER_ID,
} from "@/components/chat";
import type { DemoUserId } from "@/components/chat";
import { UI_INTENT_TOOLS, isInlineTool } from "@/components/chat/tool-labels";
import { ContextPanel } from "@/components/panel";
import { usePanelStore } from "@/stores/panel-store";
import { PanelContentSchema } from "@/types/panel";
import type { ToolPartShape } from "@/types/panel";
import { useDesktopBreakpoint } from "@/hooks/use-desktop-breakpoint";
import { PokeballIcon } from "@/components/pokeball-icon";
import { usePanelActions } from "@/hooks/use-panel-actions";

// Session limit constants - match server defaults in session-limit.ts.
// These drive the client-side warning banner (UX hint only, server enforces).
const DEMO_SESSION_LIMIT = 25;
const DEMO_WARNING_THRESHOLD = 20;

export default function ChatPage() {
  // Desktop breakpoint for panel-aware padding
  const isDesktop = useDesktopBreakpoint();

  // Track which demo user is selected. Changing users resets the chat.
  const [userId, setUserId] = useState<DemoUserId>(DEFAULT_USER_ID);

  // Client-side message counter for session limit warnings.
  // This is a UX hint only - the server is the source of truth for enforcement.
  const [messageCount, setMessageCount] = useState(0);

  // Panel state - reset on user switch, read isOpen + width for layout padding
  const resetPanel = usePanelStore((s) => s.reset);
  const isPanelOpen = usePanelStore((s) => s.isOpen);
  const panelWidth = usePanelStore((s) => s.panelWidth);

  // Memoize the transport so it only recreates when the user changes.
  // The transport adds the demo user header to every request.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: { "x-demo-user-id": userId },
      }),
    [userId],
  );

  // useChat manages message state, streaming, and API communication.
  // Changing the id resets the conversation (fresh messages).
  const chat = useChat({ id: userId, transport });

  // Panel-to-chat communication: injects system notes when the user
  // performs mutations (edits, approvals) directly in the panel UI.
  const { notifyChat } = usePanelActions({
    messages: chat.messages,
    setMessages: chat.setMessages,
    status: chat.status,
  });

  // Local input state (useChat v6 doesn't manage input for us).
  const [input, setInput] = useState("");

  // Send a message via the chat hook.
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessageCount((prev) => prev + 1);
    chat.sendMessage({ text });
  }, [input, chat]);

  // Send a specific text message (used by suggestion chips and confirm buttons).
  const handleSendMessage = useCallback(
    (text: string) => {
      setMessageCount((prev) => prev + 1);
      chat.sendMessage({ text });
    },
    [chat],
  );

  // Confirmation button handlers inject a message into the chat.
  const handleConfirm = useCallback(() => {
    setMessageCount((prev) => prev + 1);
    chat.sendMessage({ text: "Yes, proceed." });
  }, [chat]);

  const handleReject = useCallback(() => {
    setMessageCount((prev) => prev + 1);
    chat.sendMessage({ text: "No, cancel." });
  }, [chat]);

  // Choice button handler - sends the selected option as a chat message.
  const handleChoiceSelect = useCallback(
    (text: string) => {
      setMessageCount((prev) => prev + 1);
      chat.sendMessage({ text });
    },
    [chat],
  );

  // Switching users clears the conversation and panel.
  const handleUserChange = useCallback(
    (newUserId: DemoUserId) => {
      setUserId(newUserId);
      setInput("");
      setMessageCount(0);
      resetPanel();
      processedToolCalls.current.clear();
    },
    [resetPanel],
  );

  // Track which tool results we've already processed to avoid duplicates.
  const processedToolCalls = useRef(new Set<string>());

  // Watch chat messages for UI intent tool results.
  // When a UI intent tool completes, push its output to the panel store.
  useEffect(() => {
    const messages = chat.messages;
    if (messages.length === 0) return;

    // Scan all assistant messages (not just the last one) for new tool results.
    // This handles the case where multiple tool calls complete in one turn.
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;

      for (const part of msg.parts) {
        // Tool parts arrive as "tool-{toolName}" (e.g. "tool-showTable").
        // Match the same broad filter used in message-bubble.tsx.
        if (part.type !== "dynamic-tool" && !part.type.startsWith("tool-")) continue;

        const toolPart = part as ToolPartShape;

        // Extract tool name: prefer explicit toolName, fall back to type prefix.
        const toolName = toolPart.toolName ?? toolPart.type.replace("tool-", "");

        // Only process UI intent tools
        if (!UI_INTENT_TOOLS.has(toolName)) continue;

        // Inline tools (e.g. presentChoices) render in the chat bubble,
        // not in the panel. Skip panel dispatch for these.
        if (isInlineTool(toolName)) continue;

        // Skip if already processed
        if (processedToolCalls.current.has(toolPart.toolCallId)) continue;

        // Handle completed tool results
        if (toolPart.state === "output-available" && toolPart.output) {
          const output = toolPart.output as Record<string, unknown>;

          // Check if the tool returned an error
          if ("error" in output && typeof output.error === "string") {
            usePanelStore.getState().showError(toolName, output.error);
          } else {
            // Validate output against Zod schema before sending to store.
            // Tool output crosses a network boundary (SDK serialization),
            // so we treat it as untrusted and validate at consumption.
            const parsed = PanelContentSchema.safeParse(output);
            if (parsed.success) {
              switch (parsed.data.type) {
                case "detail":
                  usePanelStore.getState().showDetail(parsed.data);
                  break;
                case "table":
                  usePanelStore.getState().showTable(parsed.data);
                  break;
                case "diagram":
                  usePanelStore.getState().showDiagram(parsed.data);
                  break;
                case "audit":
                  usePanelStore.getState().showAudit(parsed.data);
                  break;
              }
            } else {
              usePanelStore.getState().showError(
                toolName,
                "Received malformed panel data from tool",
              );
            }
          }
          processedToolCalls.current.add(toolPart.toolCallId);
        }

        // Handle tool errors
        if (toolPart.state === "output-error" && toolPart.errorText) {
          usePanelStore.getState().showError(toolName, toolPart.errorText);
          processedToolCalls.current.add(toolPart.toolCallId);
        }
      }
    }
  }, [chat.messages]);

  // Ref to the composer textarea for Cmd+K focus shortcut
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Global keyboard shortcuts (Cmd+K focus, Cmd+\ toggle, Escape close)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+K - focus composer
      if (mod && e.key === "k") {
        e.preventDefault();
        composerRef.current?.focus();
      }

      // Cmd/Ctrl+\ - toggle panel (R2: works both directions now)
      if (mod && e.key === "\\") {
        e.preventDefault();
        const { isOpen, close, reopen } = usePanelStore.getState();
        if (isOpen) close();
        else reopen();
      }

      // Escape - close panel (R3: was missing, now implemented)
      if (e.key === "Escape") {
        const { isOpen, close } = usePanelStore.getState();
        if (isOpen) {
          e.preventDefault();
          close();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Chat is not ready to accept input while streaming or submitting.
  const isBusy = chat.status === "streaming" || chat.status === "submitted";

  return (
    <div className="flex h-dvh bg-background">
      {/* Chat column - adds right padding when panel overlays on desktop */}
      <div
        className="flex flex-col flex-1 min-w-0 transition-all duration-200 ease-out"
        style={isDesktop && isPanelOpen ? { paddingRight: panelWidth } : undefined}
      >
        {/* Top bar - transparent, blends into page background (no distinct surface) */}
        <header className="flex items-center justify-between h-12 px-5 border-b border-border/40">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-text-muted tracking-[0.04em] uppercase">
            <PokeballIcon size={16} />
            POKEDEX
          </span>
          <UserPicker selectedUserId={userId} onUserChange={handleUserChange} />
        </header>

        {/* Message list */}
        <MessageList
          messages={chat.messages}
          status={chat.status}
          onConfirm={handleConfirm}
          onReject={handleReject}
          onChoiceSelect={handleChoiceSelect}
          onSendMessage={handleSendMessage}
          selectedUserId={userId}
        />

        {/* Session limit warning - shows when approaching the demo message cap */}
        {messageCount >= DEMO_WARNING_THRESHOLD && messageCount < DEMO_SESSION_LIMIT && (
          <div className="px-6 py-2 bg-amber-50 border-t border-amber-200">
            <p className="text-sm text-amber-700 max-w-3xl mx-auto">
              You have {DEMO_SESSION_LIMIT - messageCount} demo messages remaining.
            </p>
          </div>
        )}

        {/* Error display */}
        {chat.error && (
          <div className="px-6 py-2 bg-danger/10 border-t border-danger/20">
            <p className="text-sm text-danger max-w-3xl mx-auto">
              {chat.error.message?.includes("demo limit") ||
              chat.error.message?.includes("demo capacity")
                ? chat.error.message
                : chat.error.message?.includes("429")
                  ? "Too many requests. Please wait a moment."
                  : chat.error.message?.match(/fetch|network|ECONNREFUSED/i)
                    ? "Connection issue. Check your network."
                    : "Something went wrong. Please try again."}
            </p>
          </div>
        )}

        {/* Composer - pinned to bottom, same max-w as message column */}
        <div className="w-full px-5 pb-5 pt-2">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              input={input}
              onInputChange={setInput}
              onSend={handleSend}
              isDisabled={isBusy}
              composerRef={composerRef}
            />
          </div>
        </div>
      </div>

      {/* Context panel - slides in from right, controlled by AI tools */}
      <ContextPanel notifyChat={notifyChat} />
    </div>
  );
}
