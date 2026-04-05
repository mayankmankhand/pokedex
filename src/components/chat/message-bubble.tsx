// Renders a single chat message row.
// Assistant messages sit directly on background (no card). User messages in cool gray bubble.
// See docs/design/plm-redesign-spec-v3.md Section 6.1 for design rules.

"use client";

import { memo } from "react";
import type { UIMessage } from "ai";
import type { ToolPartShape } from "@/types/panel";
import ReactMarkdown from "react-markdown";
import { ToolIndicator, ToolGroup } from "./tool-indicator";
import { ConfirmButtons } from "./confirm-buttons";
import { ChoiceButtons } from "./choice-buttons";
import { ThinkingIndicator } from "./thinking-indicator";
import { getUserById } from "@/lib/demo-users";
import { TrainerSprite } from "@/components/sprites";

// Prefix and suffix for system notes injected by panel actions.
// These are assistant messages that log UI mutations (e.g. edits, approvals)
// without triggering an LLM response. Rendered as muted centered text.
const SYSTEM_NOTE_PREFIX = "[System Note: ";
const SYSTEM_NOTE_SUFFIX = "]";

// Keywords that signal the AI is asking for confirmation.
// Used to show accept/reject buttons on the message.
const CONFIRM_KEYWORDS = [
  "do you want to proceed",
  "shall i proceed",
  "would you like to proceed",
  "confirm",
  "are you sure",
  "go ahead",
  "do you want me to",
  "shall i go ahead",
  "would you like me to",
];

interface MessageBubbleProps {
  message: UIMessage;
  isStreaming: boolean;
  showConfirmButtons: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onChoiceSelect: (text: string) => void;
  /** Force choice buttons into a specific state (superseded, answered). */
  choiceForceState?: "superseded" | "answered";
  /** Current demo user ID - used to show trainer sprite on user messages. */
  selectedUserId?: string;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming,
  showConfirmButtons,
  onConfirm,
  onReject,
  onChoiceSelect,
  choiceForceState,
  selectedUserId,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  // Resolve the demo user for avatar display on user messages.
  const demoUser = isUser && selectedUserId ? getUserById(selectedUserId) : undefined;

  // Extract text content and tool parts from the message.
  const textParts = message.parts.filter((p) => p.type === "text");
  const toolParts = message.parts.filter(
    (p) => p.type === "dynamic-tool" || p.type.startsWith("tool-"),
  );

  // Combine all text parts into one string for rendering.
  const fullText = textParts.map((p) => p.text).join("");

  // System notes are assistant messages injected by panel actions (not the LLM).
  // Render them as muted, centered, inline notifications instead of chat bubbles.
  if (
    !isUser &&
    fullText.startsWith(SYSTEM_NOTE_PREFIX) &&
    fullText.endsWith(SYSTEM_NOTE_SUFFIX)
  ) {
    const noteText = fullText.slice(
      SYSTEM_NOTE_PREFIX.length,
      -SYSTEM_NOTE_SUFFIX.length,
    );
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs italic text-text-muted">
          {noteText}
        </span>
      </div>
    );
  }

  // Check if any tools are still executing (for thinking indicator).
  // Tool parts start as "input-streaming"/"input-available" then become "output-available"/"output-error".
  const hasRunningTools =
    toolParts.length > 0 &&
    toolParts.some((p) => {
      const state = (p as ToolPartShape).state;
      return state === "input-streaming" || state === "input-available";
    });

  // Detect presentChoices tool call and extract choices from input args.
  // The tool result is a context string (not a payload), so we read from input.
  const choicesToolPart = !isUser
    ? toolParts.find((p) => {
        const tp = p as ToolPartShape & { toolName?: string; input?: unknown };
        const name = tp.toolName ?? tp.type.replace("tool-", "");
        return name === "presentChoices" && tp.state !== "input-streaming";
      })
    : undefined;

  const choicesInput = choicesToolPart
    ? (choicesToolPart as ToolPartShape & { input?: { question?: string; choices?: string[] } }).input
    : undefined;

  const hasChoicesTool = Boolean(choicesInput?.choices?.length);

  // Check if this message is asking for confirmation (only for assistant).
  // Gate on !isStreaming so buttons appear after the full explanation is visible (#59).
  // Suppress keyword-based confirm box when presentChoices is in the same message.
  // The structured choices replace the generic Yes/No for multi-option questions.
  const isAskingConfirmation =
    !isUser &&
    !isStreaming &&
    showConfirmButtons &&
    !hasChoicesTool &&
    CONFIRM_KEYWORDS.some((kw) => fullText.toLowerCase().includes(kw));

  return (
    <div className={isUser ? "flex justify-end items-end gap-2" : ""}>
      <div className={isUser ? "max-w-[85%]" : "w-full"}>
        {/* Tool call indicators - vertical stack, grouped when multiple */}
        {toolParts.length > 0 && (
          <div className="mb-2">
            <ToolGroup count={toolParts.length}>
              {toolParts.map((part) => {
                const toolPart = part as ToolPartShape;
                const toolName =
                  toolPart.toolName ?? toolPart.type.replace("tool-", "");
                return (
                  <ToolIndicator
                    key={toolPart.toolCallId}
                    toolName={toolName}
                    state={toolPart.state}
                    output={toolPart.output}
                  />
                );
              })}
            </ToolGroup>
            {/* Show cycling PLM phrases while tools are running (#56). */}
            {hasRunningTools && <ThinkingIndicator />}
          </div>
        )}

        {/* Message content */}
        {fullText && (
          <div
            className={
              isUser
                ? "rounded-xl rounded-br-sm px-4 py-2.5 bg-surface-hover border-2 border-border text-text"
                : ""
            }
          >
            {isUser ? (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                {fullText}
              </p>
            ) : (
              <div className="chat-markdown">
                <ReactMarkdown skipHtml={true}>{fullText}</ReactMarkdown>
              </div>
            )}

            {/* Streaming indicator - three-dot CSS pulse animation */}
            {isStreaming && !isUser && (
              <div className="streaming-indicator flex items-center mt-1">
                <span className="streaming-pokeballs">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="sr-only">Assistant is typing...</span>
              </div>
            )}
          </div>
        )}

        {/* Confirmation buttons */}
        {isAskingConfirmation && (
          <ConfirmButtons onConfirm={onConfirm} onReject={onReject} />
        )}

        {/* Multi-choice buttons (from presentChoices tool) */}
        {hasChoicesTool && choicesInput?.choices && !isStreaming && (
          <ChoiceButtons
            choices={choicesInput.choices}
            onSelect={onChoiceSelect}
            forceState={choiceForceState}
          />
        )}
      </div>

      {/* Trainer avatar next to user messages (Phase 3) */}
      {isUser && demoUser && (
        <span
          className="flex-shrink-0 w-7 h-7 rounded-full bg-surface
                     flex items-center justify-center border border-border-subtle mb-0.5"
          style={{ color: demoUser.accentColor }}
        >
          <TrainerSprite spriteId={demoUser.spriteId} size={16} />
        </span>
      )}
    </div>
  );
});
