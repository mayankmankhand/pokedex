# UX Review Task

Be thorough but concise.

**Use this when:** Evaluating user experience quality - usability, accessibility, user flows, and how the UI feels to use.
**Don't use this when:** Testing a running web application in a browser (/review-browser). Reviewing code quality (/review-code), reviewing command prompts (/review-commands), checking plan completion (/review-plan), or doing a pre-release check (/review-full).

**Important:** This command reviews artifacts - code, markup, specs, and screenshots. It does not evaluate a running application. When live interaction would be needed for a complete assessment, state that as a limitation in the summary.

## CRITICAL RULES
<rules>
1. **REPORT ONLY** - Do NOT make any changes or edits to files
2. **Wait for approval** - Only fix things after I say "fix it"
3. **Explain simply** - I'm a PM learning to code, use plain English
</rules>

## How to Review
<procedure>
Read the UI-related files (components, templates, styles, markup). Then pick one of two modes:

**Small change** (1-2 files, minor UI tweak): Review in a single pass. No sub-agents needed.

**Bigger change** (3+ files or new user-facing feature): Run four focused sub-agents in parallel using the Agent tool, then combine their results:

| Sub-agent | What it checks |
|-----------|----------------|
| **Usability** | Nielsen's heuristics - feedback, user control, error prevention, consistent language |
| **Accessibility** | WCAG AA - keyboard navigation, contrast, focus indicators, semantic HTML, screen-reader support |
| **User Flows** | Happy path completeness, error states, destructive action confirmations, empty states |
| **Research** | Web search for how leading products handle similar UX patterns (max 2 searches, focus on established design systems like Material, Apple HIG, GOV.UK) |

The Research sub-agent should keep findings lightweight and evidence-linked. Clearly separate research-backed findings from heuristic findings. If search results are weak, move on - research should not block the review.

Each sub-agent should use the severity scale and Finding ID format below. If a sub-agent has no findings, it should report "No issues found" so the user knows it ran.
</procedure>

## Severity Levels
<reference>
- 🚫 **Block** - Users will get stuck, lose data, or be unable to complete a key task. Must fix.
- ⚠️ **Warn** - Usability pain point that will frustrate users or exclude some. Should fix.
- 💡 **Suggest** - Polish item. Improves experience but users can work around it.

<!-- Shared block - keep in sync with other review-*.md files -->
**Severity anchors (apply to all review types):**
These categories have minimum severity floors - never downgrade them:
- Exposed secrets, insecure auth, or injection risks = always at least **Warn**, usually **Block**
- Data loss or irreversible user harm without safeguards = always at least **Warn**
- Accessibility failures blocking keyboard/screen-reader on primary tasks = always at least **Warn**
- Committed requirements plainly unmet = always at least **Warn**

**UX review weighting:**
- Accessibility violations that block primary tasks = lean toward **Block**
- Missing error states or destructive actions without confirmation = lean toward **Warn**
- Visual polish and minor consistency issues = lean toward **Suggest**
</reference>

## Finding IDs

<reference>
Every finding gets a unique ID: **R1**, **R2**, **R3**, etc. This lets the user say "fix R2 and R5" to approve specific fixes. When combining results from sub-agents, renumber all findings into a single R1, R2, R3 sequence.
</reference>

## Output Format
<output_format>
### Top Issues (scannable summary)
```
🚫 2 Blocks: R1 (file:line - one-line description), R3 (file:line - one-line description)
⚠️ 1 Warn: R2 (file:line - one-line description)
💡 1 Suggest: R4 (file:line - one-line description)
```

### ✅ Looks Good
- [What's working well - 2-3 items]

### 🔍 Findings

- **R1** 🚫 `file:line` - [Issue description in plain English]
  - **Why:** [Why this matters]
  - **Fix direction:** [What to change - not the exact code, just the approach]

- **R2** ⚠️ `file:line` - [Issue description]
  - **Why:** [Why this matters]
  - **Fix direction:** [Approach]
</output_format>

### 🏗️ Staff Designer Check
<guidelines>
After the standard review, step back and evaluate as a staff designer:
- **Coherent experience?** - Does the UI tell a clear story, or does it feel like disconnected pieces?
- **User confidence** - Will the user feel in control, or will they hesitate before acting?
- **Edge cases handled?** - Empty states, loading, errors, first-time use - are they covered?
- **What would you push back on?** - What would a senior designer flag before shipping?
</guidelines>

### 📊 Summary
- Files reviewed: X
- Blocks: X | Warns: X | Suggests: X

<rules>
## REMEMBER: Report issues only. Do NOT edit any files until I approve.
</rules>
