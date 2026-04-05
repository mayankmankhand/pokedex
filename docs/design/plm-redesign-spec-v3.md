> **Note:** This spec describes the Slate+Teal palette from the original redesign. The app now uses the Pokemon Indigo League theme (see CLAUDE.md for current design tokens). This document is kept for historical reference.

---

# PLM Assistant: UI Redesign Spec v3

**Audience:** Development team. Pokedex hardware PLM tool with AI chat + context panel.
**Objective:** Fix four visual bugs, replace the beige palette with a cool neutral identity distinct from Claude, and introduce new UX interaction rules modeled on Claude's patterns without copying its look.
**Design philosophy:** Same *experience* as Claude (transparent assistant messages, centered composer, panel slide-in, suggestion chips). Different *identity* (cool slate palette, teal accent, sans-serif throughout, subtle glassmorphism on surfaces).

---

## 1. Bug Fixes (Immediate)

### 1.1 White Bar on Top

**Root cause:** The header uses `bg-white` or `bg-surface-elevated`, creating a harsh stripe against the page background.

**Fix:** Remove the visible header bar entirely as a distinct surface. Instead, float the title and user picker directly on the page background.

| Element | Style |
|---------|-------|
| Container | `bg-transparent`, no shadow, no border. Optional: `border-b border-border/40` for a hairline separator. |
| "PLM Assistant" title | `text-sm font-medium text-text-muted tracking-wide`. Small, understated. Not a hero heading. |
| User picker | Ghost button style: `bg-transparent hover:bg-surface rounded-lg px-3 py-1.5 text-sm`. No visible border until hover. |
| Height | Compact. `h-12` max. Feels like part of the page, not a toolbar. |

**UX pattern source:** Claude has no visually distinct header bar. The model selector and controls sit flat on the page background.

### 1.2 Robot Icons on the Left Edge

**Root cause:** Sidebar navigation icons (small icons on the far left) appear to be leftover placeholders or a collapsed sidebar.

**Fix:** Remove completely. This is a single-view chat app. There is no multi-page navigation to represent. If you need a logo mark, place a small monogram ("PLM" in a pill, or a small gear icon) inline in the header area, flush left.

### 1.3 Transparent Table Background in the Panel

**Root cause:** The table component inherits the panel's surface color with no distinct container, making it feel like it's floating without definition.

**Fix (with the new palette from Section 3):**

- Wrap the entire table in a container: `bg-white/80 backdrop-blur-sm rounded-xl border border-border shadow-sm overflow-hidden`
- Table header row: `bg-surface text-xs font-semibold uppercase tracking-wider text-text-muted`
- Table body rows: `bg-transparent` (white shows through the container), `hover:bg-surface-hover transition-colors`
- The `overflow-hidden` on the wrapper clips the rounded corners against the header

The subtle `backdrop-blur-sm` and `bg-white/80` give the table a frosted-glass feel that is visually distinct from Claude's flat surfaces.

### 1.4 Chat Input Field Misaligned

**Root cause:** The composer textarea is not inheriting the `max-w-3xl mx-auto` constraint that the message column uses. It sits at the full width of the chat panel.

**Fix:** The composer must share the same centering and max-width as the message list.

```
<div class="flex flex-col h-dvh">
  {/* Transparent header */}
  <header class="h-12 px-4 flex items-center justify-between">
    ...
  </header>

  {/* Scrollable messages */}
  <main class="flex-1 overflow-y-auto">
    <div class="max-w-3xl mx-auto px-4 py-6">
      {messages}
    </div>
  </main>

  {/* Composer, pinned to bottom, same centering */}
  <div class="w-full px-4 pb-5 pt-2">
    <div class="max-w-3xl mx-auto">
      <div class="rounded-2xl bg-white border border-border
                  shadow-[0_2px_12px_rgba(0,0,0,0.06)]
                  p-3 flex flex-col gap-2">
        <textarea ... />
        <div class="flex items-center justify-between">
          {/* Left: attachment button */}
          {/* Right: send button */}
        </div>
      </div>
    </div>
  </div>
</div>
```

**Key rules:**
- `max-w-3xl mx-auto` on both the message column and the composer wrapper
- When the panel opens and the chat column compresses, both compress together
- Bottom padding `pb-5` so the composer breathes away from the viewport edge
- Composer gets a visible but soft border (`border-border`) and a light shadow
- Send button: `bg-primary text-white rounded-lg px-3 py-1.5` positioned bottom-right inside the composer
- Textarea: `min-h-[44px] max-h-[200px]` with auto-resize
- Placeholder: "Ask about requirements, tests, or traceability..." in `text-text-muted`

---

## 2. Design Identity: "Slate + Teal"

### 2.1 Concept

Claude uses warm terracotta on cream. Your app should feel different: **cool, precise, and engineered**. Think of it as the difference between a leather notebook (Claude) and a well-lit lab bench (PLM Assistant).

The identity is built on three pillars:

1. **Cool slate neutrals** for backgrounds and surfaces. Not cold blue-gray (too corporate), not warm beige (that's what we're escaping). A true neutral gray with just a whisper of blue undertone.
2. **Teal as the primary accent.** Teal reads as "technical confidence" without being generic blue. It's distinctive, it works at every size (buttons, badges, focus rings, links), and it contrasts well against slate.
3. **Subtle glass/frost effects** on elevated surfaces. Where Claude uses flat white cards, the PLM Assistant uses `backdrop-blur` and semi-transparent whites. This adds depth without visual weight and feels modern without being gimmicky.

