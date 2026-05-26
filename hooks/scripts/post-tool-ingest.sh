#!/usr/bin/env bash
# post-tool-ingest.sh
#
# PostToolUse hook → dashboard ingest forwarder.
# Select the last assistant text from transcript_path with the same logic as stop-ingest.sh.
# Pull it out, fill it with payload.lastAssistantText, and POST. Unlike stop hooks
# Since the transcript has already been flushed, retransmission with a 1.5s delay is omitted.
#
# Purpose: The intermediate response text that AI outputs between tool calls is also displayed on the dashboard.
# To reflect in real time. The stop hook only updates at the end of the turn.
# The user feels that "the response has not changed."

set +e

INGEST_URL="${DASHBOARD_INGEST_URL:-http://127.0.0.1:8765/ingest}"
PAYLOAD="$(cat)"

# Avoid Windows (Git Bash/MSYS2) UTF-8 → ANSI (CP949) argv conversion.
# Flow the payload to the node as stdin (fd 0) instead of argv.
enriched="$(printf '%s' "$PAYLOAD" | node -e '
  const fs = require("fs");
  let payload = {};
  try { payload = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch {}
  const tp = payload.transcript_path;
  let preview = null;
  if (tp && fs.existsSync(tp)) {
    try {
      const lines = fs.readFileSync(tp, "utf8").split("\n").filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        let o; try { o = JSON.parse(lines[i]); } catch { continue; }
        if (o.type !== "assistant") continue;
        const content = (o.message && o.message.content) || [];
        let text = null;
        for (let k = content.length - 1; k >= 0; k--) {
          const c = content[k];
          if (c && c.type === "text") { text = c; break; }
        }
        if (text && typeof text.text === "string" && text.text.trim()) {
          const SEPARATOR_RE = /^[\s\-=*_~─━═─-╿]+$/;
          const rows = text.text.split("\n").map(s => s.trim());
          let lastLine = "";
          for (let j = rows.length - 1; j >= 0; j--) {
            const r = rows[j];
            if (!r) continue;
            if (/^`{3,}/.test(r)) continue;
            if (SEPARATOR_RE.test(r)) continue;
            lastLine = r;
            break;
          }
          if (!lastLine) lastLine = text.text.slice(-500);
          preview = lastLine.slice(0, 500);
          break;
        }
      }
    } catch {}
  }
  payload.lastAssistantText = preview;
  process.stdout.write(JSON.stringify(payload));
' 2>/dev/null)"

[ -z "$enriched" ] && enriched="$PAYLOAD"

printf '%s' "${enriched}" | curl \
  --connect-timeout 0.5 \
  --max-time 1 \
  --noproxy '*' \
  -s -o /dev/null \
  -X POST \
  -H 'Content-Type: application/json' \
  --data-binary @- \
  "${INGEST_URL}?hook=PostToolUse" \
  >/dev/null 2>&1 || true

exit 0
