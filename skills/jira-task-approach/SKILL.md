---
name: jira-task-approach
description: "Generate a level-aware approach document (unified plan + design). Adjust length to task size (L1/L2/L3). Triggers: jira-task approach, approach task, integrated design."
user-invocable: false
argument-hint: "<TASK-ID>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - mcp__atlassian__jira_get_issue
  - mcp__atlassian__jira_batch_create_issues
---

# jira-task-approach: Generate Approach Document (level-aware)

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Overview

Integrates the former `plan` + `design` two-step into one. Depth scales with task size (L1/L2/L3) — small tasks get 5 lines, not heavy design docs.

**Output**: `docs/approach/<TASK-ID>.approach.md` + Jira attachment when available. Jira comments disabled.

## Workflow

### Step 1: Load Context

**1a. Determine breakdown level** (L1/L2/L3):

Priority order:
1. `breakdownLevel` in `.jira-context.json` → use as-is if present
2. Issuetype fallback: `Subtask`/`Task`/`Bug` → L1 · `Story` → L2 · `Epic` → L3 · others → L1
3. Promotion check — upgrade to at least L2 if task touches any of: data model/schema change · transaction/atomic boundary · externally exposed API contract · concurrency/idempotence/ordering · security/privilege boundary

Notify user in one line: `📐 Approach level: L2 (issuetype Story fallback)` or `📐 L2 (Task but schema change → upgrade)`. User can override on next turn ("reduce to L1") — no flag needed.

**1b. Cache-first issue fetch**:
- Hit: `cachedIssue.key === TASK-ID` AND `summary`/`description`/`issuetype`/`fetchedAt` all present → skip fetch
- Miss: `mcp__atlassian__jira_get_issue` with `fields="summary,status,description,issuetype,parent,subtasks,issuelinks,priority"`, `comment_limit=0` → update `cachedIssue`

L3 requires child Story sequencing, so including `subtasks`/`issuelinks` is important.

**1c. Load requirements hints** (if any):

Glob `docs/requirements/*.requirements.md`:
- 0 files → proceed with no hint
- 1 file → adopt automatically
- N files → pick slug closest to `cachedIssue.summary`; if ambiguous, take first and notify

Extract from matched file: `## Technical Approach Hint` (primary input), `## Codebase Context`, `## Functional Requirements`, `## Open Questions` (carry over any P1/P2/[CONFLICT] items as Open Items in the approach doc).

If no requirements file: mark `Source` as `N/A — discover omitted`.

### Step 2: Generate Approach Document

**L3 empty-child guard** (L3 only): count child Story candidates from `subtasks` + `issuelinks` (including `is blocked by` reverse). If 0 children:
- Output: `⚠️ L3 Epic has 0 child stories. Register child issues via /jira-task create or Jira, then re-run.`
- Skip document creation, attachment, and context update
- Do NOT add `"approach"` to `completedSteps`
- Exit normally (no error)

For L1/L2, or L3 with ≥1 child:

```bash
mkdir -p docs/approach
perl -0777 -pe 's/<!--.*?-->//gs' templates/approach.template.md \
    > docs/approach/<TASK-ID>.approach.md
```

Read `skills/jira-task-approach/refs/level-templates.md` and fill the body using only the block for the determined level:
- **L1 Single (5 lines)**: areas of change, key decisions, verification, risk, rollback — 1 line each
- **L2 Story (one page)**: Approach Summary, Architecture sketch, Implementation Plan (by file), Key Decisions, Test Plan, Risks — 5–10 lines each
- **L3 Epic (sequencing only)**: child Story list + dependency/order/parallelability; detailed design is the child Story's responsibility

Replace placeholders: `{task_id}`, `{summary}`, `{level}`, `{level_name}` (`Single`/`Story`/`Epic`).

### Step 2.5: Offer Sub-task Creation (L2 only)

Skip this step if level is L1 or L3.

Parse `## Implementation Plan` table from the generated `docs/approach/<TASK-ID>.approach.md`. Extract each row's **File** and **Summary** columns as proposed sub-task candidates.

Present to user via AskUserQuestion:

```
Found <N> implementation items. Create as Jira Sub-tasks under <TASK-ID>?

| # | Proposed Sub-task |
|---|------------------|
| 1 | `src/auth/login.ts` — Add OTP validation |
| 2 | `src/auth/routes.ts` — Add /otp-verify endpoint |
```

Options: "Create all", "Skip"

If **Create all**: extract `project_key` from TASK-ID prefix (e.g. `PROJ-123` → `PROJ`). Call `mcp__atlassian__jira_batch_create_issues`:

```json
{
  "issues": [
    { "project_key": "<PROJECT>", "summary": "<File> — <Summary>", "issue_type": "Subtask", "parent": "<TASK-ID>" },
    ...
  ]
}
```

On success: append created sub-task keys to the approach doc under Implementation Plan as a one-line note: `> Sub-tasks created: PROJ-201, PROJ-202, ...`

On failure or skip: continue without blocking.

### Step 3: Attach to Jira

Do not call `mcp__atlassian__jira_add_comment` — Jira comments are disabled.

Upload the document as a Jira attachment:

```bash
SCRIPT_NAME="jira-attach.sh" OUT_VAR="JIRA_ATTACH_SH"
# Read skills/_shared/script-lookup.md and execute its lookup block here
[ -n "$JIRA_ATTACH_SH" ] && bash "$JIRA_ATTACH_SH" <TASK-ID> docs/approach/<TASK-ID>.approach.md
```

On failure: show local file path and continue.

### Step 4: Update Context + Summary

```bash
SCRIPT_NAME="jira-context-update.py" OUT_VAR="JIRA_CTX_UPDATE_PY"
# Read skills/_shared/script-lookup.md and execute its lookup block here
python3 "$JIRA_CTX_UPDATE_PY" <TASK-ID> approach "-" \
    ".jira-context.json"
```

Output:

```
---
✅ **Approach Complete** — <TASK-ID>

- Level: <L1/L2/L3>
- Artifact: `docs/approach/<TASK-ID>.approach.md`
- Jira comment: skipped (disabled)
- Jira attachment: uploaded (or local path if upload failed)

**Progress**: discover → create → init → start → **approach ✓** → impl → test → review → pr → done

**Next**: `/jira-task impl <TASK-ID>` — implement from the approach document
---
```
