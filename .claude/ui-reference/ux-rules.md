# UX Guidelines Reference

<!-- Attribution: Curated by UI/UX Pro Max Skill. Licensed under MIT. -->

Production UX rules for building accessible, usable interfaces. Sorted by severity.

---

## CRITICAL

### `color-contrast`

**Category:** Accessibility
**Severity:** CRITICAL

Maintain minimum 4.5:1 contrast ratio between text and background (WCAG AA).

- **Do:** Test all text/background combinations with a contrast checker. Use 7:1 for AAA compliance.
- **Don't:** Place light gray text on white backgrounds or rely on brand colors without verifying contrast.

---

### `alt-text`

**Category:** Accessibility
**Severity:** CRITICAL

Provide descriptive alt text for all meaningful images.

- **Do:** Write alt text that conveys the image's purpose (e.g., "Bar chart showing Q3 revenue growth of 12%").
- **Don't:** Use "image" or "photo" as alt text. Leave alt attributes empty on informational images.

---

### `focus-states`

**Category:** Accessibility
**Severity:** CRITICAL

All interactive elements must have a visible focus indicator for keyboard navigation.

- **Do:** Use a 2px solid outline with sufficient contrast. Ensure focus order follows visual layout.
- **Don't:** Set `outline: none` without providing an alternative focus style.

---

### `touch-targets`

**Category:** Accessibility
**Severity:** CRITICAL

Interactive elements must be at least 44x44px on touch devices.

- **Do:** Use padding to increase tap area even if the visible element is smaller. Space targets at least 8px apart.
- **Don't:** Place small links or buttons close together without adequate spacing.

---

### `aria-labels`

**Category:** Accessibility
**Severity:** CRITICAL

Icon-only buttons and links must have accessible labels.

- **Do:** Add `aria-label` to icon-only buttons (e.g., `aria-label="Close dialog"`). Use `aria-labelledby` when a visible label exists elsewhere.
- **Don't:** Rely on tooltip hover text as the only label. Screen readers cannot access tooltips reliably.

---

## HIGH

### `font-size-minimum`

**Category:** Typography
**Severity:** HIGH

Body text must be at least 16px on mobile devices.

- **Do:** Set base font size to 16px. Use relative units (rem) so users can scale text.
- **Don't:** Use 12px or 14px body text on mobile. Avoid fixed pixel sizes that prevent browser zoom.

---

### `line-height`

**Category:** Typography
**Severity:** HIGH

Body text line height should be 1.5 to 1.75 for readability.

- **Do:** Use `line-height: 1.6` for body text. Tighten to 1.2-1.3 for headings.
- **Don't:** Use `line-height: 1.0` or leave it at browser default for long-form content.

---

### `line-length`

**Category:** Typography
**Severity:** HIGH

Limit line length to 65-75 characters for comfortable reading.

- **Do:** Use `max-width` on text containers (e.g., `max-width: 65ch`). Center the content block on wide screens.
- **Don't:** Let text span the full width of a 1440px+ viewport.

---

### `no-horizontal-scroll`

**Category:** Layout
**Severity:** HIGH

Pages must not scroll horizontally on any supported viewport.

- **Do:** Ensure no element exceeds viewport width. Use `max-width: 100%` on images, `box-sizing: border-box` globally, and test at 320px width minimum.
- **Don't:** Use fixed-width elements wider than the viewport. Avoid `100vw` (it includes scrollbar width). Avoid `overflow-x: hidden` on the body - it masks layout bugs instead of fixing them.

---

### `loading-states`

**Category:** Interaction
**Severity:** HIGH

Show loading feedback for any operation taking more than 300ms.

- **Do:** Use skeleton screens for content-heavy pages. Use spinners for discrete actions. Show progress bars for uploads.
- **Don't:** Leave the screen blank or frozen during data fetching.

---

### `error-placement`

**Category:** Interaction
**Severity:** HIGH

Display error messages near the element that caused the problem.

- **Do:** Show inline validation errors directly below the input field. Use `aria-describedby` to link errors to inputs.
- **Don't:** Show errors only at the top of the page. Avoid generic "Something went wrong" without context.

---

### `form-labels`

**Category:** Accessibility
**Severity:** HIGH

Every form input must have a visible, associated label.

- **Do:** Use `<label>` elements with `htmlFor` pointing to the input ID. Place labels above or to the left of inputs.
- **Don't:** Use placeholder text as the only label. Placeholders disappear when users start typing.

---

### `color-not-only-indicator`

**Category:** Accessibility
**Severity:** HIGH

Never use color as the sole means of conveying information.

- **Do:** Combine color with icons, text, or patterns (e.g., red text plus an error icon plus the word "Error").
- **Don't:** Use only red/green to indicate valid/invalid states. Colorblind users cannot distinguish them.

---

## MEDIUM

### `cursor-pointer`

**Category:** Interaction
**Severity:** MEDIUM

All clickable elements should show a pointer cursor on hover.

- **Do:** Apply `cursor: pointer` to buttons, links, and custom clickable elements.
- **Don't:** Leave clickable `<div>` or `<span>` elements with the default cursor.

---

### `consistent-spacing`

**Category:** Layout
**Severity:** MEDIUM

Use a consistent spacing scale throughout the interface.

- **Do:** Define a spacing scale (e.g., 4, 8, 12, 16, 24, 32, 48, 64px) and use only those values.
- **Don't:** Mix arbitrary values like 13px, 17px, 22px. Inconsistent spacing makes a UI feel unpolished.

---

### `responsive-breakpoints`

**Category:** Layout
**Severity:** MEDIUM

Design for standard breakpoints and test at each one.

- **Do:** Use breakpoints at 640px (mobile), 768px (tablet), 1024px (laptop), 1280px (desktop). Test at 320px minimum.
- **Don't:** Only test at your own screen size. Avoid breakpoints that create awkward in-between states.

---

### `animation-duration`

**Category:** Animation
**Severity:** MEDIUM

Keep UI animations between 150ms and 300ms.

- **Do:** Use 150ms for hover/focus transitions. Use 200-300ms for modals and page transitions. Respect `prefers-reduced-motion`.
- **Don't:** Use animations longer than 500ms for UI interactions. Avoid animations that block user input.

---

### `disable-during-async`

**Category:** Interaction
**Severity:** MEDIUM

Disable buttons during asynchronous operations to prevent duplicate submissions.

- **Do:** Set `disabled` and show a spinner or "Submitting..." text. Re-enable on success or failure.
- **Don't:** Allow multiple clicks on a submit button while a request is in flight.

---

### `no-emoji-icons`

**Category:** Layout
**Severity:** MEDIUM

Use SVG icons instead of emoji for UI elements.

- **Do:** Use an icon library (Lucide, Heroicons, Phosphor) with consistent sizing and stroke width.
- **Don't:** Use emoji as functional icons. They render differently across platforms and are not styleable.

---

### `consistent-icon-sizing`

**Category:** Layout
**Severity:** MEDIUM

All icons within the same context should use the same dimensions.

- **Do:** Define icon size tokens (e.g., 16px inline, 20px buttons, 24px navigation). Apply consistently.
- **Don't:** Mix 14px, 18px, and 22px icons in the same toolbar or navigation bar.
