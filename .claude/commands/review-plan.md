# Plan Compliance Review Task

Did we build what we said we'd build? Compares implementation against plan/spec.

**Use this when:** Checking if implementation matches a plan file in `.claude/plans/` - feature completeness, scope drift, quality gates.
**Don't use this when:** Reviewing code quality (/review-code), testing a running web app (/review-browser), reviewing command prompts (/review-commands), evaluating end-user UX (/review-ux), or doing a pre-release check (/review-full).

## CRITICAL RULES
<rules>
1. **REPORT ONLY** - Do NOT make any changes or edits to files
2. **Wait for approval** - Only fix things after I say "fix it"
3. **Explain simply** - I'm a PM learning to code, use plain English
</rules>

## How to Review
<procedure>
First, find the plan file to review against. Auto-detect the most recently modified `PLAN-*.md` file in `.claude/plans/` (also check the project root for legacy plan files). If no plan file exists, pause and ask the user: "I couldn't find a plan file. Which file should I compare against, or would /review-code be more appropriate?" If multiple plan files exist and the most recent one is not clearly complete (all tasks checked off), pause and ask the user: "Which plan file should I evaluate against?"

Read the plan file, then read the implementation files. Compare them. Pick one of two modes:

**Small change** (1-2 plan tasks, few files): Review in a single pass. No sub-agents needed.

**Bigger change** (3+ plan tasks or significant scope): Run four focused sub-agents in parallel using the Agent tool, then combine their results:

| Sub-agent | What it checks |
|-----------|----------------|
| **Feature Completeness** | Every plan task implemented? Subtasks done? Placeholders remaining? |
| **Spec Compliance** | Implementation matches UI/UX Design section and critical decisions in plan? |
| **Scope Management** | Unplanned additions? Cuts justified and documented? Scope creep? |
| **Quality Gates** | Success criteria met? Tests written? Docs updated? |

Each sub-agent should use the severity scale and Finding ID format below. If a sub-agent has no findings, it should report "No issues found" so the user knows it ran.
</procedure>

## Severity Levels
<reference>
- 🚫 **Block** - A planned requirement is missing or wrong. Must fix before marking plan complete.
- ⚠️ **Warn** - Partial implementation or undocumented deviation from plan.
- 💡 **Suggest** - Minor gap or improvement opportunity beyond plan scope.

<!-- Shared block - keep in sync with other review-*.md files -->
**Severity anchors (apply to all review types):**
These categories have minimum severity floors - never downgrade them:
- Exposed secrets, insecure auth, or injection risks = always at least **Warn**, usually **Block**
- Data loss or irreversible user harm without safeguards = always at least **Warn**
- Accessibility failures blocking keyboard/screen-reader on primary tasks = always at least **Warn**
- Committed requirements plainly unmet = always at least **Warn**

**Plan review weighting:**
- Plan task marked done but not actually implemented = lean toward **Block**
- Undocumented scope changes or cuts = lean toward **Warn**
- Minor deviations that improve on the plan = lean toward **Suggest**
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

### 🏗️ Staff PM Check
<guidelines>
After the standard review, step back and evaluate as a staff PM focused on scope and delivery:
- **Scope discipline** - Did we build exactly what was planned, or did scope creep in?
- **Acceptance completeness** - Would a stakeholder accept this as "done" based on the plan?
- **Traceability** - Can you trace each plan task to its implementation?
- **Delivery risk** - What's most likely to cause a "wait, this isn't what I asked for" moment?
</guidelines>

### 📊 Summary
- Plan file: [filename]
- Plan tasks checked: X
- Blocks: X | Warns: X | Suggests: X

<rules>
## REMEMBER: Report issues only. Do NOT edit any files until I approve.
</rules>
