#!/usr/bin/env bash
# install.sh — one-shot setup for jiraflow
# Usage (local):  bash install.sh
# Usage (remote): curl -fsSL https://raw.githubusercontent.com/panicDev/jiraflow/main/install.sh | bash
set -euo pipefail

# ── tty detection (curl | bash needs /dev/tty for interactive reads) ──────────
TTY_AVAILABLE=false
if [ -t 0 ] || [ -e /dev/tty ]; then TTY_AVAILABLE=true; fi
_read() {
  if $TTY_AVAILABLE; then read -r "$@" </dev/tty
  else read -r "$@"; fi
}
_read_s() {
  if $TTY_AVAILABLE; then read -r -s "$@" </dev/tty; echo
  else read -r "$@"; fi
}

# ── colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${RESET}"; }
err()  { echo -e "${RED}❌ $*${RESET}"; }
info() { echo -e "${CYAN}ℹ️  $*${RESET}"; }
warn() { echo -e "${YELLOW}⚠️  $*${RESET}"; }
hr()   { echo -e "${CYAN}─────────────────────────────────────────${RESET}"; }

# ── helpers ───────────────────────────────────────────────────────────────────
prompt_with_default() {
  local var_name="$1" label="$2" default="$3" secret="${4:-no}"
  local value=""
  if [[ "$secret" == "yes" ]]; then
    if [[ -n "$default" ]]; then
      echo -ne "${BOLD}${label}${RESET} [current: ${CYAN}****${RESET}]: "
    else
      echo -ne "${BOLD}${label}${RESET}: "
    fi
    _read_s value
    [[ -z "$value" ]] && value="$default"
  else
    if [[ -n "$default" ]]; then
      echo -ne "${BOLD}${label}${RESET} [${CYAN}${default}${RESET}]: "
    else
      echo -ne "${BOLD}${label}${RESET}: "
    fi
    _read value
    [[ -z "$value" ]] && value="$default"
  fi
  printf -v "$var_name" '%s' "$value"
}

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    err "$1 not found. $2"
    return 1
  fi
  ok "$1 found ($(command -v "$1"))"
}

# ── step 0: resolve plugin root (handle curl | bash) ─────────────────────────
PIPED=false
if [[ -f "${BASH_SOURCE[0]:-}" ]]; then
  PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  PIPED=true
  DEFAULT_DIR="$HOME/.local/share/jiraflow"
  hr
  echo -e "${BOLD}  jiraflow — one-shot install (remote mode)${RESET}"
  hr
  echo
  echo -e "${BOLD}Install directory${RESET} [${CYAN}${DEFAULT_DIR}${RESET}]: "
  echo -ne "> "
  _read INSTALL_DIR
  INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_DIR}"

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Existing clone found at $INSTALL_DIR — pulling latest..."
    git -C "$INSTALL_DIR" pull --ff-only
  else
    info "Cloning panicDev/jiraflow → $INSTALL_DIR"
    git clone https://github.com/panicDev/jiraflow.git "$INSTALL_DIR"
  fi
  PLUGIN_ROOT="$INSTALL_DIR"
fi

ENV_FILE="$PLUGIN_ROOT/.env"

# ── banner ────────────────────────────────────────────────────────────────────
hr
echo -e "${BOLD}  jiraflow — one-shot install${RESET}"
echo    "  Plugin root: $PLUGIN_ROOT"
hr
echo

# ── step 1: agent selection ───────────────────────────────────────────────────
echo -e "${BOLD}Step 1: Select your coding agent${RESET}"
echo "  1) Claude Code  (uses \`claude mcp add\`)"
echo "  2) Codex / OpenCode / Pi / other  (writes .env file)"
echo "  3) Both (Claude Code + .env)"
echo -ne "Choice [1]: "
_read AGENT_CHOICE
AGENT_CHOICE="${AGENT_CHOICE:-1}"

USE_CLAUDE_CODE=false
USE_ENV_FILE=false
case "$AGENT_CHOICE" in
  1) USE_CLAUDE_CODE=true ;;
  2) USE_ENV_FILE=true ;;
  3) USE_CLAUDE_CODE=true; USE_ENV_FILE=true ;;
  *) err "Invalid choice. Exiting."; exit 1 ;;
esac
echo

# ── step 2: prerequisites ─────────────────────────────────────────────────────
echo -e "${BOLD}Step 2: Prerequisites${RESET}"
check_cmd git "Install from https://git-scm.com"

