# jira-cc Plugin — OpenCode Installation

## Setup

1. Set required environment variables:
   ```bash
   export JIRA_URL="https://your-company.atlassian.net"
   export JIRA_USERNAME="your-email@company.com"
   export JIRA_API_TOKEN="your-api-token"
   export JIRAFLOW_ROOT="/path/to/jiraflow"   # absolute path to this plugin directory
   ```

2. Configure `mcp-atlassian` MCP server in your OpenCode config so Jira tools are available with the `mcp__atlassian__` prefix.

3. Ensure `git` and `gh` (GitHub CLI) are installed and authenticated.

## Usage

Read `skills/using-jiraflow/SKILL.md` for the full workflow guide and action list.

Quick start:
- `init` — fetch assigned tasks and create feature branches
- `start <TASK-ID>` — check out a task and begin work
- `approach <TASK-ID>` — generate an implementation plan
- `impl <TASK-ID>` — implement the task
- `test <TASK-ID>` — write and run tests
- `review <TASK-ID>` — code review
- `pr <TASK-ID>` — create pull request
- `done <TASK-ID>` — mark complete

Full workflow: `discover → create → init → start → approach → impl → test → review → merge → pr → done`

## Skill Files

All workflow skills are in `skills/`. To execute an action, read the corresponding `SKILL.md` and follow it.

See `AGENTS.md` for universal agent instructions and tool name mapping.
