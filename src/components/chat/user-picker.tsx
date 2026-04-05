// Demo user picker - trainer card dropdown.
// Replaces native <select> with a custom dropdown to display
// trainer sprites and team affiliation (Phase 3, Issue #10).
// Uses the WAI-ARIA listbox popup pattern: button trigger + listbox.
// Switching users clears the chat history (fresh conversation).

"use client";

import { useState, useRef, useEffect, useCallback, useId, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { DEMO_USERS, DEMO_TEAMS } from "@/lib/demo-users";
import { TrainerSprite } from "@/components/sprites";

export type DemoUserId = (typeof DEMO_USERS)[number]["id"];
export const DEFAULT_USER_ID = DEMO_USERS[0].id;

// Resolve team name from teamId for display in the dropdown.
const teamsById = new Map(DEMO_TEAMS.map((t) => [t.id, t.name]));

interface UserPickerProps {
  selectedUserId: DemoUserId;
  onUserChange: (userId: DemoUserId) => void;
}

export function UserPicker({ selectedUserId, onUserChange }: UserPickerProps) {
  const selectedUser = DEMO_USERS.find((u) => u.id === selectedUserId);
  const [isOpen, setIsOpen] = useState(false);
  // Index of the currently highlighted option (for keyboard navigation).
  const [activeIndex, setActiveIndex] = useState(() =>
    DEMO_USERS.findIndex((u) => u.id === selectedUserId),
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Tracks typeahead characters typed in quick succession.
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Unique ID prefix for ARIA references (safe for multiple instances).
  const idPrefix = useId();
  const listboxId = `${idPrefix}-listbox`;
  const labelId = `${idPrefix}-label`;
  const activeOptionId = `${idPrefix}-option-${activeIndex}`;

  // Sync activeIndex when selection changes externally.
  useEffect(() => {
    const idx = DEMO_USERS.findIndex((u) => u.id === selectedUserId);
    if (idx >= 0) setActiveIndex(idx);
  }, [selectedUserId]);

  // Clean up typeahead timer on unmount.
  useEffect(() => {
    return () => clearTimeout(typeaheadTimerRef.current);
  }, []);

  // Click-outside-to-close and focus-out-to-close
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    // Close dropdown when focus leaves the component (e.g., Tab away).
    function handleFocusOut(e: FocusEvent) {
      const related = e.relatedTarget as Node | null;
      if (
        related &&
        !triggerRef.current?.contains(related) &&
        !listRef.current?.contains(related)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("focusout", handleFocusOut, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("focusout", handleFocusOut, true);
    };
  }, [isOpen]);

  // Focus the listbox when it opens so keyboard events work immediately.
  useEffect(() => {
    if (isOpen) {
      listRef.current?.focus();
    }
  }, [isOpen]);

  // Scroll the active option into view when it changes.
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.children[activeIndex] as HTMLElement | undefined;
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const selectUser = useCallback(
    (index: number) => {
      const user = DEMO_USERS[index];
      if (user) {
        onUserChange(user.id as DemoUserId);
        setIsOpen(false);
        // Return focus to the trigger button after selection.
        triggerRef.current?.focus();
      }
    },
    [onUserChange],
  );

  // First-letter typeahead: typing a letter jumps to the next user whose name
  // starts with that letter. Consecutive keystrokes within 500ms are combined.
  const handleTypeahead = useCallback(
    (char: string) => {
      clearTimeout(typeaheadTimerRef.current);
      typeaheadRef.current += char.toLowerCase();

      const search = typeaheadRef.current;
      const startFrom = typeaheadRef.current.length === 1 ? activeIndex + 1 : activeIndex;
      // Search forward from current position, wrapping around.
      for (let i = 0; i < DEMO_USERS.length; i++) {
        const idx = (startFrom + i) % DEMO_USERS.length;
        if (DEMO_USERS[idx].name.toLowerCase().startsWith(search)) {
          setActiveIndex(idx);
          break;
        }
      }

      typeaheadTimerRef.current = setTimeout(() => {
        typeaheadRef.current = "";
      }, 500);
    },
    [activeIndex],
  );

  function handleTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(true);
    }
  }

  function handleListKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % DEMO_USERS.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + DEMO_USERS.length) % DEMO_USERS.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        selectUser(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(DEMO_USERS.length - 1);
        break;
      default:
        // Single printable character triggers typeahead.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handleTypeahead(e.key);
        }
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label id={labelId} className="text-xs text-text-muted whitespace-nowrap">
        Signed in as
      </label>
      <div className="relative">
        {/* Trigger button - listbox popup pattern (no role="combobox") */}
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-labelledby={labelId}
          onClick={() => setIsOpen((prev) => !prev)}
          onKeyDown={handleTriggerKeyDown}
          className="flex items-center gap-2 bg-transparent border-none rounded-lg
                     pl-2 pr-7 py-1.5 text-sm text-text
                     hover:bg-surface
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
                     cursor-pointer transition-colors duration-150"
        >
          {selectedUser && (
            <TrainerSprite
              spriteId={selectedUser.spriteId}
              size={18}
              className="flex-shrink-0"
              style={{ color: selectedUser.accentColor }}
            />
          )}
          <span className="truncate">{selectedUser?.name ?? "Select user"}</span>
        </button>

        {/* Dropdown arrow overlay */}
        <ChevronDown
          size={14}
          className={`absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none
                      transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
        />

        {/* Dropdown listbox */}
        {isOpen && (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            aria-activedescendant={activeOptionId}
            onKeyDown={handleListKeyDown}
            tabIndex={0}
            className="absolute top-full right-0 sm:left-0 sm:right-auto mt-1 z-50
                       w-64 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto
                       bg-surface-elevated border-2 border-border rounded-xl
                       shadow-lg py-1
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          >
            {DEMO_USERS.map((user, index) => {
              const isActive = index === activeIndex;
              const isSelected = user.id === selectedUserId;
              const teamName = teamsById.get(user.teamId) ?? "Unknown";

              return (
                <li
                  key={user.id}
                  id={`${idPrefix}-option-${index}`}
                  role="option"
                  aria-selected={isSelected ? "true" : "false"}
                  onClick={() => selectUser(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer
                              transition-colors duration-75
                              ${isActive ? "bg-surface-hover" : ""}
                              ${isSelected && !isActive ? "border-l-2 border-l-primary" : ""}
                              ${isSelected ? "font-semibold" : ""}`}
                >
                  {/* Trainer sprite with character accent color */}
                  <span
                    className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-hover
                               flex items-center justify-center border border-border-subtle"
                    style={{ color: user.accentColor }}
                  >
                    <TrainerSprite spriteId={user.spriteId} size={20} />
                  </span>

                  {/* Name and team */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-text truncate">{user.name}</div>
                    <div className="text-[11px] text-text-muted truncate">{teamName}</div>
                  </div>

                  {/* Selected check */}
                  {isSelected && (
                    <span className="text-primary text-xs flex-shrink-0" aria-hidden="true">
                      &#10003;
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Screen reader announcement of current user */}
        {selectedUser && (
          <span className="sr-only">
            Currently logged in as {selectedUser.name}
          </span>
        )}
      </div>
    </div>
  );
}