if $USE_CLAUDE_CODE; then
  check_cmd claude "Install Claude Code: https://docs.anthropic.com/en/docs/claude-code" || {
    err "claude CLI required for Claude Code mode"; exit 1
  }
  if ! command -v uv &>/dev/null; then
    warn "uv not found — required for uvx mcp-atlassian"
    echo    "  Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
    echo -ne "  Continue anyway? [y/N]: "
    _read CONT; [[ "$CONT" =~ ^[Yy]$ ]] || exit 1
  else
    ok "uv found ($(uv --version))"
  fi
fi

check_cmd gh "Install: https://cli.github.com (needed for /jira-task pr)" || warn "gh not found — /jira-task pr will be unavailable"
echo

# ── step 3: collect credentials ───────────────────────────────────────────────
echo -e "${BOLD}Step 3: Jira credentials${RESET}"
echo "  Get your API token: https://id.atlassian.com/manage-profile/security/api-tokens"
echo

# pre-fill from existing env or .env file
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set +u; source "$ENV_FILE" 2>/dev/null || true; set -u
fi

prompt_with_default JIRA_URL       "JIRA_URL      (e.g. https://company.atlassian.net)" "${JIRA_URL:-}"
prompt_with_default JIRA_USERNAME  "JIRA_USERNAME (Atlassian email)"                    "${JIRA_USERNAME:-}"
prompt_with_default JIRA_API_TOKEN "JIRA_API_TOKEN"                                     "${JIRA_API_TOKEN:-}" "yes"
echo
prompt_with_default JIRA_PROJECTS_FILTER "JIRA_PROJECTS_FILTER (optional, e.g. PROJ,DEV)" "${JIRA_PROJECTS_FILTER:-}"
prompt_with_default JIRA_DEFAULT_PROJECT "JIRA_DEFAULT_PROJECT (optional, e.g. PROJ)"      "${JIRA_DEFAULT_PROJECT:-}"
echo

if [[ -z "$JIRA_URL" || -z "$JIRA_USERNAME" || -z "$JIRA_API_TOKEN" ]]; then
  err "JIRA_URL, JIRA_USERNAME, and JIRA_API_TOKEN are required."; exit 1
fi
JIRA_URL="${JIRA_URL%/}"

# ── step 4: connection test ───────────────────────────────────────────────────
echo -e "${BOLD}Step 4: Testing connection to Jira${RESET}"
_TMP=$(mktemp)
HTTP_CODE=$(curl -s -o "$_TMP" -w "%{http_code}" \
  -u "${JIRA_USERNAME}:${JIRA_API_TOKEN}" \
  "${JIRA_URL}/rest/api/3/myself" 2>/dev/null || echo "000")

if [[ "$HTTP_CODE" == "200" ]]; then
  DISPLAY_NAME=$(python3 -c "import json; d=json.load(open('$_TMP')); print(d.get('displayName',''))" 2>/dev/null || echo "")
  ok "Connected as: ${DISPLAY_NAME:-$JIRA_USERNAME} (HTTP 200)"
else
  case "$HTTP_CODE" in
    401) err "Auth failed (401) — check JIRA_USERNAME and JIRA_API_TOKEN" ;;
    404) err "Not found (404) — check JIRA_URL format (https://domain.atlassian.net)" ;;
    000) err "Connection failed — check network / JIRA_URL" ;;
    *)   err "Unexpected HTTP $HTTP_CODE" ;;
  esac
  echo -ne "  Continue setup anyway? [y/N]: "
  _read CONT; [[ "$CONT" =~ ^[Yy]$ ]] || exit 1
fi
rm -f "$_TMP"
echo

# ── step 5: configure ─────────────────────────────────────────────────────────
echo -e "${BOLD}Step 5: Configure${RESET}"

if $USE_ENV_FILE; then
  cat > "$ENV_FILE" <<EOF
# jiraflow environment — generated by install.sh
# Source this file before starting your coding agent:
#   source .env   OR add to your shell RC / direnv .envrc

