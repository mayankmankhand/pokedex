# Code Review Task

Be thorough but concise.

**Use this when:** Reviewing code changes - bug fixes, new features, refactors, scripts.
**Don't use this when:** Testing a running web app (/review-browser), reviewing slash command prompts (/review-commands), checking plan completion (/review-plan), evaluating UX (/review-ux), or doing a pre-release check (/review-full).

## CRITICAL RULES
<rules>
1. **REPORT ONLY** - Do NOT make any changes or edits to files
2. **Wait for approval** - Only fix things after I say "fix it"
3. **Explain simply** - I'm a PM learning to code, use plain English
</rules>

## How to Review
<procedure>
Read the changed files. Then pick one of two modes:

**Small change** (1-2 files): Review in a single pass. No sub-agents needed.

**Bigger change** (3+ files or significant logic): Run four focused sub-agents in parallel using the Agent tool, then combine their results:

| Sub-agent | What it checks |
|-----------|----------------|
| **Security** | Auth checks, input validation, secrets exposure, injection risks |
| **Code Quality** | Naming, duplication, complexity, pattern consistency |
| **Logic** | Edge cases, off-by-ones, missing error handling, wrong assumptions |
| **Performance & Maintainability** | O(n) issues, memory usage, tech debt, maintainability concerns |

Each sub-agent should use the severity scale and Finding ID format below. If a sub-agent has no findings, it should report "No issues found" so the user knows it ran.
</procedure>

## Severity Levels
<reference>
- 🚫 **Block** - Will break the app. Must fix before merging.
- ⚠️ **Warn** - Should fix before shipping. Risk of bugs or tech debt.
- 💡 **Suggest** - Nice to have. Improves quality but not urgent.

<!-- Shared block - keep in sync with other review-*.md files -->
**Severity anchors (apply to all review types):**
These categories have minimum severity floors - never downgrade them:
- Exposed secrets, insecure auth, or injection risks = always at least **Warn**, usually **Block**
- Data loss or irreversible user harm without safeguards = always at least **Warn**
- Accessibility failures blocking keyboard/screen-reader on primary tasks = always at least **Warn**
- Committed requirements plainly unmet = always at least **Warn**

**Code review weighting:**
- Security vulnerabilities and data-loss risks = lean toward **Block**
- Performance issues in hot paths = lean toward **Warn**
- Style and naming = lean toward **Suggest** unless it harms readability
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

### 🏗️ Staff Engineer Check
<guidelines>
After the standard review, step back and evaluate as a staff engineer:
- **Right approach?** - Is the overall design sound, not just the code?
- **Shortcuts to clean up?** - Anything that works now but needs fixing before production?
- **What would you push back on?** - What would a senior engineer flag before merging?
</guidelines>

### 📊 Summary
- Files reviewed: X
- Blocks: X | Warns: X | Suggests: X

<rules>
## REMEMBER: Report issues only. Do NOT edit any files until I approve.
</rules>
