---
name: jira-setup
description: "Interactive setup wizard for Jira MCP server registration and connection validation. Triggers: jira setup, setup jira, MCP registration."
user-invocable: false
argument-hint: ""
allowed-tools:
  - Read
  - Bash
  - mcp__atlassian__jira_get_user_profile
  - mcp__atlassian__jira_search
---

# jira-setup: Interactive Jira Setup Wizard

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Overview

Interactive configuration wizard to register a Jira MCP server (`atlassian`) with Claude Code.

## Step 1: Prerequisites Check

### 1-1. Check uv installation

```bash
uv --version
```

On failure:
```
❌ UV is not installed.

Installation method:
  Windows (PowerShell): irm https://astral.sh/uv/install.ps1 | iex
  macOS/Linux:          curl -LsSf https://astral.sh/uv/install.sh | sh

After installation, restart your terminal and run /jira setup again.
```
→ Stop

### 1-2. Check for Python 3.10+

```bash
python --version 2>/dev/null || python3 --version 2>/dev/null
```

**Avoid Windows Store stub**: If `python --version` does not return "Python 3.x.x" and outputs nothing, or tries to open the Microsoft Store, it is considered a stub. Confirm replacement with `uv python list`.

Without or without Python 3.10:
```
❌ Requires Python 3.10 or higher.

Current version: <version or "none">

Install Python with uv:
  uv python install 3.11

Or install directly from python.org.
```
→ Stop

When prerequisites are passed: `✅ Prerequisites checked (uv <version>, Python <version>)`

## Step 2: Check Existing Registration

Inspect `.claude/settings.local.json` and `~/.claude/settings.json`:

```bash
cat .claude/settings.local.json 2>/dev/null
cat ~/.claude/settings.json 2>/dev/null
```

If an `atlassian` item exists under the `mcpServers` key, it is judged to have already been registered.

**If you are already registered**, you will be guided through your options:

```
ℹ️ The Jira MCP server (atlassian) is already registered.

What would you like to do?
1. Run only the connection test
2. Reset credentials (overwrite existing settings)
3. Cancel
```

Ask the user to make a choice with the `AskUserQuestion` tool:
- Select "Test Connection" → Go directly to Step 5
- Select "Reset" → Proceed from Step 3
- Select "Cancel" → Exit

## Step 3: Collect Credentials

Collect the following information using the `AskUserQuestion` tool.

**Required:**

1. **JIRA_URL** — Jira Cloud URL
   - Example: `https://your-domain.atlassian.net`
   - Check: Must start with `https://` and include `atlassian.net`

2. **JIRA_USERNAME** — Atlassian account email
   - Example: `your-email@company.com`

3. **JIRA_API_TOKEN** — API token
   - Issuance link: https://id.atlassian.com/manage-profile/security/api-tokens
   - Instructions not to display input values ​​on screen

**Optional** (separate question):

4. **JIRA_PROJECTS_FILTER** — Allow access project keys (comma separated)
   - Example: `PROJ` or `PROJ,DEV`
   - If left blank, all projects can be accessed

5. **JIRA_DEFAULT_PROJECT** — Default project key (automatically included in JQL query)
   - Example: `PROJ`
   - If left blank, no project filtering

## Step 4: Register MCP Server

Register the MCP server with the collected credentials:

```bash
claude mcp add atlassian \
  -e JIRA_URL="<JIRA_URL>" \
  -e JIRA_USERNAME="<JIRA_USERNAME>" \
  -e JIRA_API_TOKEN="<JIRA_API_TOKEN>" \
  -- uvx mcp-atlassian
```

If `JIRA_PROJECTS_FILTER` is entered, add `-e JIRA_PROJECTS_FILTER="<value>"`.

**Note**: `JIRA_DEFAULT_PROJECT` is a variable used by the plugin itself, not the MCP server, so record it separately in `.claude/settings.local.json` or `CLAUDE.md`.

After registration: `✅ MCP server registration complete`

## Step 5: Validate Connection

Verify connection by calling `mcp__atlassian__jira_get_user_profile`.

**On success:**
```
✅ Connection successful!

User: <displayName> (<emailAddress>)
Account ID: <accountId>

The Jira MCP server is successfully connected.
The /jira-task workflow is now available.
```

**Error diagnosis on failure:**

| error pattern | Cause | Solution |
|-----------|------|--------|
| `401 Unauthorized` | API token or email error | Recheck JIRA_USERNAME and JIRA_API_TOKEN |
| `404 Not Found` | JIRA_URL error | Check URL format (`https://domain.atlassian.net`) |
| `connection refused` | network problems | Check your internet connection and firewall |
| `uvx not found` | uv not installed or PATH error | Recheck `uv --version` |

```
❌ Connection failed

Error: <error message>
Cause: <Diagnosis result>
Solution: <Concrete Action>

To modify your credentials, run /jira setup again.
```

## Step 6: Post-Setup Summary

```
─────────────────────────────────────────
🎉 Jira setup complete
─────────────────────────────────────────
MCP Server: atlassian (uvx mcp-atlassian)
Linked account: <email>
Jira URL: <JIRA_URL>

Next steps:
  /jira — Check connection status and available commands
  /jira-task init — Get list of assigned tasks
─────────────────────────────────────────
```