export JIRA_URL="$JIRA_URL"
export JIRA_USERNAME="$JIRA_USERNAME"
export JIRA_API_TOKEN="$JIRA_API_TOKEN"
export JIRAFLOW_ROOT="$PLUGIN_ROOT"
EOF
  [[ -n "$JIRA_PROJECTS_FILTER" ]] && echo "export JIRA_PROJECTS_FILTER=\"$JIRA_PROJECTS_FILTER\"" >> "$ENV_FILE"
  [[ -n "$JIRA_DEFAULT_PROJECT" ]] && echo "export JIRA_DEFAULT_PROJECT=\"$JIRA_DEFAULT_PROJECT\""   >> "$ENV_FILE"

  if ! grep -qF ".env" "$PLUGIN_ROOT/.gitignore" 2>/dev/null; then
    echo ".env" >> "$PLUGIN_ROOT/.gitignore"
  fi

  ok ".env written to $ENV_FILE"
  info "Source it before running your agent:  source $ENV_FILE"
fi

if $USE_CLAUDE_CODE; then
  MCP_CMD=(claude mcp add atlassian
    -e "JIRA_URL=$JIRA_URL"
    -e "JIRA_USERNAME=$JIRA_USERNAME"
    -e "JIRA_API_TOKEN=$JIRA_API_TOKEN"
  )
  [[ -n "$JIRA_PROJECTS_FILTER" ]] && MCP_CMD+=(-e "JIRA_PROJECTS_FILTER=$JIRA_PROJECTS_FILTER")
  MCP_CMD+=(-- uvx mcp-atlassian)

  "${MCP_CMD[@]}" && ok "MCP server 'atlassian' registered" || {
    err "claude mcp add failed — try running manually:"
    echo "  ${MCP_CMD[*]}"
  }

  # Install plugin: marketplace first, local symlink fallback
  if claude plugin marketplace add panicDev/jiraflow &>/dev/null \
     && claude plugin install jiraflow@panicDev &>/dev/null; then
    ok "jiraflow plugin installed via marketplace"
  else
    warn "Marketplace install failed — using local symlink"
    CACHE_DIR="$HOME/.claude/plugins/cache/jiraflow/jiraflow/0.1.3"
    mkdir -p "$(dirname "$CACHE_DIR")"
    ln -sfn "$PLUGIN_ROOT" "$CACHE_DIR"
    python3 - <<PYEOF
import json, os
from datetime import datetime, timezone

mp_path = os.path.expanduser("~/.claude/plugins/known_marketplaces.json")
ip_path = os.path.expanduser("~/.claude/plugins/installed_plugins.json")
s_path  = os.path.expanduser("~/.claude/settings.json")
plugin_root = "$PLUGIN_ROOT"
now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

mp = json.load(open(mp_path)) if os.path.exists(mp_path) else {}
mp["jiraflow"] = {"source": {"source": "github", "repo": "panicDev/jiraflow"},
                  "installLocation": plugin_root, "lastUpdated": now}
json.dump(mp, open(mp_path, "w"), indent=2)

ip = json.load(open(ip_path)) if os.path.exists(ip_path) else {"version": 2, "plugins": {}}
for k in ["jiraflow@local", "jiraflow@jiraflow", "jiraflow@panicDev"]:
    ip["plugins"].pop(k, None)
ip["plugins"]["jiraflow@jiraflow"] = [{"scope": "user",
    "installPath": os.path.expanduser("~/.claude/plugins/cache/jiraflow/jiraflow/0.1.3"),
    "version": "0.1.3", "installedAt": now, "lastUpdated": now}]
json.dump(ip, open(ip_path, "w"), indent=2)

if os.path.exists(s_path):
    s = json.load(open(s_path))
    ep = s.setdefault("enabledPlugins", {})
    for k in ["jiraflow@local", "jiraflow@panicDev"]:
        ep.pop(k, None)
    ep["jiraflow@jiraflow"] = True
    json.dump(s, open(s_path, "w"), indent=2)
print("Plugin registered (local).")
PYEOF
    ok "jiraflow plugin installed (local)"
  fi

  info "Set JIRAFLOW_ROOT=$PLUGIN_ROOT in your shell RC for cross-agent support"
fi

echo

# ── done ──────────────────────────────────────────────────────────────────────
hr
echo -e "${BOLD}  Setup complete${RESET}"
hr
echo
echo "  Next steps:"
if $USE_CLAUDE_CODE; then
  echo "    claude             → open Claude Code"
  echo "    > /jira            → verify connection"
  echo "    > /jira-task init  → fetch assigned tasks + create branches"
fi
if $USE_ENV_FILE; then
  echo "    source $ENV_FILE"
  echo "    # then start your agent (codex / opencode / pi / etc.)"
  echo "    # ask it to read: skills/using-jiraflow/SKILL.md"
fi
echo
