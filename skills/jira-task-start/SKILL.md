---
name: jira-task-start
description: "Start working on a Jira task — create or checkout a feature branch and transition the issue to In Progress. Triggers: jira-task start, start task, begin task."
user-invocable: false
argument-hint: "<TASK-ID>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - mcp__atlassian__jira_get_issue
  - mcp__atlassian__jira_transition_issue
  - mcp__atlassian__jira_get_transitions
  - mcp__atlassian__jira_search
---

# jira-task-start: Start Working on a Jira Task

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Prerequisites
- Jira MCP server must be connected (check with `/jira`)
- Current directory should be inside a git repository
- TASK-ID must be a valid Jira issue key (e.g., PROJ-123)

## Workflow

### Step 0: Detect Mode (post-init vs fresh)

Read `.jira-context.json` with `Read`:

- **post-init mode**: `.jira-context.json` exists with a task entry matching `<TASK-ID>` in `tasks[]`.
  - Skip Step 4 (README creation) — already created by init.
  - Step 6 is patching (preserving existing fields) instead of full rewrite.
  - **Branch is always created here** (init no longer creates branches).
- **fresh mode**: No existing context entry for this task.
  - Perform all steps.

Inform user in one line: `📂 post-init mode: context found, creating branch now.` or `📂 fresh mode: full setup.`

### Step 1: Fetch Issue Details (cache-first)

First, check `cachedIssue` in `.jira-context.json`. **If all required fields (`summary`, `description`, `priority`, `assignee`, `issuetype`) are filled and `fetchedAt` is present, fetch is skipped** — If the cache created by init is already sufficient.

If cache misses, call `mcp__atlassian__jira_get_issue`:

**Context optimization**: When calling, slim the response with the following parameters.
- `fields="summary,status,priority,assignee,issuetype,description,subtasks,issuelinks"`
- `comment_limit=0` (Comment history is not required at the start stage)

After the call, the result is stored in `cachedIssue` in `.jira-context.json` (see CLAUDE.md "Issue Cache" — so subsequent steps can skip re-lookup). `fetchedAt` must be in the format `new Date().toISOString()` (UTC `Z`).

Display to the user:
- **Key**: Issue key
- **Summary**: Issue title
- **Status**: Current status
- **Priority**: Priority level
- **Assignee**: Who it's assigned to
- **Description**: Issue description (truncated if very long)
- **Acceptance Criteria**: If present in description
- **Sub-tasks**: If any
- **Linked Issues**: If any

### Step 2: Transition to "In Progress"

Use `mcp__atlassian__jira_get_transitions` to fetch available transitions, then use `mcp__atlassian__jira_transition_issue` with:
- `issueKey`: The TASK-ID
- `transitionId`: ID for "In Progress" (or similar like "Start Progress", "Begin Work")

**Important**: Do NOT pass a `comment` parameter to `jira_transition_issue`. Jira ticket comments are disabled for this plugin.

If the transition fails, the issue may already be in progress or the transition name differs.
In that case, inform the user of the current status and continue with the remaining steps.

### Step 3: Determine Branch Prefix + Create Branch

Derive branch prefix from `cachedIssue.issuetype.name` (available after Step 1):

| Issuetype | Prefix |
|---|---|
| `Bug` | `fix` |
| `Story`, `New Feature` | `feature` |
| `Task`, `Sub-task`, `Subtask` | `task` |
| `Hotfix` | `hotfix` |
| `Epic` | `feature` |
| *(any other)* | `task` |

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
BRANCH_NAME="<prefix>/<TASK-ID>"   # e.g. fix/PROJ-123, feature/PROJ-456, task/PROJ-789

# Detect base branch (develop → main → master)
BASE_BRANCH=""
for b in develop main master; do
  git rev-parse --verify "$b" 2>/dev/null && BASE_BRANCH="$b" && break
done

# Create branch if not exists, then checkout
git branch "$BRANCH_NAME" "$BASE_BRANCH" 2>/dev/null || true
git checkout "$BRANCH_NAME"
```

Notify user: `🌿 Branch: <prefix>/<TASK-ID> (from <base-branch>)`

### Step 4: Generate Task Context README (fresh mode only)

**This step is skipped in post-init mode.** Init already created `TASK-README.md`.

**fresh mode**: Create `TASK-README.md` in the repo root:

```markdown
# <TASK-ID>: <Summary>

## Issue Details
- **Status**: In Progress
- **Priority**: <priority>
- **Assignee**: <assignee>
- **Branch**: <prefix>/<TASK-ID>
- **Started**: <current date/time>

## Description
<issue description from Jira>

## Acceptance Criteria
<extracted from description if available>

## Related Issues
<linked issues if any>
```

### Step 5: Skip Jira Comment

Jira ticket comments are disabled. Do not call `mcp__atlassian__jira_add_comment`. Continue directly to local context updates.

### Step 6: Patch Local Context

Updates `.jira-context.json` using the `skills/_shared/context-update.md` pattern. LLM ban inline JSON patch — prevent missing/overwriting accidents.

Interpret the absolute path of `JIRA_CTX_UPDATE_PY` as `skills/_shared/script-lookup.md` just before calling:

```bash
SCRIPT_NAME="jira-context-update.py" OUT_VAR="JIRA_CTX_UPDATE_PY"
# Read skills/_shared/script-lookup.md and execute its lookup block here
python3 "$JIRA_CTX_UPDATE_PY" <TASK-ID> start "<fresh-jira-status>" \
    ".jira-context.json"
```

- `<fresh-jira-status>`: Actual status name re-queried with `jira_get_issue` immediately after Step 2 transition. Do not use the transition attempt value as is.

The script batches adding `"start"` to `completedSteps`, updating `status`, recording `startAt`, and updating `cachedIssue.status`/`fetchedAt`.

The body of `cachedIssue` must be patched in advance in `.jira-context.json` as a result of Step 1 fetch so that the script only updates status/fetchedAt neatly.

Only if the file does not exist (fresh mode), create a new one and then call the above script.

### Step 7: PDCA Recommendation

An advisory block in the following format is output immediately before the Completion Summary. LLM makes a decision based on the issue summary, description, type, and scope — it does not use a separate heuristic table or classifier.

- **Judgement target**: Only two steps: `approach` and `test`. `impl`/`review`/`merge`/`done` are always required and therefore excluded from judgment.
- **Judgment basis**: Nature of work (new feature / refactoring / bug fix / document/setting change), scope of change, risk.
- **Do not save**: Do not record in `.jira-context.json` or elsewhere. It has meaning only within one session, and communication ends with a response text.
- **User Override**: If the user tells you in natural language ("Please enter the test") on the next turn, it will be followed. No separate flag/save.

Example output format:

```
🔍 PDCA Advisory
- Required: approach, impl, review, merge
- Skippable: test (Reason: SKILL.md text added, no change in operation)
```

If there are no skippable steps, "Skippable: None" is output. The recommendation displays this response only once, and subsequent steps do not automatically print it again.

### Step 8: Completion Summary

Completed summary output in the format below:

```
---
✅ **Start Complete** — <TASK-ID>

- Issue Status: In Progress
- Branch: <prefix>/<TASK-ID> (checked out)
- Jira comment: skipped (disabled)

**Progress**: discover → create → init → **start ✓** → approach → impl → test → review → pr → done

**Next**: `/jira-task approach <TASK-ID>` — write the level-aware approach document (or follow the Step 7 recommendation)
---
```
