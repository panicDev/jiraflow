#!/usr/bin/env bash
# install.sh — one-shot setup for jira-cc plugin
# Usage: bash install.sh
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$PLUGIN_ROOT/.env"

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
    read -r -s value; echo
    [[ -z "$value" ]] && value="$default"
  else
    if [[ -n "$default" ]]; then
      echo -ne "${BOLD}${label}${RESET} [${CYAN}${default}${RESET}]: "
    else
      echo -ne "${BOLD}${label}${RESET}: "
    fi
    read -r value
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

# ── banner ────────────────────────────────────────────────────────────────────
hr
echo -e "${BOLD}  jira-cc — one-shot install${RESET}"
echo    "  Plugin root: $PLUGIN_ROOT"
hr
echo

# ── step 1: agent selection ───────────────────────────────────────────────────
echo -e "${BOLD}Step 1: Select your coding agent${RESET}"
echo "  1) Claude Code  (uses \`claude mcp add\`)"
echo "  2) Codex / OpenCode / Pi / other  (writes .env file)"
echo "  3) Both (Claude Code + .env)"
echo -ne "Choice [1]: "
read -r AGENT_CHOICE
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
  # uv required for mcp-atlassian
  if ! command -v uv &>/dev/null; then
    warn "uv not found — required for uvx mcp-atlassian"
    echo    "  Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
    echo -ne "  Continue anyway? [y/N]: "
    read -r CONT; [[ "$CONT" =~ ^[Yy]$ ]] || exit 1
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

prompt_with_default JIRA_URL      "JIRA_URL      (e.g. https://company.atlassian.net)" "${JIRA_URL:-}"
prompt_with_default JIRA_USERNAME "JIRA_USERNAME (Atlassian email)"                     "${JIRA_USERNAME:-}"
prompt_with_default JIRA_API_TOKEN "JIRA_API_TOKEN"                                     "${JIRA_API_TOKEN:-}" "yes"
echo
prompt_with_default JIRA_PROJECTS_FILTER "JIRA_PROJECTS_FILTER (optional, e.g. PROJ,DEV)" "${JIRA_PROJECTS_FILTER:-}"
prompt_with_default JIRA_DEFAULT_PROJECT "JIRA_DEFAULT_PROJECT (optional, e.g. PROJ)"      "${JIRA_DEFAULT_PROJECT:-}"
echo

# basic validation
if [[ -z "$JIRA_URL" || -z "$JIRA_USERNAME" || -z "$JIRA_API_TOKEN" ]]; then
  err "JIRA_URL, JIRA_USERNAME, and JIRA_API_TOKEN are required."; exit 1
fi
JIRA_URL="${JIRA_URL%/}"  # strip trailing slash

# ── step 4: connection test ───────────────────────────────────────────────────
echo -e "${BOLD}Step 4: Testing connection to Jira${RESET}"
HTTP_CODE=$(curl -s -o /tmp/jira-install-test.json -w "%{http_code}" \
  -u "${JIRA_USERNAME}:${JIRA_API_TOKEN}" \
  "${JIRA_URL}/rest/api/3/myself" 2>/dev/null || echo "000")

if [[ "$HTTP_CODE" == "200" ]]; then
  DISPLAY_NAME=$(python3 -c "import json,sys; d=json.load(open('/tmp/jira-install-test.json')); print(d.get('displayName',''))" 2>/dev/null || echo "")
  ok "Connected as: ${DISPLAY_NAME:-$JIRA_USERNAME} (HTTP 200)"
else
  case "$HTTP_CODE" in
    401) err "Auth failed (401) — check JIRA_USERNAME and JIRA_API_TOKEN" ;;
    404) err "Not found (404) — check JIRA_URL format (https://domain.atlassian.net)" ;;
    000) err "Connection failed — check network / JIRA_URL" ;;
    *)   err "Unexpected HTTP $HTTP_CODE" ;;
  esac
  echo -ne "  Continue setup anyway? [y/N]: "
  read -r CONT; [[ "$CONT" =~ ^[Yy]$ ]] || exit 1
fi
echo

# ── step 5: configure ─────────────────────────────────────────────────────────
echo -e "${BOLD}Step 5: Configure${RESET}"

if $USE_ENV_FILE; then
  cat > "$ENV_FILE" <<EOF
# jira-cc environment — generated by install.sh
# Source this file before starting your coding agent:
#   source .env   OR add to your shell RC / direnv .envrc

export JIRA_URL="$JIRA_URL"
export JIRA_USERNAME="$JIRA_USERNAME"
export JIRA_API_TOKEN="$JIRA_API_TOKEN"
export JIRAFLOW_ROOT="$PLUGIN_ROOT"
EOF
  [[ -n "$JIRA_PROJECTS_FILTER" ]] && echo "export JIRA_PROJECTS_FILTER=\"$JIRA_PROJECTS_FILTER\"" >> "$ENV_FILE"
  [[ -n "$JIRA_DEFAULT_PROJECT" ]] && echo "export JIRA_DEFAULT_PROJECT=\"$JIRA_DEFAULT_PROJECT\""   >> "$ENV_FILE"

  # ensure .env is gitignored in the plugin root
  if ! grep -qF ".env" "$PLUGIN_ROOT/.gitignore" 2>/dev/null; then
    echo ".env" >> "$PLUGIN_ROOT/.gitignore"
  fi

  ok ".env written to $ENV_FILE"
  info "Source it before running your agent:  source $ENV_FILE"
fi

if $USE_CLAUDE_CODE; then
  # build claude mcp add command
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

  # JIRAFLOW_ROOT via CLAUDE.md env hint (informational only — claude reads project CLAUDE.md)
  info "Set JIRAFLOW_ROOT=$PLUGIN_ROOT in your shell RC for full cross-agent support"
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
