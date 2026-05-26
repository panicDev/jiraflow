---
name: jira-task-init
description: "Fetch assigned high-priority Jira tasks and register them in local context (count, issue key, or natural language). Branches are created lazily at start. Triggers: jira-task init, init sprint, setup tasks, fetch assigned work."
user-invocable: false
argument-hint: "[count | ISSUE-KEY | natural-language description]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - mcp__atlassian__jira_search
  - mcp__atlassian__jira_get_issue
  - mcp__atlassian__jira_get_agile_boards
  - mcp__atlassian__jira_get_sprints_from_board
---

# jira-task-init: Bulk Sprint/Task Initialization

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

Batch workflow that fetches Jira tasks assigned to me in order of priority and registers them in local context. Branches are created lazily at `/jira-task start` — not here.

## Prerequisites
- Jira MCP server connected
- Current directory is inside git repository
- Environment variables: JIRA_URL, JIRA_USERNAME, JIRA_API_TOKEN

## Workflow

### Step 0: Argument Parsing

The arguments are analyzed and classified into one of three modes:

1. **Number (Count mode)**: If there are no arguments or only numbers → existing operation. Proceed to Step 1.
   - Example: `""`, `"3"`, `"5"`
2. **Issue Key (Issue Key mode)**: If the argument includes a Jira issue key pattern (`[A-Z]+-\d+`, e.g. `MAE-2`, `PROJ-123`) → Proceed to Step 1-B.
   - Example: `"MAE-2"`, `"Only those that can be started by analyzing MAE-2 subtasks"`
   - Even if an issue key is included in the natural language, the issue key is extracted and processed in Issue Key mode
3. **Natural language (not including issue key)**: All you need is natural language without an issue key pattern → Request the user to check the issue key. If you receive an issue key, proceed to Step 1-B, and if you receive a number, proceed to Step 1.

### Step 1: Fetch My Assigned Tasks (Count mode)

Determines how many tasks to bring to the user (default: 5).

Querying high-priority tasks assigned to me using JQL queries.
**If JIRA_DEFAULT_PROJECT is set, you must include the condition `project = <JIRA_DEFAULT_PROJECT>`.**

```
Use mcp__atlassian__jira_search with JQL:
  project = <JIRA_DEFAULT_PROJECT> AND assignee = currentUser() AND status NOT IN (Done, Closed) ORDER BY priority DESC, created ASC
  fields="summary,status,priority,issuetype,assignee"
  limit=20
```

Or if you have an active sprint, query based on sprint:
1. Check the list of boards with `mcp__atlassian__jira_get_agile_boards`
2. Check active sprints with `mcp__atlassian__jira_get_sprints_from_board` (requires boardId)
3. JQL: `project = <JIRA_DEFAULT_PROJECT> AND sprint = <active-sprint-id> AND assignee = currentUser() AND status NOT IN (Done, Closed) ORDER BY priority DESC`

Select only the top N (default 5) from the results. → Proceed to Step 2.

### Step 1-B: Fetch Sub-tasks by Issue Key (Issue Key mode)

Search for the issue and subtasks using the issue key extracted in Step 0 and analyze dependencies.

Detailed procedure: `Read skills/jira-task-init/refs/issue-key-mode.md`

Summary:
1. Parent issue search (`fields="summary,status,issuetype,priority"`, `comment_limit=0`)
2. Checking unfinished subtasks with JQL (`parent = <ISSUE-KEY> AND status NOT IN (Done, Closed)`)
3. Analysis of issuelinks of each subtask → `is blocked by` If there is an uncompleted blocker, processed as blocked
4. Select only tasks that can be started and print the dependency table → Forward to Step 2

### Step 2: Display Task List

Display imported task list as table:

```
Found <N> tasks assigned to you:

| # | Key | Summary | Priority | Status | Type |
|---|-----|---------|----------|--------|------|
| 1 | PROJ-101 | Implementation of login function | Highest | To Do | Story |
| 2 | PROJ-102 | API error handling | High | To Do | Task |
| 3 | PROJ-103 | Dashboard UI | High | In Progress | Story |
| 4 | PROJ-104 | test coverage | Medium | To Do | Task |
| 5 | PROJ-105 | Document update | Medium | To Do | Task |
```

Ask user: "Register these tasks? (select all or enter numbers, e.g. 1,3)"

### Step 3: Detect Git Context

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
```

Base branch detection (try in order):
```bash
git rev-parse --verify develop 2>/dev/null  # 1st: develop
git rev-parse --verify main 2>/dev/null     # 2nd: main
git rev-parse --verify master 2>/dev/null   # 3rd: master
```

### Step 4: Ensure .gitignore

If the following entry is not present in your project's `.gitignore`, add it using bash:

```bash
REPO_GITIGNORE="$REPO_ROOT/.gitignore"
if ! grep -qF ".jira-context.json" "$REPO_GITIGNORE" 2>/dev/null; then
  printf '\n# Jira integration (local dev context)\n.jira-context.json\nTASK-README.md\n' >> "$REPO_GITIGNORE"
fi
```

Skip if it already exists.

### Step 6: Generate Task README

Create `TASK-README.md` in the repo root (one per init run, summarizing all initialized tasks). Includes:
- Issue Details (Key, Summary, Type, Priority, Status, Branch, Initialized)
- Description (Jira issue description)
- Acceptance Criteria (extracted from description)
- Workflow (`start` → `test` → `review` → `done` command guide)

### Step 7: Skip Jira Comments

Jira ticket comments are disabled. Do not call `mcp__atlassian__jira_add_comment` for initialized tasks. Continue directly to saving local context.

### Step 8: Save Context

Create or update `.jira-context.json` in the repo root using aggregate format:

```json
{
  "initialized": "<ISO timestamp>",
  "repoRoot": "<REPO_ROOT absolute path>",
  "baseBranch": "<detected base branch>",
  "tasks": [
    {
      "taskId": "PROJ-101",
      "branch": null,
      "repoRoot": "<REPO_ROOT absolute path>",
      "summary": "Implementing login functionality",
      "priority": "Highest",
      "status": "To Do",
      "completedSteps": ["init"],
      "initializedAt": "<ISO timestamp>"
    }
  ]
}
```

If the file already exists (previous init run), append new tasks to `tasks[]` — do not overwrite existing entries.

### Step 8.5: Dashboard Workspace Registration

To make the initialized tasks immediately visible in the dashboard, register the repo (`$REPO_ROOT`) in the dashboard
workspace registry. (idempotent — If already registered, only lastSeenAt is updated.)

```bash
node "${JIRAFLOW_ROOT:-$CLAUDE_PLUGIN_ROOT}/scripts/register-workspace.js" "$REPO_ROOT"
```

Even if it fails, the workflow continues (registration only affects dashboard visibility).

### Step 9: Completion Summary

Add `"init"` to `completedSteps` for each task in `.jira-context.json`.
After displaying the results in a table, output a summary of the completion in the format below:

```
| # | Task | Summary | Type | Status |
|---|------|---------|------|--------|
| 1 | PROJ-101 | Implementing login functionality | Story | To Do |
| 2 | PROJ-102 | API error handling | Task | To Do |

---
✅ **Init Complete**

- <N> tasks registered
- Branches will be created at `/jira-task start` (prefix derived from issuetype)
- Jira comment: skipped (disabled)
- Context saved to `.jira-context.json`

**Progress**: discover → create → **init ✓** → start → approach → impl → test → review → pr → done

**Next**: `/jira-task start <TASK-ID>` — check out the branch and start working
---
```
