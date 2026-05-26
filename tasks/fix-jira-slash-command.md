# /jira slash command misdiagnosis bug fix

## Overview

An issue where when executing the `/jira` command, "Connection not established" is incorrectly displayed even though Jira is properly connected.

- **Skill file location**: `~/.claude/plugins/cache/jira-claude-code-integration/jira-integration/0.4.1/commands/jira.md`
- **Jira plugin repository**: `mzd-hseokkim/jira-claude-code-integration`

---

## Bug 1: Passing `"me"` to `jira_get_user_profile`

### Problem

Skill file line 17:

```
Check if Atlassian MCP server is available by trying to use `mcp__atlassian__jira_get_user_profile`.
```

There is no specification on what to pass as `user_identifier`, so Claude infers and uses `"me"`.
The `mcp-atlassian` tool does not support semantic values ​​like `"me"` and requires a real email/account ID, so it always fails:

```json
{"success": false, "error": "Could not determine how to look up user 'me'."}
```

### Correction

Replace connection verification with a JQL search that always returns a response instead of `jira_get_user_profile`:

```
Check if Atlassian MCP server is available by calling `mcp__atlassian__jira_search`
with JQL `project is not EMPTY ORDER BY updated DESC` and limit 1.
If the call succeeds (no exception), the server is connected.
```

Alternatively, there is a way to specify the actual email in the skill file, but since emails are different for each user, the JQL method is more general-purpose.

---

## Bug 2: Attempting to read `JIRA_URL` from shell environment variable

### Problem

Skill file line 20:

```
The connected Jira instance URL (from JIRA_URL env var)
```

Claude runs `echo $JIRA_URL` but it is always empty. This is because `JIRA_URL` is not a shell environment variable, but only exists in the MCP server configuration `env` block of `.claude.json`:

```json
"atlassian": {
  "type": "stdio",
  "command": "uvx",
  "args": ["mcp-atlassian"],
  "env": {
    "JIRA_URL": "https://mz-dev.atlassian.net", ← Injected only inside the MCP process
    "JIRA_USERNAME": "hseokkim@mz.co.kr"
  }
}
```

When viewed in the shell, it is always an empty string, so it is misdiagnosed as "credentials not set."

### Correction

Remove the `JIRA_URL` env var confirmation instruction and change to extract the URL from the MCP tool call result:

```
Report the Jira instance URL from the search result's issue URLs (e.g., extract base URL
from issue key responses), or simply omit the URL field if it cannot be determined
without shell env access.
```

---

## Example of connection confirmation logic after modification

```markdown
## 1. Connection Status

Check if Atlassian MCP server is available by calling `mcp__atlassian__jira_search`
with JQL `project is not EMPTY ORDER BY updated DESC` and limit 1.

- If the call succeeds: report "Connected"
- If the call throws an error: report "Not connected" and guide setup

Do NOT use `echo $JIRA_URL` to check credentials — these are scoped to the MCP server
process and not visible as shell environment variables.
```

---

## Scope of influence

This bug is limited to a **display error** in the `/jira` command. The actual Jira integration function (`/jira-task *` commands) operates normally.
