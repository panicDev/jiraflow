---
name: jira-dashboard
description: "Manage the Jira dashboard server — setup, start, stop, or check status. Triggers: jira dashboard, dashboard status, start dashboard."
allowed-tools:
  - Bash
---

# jira-dashboard Skill

**Language Rule**: All user-facing output, generated documents, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, file paths, and JSON keys exactly as-is. If any legacy instruction below contains Korean, translate it to English at runtime.

Responsible for setup, startup, stop, and status inquiry of the Dashboard server.
All OS-level operations are delegated to `scripts/dashboard-control.sh`.

## Action Routing

Route as follows according to ARGUMENTS.

| ARGUMENTS | Action |
|-----------|------|
| (empty / only `dashboard`) | `cmd_default` — Automatic setup→start after checking status |
| `start` | `dashboard_start` |
| `stop` | `dashboard_stop` |
| `status` | `dashboard_status` |
| `setup` | `dashboard_setup` |
| Other | Instructions for use |

## Execution

### 1. Check plugin root env var

```bash
# JIRAFLOW_ROOT (cross-agent) takes precedence over CLAUDE_PLUGIN_ROOT (Claude Code only).
# If neither is set, the helper will error with a friendly message.
```

### 2. Determine helper script path

```bash
# The skill is executed in the user project context → searched in the plugin root
CTRL_SH="${JIRAFLOW_ROOT:-$CLAUDE_PLUGIN_ROOT}/scripts/dashboard-control.sh"
if [[ ! -f "${CTRL_SH}" ]]; then
  echo "Error: Cannot find dashboard-control.sh: ${CTRL_SH}" >&2
  exit 1
fi
```

### 3. Execute action

Call the bash helper according to the conditions below.

**No arguments (default)**:
```bash
bash "${CTRL_SH}"
```

**start**:
```bash
bash "${CTRL_SH}" start
```

**stop**:
```bash
bash "${CTRL_SH}" stop
```

**status**:
```bash
bash "${CTRL_SH}" status
```

**setup**:
```bash
bash "${CTRL_SH}" setup
```

**Other**:
```bash
bash "${CTRL_SH}" "${ACTION}"
# The helper outputs usage and exit 1
```

## Instructions for Claude

Do it in the following order:

1. Parse the action from ARGUMENTS.
   - If empty or only `dashboard`, action = `""` (default)
   - If it is one of `start`, `stop`, `status`, or `setup`, use it as is.
   - Otherwise, print usage and exit

2. Check the plugin root environment variable in Bash:
   ```bash
   echo "${JIRAFLOW_ROOT:-$CLAUDE_PLUGIN_ROOT}"
   ```
   If empty, prompt the user to set `JIRAFLOW_ROOT` to the absolute path of the jiraflow plugin directory.

3. Call the helper:
   ```bash
   CTRL_SH="${JIRAFLOW_ROOT:-$CLAUDE_PLUGIN_ROOT}/scripts/dashboard-control.sh"
   bash "${CTRL_SH}" <action>
   ```
   (If action is default, call `bash "${CTRL_SH}"` without arguments)

4. The helper output is delivered to the user as is.

5. If the helper exit code is 0, it announces success, if it is non-0, it announces failure (highlighting the helper's stderr message).

## Output Format (if successful)

The contents output by the helper are wrapped in block form and delivered to the user:

```
Dashboard command result:
<Helper stdout contents>
```

Additional information when start is successful:
```
Open http://127.0.0.1:8765 in your browser, or
You can check the status with `/jira dashboard status`.
```
