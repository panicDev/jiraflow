# Shared Script Lookup Pattern

Plugin `scripts/` Standard pattern for determining the absolute path of child public scripts. The skill runs in the cwd of the user project (including the work tree), so the script cannot be found using only a relative path.

## How to use

The calling skill sets up the following two variables and then executes the lookup block:

- `SCRIPT_NAME` — Script file name to find (e.g. `jira-attach.sh`, `jira-context-update.py`, `propagate-mcp-config.sh`, `append-review-log-wrapper.sh`, `cleanup-worktree-mcp.py`)
- `OUT_VAR` — Variable name to contain the absolute path of the result (e.g. `JIRA_ATTACH_SH`, `PROPAGATE_SH`)

```bash
SCRIPT_NAME="<script file name>"
OUT_VAR="<output variable name>"

# 1) JIRAFLOW_ROOT 2) CLAUDE_PLUGIN_ROOT 3) cwd 4) repoRoot(.jira-context.json) 5) plugin cache latest semver
# Cache fallback must be sort -V | Select the latest version with tail -1. find ... | head -1 is prohibited because it catches the stale version.
_resolved=""
for _c in "${JIRAFLOW_ROOT}/scripts/${SCRIPT_NAME}" \
          "${CLAUDE_PLUGIN_ROOT}/scripts/${SCRIPT_NAME}" \
          "scripts/${SCRIPT_NAME}" \
          "$(node -e "try{console.log(require('./.jira-context.json').repoRoot)}catch{}" 2>/dev/null)/scripts/${SCRIPT_NAME}" \
          "$(find "$HOME/.claude" -name "${SCRIPT_NAME}" -type f 2>/dev/null | sort -V | tail -1)"; do
  [ -n "$_c" ] && [ -f "$_c" ] && _resolved="$_c" && break
done
printf -v "$OUT_VAR" '%s' "$_resolved"
unset _resolved _c
```

If not found, `$OUT_VAR` is an empty string. The caller is responsible for handling empty values ​​(skip + user guidance).

## Lookup priority basis

1. **`JIRAFLOW_ROOT`** — Cross-agent env var pointing to plugin root. Takes priority over Claude-specific env.
2. **`CLAUDE_PLUGIN_ROOT`** — Injected by Claude Code plugin runtime.
3. **cwd `scripts/`** — If running from the main repo.
4. **`repoRoot`** in `.jira-context.json` — Restore the main repo path from saved context.
5. **Plugin cache latest semver** — `~/.claude/plugins/cache/.../scripts/`. `sort -V | Select latest with tail -1`. `head -1` is prohibited because it grabs the stale version.

## Add new script

Automatically operates without any code changes when adding a new public script under `scripts/`. Reuse the lookup block by changing only `SCRIPT_NAME` to a new file name in the calling skill.