### 2.2 What We Borrow from Claude (UX, Not UI)

| Claude UX pattern | PLM adaptation |
|---|---|
| Assistant messages sit directly on page background, no card | Same. No wrapper card. Text on background. |
| User messages in a muted bubble, right-aligned | Same positioning. Different bubble color (cool gray, not warm taupe). |
| Centered chat column at `max-w-3xl` | Same. |
| Composer is a white card with shadow, centered | Same layout. Different shadow and border treatment. |
| Panel slides in from the right | Same animation pattern. Different surface treatment (frosted glass). |
| Suggestion chips on empty state, no icons | Same. Different chip styling. |
| Focus rings only on keyboard nav (`focus-visible`) | Same. Teal rings instead of blue. |
| Serif font for assistant responses | **Different.** We use sans-serif throughout. Identity distinction. |

---

## 3. Color Palette

### 3.1 Core Tokens

| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--color-background` | `#F4F5F7` | 220 14% 96% | Page background. Cool off-white. |
| `--color-surface` | `#EBEDF0` | 220 12% 93% | Cards, panel body, grouped sections. |
| `--color-surface-elevated` | `#FFFFFF` | 0 0% 100% | Composer, dropdowns, table body. |
| `--color-surface-hover` | `#E2E4E9` | 222 12% 90% | Table row hover, interactive states. |
| `--color-surface-glass` | `rgba(255,255,255,0.75)` | n/a | Frosted panels, elevated overlays. Pair with `backdrop-blur-sm`. |
| `--color-primary` | `#0D9488` | 175 84% 32% | Buttons, CTAs, active states. Teal-600. |
| `--color-primary-hover` | `#0F766E` | 175 83% 26% | Button hover. Teal-700. |
| `--color-primary-subtle` | `#CCFBF1` | 167 85% 89% | Light teal tint for badges, highlights. Teal-100. |
| `--color-accent` | `#6366F1` | 239 84% 67% | Secondary accent for special states. Indigo-500. Sparingly used. |
| `--color-text` | `#1E293B` | 215 25% 17% | Primary text. Slate-800. |
| `--color-text-muted` | `#64748B` | 215 16% 47% | Secondary text, labels, timestamps. Slate-500. |
| `--color-text-subtle` | `#94A3B8` | 215 16% 65% | Placeholders, disabled text. Slate-400. |
| `--color-border` | `#CBD5E1` | 213 27% 84% | Borders, dividers. Slate-300. |
| `--color-border-subtle` | `#E2E8F0` | 214 32% 91% | Lighter borders for subtle separation. Slate-200. |
| `--color-danger` | `#DC2626` | 0 72% 51% | Errors, failed badges, destructive actions. |
| `--color-success` | `#16A34A` | 142 72% 36% | Passed, approved, tool completion. |
| `--color-warning` | `#D97706` | 38 92% 44% | Blocked, draft states. Amber-600. |

### 3.2 Why This Works

- **Not Claude.** Claude is warm cream + terracotta. This is cool slate + teal. Completely different visual identity.
- **Not generic corporate blue.** Teal is distinct. It reads as "technical precision" rather than "enterprise SaaS blue."
- **Not dark mode.** The `#F4F5F7` background is still clearly light. Engineers working in bright environments (offices, labs) need a light UI. Dark mode can come later.
- **Professional gravity.** The slate neutrals convey seriousness appropriate for a PLM tool managing product requirements and test cases. This is engineering software, not a consumer app.
- **The indigo accent** (`#6366F1`) is reserved for rare special states (diagram nodes, selected items, maybe a focus mode indicator). It creates visual interest without competing with teal.

### 3.3 StatusBadge Colors (Updated for Slate + Teal)

All badges use inline hex values, component-local, to avoid Tailwind class bloat. All pass WCAG AA.

| Status | Background | Text | Border | Style |
|--------|-----------|------|--------|-------|
| DRAFT | `#FEF3C7` | `#92400E` | none | Filled, amber tint |
| APPROVED | `#D1FAE5` | `#065F46` | none | Filled, green tint |
| CANCELED | `#F1F5F9` | `#64748B` | none | Filled, slate tint, dimmed |
| PENDING | `transparent` | `#64748B` | `#CBD5E1` | Outlined, hollow |
| PASSED | `#D1FAE5` | `#065F46` | none | Filled, green tint |
| FAILED | `#FEE2E2` | `#991B1B` | none | Filled, red tint |
| ACTIVE | `#CCFBF1` | `#0F766E` | none | Filled, teal tint |
| BLOCKED | `#FFEDD5` | `#9A3412` | none | Filled, orange tint |
| SKIPPED | `#F1F5F9` | `#475569` | none | Filled, slate tint |

---

## 4. Typography

### 4.1 Decision: All Sans-Serif

Claude uses serif for assistant messages. We deliberately do not. This is the clearest visual differentiator. The PLM Assistant is an engineering tool, and monospace/sans-serif feels right for precision work.

