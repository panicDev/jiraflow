---
name: jira-task-done
description: "Complete a Jira task — generate a summary, transition the issue to Done, and skip Jira comments. Triggers: jira-task done, complete task."
user-invocable: false
argument-hint: "<TASK-ID>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - mcp__atlassian__jira_get_issue
  - mcp__atlassian__jira_transition_issue
  - mcp__atlassian__jira_get_transitions
  - mcp__atlassian__jira_add_worklog
---

# jira-task-done: Complete a Jira Task

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Prerequisites
- A task branch must exist with commits (branch name read from `.jira-context.json` `branch` field)
- Jira MCP server must be connected

## Workflow

### Step 1: Verify Context

Check for `.jira-context.json` to get the active task context.
If TASK-ID is provided as argument, use that instead.

Read `branch` from the task entry in `.jira-context.json` (e.g. `fix/PROJ-123`). If `branch` is null/missing, fall back to `feature/<TASK-ID>`. Use this as `$BRANCH` in git commands.

If `"merge"` or `"pr"` is present in `completedSteps`, context is sufficient for this step — no git call required. If neither exists (exception path: user calls done without merge/pr), then only check the branch existence with `git branch --list "$BRANCH"`.

### Step 2: Fetch Current Issue Status

**Cache-first**: Check `cachedIssue` in `.jira-context.json` first (see CLAUDE.md "Issue Cache"). If it is a hit, skip the call and only use the cached `status`. If miss, update cache after calling `mcp__atlassian__jira_get_issue` (`fields="summary,status,issuetype,assignee"`, `comment_limit=0`). **However, the done stage is just before the state transition, so if the user doubts the freshness, they can ignore the cache and re-search**.

### Step 3: Summarize Changes

**Default path (done is called after merge/pr is complete)**: git calls 0 times.

When merge/pr has already completed, use the local PDCA documents and context files for the completion summary. Do not rely on Jira comments because Jira ticket comments are disabled.

**Exception path (direct call to done without merge/pr)**: Only then, check stat once with the appropriate git command depending on the squash·merge type.

- squash-merged onto base: `git show --stat $(git log --grep="<TASK-ID>" -1 --format=%H <base-branch>)`
- Normal merge: `git diff --stat <base-branch>..$BRANCH`
- Judgment criteria: squash if `<base>..$BRANCH` is empty, normal if not empty.

### Step 4: Generate Completion Summary

Create a complete summary citing the following sources in order of priority (no git re-references):

1. `.jira-context.json` task metadata (branch/status)
2. `docs/approach/<TASK-ID>.approach.md` (approach summary)
3. `docs/test/<TASK-ID>.test-report.md` (test results)
4. PR metadata from the `gh` CLI if the task completed via PR

### Step 5: Skip Jira Completion Comment

Jira ticket comments are disabled. Do not call `mcp__atlassian__jira_add_comment`. Keep the completion report in the local completion summary.

### Step 5.5: Log Work to Jira

Read `startAt` from the task entry in `.jira-context.json`. If present, calculate elapsed time and log it:

```bash
START_AT=$(python3 -c "
import json, sys
ctx = json.load(open('.jira-context.json'))
tasks = ctx.get('tasks', [ctx])
t = next((t for t in tasks if t.get('taskId') == '$TASK_ID'), {})
print(t.get('startAt', ''))
")

if [ -n "$START_AT" ]; then
  ELAPSED_SEC=$(python3 -c "
from datetime import datetime, timezone
start = datetime.fromisoformat('$START_AT'.replace('Z','+00:00'))
now = datetime.now(timezone.utc)
print(int((now - start).total_seconds()))
")
  # Format as Jira time string: "1h 30m"
  TIME_SPENT=$(python3 -c "
s = $ELAPSED_SEC
h, m = divmod(s // 60, 60)
print(f'{h}h {m}m' if h else f'{m}m')
")
fi
```

Call `mcp__atlassian__jira_add_worklog` with `issue_key=<TASK-ID>`, `time_spent="<TIME_SPENT>"`.

If `startAt` is missing or the call fails (worklog disabled for project), skip silently — do not block the workflow. Record result for summary.

### Step 6: Transition Issue

Use `mcp__atlassian__jira_get_transitions` to fetch available transitions, then use `mcp__atlassian__jira_transition_issue` to move the issue:
- Try "In Review" first (common for PR-based workflows)
- If "In Review" is not available, try "Done"
- If both fail, inform the user of available transitions

**Comment policy**: Do not pass a `comment` parameter to `jira_transition_issue`; Jira ticket comments are disabled.

### Step 6.5: Verify Transition via Fresh Fetch (SSOT)

`Read skills/_shared/transition-verify.md` — Follows the fresh fetch procedure, `<final-jira-status>` decision rule, and fetch failure policy. Pass the resulting status to the `<final-jira-status>` argument in Step 8.

### Step 7: Update Context & Completion Summary

Update `.jira-context.json` with the common script. To determine the script path, run the lookup block after `Read skills/_shared/script-lookup.md`:

```bash
SCRIPT_NAME="jira-context-update.py" OUT_VAR="JIRA_CTX_UPDATE_PY"
# Read skills/_shared/script-lookup.md and execute its lookup block here
python3 "$JIRA_CTX_UPDATE_PY" <TASK-ID> done "<final-jira-status>" \
    ".jira-context.json"
```

- `<final-jira-status>`: **Jira actual status name obtained through fresh fetch in Step 6.5** (e.g. `"Finished"`, `"Done"`). Do not use the transition attempt value as is — it may have a different name depending on the Jira workflow.

The script batches:
- Add `"done"` to `completedSteps` (prevent duplication)
- set `status` to `<final-jira-status>`
- Write current UTC ISO 8601 (Z suffix) in `doneAt`
- Update `cachedIssue.status` / `cachedIssue.fetchedAt` together (only when there is cachedIssue)
- Automatically detect aggregate vs worktree format

Completed summary output in the format below:

```
---
✅ **Task Done** — <TASK-ID>

- Jira Status: Done (or In Review)
- Time logged: <TIME_SPENT> (or "skipped — startAt not found")
- `.jira-context.json` updated

**Progress**: discover → create → init → start → approach → impl → test → review → merge → pr → **done ✓**

🎉 All steps are complete!
---
```
