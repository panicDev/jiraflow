---
name: jira-task-clean
description: "Delete feature branches for completed Jira tasks and remove them from .jira-context.json. Triggers: jira-task clean, clean branch, cleanup task."
user-invocable: false
argument-hint: "<TASK-ID> [TASK-ID ...] | --all | --list"
allowed-tools:
  - Read
  - Write
  - Bash
---

# jira-task-clean: Branch Cleanup

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Overview

Delete task branches for completed Jira tasks and remove their entries from `.jira-context.json`.

**Must be run from the base branch (develop / main / master).** Running from a task branch will prevent deletion of that branch.

**Branch resolution**: For each TASK-ID, read the `branch` field from the matching entry in `.jira-context.json` `tasks[]`. Use that as the branch name. If `branch` is null/missing, fall back to `feature/<TASK-ID>`.

## Workflow

### Case 1: `clean <TASK-ID> [TASK-ID ...]`

Delete specific task branches.

Show a dry-run summary first, then ask for confirmation before deleting:

```bash
# $BRANCH = branch read from context (e.g. fix/PROJ-123, feature/PROJ-456)
# Check if branch is already merged (safe to delete)
git branch --merged | grep "$BRANCH"

# Delete branch after confirmation
git branch -d "$BRANCH"
# If branch is not merged but user confirms force-delete:
git branch -D "$BRANCH"
```

After deletion, remove the task entry from `.jira-context.json` `tasks[]` array.

### Case 2: `clean --all`

Find all tasks in `.jira-context.json` where `completedSteps` includes `"done"` or `"pr"`, then delete their branches.

Read each task's `branch` field from context. List branches to delete, show dry-run summary, ask for confirmation.

After user confirms:
1. Delete each merged task branch: `git branch -d "$BRANCH"` (using branch from context)
2. Remove completed task entries from `.jira-context.json` `tasks[]`

### Case 3: `clean --list`

Display all tasks from `.jira-context.json` with their branch status:

Read each task's `branch` field from `.jira-context.json`. Then:
```bash
# Show local branches and merge status per branch from context
git branch -v
git branch --merged
```

Display a table (branch column from context `branch` field):
```
| Task | Branch | Status | Merged | Safe to Delete |
|------|--------|--------|--------|----------------|
| PROJ-101 | fix/PROJ-101 | Done | Yes | Yes |
| PROJ-102 | feature/PROJ-102 | In Progress | No | No |
```

## Completion Summary

```
---
🧹 **Branch Cleanup Complete**

- Cleaned tasks: <TASK-ID list>
- Deleted branches: <count>
- Removed from .jira-context.json: <count>
---
```
