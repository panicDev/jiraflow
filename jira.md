---
name: jira
description: Show Jira integration status, available tools, and help for jira-task commands. Use when user types /jira, asks about Jira connection, or wants to see available Jira commands.
user-invocable: true
argument-hint: "[setup|dashboard]"
allowed-tools:
  - Read
  - Bash
  - Skill
  - mcp__atlassian
---

# /jira - Jira Integration Help & Status

## Argument Parsing

If the argument is `setup`, run the setup wizard:
`Skill({ skill: "jiraflow:jira-setup" })`

If the argument starts with `dashboard` (e.g., `dashboard`, `dashboard start`, `dashboard stop`, `dashboard status`, `dashboard setup`), delegate to the dashboard skill:
`Skill({ skill: "jiraflow:jira-dashboard", args: "<remaining args after 'dashboard'>" })`

Otherwise, show the following information:

## 1. Connection Status

Check if Atlassian MCP server is available by calling `mcp__atlassian__jira_search`
with JQL `project is not EMPTY ORDER BY updated DESC` and limit 1.

- If the call succeeds (no exception): report "Connected"
- If the call throws an error: report "Not connected" and guide setup

Do NOT use `echo $JIRA_URL` to check credentials — these are scoped to the MCP server
process and not visible as shell environment variables.

If connection fails, guide the user to set up environment variables:
```
JIRA_URL=https://your-domain.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_API_TOKEN=your-api-token
```

## 2. Available Commands

Display the available workflow commands:

| Command | Description |
|---------|-------------|
| `/jira setup` | Interactive setup wizard for Jira MCP server registration |
| `/jira dashboard [start\|stop\|status\|setup]` | Dashboard server management — setup/start/stop/status check (auto-starts if no argument given) |
| `/jira-task create [hint]` | Interactively create a new Jira issue (including subtask decomposition, dependencies, and epic linking) |
| `/jira-task init [N]` | Fetch my top N assigned tasks and create worktrees for each |
| `/jira-task auto <TASK-ID>` | Auto-execute full workflow (start → approach → impl → test → review) |
| `/jira-task start <TASK-ID>` | Start working on a task (fetch context, create branch, transition to In Progress) |
| `/jira-task approach <TASK-ID>` | Generate a level-aware approach document (unified plan + design) |
| `/jira-task impl <TASK-ID>` | Implement based on approach document |
| `/jira-task test <TASK-ID>` | Run tests (Playwright E2E, unit) and save local report/attachments |
| `/jira-task review <TASK-ID>` | Run code review and save local report/attachments |
| `/jira-task pr <TASK-ID>` | Create pull request and link to Jira |
| `/jira-task done <TASK-ID>` | Complete task (PR, transition status, local summary) |
| `/jira-task report` | Report on the status of my assigned issues |

## 3. Available MCP Tools

Briefly list the Atlassian MCP tool categories:
- **Issues**: get, search (JQL), create, update, delete, transition, batch-create
- **Comments**: disabled by plugin policy (do not add Jira ticket comments)
- **Attachments**: download
- **Sprints & Boards**: get-agile-boards, get-sprints-from-board, get-sprint-issues, create-sprint, update-sprint
- **Development Info**: get-issue-development-info (linked PRs, branches, commits)
- **Projects & Users**: get-all-projects, get-project-issues, get-user-profile
- **Issue Links**: create-issue-link, link-to-epic
