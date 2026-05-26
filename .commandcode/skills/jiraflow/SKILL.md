---
name: jiraflow
description: "Jira + coding agent workflow automation. Full SDLC: discover → create → init → start → approach → impl → test → review → merge → pr → done. Invoke via /skills → jiraflow."
---

# jiraflow

Read `skills/using-jiraflow/SKILL.md` for the complete workflow guide, action list, and tool mappings.

## Quick Setup

Set environment variables before starting:
```bash
export JIRA_URL="https://your-domain.atlassian.net"
export JIRA_USERNAME="your-email@company.com"
export JIRA_API_TOKEN="your-api-token"
export JIRAFLOW_ROOT="/path/to/jiraflow"   # absolute path to this plugin directory
```

Configure `mcp-atlassian` MCP server so Jira tools are available with `mcp__atlassian__` prefix.

## Actions

| Action | What it does |
|--------|-------------|
| `init` | Fetch assigned tasks + create feature branches |
| `start <ID>` | Checkout branch, transition In Progress |
| `approach <ID>` | Generate approach doc (L1/L2/L3) |
| `impl <ID>` | Implement from approach doc |
| `test <ID>` | Write + run tests |
| `review <ID>` | Gap analysis + code review |
| `merge <ID>` | Merge feature branch into base |
| `pr <ID>` | Create GitHub PR |
| `done <ID>` | Transition Done, log work time |
| `status` | Rich view of all active tasks |
| `auto <ID>` | Chain start→approach→impl→test→review |
