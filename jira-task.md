---
name: jira-task
description: Main workflow command for Jira-integrated development. Routes to specialized skills based on the action argument. Usage /jira-task [action] [TASK-ID]. Actions create, discover, init, start, approach, impl, test, review, merge, pr, done, report, status, clean. Triggers jira-task, jira task, create task, new task, discover requirements, init tasks, setup tasks, start task, begin task, approach task, implement task, test task, review task, create PR, complete task, task report, clean worktree, task creation, issue registration, requirements gathering, status report, work environment setup, start work, approach design, start implementation, run tests, code review, create PR, complete task, clean worktree
user-invocable: true
argument-hint: "[create|discover|init|start|approach|impl|test|review|pr|merge|done|report|auto|clean] [TASK-ID or hint/topic]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Skill
  - mcp__atlassian
---

# /jira-task - Jira Development Workflow

Parse the user's argument to determine the action and task ID, then execute the corresponding workflow.

## Argument Parsing

The argument format is: `[action] [TASK-ID or hint]`

- **action**: One of `create`, `discover`, `init`, `start`, `approach`, `impl`, `test`, `review`, `pr`, `merge`, `done`, `report`, `status`, `auto`, `clean`. `plan`/`design` are accepted as deprecated aliases for `approach` (auto-routed).
- **TASK-ID**: Jira issue key (e.g., `PROJ-123`). Optional — if omitted, auto-detect from context. Not required for `create`, `discover`, `init`, `report`, `status`.
- For `create`, any text after the action is treated as an initial hint (natural-language description) and passed to the skill as-is.
- For `discover`, any text after the action (natural-language topic) and flags such as `--lite`, `--from <file-path>` are delegated to the skill verbatim.

If no action is provided, show the help text (same as `/jira` command).

## TASK-ID Auto-Detection

When TASK-ID is not provided, detect it automatically in the following priority order:

1. **Git branch name**: Run `git branch --show-current`. If the branch matches `feature/<TASK-ID>`, extract the TASK-ID.
2. **Current directory name**: Check if the current directory name matches a Jira issue key pattern (`[A-Z]+-\d+`, e.g., `PROJ-123`).
3. **`.jira-context.json`**: Read the file and use the active task ID if present.

If auto-detection succeeds, proceed with the detected TASK-ID. If it fails and the action requires a TASK-ID, ask the user to provide it.

## Action Routing

Each action follows the workflow of its corresponding skill exactly. See each skill's SKILL.md for detailed steps.

**Important: Always use the `Skill` tool when invoking sub-skills. Never use the `Task` tool.**

### `create [natural-language hint]`

**Mandatory rule**: When the `create` keyword is detected, the Skill tool below **must** be called. Claude is forbidden from calling `jira_create_issue` directly to create an issue — due to repeated past failures, issues may only be created through the skill which encodes the schema/field rules.

Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-create", args: "<pass all arguments the user entered after create, verbatim>" })`

Argument examples:
- `create` → args: `""` (uses conversation context only)
- `create add login feature` → args: `"add login feature"`
- `create attach OTP two-factor auth to auth module` → args: `"attach OTP two-factor auth to auth module"`
- `create --from-requirements docs/requirements/<slug>.requirements.md` → args: `"--from-requirements docs/requirements/<slug>.requirements.md"` (bulk-registers Epic/Story/Sub-task using `/jira-task discover` output as input)

Whether to decompose into subtasks is determined automatically by the skill (no separate flag needed). In `--from-requirements` mode, automatic determination is skipped and the tree is used as-is.

### `discover [natural-language topic] [--lite] [--from <file-path>]`

**Mandatory rule**: When the `discover` keyword is detected, the Skill tool below **must** be called. Claude is forbidden from directly browsing the codebase or writing requirements documents — this must be handled only through the skill which encodes the question patterns, document templates, and document path conventions.

Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-discover", args: "<pass all arguments the user entered after discover, verbatim>" })`

Argument examples:
- `discover user notification system` → args: `"user notification system"`
- `discover "payment module renewal" --lite` → args: `"\"payment module renewal\" --lite"`
- `discover --from docs/raw/req.md` → args: `"--from docs/raw/req.md"`

