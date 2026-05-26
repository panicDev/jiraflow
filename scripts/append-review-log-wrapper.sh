#!/usr/bin/env bash
# append-review-log-wrapper.sh — jira-task-review Step 4.7 wrapper
#
# Wraps scripts/append-review-log.py with:
# - Calculate reviewerVersion (jira-task-review/SKILL.md sha256 prefix 12 characters)
# - SUBAGENT_RESULT_JSON environment variable → tmpfile (multi-line/quote safe)
#   - cleanup
#
# Usage:
#   SUBAGENT_RESULT_JSON='<json>' bash scripts/append-review-log-wrapper.sh <TASK-ID> [<log-dir>]
#
# log-dir Default value: docs/review-log
# The caller wraps the call with set +e to avoid blocking the workflow.

set +e

TASK_ID="${1:?TASK-ID required}"
LOG_DIR="${2:-docs/review-log}"

_GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -n "$_GIT_ROOT" ]; then
    REVIEWER_VERSION=$(shasum -a 256 "$_GIT_ROOT/skills/jira-task-review/SKILL.md" 2>/dev/null | cut -c1-12)
fi
[ -z "$REVIEWER_VERSION" ] && REVIEWER_VERSION="unknown" && echo "⚠️ review-log: Failed to calculate reviewerVersion, recorded as 'unknown'"

# Script path: append-review-log.py in same directory as self
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPEND_PY="$SCRIPT_DIR/append-review-log.py"

TMPFILE=$(mktemp /tmp/review_subagent_XXXXXX.json)
printf '%s' "$SUBAGENT_RESULT_JSON" > "$TMPFILE"

python3 "$APPEND_PY" "$TASK_ID" "$REVIEWER_VERSION" "$TMPFILE" "$LOG_DIR"
APPEND_EXIT=$?
rm -f "$TMPFILE" 2>/dev/null
[ $APPEND_EXIT -ne 0 ] && echo "⚠️ review-log append failed: Python exit code $APPEND_EXIT"

exit $APPEND_EXIT
