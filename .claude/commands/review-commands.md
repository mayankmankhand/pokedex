# Slash Command Review Task

Be thorough but concise.

**Use this when:** Reviewing slash command prompts (.claude/commands/*.md) - prompt quality, workflow completeness, cross-command consistency.
**Don't use this when:** Reviewing application code (/review-code), testing a running web app (/review-browser), checking plan completion (/review-plan), evaluating end-user UX (/review-ux), or doing a pre-release check (/review-full).

## CRITICAL RULES
<rules>
1. **REPORT ONLY** - Do NOT make any changes or edits to files
2. **Wait for approval** - Only fix things after I say "fix it"
3. **Explain simply** - I'm a PM learning to code, use plain English
</rules>

## How to Review
<procedure>
Read the command files being reviewed. Then pick one of two modes:

**Small change** (1-2 files, minor wording tweaks): Review in a single pass. No sub-agents needed.

**Bigger change** (3+ files or new/rewritten commands): Run four focused sub-agents in parallel using the Agent tool, then combine their results:

| Sub-agent | What it checks |
|-----------|----------------|
| **Prompt Engineering** | Clarity of instructions, ambiguities, conflicting directives, missing examples |
| **Cross-command Consistency** | Terminology alignment, structure, formatting, prerequisite references across commands |
| **Workflow Completeness** | Missing steps, dead ends, assumption gaps, output usability, failure modes |
| **Workflow Ergonomics** | Cognitive load, progress visibility, mistake recovery, non-technical accessibility |

Each sub-agent should use the severity scale and Finding ID format below. If a sub-agent has no findings, it should report "No issues found" so the user knows it ran.
</procedure>

## Severity Levels
<reference>
- 🚫 **Block** - Command will produce wrong or broken output. Must fix before using.
- ⚠️ **Warn** - Command works but has gaps that will cause confusion or missed issues.
- 💡 **Suggest** - Nice to have. Improves clarity or workflow but not urgent.

<!-- Shared block - keep in sync with other review-*.md files -->
**Severity anchors (apply to all review types):**
These categories have minimum severity floors - never downgrade them:
- Exposed secrets, insecure auth, or injection risks = always at least **Warn**, usually **Block**
- Data loss or irreversible user harm without safeguards = always at least **Warn**
- Accessibility failures blocking keyboard/screen-reader on primary tasks = always at least **Warn**
- Committed requirements plainly unmet = always at least **Warn**

**Command review weighting:**
- Conflicting or ambiguous instructions that will mislead the AI = lean toward **Block**
- Missing steps in a workflow = lean toward **Warn**
- Wording improvements or formatting polish = lean toward **Suggest**
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
After the standard review, step back and evaluate as a staff PM focused on operational clarity:
- **Can a non-technical user follow this?** - Is the workflow clear without engineering knowledge?
- **Workflow reliability** - Are there points where the user could get stuck or confused?
- **Handoff quality** - Does each command's output feed cleanly into the next step?
- **What would you push back on?** - What would an experienced PM flag before shipping these commands?
</guidelines>

### 📊 Summary
- Commands reviewed: X
- Blocks: X | Warns: X | Suggests: X

<rules>
## REMEMBER: Report issues only. Do NOT edit any files until I approve.
</rules>
