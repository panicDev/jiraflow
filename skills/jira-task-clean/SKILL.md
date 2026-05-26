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

Delete feature branches for completed Jira tasks and remove their entries from `.jira-context.json`.

**Must be run from the base branch (develop / main / master).** Running from a feature branch will prevent deletion of that branch.

## Workflow

### Case 1: `clean <TASK-ID> [TASK-ID ...]`

Delete specific task branches.

Show a dry-run summary first, then ask for confirmation before deleting:

```bash
# Check if branch is already merged (safe to delete)
git branch --merged | grep "feature/<TASK-ID>"

# Delete branch after confirmation
git branch -d "feature/<TASK-ID>"
# If branch is not merged but user confirms force-delete:
git branch -D "feature/<TASK-ID>"
```

After deletion, remove the task entry from `.jira-context.json` `tasks[]` array.

### Case 2: `clean --all`

Find all tasks in `.jira-context.json` where `completedSteps` includes `"done"` or `"pr"`, then delete their branches.

```bash
# List candidates (merged branches matching feature/ pattern)
git branch --merged | grep "feature/"
```

Show candidate list with dry-run summary. Ask for confirmation before proceeding.

After user confirms:
1. Delete each merged feature branch: `git branch -d "feature/<TASK-ID>"`
2. Remove completed task entries from `.jira-context.json` `tasks[]`

### Case 3: `clean --list`

Display all tasks from `.jira-context.json` with their branch status:

```bash
# Show local branches
git branch -v | grep "feature/"
# Show which are already merged
git branch --merged | grep "feature/"
```

Display a table:
```
| Task | Branch | Status | Merged | Safe to Delete |
|------|--------|--------|--------|----------------|
| PROJ-101 | feature/PROJ-101 | Done | Yes | Yes |
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
