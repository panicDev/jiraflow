#!/usr/bin/env bash
# dashboard-ingest.sh <HOOK_NAME>
#
# Claude Code hook forwarder: stdin(hook payload JSON) → POST /ingest
#
# Design ref: docs/design/MAE-210.design.md (Key Decisions #1–3)
# Principles:
#   - fail-silent: exit 0 always, no stdout/stderr output
#   - stdin passthrough: no parsing, no jq dependency
#   - timeout: --connect-timeout 0.5 --max-time 1

set +e

HOOK_NAME="${1:-}"
INGEST_URL="${DASHBOARD_INGEST_URL:-http://127.0.0.1:8765/ingest}"

# stdin → curl via pipe (--data-binary @-).
# On Windows (Git Bash/MSYS2), if you pass non-ASCII arguments to the native exe,
# UTF-8 → ANSI (CP949) conversion occurs and Hangul is broken. with stdin instead of argv
# Bypass the conversion by shedding.
PAYLOAD="$(cat)"

printf '%s' "${PAYLOAD}" | curl \
  --connect-timeout 0.5 \
  --max-time 1 \
  --noproxy '*' \
  -s \
  -o /dev/null \
  -X POST \
  -H 'Content-Type: application/json' \
  --data-binary @- \
  "${INGEST_URL}?hook=${HOOK_NAME}" \
  || true

exit 0
