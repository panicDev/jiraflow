# jiraflow: Jira + Coding Agent Integration

Plugin yang menghubungkan Jira task management dengan agentic software development workflow. Mendukung Claude Code, Codex, OpenCode, Pi, Gemini CLI, dan agent lain yang kompatibel dengan AGENTS.md.

## Workflow

```
discover → create → init → start → approach → impl → test → review → merge → pr → done
```

## Setup

Environment variables required:
- `JIRA_URL` — Jira instance URL
- `JIRA_USERNAME` — Jira username / email
- `JIRA_API_TOKEN` — Jira API token

MCP server required: `mcp-atlassian` (Atlassian MCP server, tool prefix `mcp__atlassian__`).

CLI tools required: `git`, `gh` (GitHub CLI).

Plugin root path: set `JIRAFLOW_ROOT` env var to the absolute path of this plugin directory.

## Invoking Skills

When the user types `/jira-task <action> [TASK-ID]`, read and follow the corresponding skill file:

| Action | Skill File |
|--------|-----------|
| `discover` | `skills/jira-task-discover/SKILL.md` |
| `create` | `skills/jira-task-create/SKILL.md` |
| `init` | `skills/jira-task-init/SKILL.md` |
| `start` | `skills/jira-task-start/SKILL.md` |
| `approach` | `skills/jira-task-approach/SKILL.md` |
| `impl` | `skills/jira-task-impl/SKILL.md` |
| `test` | `skills/jira-task-test/SKILL.md` |
| `review` | `skills/jira-task-review/SKILL.md` |
| `merge` | `skills/jira-local-merge/SKILL.md` |
| `pr` | `skills/jira-task-pr/SKILL.md` |
| `done` | `skills/jira-task-done/SKILL.md` |
| `auto` | `skills/jira-task-auto/SKILL.md` |
| `clean` | `skills/jira-task-clean/SKILL.md` |
| `report` | `skills/jira-task-report/SKILL.md` |
| `status` | `skills/jira-task-status/SKILL.md` |

`/jira` or `/jira dashboard` → `skills/jira-dashboard/SKILL.md`

## Tool Name Mapping

Skills use Claude Code tool names. Map to your agent's equivalent:

| Skill uses | Equivalent |
|-----------|-----------|
| `Read` | read file / view file |
| `Write` | write file / create file |
| `Edit` | edit file / replace in file |
| `Bash` | run shell command |
| `Glob` | list / find files |
| `Grep` | search / grep in files |
| `Skill` | read the referenced `.md` file and follow it |
| `Agent` | spawn sub-agent with the given prompt |

## TASK-ID Auto-Detection

When TASK-ID is not provided, detect from (in order):
1. `git branch --show-current` — extract from `<prefix>/<TASK-ID>` pattern (prefix: fix, feature, task, hotfix, etc.)
2. `.jira-context.json` — read `taskId` or active task in `tasks[]`

## Policies

- All output in English
- No Jira comments (`jira_add_comment` forbidden)
- Cache-first Jira fetch (check `cachedIssue` in `.jira-context.json` before API call)
- All context writes via `scripts/jira-context-update.py`

Full policy reference: `docs/policies.md`
