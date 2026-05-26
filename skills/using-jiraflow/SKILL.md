---
name: using-jiraflow
description: "Bootstrap skill for all agents — explains how to use the jiraflow plugin, lists all workflow actions, prerequisites, and tool mappings. Load this first when starting any jira-cc session."
user-invocable: false
---

# jiraflow: Jira + Coding Agent Integration

Plugin that connects Jira task management with agentic software development workflow.

## Prerequisites

Environment variables required:
- `JIRA_URL` — Jira instance URL (e.g. `https://company.atlassian.net`)
- `JIRA_USERNAME` — Jira username / email
- `JIRA_API_TOKEN` — Jira API token

MCP server required: `mcp-atlassian` (tool prefix `mcp__atlassian__`).

CLI tools required: `git`, `gh` (GitHub CLI).

Set `JIRAFLOW_ROOT` to the absolute path of this plugin directory so scripts can be located.

## Workflow

```
discover → create → init → start → approach → impl → test → review → pr → done
```

## Actions

Invoke with `/jira-task <action> [TASK-ID]`:

| Action | Purpose |
|--------|---------|
| `discover` | Analyze codebase and write a requirements document for a new feature |
| `create` | Register a Jira Epic/Story/Sub-task from requirements or a natural-language hint |
| `init` | Fetch assigned sprint tasks and create feature branches |
| `start` | Check out a feature branch and set the task In Progress |
| `approach` | Generate an implementation approach document (L1/L2/L3 depth) |
| `impl` | Implement the task following the approach document |
| `test` | Write and run tests, generate a test report |
| `review` | Code review against acceptance criteria, generate review document |
| `merge` | Merge feature branch into base branch locally |
| `pr` | Create a GitHub pull request |
| `done` | Mark task Done in Jira and clean up |
| `auto` | Chain start → approach → impl → test → review automatically |
| `clean` | Delete feature branches for completed tasks |
| `report` | Generate a sprint/task progress report |

## Tool Name Mapping

Skills use Claude Code tool names. Map to your agent's equivalent:

| Skill uses | Codex | OpenCode | Pi | General |
|-----------|-------|----------|-----|---------|
| `Read` | read_file | read_file | read | read file |
| `Write` | write_file | write_file | write | write file |
| `Edit` | edit_file | edit_file | edit | replace in file |
| `Bash` | shell | shell | bash | run command |
| `Glob` | list_files | list_files | glob | find files |
| `Grep` | search | search | grep | search in files |
| `Skill` | read the referenced `.md` file and follow it | same | same | same |
| `Agent` | spawn sub-agent | spawn sub-agent | spawn sub-agent | spawn sub-agent |

## TASK-ID Auto-Detection

When TASK-ID is not provided, detect from (in order):
1. `git branch --show-current` — extract from `feature/<TASK-ID>` pattern
2. `.jira-context.json` — read `taskId` or active task in `tasks[]`

## Policies

- All output in English
- No Jira comments (`jira_add_comment` forbidden)
- Cache-first Jira fetch (check `cachedIssue` in `.jira-context.json` before API call)
- All context writes via `scripts/jira-context-update.py`

Full policy reference: `docs/policies.md`

## Invoking Skills

For each action, read and follow the corresponding skill file:

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
