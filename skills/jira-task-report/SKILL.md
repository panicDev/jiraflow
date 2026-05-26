---
name: jira-task-report
description: "Generate a status report of assigned Jira issues — breakdown by status, blockers, Scrum/Kanban support. Triggers: jira-task report, status report, progress report."
user-invocable: false
allowed-tools:
  - Read
  - Write
  - mcp__atlassian__jira_get_agile_boards
  - mcp__atlassian__jira_get_sprints_from_board
  - mcp__atlassian__jira_search
---

# jira-task-report: Status Report

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Workflow

### Step 1: Fetch My Assigned Issues

First, check the existence of a sprint and search for issues with appropriate JQL:

**Context optimization (common to all jira_search calls):**
- `fields="summary,status,priority,issuetype,assignee"` (excluding description — report requires only card-level summary)
- `limit=50`

**If you have Sprints (Scrum)**:
1. Use `mcp__atlassian__jira_get_agile_boards` to list available boards
2. Use `mcp__atlassian__jira_get_sprints_from_board` with the boardId to find the active sprint
3. JQL: `project = <JIRA_DEFAULT_PROJECT> AND sprint = <sprint-id> AND assignee = currentUser() ORDER BY status ASC, priority DESC` (using fields/limit above)

**Without Sprint (Kanban / Other)**:
```
Use mcp__atlassian__jira_search with JQL:
  project = <JIRA_DEFAULT_PROJECT> AND assignee = currentUser() AND status != Done ORDER BY priority DESC
  fields="summary,status,priority,issuetype,assignee"
  limit=50
```

### Step 2: Categorize Issues

Group issues by status:
- **To Do**: Not started
- **In Progress**: Being worked on
- **In Review**: Awaiting review
- **Done**: Completed (within the last 7 days)

Calculate:
- Total issues
- Completion percentage
- Per-status count

### Step 3: Generate Report

Read `templates/report.template.md` for structure.

Create a markdown report with:
- Report scope (sprint name or project name)
- Progress percentage
- Issue breakdown table (by status)
- Blockers/risks (Blocker priority or "blocked" label)

Save to `docs/reports/status-<YYYY-MM-DD>.report.md`

### Step 4: Completion Summary

Display the report inline and print a completion summary:

```
---
✅ **Report Generated**

- Save report: `docs/reports/status-<YYYY-MM-DD>.report.md`
- Total Issues: <N> (Completed: <N>, In Progress: <N>, Waiting: <N>)
- Completion Rate: <N>%
---
```
