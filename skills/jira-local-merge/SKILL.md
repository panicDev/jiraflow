---
name: jira-local-merge
description: "Locally merge a Jira task branch into the base branch without a remote or PR. Triggers: jira-task merge, local merge, merge without remote."
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
---

# jira-local-merge: Local Branch Merge

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

Locally merge feature branch into base branch without remote origin,
Jira status transition processed in batch.

## Prerequisites
- Commit exists in feature branch
- Jira MCP server connected

## Workflow

### Context Optimization

When calling `mcp__atlassian__jira_get_issue` in this skill, use the following parameters (only meta needed for merge/conversion):
- `fields="summary,status,issuetype"`
- `comment_limit=0`

### Step 1: Load Context

Load task context by reading `.jira-context.json`:
- `taskId`, `branch`, `baseBranch`, `repoRoot`

Use `branch` from context as `$BRANCH` in all subsequent git commands. If `branch` is null/missing, fall back to `feature/<taskId>`.

If TASK-ID is passed as an argument, the corresponding value is used first.

If `repoRoot` is missing, fall back to:
```bash
git rev-parse --show-toplevel
```

If `baseBranch` is missing, detected by `repoRoot`:
```bash
git -C "<repoRoot>" rev-parse --verify develop 2>/dev/null
git -C "<repoRoot>" rev-parse --verify main 2>/dev/null
git -C "<repoRoot>" rev-parse --verify master 2>/dev/null
```

### Step 2: Pre-flight Checks

```bash
# 1. Check the existence of task branch ($BRANCH from context)
git branch --list "$BRANCH"

# 2. Check uncommitted changes
git status --porcelain
```

If there are uncommitted changes, notify the user and stop. Proceed after confirming whether you want to continue.

### Step 3: Choose Merge Strategy

Ask user to select merge strategy:

```
Select a merge strategy:

1. --no-ff (default recommended)
   Create a merge commit, feature branch history is preserved
   Same as GitHub "Create a merge commit"

2. --squash
   Merge all commits from the feature branch into one
   Same as GitHub "Squash and merge"

3. rebase
   Relocate feature branch commits above base branch, linear history
   Same as GitHub "Rebase and merge"
```

### Step 4: Perform Merge

#### Strategy-specific commands:

**--no-ff (default)**
```bash
git checkout <baseBranch>
git merge --no-ff $BRANCH -m "Merge $BRANCH: <issue summary>"
```

**--squash**
```bash
git checkout <baseBranch>
git merge --squash $BRANCH
git commit -m "feat(<TASK-ID>): <issue summary>"
```

**rebase**
```bash
git checkout $BRANCH
git rebase <baseBranch>
git checkout <baseBranch>
git merge --ff-only $BRANCH
```

If a merge conflict occurs, notify the user and stop. Instructions for re-executing after resolving the conflict.

### Step 5: Skip Jira Merge Comment

Jira ticket comments are disabled. Do not call `mcp__atlassian__jira_add_comment`. Keep merge details in the local completion summary.

### Step 6: Transition Issue

After viewing the transition list with `mcp__atlassian__jira_get_transitions`, transition status with `mcp__atlassian__jira_transition_issue`:
- Attempt "In Review" first (not Done as PR creation step remains)
- If there is no "In Review", the user is presented with a list of possible transitions and asked to select
- Does not convert to Done (processed in `jira-task done` after creating PR)

**Comment policy**: Do not pass a `comment` parameter to `jira_transition_issue`; Jira ticket comments are disabled.

### Step 6.5: Verify Transition via Fresh Fetch (SSOT)

`Read skills/_shared/transition-verify.md` — Follows the fresh fetch procedure, `<final-jira-status>` decision rule, and fetch failure policy. Pass the resulting status to the `<final-jira-status>` argument in Step 8.

### Step 7: Branch Cleanup Notice

After the merge is complete, display the following note:

```
ℹ️ Task branch preserved for PR creation.
   Delete after the PR is merged:

   git branch -d $BRANCH
```

The actual command is not executed.

### Step 8: Update Context & Completion Summary

Update `.jira-context.json` with the common script. To determine the script path, run the lookup block after `Read skills/_shared/script-lookup.md`:

```bash
SCRIPT_NAME="jira-context-update.py" OUT_VAR="JIRA_CTX_UPDATE_PY"
# Read skills/_shared/script-lookup.md and execute its lookup block here
python3 "$JIRA_CTX_UPDATE_PY" <TASK-ID> merge "<final-jira-status>" \
    ".jira-context.json"
```

- `<final-jira-status>`: **Jira actual status name obtained through fresh fetch in Step 6.5** (e.g. `"In Review"`, `"In Review"`). Do not use the transition attempt value as is.

The script batches:
- Add `"merge"` to `completedSteps` (prevent duplication)
- set `status` to `<final-jira-status>`
- Record current UTC ISO 8601 (Z suffix) in `mergedAt` — TZ-naive timestamp is treated as stale by dashboard reader, so Z suffix is ​​required
- Update `cachedIssue.status` / `cachedIssue.fetchedAt` together (only when there is cachedIssue)
- Automatic detection of aggregate vs worktree format (aggregate updates only the corresponding `taskId` item in `tasks[]`)

Completed summary output in the format below:

```
---
✅ **Local Merge Complete** — <TASK-ID>

- Merge: <branch> → <baseBranch> (<strategy>)
- Jira Status: In Review
- Task branch `<branch>` preserved for PR creation (delete after PR merge)
- Completed Report Posted to Jira

**Progress**: discover → create → init → start → approach → impl → test → review → **merge ✓** → done

**Next**: `/jira-task done <TASK-ID>` — Transition Done + log work time
---
```
