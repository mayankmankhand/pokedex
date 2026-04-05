// Chat composer with elevated card design.
// Enter sends the message, Shift+Enter adds a newline.
// Disabled while the AI is streaming a response.

"use client";

import { useRef, useEffect, useState, type KeyboardEvent, type FormEvent } from "react";
import { Paperclip, ArrowUp } from "lucide-react";
import { PokeballIcon } from "@/components/pokeball-icon";

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isDisabled: boolean;
  composerRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function ChatInput({
  input,
  onInputChange,
  onSend,
  isDisabled,
  composerRef,
}: ChatInputProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  // Use external ref if provided, otherwise use internal
  const textareaRef = composerRef ?? internalRef;

  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac/.test(navigator.platform));
  }, []);

  // Auto-focus the textarea on mount.
  useEffect(() => {
    textareaRef.current?.focus();
  }, [textareaRef]);

  // Re-focus after the AI finishes responding.
  useEffect(() => {
    if (!isDisabled) {
      textareaRef.current?.focus();
    }
  }, [isDisabled, textareaRef]);

  // Auto-resize the textarea to fit content (up to ~6 lines).
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [input, textareaRef]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isDisabled) {
        onSend();
      }
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (input.trim() && !isDisabled) {
      onSend();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-surface-elevated border-2 border-border
                 shadow
                 px-4 pt-3 pb-2.5 flex flex-col gap-2"
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What will you do?"
        disabled={isDisabled}
        rows={1}
        className="flex-1 resize-none bg-transparent
                   min-h-[44px] max-h-[200px]
                   text-[15px] text-text placeholder:text-text-subtle
                   focus:outline-none
                   disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Chat message input"
      />
      <div className="flex items-center justify-between">
        {/* Attach button - non-functional in V1, visual only */}
        <button
          type="button"
          disabled
          className="flex-shrink-0 w-[32px] h-[32px] rounded-lg
                     flex items-center justify-center
                     text-text-muted
                     disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Attach file (coming soon)"
          title="Attach file (coming soon)"
        >
          <Paperclip size={16} />
        </button>

        <div className="flex items-center gap-2">
          {/* Cmd+K keyboard hint - visual only, shortcut already works */}
          <span className="text-[11px] text-text-subtle hidden sm:inline">
            <kbd className="px-2 py-0.5 rounded-md bg-surface text-text-muted font-mono text-[10px] border border-border shadow-[inset_0_-1px_0_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.3)] active:scale-95">{isMac ? "⌘K" : "Ctrl+K"}</kbd>
            {" "}to focus
          </span>

          <button
            type="submit"
            disabled={isDisabled || !input.trim()}
            className="flex-shrink-0 w-[34px] h-[34px] rounded-full
                       flex items-center justify-center
                       transition-opacity duration-150
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white
                       disabled:opacity-30 disabled:cursor-not-allowed
                       cursor-pointer"
            aria-label="Send message"
          >
            {/* Pokeball with arrow overlay for send affordance */}
            <span style={{ position: "relative", display: "inline-flex" }}>
              <PokeballIcon size={34} />
              <ArrowUp
                size={14}
                strokeWidth={2.5}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  color: "var(--color-border)",
                  pointerEvents: "none",
                }}
                aria-hidden="true"
              />
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}
