---
name: jira-task-status
description: "Rich status view of all active tasks from .jira-context.json — progress, branch, time elapsed, next step. Triggers: jira-task status, task status, what's next."
user-invocable: false
argument-hint: ""
allowed-tools:
  - Read
  - Bash
---

# jira-task-status: Rich Task Status View

**Language Rule**: All output MUST be in English.

Read `.jira-context.json` and display a rich status panel for all active tasks. No Jira API call — purely local context.

## Workflow

### Step 1: Read Context

```bash
# Detect current branch for "active" marker
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
```

Read `.jira-context.json` with the `Read` tool. If the file does not exist, output:
```
ℹ️  No tasks initialized yet. Run /jira-task init to get started.
```
and stop.

### Step 2: Build Status Panel

For each task in `tasks[]`, compute:

- **Progress bar**: map `completedSteps` to the pipeline:
  `discover → create → init → start → approach → impl → test → review → merge → pr → done`
  Mark each step: `✓` if in completedSteps, `●` if it's the next step, `·` if pending

- **Time elapsed**: if `startAt` is present and `doneAt` is absent, compute `now - startAt` → format as `Xh Ym` or `X days`

- **Active marker**: `★` if `branch === CURRENT_BRANCH`

- **Next action**: derive from last completed step:

  | Last completed | Next |
  |---|---|
  | init | `/jira-task start <ID>` |
  | start | `/jira-task approach <ID>` |
  | approach | `/jira-task impl <ID>` |
  | impl | `/jira-task test <ID>` |
  | test | `/jira-task review <ID>` |
  | review | `/jira-task merge <ID>` |
  | merge | `/jira-task pr <ID>` |
  | pr | `/jira-task done <ID>` |
  | done | — complete |

### Step 3: Output

```
─────────────────────────────────────────
📊  jiraflow Status  (<N> active tasks)
─────────────────────────────────────────

★ PROJ-123  Add OTP two-factor authentication          ← ★ = current branch
  Branch:    feature/PROJ-123  (checked out)
  Jira:      In Progress
  Progress:  init ✓ · start ✓ · approach ✓ · impl ● · test · review · merge · pr · done
  Elapsed:   2h 14m
  Next:      /jira-task impl PROJ-123

  PROJ-124  Fix login session timeout
  Branch:    feature/PROJ-124
  Jira:      To Do
  Progress:  init ✓ · start ● · approach · impl · test · review · merge · pr · done
  Next:      /jira-task start PROJ-124

─────────────────────────────────────────
Tip: /jira-task auto <ID>  runs start→review automatically
─────────────────────────────────────────
```

Rules:
- Sort: current branch task first, then by last activity (most recent `<step>At`)
- Completed tasks (`done` in completedSteps): show only if `doneAt` is within last 24h, otherwise omit
- If 0 active tasks: `ℹ️  No active tasks. Run /jira-task init to fetch assigned work.`
- Elapsed time: only show if `startAt` present and task not done
