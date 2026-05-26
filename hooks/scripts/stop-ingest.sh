#!/usr/bin/env bash
# stop-ingest.sh
#
# Stop hook → dashboard ingest forwarder.
# Reads hook payload from stdin, extracts the last assistant text from
# transcript_path, and POSTs the original payload + lastAssistantText
# preview (≤500 chars) to /ingest.
#
# Race mitigation:
# Claude Code's Stop hook is used *before* the entire response body is written into the transcript
# There are times when it is executed. As a result, the hook sends a short guidance message as the final text
# Capture and transmit, and even if the text is included in the transcript, the dashboard store is
# Not updated. To correct this:
# 1) Send first ingest immediately (fast card renewal)
# 2) Launch the detached process in the background and re-transcribe the transcript after 1.5 seconds
# Read and send a second ingest — overwrite any text added.
# The hook main body terminates immediately, so there is no effect on the hook timeout.

set +e

INGEST_URL="${DASHBOARD_INGEST_URL:-http://127.0.0.1:8765/ingest}"
PAYLOAD="$(cat)"

# Extract the last meaningful line of the last assistant text from the transcript and add it to the payload
# Common logic to output enriched JSON filled with lastAssistantText to stdout.
extract_and_send() {
  local payload="$1"
  local enriched
  # Avoid Windows (Git Bash/MSYS2) UTF-8 → ANSI (CP949) argv conversion.
  # Flow the payload to the node as stdin (fd 0) instead of argv.
  enriched="$(printf '%s' "$payload" | node -e '
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

  [ -z "$enriched" ] && enriched="$payload"

  printf '%s' "${enriched}" | curl \
    --connect-timeout 0.5 \
    --max-time 1 \
    --noproxy '*' \
    -s -o /dev/null \
    -X POST \
    -H 'Content-Type: application/json' \
    --data-binary @- \
    "${INGEST_URL}?hook=Stop" \
    >/dev/null 2>&1 || true
}

# 1) Immediately first ingest
extract_and_send "$PAYLOAD"

# 2) Background re-extraction (wait for transcript flush and overwrite with text).
# Executes as detached and returns the hook body immediately.
(
  sleep 1.5
  extract_and_send "$PAYLOAD"
) </dev/null >/dev/null 2>&1 &
disown 2>/dev/null

exit 0
