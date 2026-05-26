# CLAUDE.md

This repository is a **Claude Code plugin** (`jiraflow`) that integrates Jira with Claude Code workflows. This document defines conventions for developing and maintaining the plugin itself. See `README.md` for end-user documentation.

<!-- AIDEV-NOTE: Runtime workflow prompts now enforce English-only output and disabled Jira issue comments. Keep skill prompts, command prompts, and templates aligned with this policy. -->

## Working Principle

- **Surgical Changes**: Modify only lines directly related to the request. No adjacent code "improvements"/formatting changes. Clean up only orphan imports/variables created by your changes, and do not touch existing dead code.
- **Simplicity First**: Prohibit adding unsolicited abstractions/configuration options/defense code. Since the skill is prompt markdown, the amount is the token cost.
- **Version synchronization**: When skills/hooks/scripts/settings change, the `version` of `.claude-plugin/plugin.json` must also be uploaded (if not uploaded, marketplace updates will not be detected).

## Repository Layout

- `skills/` — `/jira-task` SKILL.md prompt (1 per step)
- `commands/` — Slash command definitions
- `agents/` — Subagent definition (e.g. jira-reviewer)
- `hooks/` — phase-gate hook + synchronization script (autoloading `hooks/hooks.json`)
- `scripts/` — Common helpers (`jira-attach.sh`, `jira-context-update.py`, dashboard server, etc.)
- `templates/` — Document template (approach/test-report/review/report)
- `tests/` — Plugin tests
- `docs/` — Internal documentation (`mcp-atlassian-tools.md`, requirements/plan/design/test artifacts)

For build/test scripts, see scripts in `package.json`.

## MCP Server: atlassian (mcp-atlassian)

The `atlassian` MCP server provides Jira Cloud tools (tool prefix `mcp__atlassian__`). **Full tools reference: `docs/mcp-atlassian-tools.md`** — Look there first before using new tools.

**Attachment upload is not supported by mcp-atlassian** → REST direct call:
`POST $JIRA_URL/rest/api/3/issue/<KEY>/attachments` (Basic Auth + `X-Atlassian-Token: no-check`).
Credential search order: Environment variable → `.mcp.json` → `~/.claude.json` → `.claude/settings.local.json` → `~/.claude/settings.json`.

## Skill Authoring Conventions

> **Policy reference**: `docs/policies.md` — canonical source for Language, Jira Comment, Cache-First, Attachment, Context Update, and Version Bump policies. The rules below are the authoritative developer-facing form; `docs/policies.md` adds enforcement and test references.


- **Language Rule**: All `/jira-task` skill output must be English. This includes user responses, generated documents, Jira issue summaries/descriptions, AskUserQuestion text/options, and completion summaries. Preserve code, variable names, branch names, file paths, commands, JSON keys, and Jira issue keys exactly as-is. If any legacy prompt/example still contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

- **Jira Comment Policy**: Do not post comments to Jira tickets. Do not call `mcp__atlassian__jira_add_comment`, do not include `comment` payloads in `jira_transition_issue`, and skip any old comment-posting step. Attachments and status transitions remain enabled unless the user explicitly says otherwise.

- **Cache-First Fetch** (approach/impl/test/review/done): Check `cachedIssue` of `.jira-context.json` first before calling.
  1. If `cachedIssue.key === <TASK-ID>`, use that value → call `jira_get_issue` **omitted**.
  2. If miss, fetch to original fields/comment_limit and update `cachedIssue`.
  3. For forced refresh, the user manually deletes `cachedIssue`.

- **Public script lookup**: Since the plugin `scripts/` is not directly visible in the worktree cwd, the absolute path is determined through lookup just before calling. Single source: `skills/_shared/script-lookup.md`. Each skill reads the file right before calling, then sets up `SCRIPT_NAME` / `OUT_VAR` and executes the lookup block.
  - `jira-attach.sh` (approach/test/review): Upload Jira attachment. If you can't find it, just skip the attachment and proceed with the workflow.
  - `jira-context-update.py` (start/approach/impl/test/review/merge/done): update worktree-local + aggregate `.jira-context.json` and two `completedSteps`/`status`/`<step>At`/`cachedIssue`.
    Call: `python3 "$JIRA_CTX_UPDATE_PY" <TASK-ID> <step> <status> <ctx-file> [<ctx-file>...]`.
    `status="-"` preserves status/cachedIssue.status as is (for record-only steps without Jira transition). Standard call snippet: `skills/_shared/context-update.md`.
  - Others: `propagate-mcp-config.sh`(init), `append-review-log-wrapper.sh`(review), `cleanup-worktree-mcp.py`(done).

- **Always fetch issue details before status transition** (`jira_get_transitions` → pass transitionId to `jira_transition_issue`).

- **Context file**: The active task context is `.jira-context.json` (gitignored). Branch pattern `<prefix>/<TASK-ID>` where prefix is issuetype-based (`fix`, `feature`, `task`, `hotfix`). Branch name is persisted to the `branch` field of the task entry at `start`. Worktree location `../<project>_worktree/<TASK-ID>`.

- **Progress tracking**: When each skill is completed, its steps are added to `completedSteps` in `.jira-context.json` (to prevent duplication). Valid steps: `discover`, `create`, `init`, `start`, `approach`, `impl`, `test`, `review`, `merge`, `pr`, `done`. `done` additionally changes `status` to `"Done"`. Progress `✓` in Completion Summary is created from `completedSteps`. (`plan`/`design` has been integrated and removed as `approach` in MAE-350; stale traces of existing tasks are processed by migration logic.)

- **No code snippets in Approach documents** (waste of tokens).

## JIRA_DEFAULT_PROJECT Scoping Rule

If the `JIRA_DEFAULT_PROJECT` environment variable is set, **all JQL must include the condition `project = <JIRA_DEFAULT_PROJECT>`**. No exceptions such as Sprint/Epic sub/related issue search, etc. Applies to all skills that use JQL, such as init/report (plugin own rules separate from mcp-atlassian's `JIRA_PROJECTS_FILTER`).
