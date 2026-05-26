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
---

# jira-task-approach: Generate Approach Document (level-aware)

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Overview

`jira-task-approach` integrates the existing two steps of `plan` + `design` into a single step. Adjust volume and depth depending on the scale of the task (L1/L2/L3) — do not use heavy design documents for small tasks.

**Enter:**
- `<TASK-ID>` (required)
- `.jira-context.json.cachedIssue` (Cache-First Fetch)
- `.jira-context.json.breakdownLevel` (preferred if present)
- `Technical Approach Hint` section of discover output `docs/requirements/<slug>.requirements.md` (enter if present)

**Output:**
- `docs/approach/<TASK-ID>.approach.md`
- Jira attachment (when available). Jira comments are disabled.

**Non-target:**
- Code writing/execution (impl step responsibility)
- Test writing/execution (test phase responsibility)

## Workflow

### Step 0: Determine Breakdown Level

Level Decision Priority:

1. **`.jira-context.json.breakdownLevel`** (`"L1"` | `"L2"` | `"L3"`) — Value recorded in Sub 1.3. If it is a hit, use it as is.
2. **Jira issuetype fallback heuristic** — If there is no value in context, to issuetype of cachedIssue:
   - `Subtask`, `Task`, `Bug` → **L1**
   - `Story` → **L2**
   - `Epic` → **L3**
   - Others → **L1** (conservative)
3. **Design level promotion check** — Even if the level set at 1 to 2 is L1, if the task touches any of the following, it is at least **promoted to L2** (already maintained as L2/L3): Data model/schema change · Transaction/Atomic boundary · Externally exposed interface/API contract · Concurrency/Idempotence/Ordering · Security/Privilege boundary. Since these dimensions are "irreversible decisions that must be nailed down before coding," a five-line summary is not enough.
4. Notify the user of the determined level in one line — Example: `📐 Approach level: L2 (issuetype Story fallback)` / Specify reason for upgrade `📐 L2 (Task but schema change → upgrade)`.

When the user requests to change to natural language on the next turn ("Reduce to L1"), it is followed — no separate flag.

### Step 1: Cache-First Fetch

Check `cachedIssue` in `.jira-context.json` first (refer to CLAUDE.md "Cache-First Fetch").

- **hit condition**: `key === <TASK-ID>` AND `summary`/`description`/`issuetype` all exist AND `fetchedAt` exists. → Skip fetch.
- **miss**: Calling `mcp__atlassian__jira_get_issue`:
  - `fields="summary,status,description,issuetype,parent,subtasks,issuelinks,priority"`
  - `comment_limit=0`
  - L3 requires child Story sequencing, so including `subtasks`/`issuelinks` is important.
- Update `cachedIssue` after calling. `fetchedAt` returns `new Date().toISOString()` (UTC `Z`).

### Step 2: Load Requirements Inputs

Check `docs/requirements/*.requirements.md` as Glob.

- 0 candidate files: Proceed with no input hint.
- 1 candidate file: automatic adoption.
- N candidate files: Select the slug closest to cachedIssue.summary. If ambiguous, accept the first file and notify the user.

Extract the following sections from the adapted file:
- `## Technical Approach Hint` (required input — quote as is if present)
- `## Codebase Context` (reference)
- `## Functional Requirements` (Reference)
- `## Open Questions` (If there are any remaining P1/P2/[CONFLICT], they will be carried over to Open Items in the approach document)

If there is no requirements file, mark the `Source` section in Step 3 as `N/A — discover omitted`.

### Step 3: Generate Approach Document

The output template for each level uses only the corresponding level block after `Read skills/jira-task-approach/refs/level-templates.md`.

#### 3.0 L3 Empty-Child Guard

Applies only when level is **L3**. Count the number of child Story candidates by combining `subtasks` + `issuelinks` (including `is blocked by` reverse) of `cachedIssue` fetched/cache in Step 1. If there are 0 cases, only an empty sequencing table is created, so **it ends early here**.

- Output guidance to user:

  ```
  ⚠️ There are 0 child stories in L3 Epic.
  First, disassemble and register the child issue in `/jira-task create` or Jira and run it again.
  ```

- **Skip** all document creation/Jira comments/attachments.
- **Do not add** `"approach"` to `completedSteps` in `.jira-context.json` (considered not executed).
- Normal termination (no error). Subsequent Steps 3.1 to 5 are not performed.

L1/L2 or one or more children of L3 pass through this guard and enter 3.1.

#### 3.1 Copy directory + base template

```bash
mkdir -p docs/approach
perl -0777 -pe 's/<!--.*?-->//gs' templates/approach.template.md \
    > docs/approach/<TASK-ID>.approach.md
```

#### 3.2 Filling out the text by level

Fill the body area by copying only the output format of the level determined in `refs/level-templates.md`. No other level blocks are used.

- **L1 Single (5 lines)**: Areas of change, key decisions, verification, risk, rollback — 1 line each.
- **L2 Story (one page)**: Approach Summary, Architecture sketch, Implementation Plan (by file), Key Decisions, Test Plan, Risks. Each section should be no longer than 5-10 lines.
- **L3 Epic (sequencing only)**: child Story list + dependency/order/parallelability. Detailed design is handled by the child Story, so it is not covered in this document.
  - Child Story identification: `subtasks` + `issuelinks` of cachedIssue (including `is blocked by` reverse).

#### 3.3 Common meta population

Bulk replacement of placeholders in document header:
- `{task_id}` → actual TASK-ID
- `{summary}` → cachedIssue.summary
- `{level}` → `L1` | `L2` | `L3`
- `{level_name}` → `Single` | `Story` | `Epic`

### Step 4: Skip Jira Comment

Jira ticket comments are disabled. Do not call `mcp__atlassian__jira_add_comment`. The approach summary stays in `docs/approach/<TASK-ID>.approach.md` and, when possible, the file is uploaded as an attachment in Step 4.5.

### Step 4.5: Attach Approach Document to Jira

Upload attachment with public script:

```bash
SCRIPT_NAME="jira-attach.sh" OUT_VAR="JIRA_ATTACH_SH"
# Read skills/_shared/script-lookup.md and execute its lookup block here
[ -n "$JIRA_ATTACH_SH" ] && bash "$JIRA_ATTACH_SH" <TASK-ID> docs/approach/<TASK-ID>.approach.md
```

In case of failure, continue after providing local file path information.

### Step 5: Completion Summary

Update `.jira-context.json` with `skills/_shared/context-update.md` pattern (approach is no Jira transition → `STATUS="-"`):

```bash
SCRIPT_NAME="jira-context-update.py" OUT_VAR="JIRA_CTX_UPDATE_PY"
# Read skills/_shared/script-lookup.md and execute its lookup block here
python3 "$JIRA_CTX_UPDATE_PY" <TASK-ID> approach "-" \
    ".jira-context.json"
```

Afterwards output:

```
---
✅ **Approach Complete** — <TASK-ID>

- Level: <L1/L2/L3>
- Artifact: `docs/approach/<TASK-ID>.approach.md`
- Jira comment: skipped (disabled)
- Jira attachment: uploaded, or local path shown if upload fails

**Progress**: discover → create → init → start → **approach ✓** → impl → test → review → merge → pr → done

**Next**: `/jira-task impl <TASK-ID>` — start implementation from the approach document
---
```