Even if the natural-language topic is empty, delegate it as-is — the skill's Step 0 will prompt the user for input.

### `init [count | ISSUE-KEY | natural-language description]`

**Mandatory rule**: Regardless of the argument format (number, issue key, or natural language), when the `init` keyword is detected, the Skill tool below **must** be called. Claude is forbidden from handling it directly or skipping the skill call.

Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-init", args: "<pass all arguments the user entered after init, verbatim>" })`

Argument examples:
- `init` → args: `""`
- `init 3` → args: `"3"`
- `init MAE-2` → args: `"MAE-2"`
- `init MAE-2 analyze subtasks and only those ready to start` → args: `"MAE-2 analyze subtasks and only those ready to start"`

### `start <TASK-ID>`
Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-start", args: "<TASK-ID>" })`

### `approach <TASK-ID>`
Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-approach", args: "<TASK-ID>" })`

Generates a level-aware approach document (L1/L2/L3) that unifies the former `plan` + `design` two-stage process into a single stage.

### `plan <TASK-ID>` / `design <TASK-ID>` (deprecated alias)

`plan` and `design` were consolidated into `approach` in MAE-350. When called, print a deprecation notice once and then auto-route to the approach skill.

First, print the following message to the user:

```
⚠️ deprecated: `plan`/`design` have been consolidated into `approach` (MAE-350). Automatically routing to `/jira-task approach <TASK-ID>`.
```

Then: `Skill({ skill: "jiraflow:jira-task-approach", args: "<TASK-ID>" })`

### `impl <TASK-ID>`
Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-impl", args: "<TASK-ID>" })`

### `test <TASK-ID>`
Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-test", args: "<TASK-ID>" })`

### `review <TASK-ID>`
Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-review", args: "<TASK-ID>" })`

### `pr <TASK-ID>`
Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-pr", args: "<TASK-ID>" })`

### `merge <TASK-ID>`
Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-local-merge", args: "<TASK-ID>" })`

### `done <TASK-ID>`
Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-done", args: "<TASK-ID>" })`

### `auto <TASK-ID>`
Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-auto", args: "<TASK-ID>" })`

Automatically chains and sequentially executes `start → approach → impl → test → review`. Already-completed steps are skipped. `merge/pr/done` are not included.

### `clean [TASK-ID ...] | --all | --list`
Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-clean", args: "<TASK-ID(s) or --all or --list>" })`

Cleans up worktrees and branches. Use `--list` to view current status, `--all` to bulk-clean merged/completed items.

### `report`
Use the `Skill` tool: `Skill({ skill: "jiraflow:jira-task-report", args: "" })`

### `status`
Quick status check — reads active task information from `.jira-context.json` and fetches the latest status from Jira to display.

## Error Handling

- If TASK-ID is not provided and auto-detection fails, ask the user to provide it
- If Jira MCP server is not connected, guide user to check `/jira` for setup
- If transition fails (e.g., invalid transition name), use `mcp__atlassian__jira_get_transitions` to list available transitions for the issue

## Response Summary

Print a summary in the following format at the end of every response:

```
─────────────────────────────────────────
📋 Jira Workflow Summary
─────────────────────────────────────────
✅ Done: [work performed in this response]
🔧 Used: [skills, agents, and Jira MCP tools used]
💡 Next: [recommended next action]
─────────────────────────────────────────
```

Rules:
- **Done**: Briefly describe what was actually performed (e.g., "PROJ-123 planning document created")
- **Used**: List the skills (`jira-task-approach`, etc.), agents (`jira-reviewer`, etc.), and Jira MCP tools (`get-issue`, `transition`, etc.) used. Do not include Jira comment tools because Jira ticket comments are disabled. Omit if nothing was used.
- **Next**: Recommend the next workflow step based on `completedSteps` in `.jira-context.json`. For work outside the workflow, recommend the contextually appropriate next action.
  - Workflow step order: `discover → create → init → start → approach → impl → test → review → merge → pr → done`
  - After `review` is complete, next must be `merge` (`/jira-task merge <TASK-ID>`)
  - After `merge` is complete, next is `pr` (`/jira-task pr <TASK-ID>`)
- May be omitted for simple Q&A unrelated to the workflow
