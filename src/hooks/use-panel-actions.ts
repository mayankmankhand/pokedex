// Hook for panel-to-chat communication.
// Provides notifyChat() to inject system notes into the chat transcript
// without triggering an LLM response (uses setMessages, not sendMessage).
// If the chat is busy (streaming/submitted), queues the notification
// and injects it once the status returns to "ready".

"use client";

import { useCallback, useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import type { ChatStatus } from "ai";

interface UsePanelActionsOptions {
  messages: UIMessage[];
  setMessages: (
    messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
  ) => void;
  status: ChatStatus;
}

/**
 * Returns a `notifyChat` function that injects a system note into the chat
 * transcript. The note appears as an assistant message with the format
 * `[System Note: <message>]` so the LLM can see what the user did in the panel.
 *
 * If the chat is currently streaming or submitted, the notification is queued
 * and injected once the status returns to "ready".
 */
export function usePanelActions({
  messages,
  setMessages,
  status,
}: UsePanelActionsOptions) {
  // Queue holds one pending notification (latest wins if multiple arrive while busy).
  const pendingRef = useRef<string | null>(null);

  // Flush any pending notification once the chat becomes idle.
  useEffect(() => {
    if (status !== "ready" || pendingRef.current === null) return;

    const text = pendingRef.current;
    pendingRef.current = null;

    setMessages((prev) => [
      ...prev,
      buildSystemNote(text),
    ]);
  }, [status, setMessages]);

  const notifyChat = useCallback(
    (message: string) => {
      if (status === "streaming" || status === "submitted") {
        // Chat is busy - queue for later.
        pendingRef.current = message;
        return;
      }

      // Chat is idle - inject immediately.
      setMessages((prev) => [
        ...prev,
        buildSystemNote(message),
      ]);
    },
    [status, setMessages],
  );

  return { notifyChat };
}

/** Build a UIMessage that the LLM sees as a system note. */
function buildSystemNote(text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    parts: [{ type: "text", text: `[System Note: ${text}]` }],
  };
}