| Role | Font | Weight | Size |
|------|------|--------|------|
| UI chrome (labels, nav, buttons) | `"DM Sans", system-ui, sans-serif` | 400, 500, 600 | Varies |
| Assistant messages | `"DM Sans"` | 400 | 15px (slightly larger for readability) |
| User messages | `"DM Sans"` | 400 | 15px |
| Code blocks in chat | `"JetBrains Mono", monospace` | 400 | 13px |
| Panel headings | `"DM Sans"` | 600 | 14px |
| Table headers | `"DM Sans"` | 600 | 11px, uppercase, `tracking-wider` |
| Status badges | `"DM Sans"` | 500 | 11px |

### 4.2 Why DM Sans

- Not Inter (Claude, every AI tool). Not Roboto (Google). Not system fonts (generic).
- DM Sans has geometric clarity that feels engineered and precise.
- Excellent readability at small sizes (important for tables, badges, panel content).
- Free on Google Fonts. Load weights 400, 500, 600.
- Pairs well with JetBrains Mono for code, which engineers already know and like.

---

## 5. Surface and Shadow System

### 5.1 Surface Hierarchy

Three levels of visual elevation, using the frosted-glass effect as the signature look:

| Level | Usage | Style |
|-------|-------|-------|
| **Ground** | Page background | `bg-background` (#F4F5F7), no effects |
| **Surface** | Panel body, section groups | `bg-surface` (#EBEDF0), no blur |
| **Elevated** | Composer, dropdowns, table wrapper, modals | `bg-white/75 backdrop-blur-sm border border-border-subtle` |

The frosted-glass elevated surfaces are the key visual signature. They're subtle (75% opacity white, not a heavy blur), but they create a layered depth that flat white cards don't have. This is what makes the app feel distinct from Claude's flat surfaces.

### 5.2 Shadow Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)` | Cards, badges, subtle lift |
| `--shadow` | `0 2px 12px rgba(0,0,0,0.06)` | Composer, dropdowns |
| `--shadow-lg` | `0 8px 30px rgba(0,0,0,0.10)` | Modals, mobile overlay panel |

Shadows are cooler toned (pure black at low opacity, no warm cast). This matches the slate palette.

### 5.3 Focus Ring System

All interactive elements: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`

Teal focus rings instead of Claude's blue. The `ring-offset` color matches the local background:

| Context | ring-offset |
|---------|------------|
| On page background | `ring-offset-[#F4F5F7]` |
| On surface | `ring-offset-[#EBEDF0]` |
| On white/elevated | `ring-offset-white` |

---

## 6. Interaction Rules (Claude UX, Distinct UI)

### 6.1 Message Rendering

**Assistant messages:**
- No card wrapper. Text sits directly on `bg-background`.
- Left-aligned at the start of the `max-w-3xl` column.
- `.chat-markdown` styling: `text-[15px] leading-relaxed text-text`. Links in `text-primary underline`. Code blocks in `bg-surface rounded-lg p-3 font-mono text-[13px]`.
- No avatar/icon next to the message. Clean left edge. (Claude doesn't use an avatar either.)

**User messages:**
- Right-aligned bubble.
- Background: `#E2E4E9` (surface-hover, a cool mid-gray). Not the primary color, not warm taupe.
- Text: `text-text` (#1E293B).
- Shape: `rounded-2xl px-4 py-2.5 max-w-[85%]`.
- This creates a clear visual contrast: cool gray bubbles (user) against the slightly lighter page background.

**Streaming indicator:**
- Three-dot pulse animation, using the primary teal color at varying opacities.
- `min-h-[24px]` to prevent layout shift.
- CSS-only animation (no JS timers).

### 6.2 Tool Call Indicators

Richer than the current pill-based approach. Each tool call gets its own row, stacked vertically.

**Layout per tool:**
```
[status icon]  [descriptive label]                   [elapsed time]
```

**States:**

| State | Icon | Icon color | Label style |
|-------|------|-----------|-------------|
| Running | Animated spinner (CSS) | `text-primary` (teal) | "Looking up requirement PR-001..." in `text-text-muted text-sm` |
| Completed | Checkmark circle | `text-success` | "Retrieved PR-001" in `text-text-muted text-sm` |
| Error | Alert triangle | `text-danger` | "Failed to retrieve PR-001" in `text-danger text-sm` |

**Expandable:** Clicking a completed tool indicator toggles a detail panel (raw JSON result) below it. Collapsed by default. Container: `bg-surface rounded-lg p-3 text-xs font-mono mt-1`.

**Grouping:** When the AI calls multiple tools in sequence, group them under a collapsible header: "Used 3 tools" with a chevron to expand/collapse the full list. This prevents long tool chains from dominating the chat.

### 6.3 Context Panel

**Panel container:**
- Default width: `540px` on desktop (up from 480px to fit 4-column tables comfortably).
- Min width: `360px`. Max width: `800px`.
- **Resizable via drag handle.** A 6px invisible handle on the panel's left edge. On hover it highlights with a teal tint. Dragging left makes the panel wider, dragging right makes it narrower. The chat column flexes to fill remaining space.
- Background: `bg-surface-glass backdrop-blur-sm` (frosted glass, the signature look).
- Border: `border-l border-border`.
- Slide-in: `transform transition-all duration-250 ease-[cubic-bezier(0.165,0.85,0.45,1)]` with an opacity fade alongside. Transition is disabled during active drag resize to prevent jank.
- The panel remembers its last dragged width within the session (JS variable). When closed and reopened, it returns to that width.

**Resize handle implementation:**
```css
.panel-resize-handle {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  transition: background 0.15s;
}
.panel-resize-handle:hover,
.panel-resize-handle.active {
  background: var(--color-primary);
  opacity: 0.35;
  border-radius: 3px;
}
```

The JS listens for `mousedown` on the handle, then `mousemove` on `document` to compute the new width (start width + delta, clamped to min/max). On `mouseup`, re-enable the CSS transition. During drag, set `body.style.cursor = 'col-resize'` and `user-select: none` to prevent text selection.

**Panel header:**
- Background: `bg-transparent` (sits on the frosted panel surface, no separate bar).
- Layout: content type badge (e.g., "Table") in a small pill (`bg-primary-subtle text-primary text-xs font-medium px-2 py-0.5 rounded-full`), then the title, then the X close button flush right.
- Close button: `hover:bg-surface-hover rounded-lg p-1.5 transition-colors`.

**Table view improvements (overflow fix, v3):**

The core problem: a 4-column table with monospace IDs, long titles, status badges, and a meta column doesn't fit in 480px (or even 540px) without clipping. Three layers of defense:

1. **Wider default panel** (540px instead of 480px) gives ~60px more breathing room immediately.

2. **`table-layout: fixed` with column width hints via `<colgroup>`.**
   - ID columns: `68px` fixed. Enough for "PR-010" or "TC-009" in monospace.
   - Status columns: `90px` fixed. Enough for the widest badge ("CANCELED").
   - Meta columns (team, req ref): `85px` fixed.
   - Title column: `width: auto`, takes all remaining space.
   - Title cells use `white-space: normal; word-break: break-word;` so long titles wrap to two lines instead of pushing the table wider.
   - All other cells use `white-space: nowrap` to stay compact.

3. **Horizontal scroll as fallback.** The table sits inside a scroll container:
   ```css
   .panel-table-scroll {
     overflow-x: auto;
     -webkit-overflow-scrolling: touch;
   }
   ```
   The table has `min-width: 420px` so even at minimum panel width (360px), the table is scrollable rather than crushed.

These three layers work together: the wider panel + fixed layout handles 90% of cases. Word-wrap on titles handles edge cases with very long names. Horizontal scroll handles the extreme case where the panel is dragged narrow.

**Additional table styling:**
- Wrap in `bg-white/80 backdrop-blur-sm rounded-xl border border-border-subtle shadow-sm overflow-hidden`.
- Sticky header: `sticky top-0 z-10 bg-surface/95 backdrop-blur-sm`.
- Cell padding: `px-3.5 py-2.5` (slightly tighter than v2 to fit more content).
- Row hover: `hover:bg-surface-hover transition-colors`.
- Footer: "Showing 10 of 47" in `text-xs text-text-muted py-2 px-4 border-t border-border-subtle`.
- A subtle horizontal scrollbar appears only when needed (thin, styled to match the theme).

**Detail view improvements:**
- Group fields into labeled sections: `text-[11px] uppercase tracking-widest font-semibold text-text-muted mb-2`.
- Two-column grid for short key-value pairs: `grid grid-cols-2 gap-x-6 gap-y-2`.
- Related entity pills: `inline-flex px-2.5 py-1 rounded-md bg-surface text-sm text-text hover:bg-surface-hover cursor-pointer transition-colors`. Clicking sends a message to the chat (e.g., "Show me test case TC-003").

**Diagram view:**
- Zoom controls: `+` and `-` buttons in the panel header, controlling a CSS `transform: scale()`.
- Background: subtle dot grid pattern on the diagram container (`bg-[radial-gradient(circle,#CBD5E1_1px,transparent_1px)] bg-[length:20px_20px]`). This gives the diagram a "canvas" feel, like a whiteboard.
- "Copy source" button for the Mermaid text.

**Audit view:**
- Timeline layout: vertical line on the left, event dots.
- Each entry: timestamp (relative, e.g., "2 hours ago"), user name, action badge, expandable change diff.

### 6.4 Confirmation Actions

When the AI asks for confirmation before a destructive/mutation action:

- Wrap in a container: `bg-surface rounded-xl p-4 border border-border-subtle`.
- Include: plain-text description of what will happen, two buttons side by side.
- Accept button: `bg-primary text-white rounded-lg px-4 py-2 font-medium hover:bg-primary-hover`.
- Reject button: `bg-transparent border border-border text-text-muted rounded-lg px-4 py-2 font-medium hover:bg-surface-hover`.
- After resolution: container collapses to a one-liner: `[checkmark] PR-001 approved by Alice, 2:34 PM` or `[x] Action canceled` in `text-sm text-text-muted`.

### 6.5 Empty State

Centered in the `max-w-3xl` column, vertically centered (or near top-third) in the message area.

- Heading: "What would you like to work on?" in `text-2xl font-semibold text-text`.
- Subheading: "Ask about requirements, test cases, or traceability." in `text-base text-text-muted mt-2`.
- Suggestion chips below, wrapped in a `flex flex-wrap gap-2 mt-6 justify-center`.
- Chip style: `px-4 py-2 rounded-full border border-border text-sm text-text hover:bg-surface-hover hover:border-primary/30 cursor-pointer transition-all`.
- Example chips: "Show all requirements", "What's untested?", "Scanner traceability diagram", "Recent audit log".
- No icons. No oversized graphics. Just clean text.

### 6.6 Scroll Behavior

- Auto-scroll to bottom on new assistant message, but only if user is within 200px of the bottom.
- If user has scrolled up, show a floating pill at the bottom center: "New message ↓" in `bg-primary text-white rounded-full px-4 py-1.5 text-sm shadow-lg cursor-pointer`. Clicking scrolls to bottom.
- Panel scrolls independently from chat. Panel header is sticky.

### 6.7 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Escape` | Close panel |
| `Cmd/Ctrl+K` | Focus composer |
| `Cmd/Ctrl+\` | Toggle panel |

### 6.8 Loading and Transition States

**Page load:** Show the empty state immediately. No spinner.

**Message streaming:** Streaming indicator appears instantly after send. No artificial delay.

**Panel content:** Show skeleton loader (3 shimmer bars) while content loads. Transition to real content with a 150ms fade.

**Panel slide-in:** 250ms with the cubic-bezier ease. Opacity fades from 0 to 1 alongside the transform.

---

## 7. CSS Architecture

### 7.1 Theme Block (globals.css)

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap');

@theme {
  --color-background: #F4F5F7;
  --color-surface: #EBEDF0;
  --color-surface-elevated: #FFFFFF;
  --color-surface-hover: #E2E4E9;
  --color-surface-glass: rgba(255, 255, 255, 0.75);
  --color-primary: #0D9488;
  --color-primary-hover: #0F766E;
  --color-primary-subtle: #CCFBF1;
  --color-accent: #6366F1;
  --color-text: #1E293B;
  --color-text-muted: #64748B;
  --color-text-subtle: #94A3B8;
  --color-border: #CBD5E1;
  --color-border-subtle: #E2E8F0;
  --color-danger: #DC2626;
  --color-success: #16A34A;
  --color-warning: #D97706;
}

html {
  font-family: 'DM Sans', system-ui, sans-serif;
}

.chat-markdown {
  font-size: 15px;
  line-height: 1.7;
  color: var(--color-text);
}

.chat-markdown a {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.chat-markdown code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  background: var(--color-surface);
  padding: 2px 6px;
  border-radius: 4px;
}

.chat-markdown pre {
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 7.2 Streaming Indicator CSS

```css
.streaming-dots span {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  margin: 0 2px;
  animation: dot-pulse 1.4s infinite ease-in-out both;
}
.streaming-dots span:nth-child(1) { animation-delay: 0s; }
.streaming-dots span:nth-child(2) { animation-delay: 0.16s; }
.streaming-dots span:nth-child(3) { animation-delay: 0.32s; }

@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
```

### 7.3 Skeleton Loader CSS

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 8. Dark Mode (Future, Token-Ready)

The token system is designed for easy swapping. Reserve these values for when you're ready:

| Token | Light | Dark |
|-------|-------|------|
| background | `#F4F5F7` | `#0F172A` (Slate-900) |
| surface | `#EBEDF0` | `#1E293B` (Slate-800) |
| surface-elevated | `#FFFFFF` | `#334155` (Slate-700) |
| surface-hover | `#E2E4E9` | `#475569` (Slate-600) |
| text | `#1E293B` | `#F1F5F9` (Slate-100) |
| text-muted | `#64748B` | `#94A3B8` (Slate-400) |
| border | `#CBD5E1` | `#334155` (Slate-700) |
| primary | `#0D9488` | `#2DD4BF` (Teal-400, brighter for dark bg) |

---

## 9. Future Panel Content Types

The right panel currently supports: detail, table, diagram, error, audit.

**Reserved for future (add to the Zod union now, implement later):**

| Type | Description |
|------|-------------|
| `document` | Scrollable markdown preview of AI-generated content (test procedure drafts, requirement summaries). Uses `.chat-markdown` styles in the wider panel column. |
| `comparison` | Side-by-side diff of two entity versions. Split panel with green/red highlights. |
| `timeline` | Gantt-style horizontal timeline for requirement lifecycle milestones. |

The Zustand store should also support an array of panel items (tabs) rather than a single item, even if V1 only renders one at a time.

---

## 10. Implementation Checklist

### Phase 1: Bug Fixes (Day 1)

1. [ ] Remove sidebar robot icons
2. [ ] Restyle header: transparent bg, compact, no shadow
3. [ ] Fix composer: `max-w-3xl mx-auto`, matching message column
4. [ ] Fix composer padding and centering when panel is open/closed
5. [ ] Add white/frosted wrapper with rounded corners and border to table component
6. [ ] **[v3]** Increase default panel width from 480px to 540px
7. [ ] **[v3]** Add `table-layout: fixed` with `<colgroup>` column width hints to all panel tables
8. [ ] **[v3]** Wrap table in a `.panel-table-scroll` div with `overflow-x: auto`
9. [ ] **[v3]** Set title cells to `white-space: normal; word-break: break-word` (wrap instead of clip)
10. [ ] **[v3]** Set ID/status/meta cells to `white-space: nowrap` with fixed widths

### Phase 2: Palette + Typography (Day 1 to 2)

6. [ ] Replace all `@theme` tokens in globals.css with the Slate + Teal palette
7. [ ] Add Google Font imports for DM Sans and JetBrains Mono
8. [ ] Update `html` font-family to DM Sans
9. [ ] Update `.chat-markdown` styles (font-size, link color, code block styling)
10. [ ] Update StatusBadge inline hex values
11. [ ] Replace shadow values with the new token system
12. [ ] Grep for all old hex codes (#F8F0E3, #F0E9DC, #B45309, etc.) and replace
13. [ ] Verify WCAG AA contrast on all text/background combos
14. [ ] Update focus rings from `ring-accent` to `ring-primary` (teal)

### Phase 3: Message + Composer Styling (Day 2)

15. [ ] Remove card wrapper from assistant messages (transparent bg)
16. [ ] User message bubble: switch to cool gray (#E2E4E9)
17. [ ] Restyle composer: rounded-2xl, border, shadow, proper internal padding
18. [ ] Update streaming indicator to three-dot CSS animation
19. [ ] Update placeholder text

### Phase 4: Interaction Upgrades (Day 2 to 3)

20. [ ] Redesign empty state with heading + suggestion chips
21. [ ] Make suggestion chips functional (click sends message)
22. [ ] Rework tool indicators: vertical stack, grouped, expandable
23. [ ] Rework confirm/action containers with post-resolution collapse
24. [ ] Add "New message ↓" scroll pill
25. [ ] Add keyboard shortcuts (Cmd+K focus, Cmd+\ toggle panel)

### Phase 5: Panel Polish (Day 3)

26. [ ] Panel container: frosted glass (`bg-surface-glass backdrop-blur-sm`)
27. [ ] Panel header: transparent bg, type badge pill, breadcrumb title
28. [ ] Panel slide-in: updated easing curve + opacity fade
29. [ ] Table view: sticky header, row count footer, frosted wrapper
30. [ ] Detail view: sectioned groups, two-column grid, clickable entity pills
31. [ ] Diagram view: dot-grid background, zoom controls
32. [ ] Add skeleton loaders for panel content
33. [ ] Reserve `document`, `comparison`, `timeline` types in the Zod union
34. [ ] **[v3]** Add drag-to-resize handle on the panel's left edge (min 360px, max 800px)
35. [ ] **[v3]** Persist panel width in session (JS variable, reset on page reload is fine)
36. [ ] **[v3]** Style the horizontal scrollbar on tables to match theme (thin, subtle)

---

## 11. Quick Visual Comparison

| Aspect | Claude.ai | PLM Assistant (new) |
|--------|----------|-------------------|
| Background | Warm off-white (#F5F5F0) | Cool slate (#F4F5F7) |
| Primary accent | Terracotta (#AE5630) | Teal (#0D9488) |
| Assistant font | Serif (font-serif) | Sans-serif (DM Sans) |
| User bubble | Warm taupe (#DDD9CE) | Cool gray (#E2E4E9) |
| Elevated surfaces | Flat white | Frosted glass (white/75 + blur) |
| Focus rings | Blue | Teal |
| Shadow tone | Warm (rgba brown-ish) | Cool (pure black, low opacity) |
| Overall feel | Leather notebook, literary | Clean lab bench, engineered |

---

## 12. AI Self-Check: Verification Rules

These rules are for the AI (or any reviewer) to verify that every implementation matches this spec. Run through each section after completing the corresponding phase. A failing check means the code does not match the spec and must be fixed before moving on.

### 12.1 Palette Verification

Run these checks against `globals.css` (or wherever `@theme` tokens are defined):

- [ ] `--color-background` resolves to `#F4F5F7`. Not `#F8F0E3` (old beige), not `#F5F5F0` (Claude's cream), not `#FFFFFF` (pure white).
- [ ] `--color-primary` resolves to `#0D9488` (teal-600). Not `#B45309` (old amber), not `#AE5630` (Claude's terracotta), not any shade of blue.
- [ ] `--color-accent` resolves to `#6366F1` (indigo-500). This is the secondary accent, used sparingly. It must not appear on buttons or links.
- [ ] Run `grep -rn "#F8F0E3\|#F0E9DC\|#B45309\|#FAF9F7\|#FBF5EC"` across the codebase. **Zero results.** All old beige/amber hex codes must be fully replaced.
- [ ] Run `grep -rn "#AE5630\|#C4633A\|#DE7356\|#DDD9CE"` across the codebase. **Zero results.** No Claude brand colors should be present.
- [ ] Every `StatusBadge` uses inline hex values, not Tailwind palette classes. Verify by opening the component file and confirming no `bg-green-100` or `text-red-800` type classes exist. Only raw hex like `#D1FAE5` and `#065F46`.
- [ ] WCAG AA check: open the app, inspect `--color-text-muted` (#64748B) rendered on `--color-background` (#F4F5F7). Contrast ratio must be ≥ 4.5:1. Use browser DevTools or WebAIM.

### 12.2 Typography Verification

- [ ] Open the app in browser DevTools. Inspect `<html>` element. `font-family` computed value must start with `"DM Sans"`. Not `Inter`, not `Geist`, not system defaults.
- [ ] Inspect an assistant message. Computed `font-family` must be `"DM Sans"`. It must NOT be a serif font. This is a deliberate departure from Claude.
- [ ] Inspect a code block inside an assistant message. Computed `font-family` must start with `"JetBrains Mono"`.
- [ ] Inspect table header cells in the panel. Font weight must be 600 (semibold). Font size must be 11px. Text must be uppercase with letter-spacing > 0.
- [ ] No instance of `font-family: Inter` or `font-family: 'Geist'` should exist anywhere in the compiled CSS. Grep to confirm.

### 12.3 Layout and Alignment

- [ ] **Composer alignment test:** With the panel closed, the composer and the message list must share the same left and right edges. Measure by inspecting: both must have `max-width: 768px` (or `max-w-3xl` = 48rem) and `margin: 0 auto`.
- [ ] **Composer alignment with panel open:** Open the panel. The chat column compresses. Verify the composer compresses with it. The composer must not overflow or extend under the panel.
- [ ] **Header:** The top bar must have `background: transparent` or `background-color: transparent`. It must not have `background: white` or any box-shadow. Inspect to confirm.
- [ ] **No robot/sidebar icons:** Visually scan the left edge of the viewport. There should be zero floating icons, no collapsed sidebar, no navigation rail. If any icon exists on the far left that is not the "PLM Assistant" title text, it is a bug.
- [ ] **Message column:** Assistant messages must be left-aligned (no centering, no card wrapper). User messages must be right-aligned with a gray bubble. Visually verify the asymmetry.

### 12.4 Panel and Table Overflow

- [ ] **Default panel width:** Open the panel. Inspect the `.context-panel` element. Computed width must be `540px` (not 480px).
- [ ] **Table fits at default width:** Trigger "Show all requirements." All four columns (ID, Title, Status, Team) must be fully visible without horizontal scrolling. Title text may wrap to a second line, but no column should be clipped or hidden.
- [ ] **Title wrapping test:** Find the longest requirement title in the table. It must wrap to multiple lines within its cell. It must NOT force a horizontal scrollbar at 540px panel width.
- [ ] **ID column stays compact:** All `PR-xxx` and `TC-xxx` IDs must be on a single line, never wrapping. Monospace font. Verify with DevTools that these cells have `white-space: nowrap`.
- [ ] **Resize handle exists:** Hover over the left edge of the open panel. The cursor must change to `col-resize`. A teal-tinted highlight bar (6px wide) must appear.
- [ ] **Resize drag test:** Drag the handle left. Panel must widen smoothly (no jank, no transition animation during drag). Release. Panel stays at the new width.
- [ ] **Resize bounds:** Drag the panel to its narrowest. It must stop at 360px and not go smaller. Drag it to its widest. It must stop at 800px.
- [ ] **Horizontal scroll fallback:** Resize the panel to 360px (minimum). If any table content overflows, a horizontal scrollbar must appear inside the table wrapper. The scrollbar should be thin and subtle, not the OS default thick scrollbar.
- [ ] **Panel width persistence:** Resize the panel to 700px. Close it (X button or Escape). Reopen it (trigger any command that opens the panel). It must reopen at 700px, not reset to 540px.
- [ ] **`table-layout: fixed` enforcement:** Inspect the `<table>` inside the panel. Computed `table-layout` must be `fixed`. A `<colgroup>` with `<col>` elements must be present in the HTML.

### 12.5 Frosted Glass Surfaces

- [ ] **Panel background:** Inspect `.context-panel`. It must have `backdrop-filter: blur(12px)` (or similar) and a semi-transparent background (`rgba(255,255,255,0.72)` or close). Scroll the chat behind the open panel. The chat content must be visibly blurred through the panel surface, not opaque white.
- [ ] **Table wrapper:** Inspect `.panel-table-wrap`. It must have `backdrop-filter: blur(...)` and `background: rgba(255,255,255,0.8)`. Not a solid `#FFFFFF`.
- [ ] **Composer:** The composer must have a solid white background (not frosted). Verify `background-color` is `#FFFFFF` or `var(--surface-elevated)`. The composer is the one elevated surface that is intentionally opaque for readability while typing.

### 12.6 Interactive Behavior

- [ ] **Empty state:** Load the app fresh (no messages). The empty state must show: a heading ("What would you like to work on?"), a subheading, and 4+ suggestion chips. No icons, no images.
- [ ] **Chip click:** Click a suggestion chip. It must send that text as a user message and trigger a response. The empty state must disappear.
- [ ] **Streaming dots:** After sending a message, three animated dots must appear immediately (within one frame). They must be teal colored. They must not cause the message area to jump in height (min-height enforced).
- [ ] **Tool indicators:** When tools run, they must appear as vertical rows (not inline pills). Each row shows: icon, description text, elapsed time. The group must have a collapsible header ("Used N tools").
- [ ] **Tool group collapse:** Click the "Used N tools" header. The individual tool rows must hide. Click again. They must reappear.
- [ ] **Confirm block:** When the AI asks for confirmation, Accept and Reject buttons must appear inside a surface-colored container with a border. Accept must be teal (`bg-primary`). Reject must be a ghost button (transparent bg, border).
- [ ] **Confirm resolution:** Click Accept. The entire confirm block must collapse to a single line with a green checkmark and a timestamp. Click Reject in a different scenario. It must collapse to "Action canceled" with an X icon.
- [ ] **Keyboard: Cmd+K:** Press Cmd+K (or Ctrl+K). The composer textarea must receive focus. If focus was elsewhere (e.g., the page body), it must jump to the composer.
- [ ] **Keyboard: Escape:** Open the panel. Press Escape. The panel must close.
- [ ] **Keyboard: Cmd+\\:** Press Cmd+\\ (or Ctrl+\\). The panel must toggle open/closed.
- [ ] **Keyboard: Enter vs Shift+Enter:** Type text in the composer. Press Enter. The message must send. Type text, press Shift+Enter. A new line must appear in the composer. The message must not send.

### 12.7 Scroll Behavior

- [ ] **Auto-scroll:** Send a message while scrolled to the bottom. The message area must auto-scroll to show the new assistant response.
- [ ] **No forced scroll:** Scroll up to read older messages. Send a new message (or wait for a response). The message area must NOT auto-scroll. The user's scroll position must be preserved.
- [ ] **Scroll pill:** While scrolled up, if a new message arrives, a "New message ↓" pill must appear near the bottom of the message area. Clicking it must scroll to the latest message.
- [ ] **Panel independent scroll:** Scroll the panel body (e.g., a long table). The chat message area must NOT scroll. The two scroll contexts must be completely independent.
- [ ] **Panel header sticky:** Scroll the panel body. The panel header (type badge, title, close button) must stay fixed at the top. It must not scroll away.

### 12.8 Responsive and Edge Cases

- [ ] **Narrow viewport (≤1024px):** The panel must overlay as a drawer (position absolute, right 0) with a shadow, not sit side-by-side. The chat must remain full width underneath.
- [ ] **Backdrop on mobile overlay:** When the panel is open on narrow viewports, a semi-transparent backdrop must appear behind it. Tapping the backdrop should close the panel.
- [ ] **Extremely long message:** Send a message with 500+ characters. The user bubble must wrap text and not exceed `max-width: 85%` of the column.
- [ ] **Empty table:** If a query returns zero results, the table view must show a meaningful empty state (e.g., "No results found"), not a blank panel or a table with only headers.
- [ ] **Reduced motion:** Enable `prefers-reduced-motion: reduce` in OS settings or browser DevTools. All animations (streaming dots, panel slide, fade-ups) must be effectively instant (duration ≤ 0.01ms).

### 12.9 Accessibility

- [ ] **Focus rings:** Tab through interactive elements (buttons, chips, composer, panel close). Every focusable element must show a visible ring. The ring must be teal (`--color-primary`), not blue, not amber.
- [ ] **Ring offset:** Focus rings must have a `ring-offset` that matches their local background. A teal ring on the composer (white bg) must have a white offset. A teal ring on a chip (page bg) must have a `#F4F5F7` offset. No jarring white gaps.
- [ ] **Panel ARIA:** The context panel must have `role="complementary"`. The close button must have an accessible label (e.g., `aria-label="Close panel"` or a `title` attribute).
- [ ] **Icon buttons:** Every icon-only button (attach, send, close) must have a `title` or `aria-label`. Inspect each one.
- [ ] **Contrast on badges:** Inspect each StatusBadge variant. Every text color on its background must pass WCAG AA (4.5:1 for normal text, 3:1 for large text). Pay special attention to DRAFT (amber text on amber bg) and CANCELED (gray text on gray bg).

### 12.10 No-Go Rules (Things That Must NOT Exist)

These are guardrails. If any of these are true, the implementation has regressed.

- [ ] **No beige anywhere.** No hex value in the range `#F8xxxx` to `#FAxxxx` for backgrounds. No amber/brown primary colors.
- [ ] **No Claude brand colors.** No terracotta (#AE5630, #C4633A, #DE7356). No warm taupe (#DDD9CE). No cream (#F5F5F0 as a page background). The app must not look like a Claude clone.
- [ ] **No serif fonts on any UI element.** `font-serif` must not appear in any class applied to rendered elements. (It's acceptable in comments or documentation.)
- [ ] **No robot/AI avatar icons.** No emoji, no SVG robot, no Anthropic logo, no AI-themed iconography anywhere in the chat or header.
- [ ] **No visible header bar.** The header must blend into the page. If you can draw a clear horizontal rectangle of a different color at the top, it's a bug.
- [ ] **No `overflow: hidden` on the table wrapper** without a scroll container inside it. Tables must scroll, not clip.
- [ ] **No hardcoded 480px panel width.** All references to 480px in the codebase must be replaced with 540px (or a CSS variable).
- [ ] **No `white-space: nowrap` on title/description cells.** Only ID, status, and short metadata cells should be nowrap. Content cells must wrap.
- [ ] **No Tailwind color classes on StatusBadges.** No `bg-green-100`, `text-red-700`, etc. Only inline hex values.
- [ ] **No `box-shadow` on the header.** Zero shadow on the top bar.
- [ ] **No `Inter` in the font stack.** It must not be imported, referenced, or fallback-listed.
