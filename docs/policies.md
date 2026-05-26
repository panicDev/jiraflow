# Plugin Policies

Canonical reference for jiraflow plugin policies. See `CLAUDE.md` for developer conventions.

## Language Policy

All `/jira-task` skill output must be English: user responses, generated documents, Jira issue summaries/descriptions, AskUserQuestion text/options, and completion summaries.

Preserve exactly as-is: code, variable names, branch names, file paths, commands, JSON keys, Jira issue keys.

If any legacy prompt/example contains Korean, translate to English at runtime; Korean text is not authoritative for output language.

**Enforcement**: `npm run test:prompts` scans skills/commands/agents/templates Markdown for Korean characters.

## Jira Comment Policy

Do not post comments to Jira tickets:
- Do not call `mcp__atlassian__jira_add_comment`
- Do not include `comment` payloads in `jira_transition_issue`
- Skip any legacy comment-posting step

Attachments and status transitions remain enabled.

**Enforcement**: `npm run test:prompts` verifies no `jira_add_comment` in skill files.

## Cache-First Fetch Policy

For approach/impl/test/review/done steps:
1. If `cachedIssue.key === <TASK-ID>` in `.jira-context.json` → skip `jira_get_issue`
2. On cache miss: fetch and update `cachedIssue`
3. Forced refresh: user manually deletes `cachedIssue`

## Attachment and Transition Policy

- Attachments: enabled — upload via `jira-attach.sh`
- Transitions: enabled — fetch `jira_get_transitions` first, then pass `transitionId` to `jira_transition_issue`

## Context Update Policy

All context writes route through `scripts/jira-context-update.py`. No ad-hoc JSON patches in prompts.

Call: `python3 "$JIRA_CTX_UPDATE_PY" <TASK-ID> <step> <status> <ctx-file> [<ctx-file>...]`

`status="-"` preserves current status and `cachedIssue.status`.

## Version Bump Policy

When skills, hooks, scripts, or settings change: update `version` in `.claude-plugin/plugin.json`. Marketplace updates require a version bump.
