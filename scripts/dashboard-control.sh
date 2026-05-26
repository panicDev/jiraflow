#!/usr/bin/env bash
# dashboard-control.sh — Dashboard lifecycle helper for /jira dashboard skill.
# Functions: require_plugin_root, pid_file_path, read_pid_file, write_pid_file,
#            is_running, dashboard_setup, dashboard_start,
#            dashboard_stop, dashboard_status, dashboard_register_and_attach,
#            _fetch_workspaces_summary, cmd_default
# Usage: bash dashboard-control.sh <start|stop|status|setup|"">
# Return: 0=success, non-zero=error. stdout=user output. stderr=warnings/errors.

set -euo pipefail

# ---------------------------------------------------------------------------
# CLAUDE_PLUGIN_ROOT automatic search (response to cases where shell environment variables are not injected)
# In Claude Code's hook command string, ${CLAUDE_PLUGIN_ROOT} is automatically replaced, but
# skill is not always injected into the Bash tool shell. This script always
# Since it is in the <plugin-root>/scripts/dashboard-control.sh path, its location is one step
# The above is automatically adopted as the plugin root (if env is not set).
# ---------------------------------------------------------------------------
if [[ -z "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
  _self="${BASH_SOURCE[0]:-$0}"
  _self_dir="$(cd -- "$(dirname -- "$_self")" && pwd)"
  CLAUDE_PLUGIN_ROOT="$(cd -- "$_self_dir/.." && pwd)"
  export CLAUDE_PLUGIN_ROOT
fi

# ---------------------------------------------------------------------------
# require_plugin_root
# If it comes this far and is still empty (failure to estimate own location), it ends with a friendly error.
# ---------------------------------------------------------------------------
require_plugin_root() {
  if [[ -z "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
    echo "Error: CLAUDE_PLUGIN_ROOT cannot be automatically determined." >&2
    echo "Script location-based estimation failed ($0)." >&2
    echo "Export CLAUDE_PLUGIN_ROOT directly and try again." >&2
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# pid_file_path  -> stdout: absolute path to PID file
#   Creates parent directory (~/.claude/jiraflow/) with 700 if absent.
# ---------------------------------------------------------------------------
pid_file_path() {
  local dir="${HOME}/.claude/jiraflow"
  mkdir -p "${dir}"
  chmod 700 "${dir}"
  echo "${dir}/dashboard.pid"
}

# ---------------------------------------------------------------------------
# read_pid_file  -> stdout: KEY=VALUE lines (PID/PORT/PLUGIN_ROOT/STARTED_AT)
#   Outputs nothing if file does not exist.
# ---------------------------------------------------------------------------
read_pid_file() {
  local pid_file
  pid_file="$(pid_file_path)"
  if [[ -f "${pid_file}" ]]; then
    cat "${pid_file}"
  fi
}

# ---------------------------------------------------------------------------
# write_pid_file <pid> <port> <plugin_root> <started_at>
#   Creates/overwrites PID file with 0600 permissions.
# ---------------------------------------------------------------------------
write_pid_file() {
  local pid="${1}"
  local port="${2}"
  local plugin_root="${3}"
  local started_at="${4}"
  local pid_file
  pid_file="$(pid_file_path)"
  {
    echo "PID=${pid}"
    echo "PORT=${port}"
    echo "PLUGIN_ROOT=${plugin_root}"
    echo "STARTED_AT=${started_at}"
  } > "${pid_file}"
  chmod 600 "${pid_file}"
}

# ---------------------------------------------------------------------------
# is_running  -> 0=running, 1=stopped (no PID file), 2=stale (file but no process)
# ---------------------------------------------------------------------------
is_running() {
  local pid_file
  pid_file="$(pid_file_path)"
  if [[ ! -f "${pid_file}" ]]; then
    return 1  # stopped
  fi
  local pid
  pid="$(grep '^PID=' "${pid_file}" | cut -d= -f2)"
  if [[ -z "${pid}" ]]; then
    return 1  # stopped (malformed file treated as stopped)
  fi
  if kill -0 "${pid}" 2>/dev/null; then
    return 0  # running
  else
    return 2  # stale
  fi
}

# ---------------------------------------------------------------------------
# dashboard_setup
#   Checks 3 cache markers; skips if all present. Otherwise runs npm install
#   and web build.
# ---------------------------------------------------------------------------
dashboard_setup() {
  require_plugin_root
  local root="${CLAUDE_PLUGIN_ROOT}"
  local marker1="${root}/node_modules"
  local marker2="${root}/scripts/dashboard/web/node_modules"
  local marker3="${root}/scripts/dashboard/public/index.html"

  if [[ -d "${marker1}" && -d "${marker2}" && -f "${marker3}" ]]; then
    echo "Setup cache confirmed — skipping npm install and build."
    return 0
  fi

  echo "Starting Dashboard setup (${root}) ..."

  # Root dependencies
  echo " [1/2] Installing plugin root dependencies (npm install) ..."
  if ! npm --prefix "${root}" install; then
    echo "Error: npm install failed. Check the log." >&2
    echo "Log location: terminal output or see ~/.npm/_logs/" >&2
    return 1
  fi

  # Web app build
  echo " [2/2] Building Web UI (npm --prefix scripts/dashboard/web install && run build) ..."
  if ! npm --prefix "${root}/scripts/dashboard/web" install; then
    echo "Error: Failed to install web dependencies." >&2
    return 1
  fi
  if ! npm --prefix "${root}/scripts/dashboard/web" run build; then
    echo "Error: web build failed." >&2
    return 1
  fi

  echo "Setup complete."
  return 0
}

# ---------------------------------------------------------------------------
# dashboard_start
#   Ensures setup, then spawns dashboard server detached.
# ---------------------------------------------------------------------------
dashboard_start() {
  require_plugin_root
  local root="${CLAUDE_PLUGIN_ROOT}"
  local port=8765

  # Already running?
  if is_running; then
    local pid_file
    pid_file="$(pid_file_path)"
    local pid started_at
    pid="$(grep '^PID=' "${pid_file}" | cut -d= -f2)"
    started_at="$(grep '^STARTED_AT=' "${pid_file}" | cut -d= -f2-)"
    echo "Dashboard is already running."
    echo "  URL        : http://127.0.0.1:${port}"
    echo "  PID        : ${pid}"
    echo "Start time: ${started_at}"
    return 0
  fi

  # Stale PID file? Clean up silently.
  local pid_file
  pid_file="$(pid_file_path)"
  if [[ -f "${pid_file}" ]]; then
    echo "Cleaning up old PID files." >&2
    rm -f "${pid_file}"
  fi

  # Ensure setup is done
  dashboard_setup || return 1

  # Prepare log directory
  local log_dir="${root}/logs"
  mkdir -p "${log_dir}"
  local log_file="${log_dir}/dashboard-server.log"

  echo "Starting the Dashboard server..."

  # Launch detached
  local server_js="${root}/scripts/dashboard/server.js"
  DASHBOARD_NO_OPEN=1 nohup node "${server_js}" \
    > "${log_file}" 2>&1 < /dev/null &
  local server_pid=$!
  disown "${server_pid}" 2>/dev/null || true

  # Verify it stayed alive (1s grace)
  sleep 1
  if ! kill -0 "${server_pid}" 2>/dev/null; then
    echo "Error: The server terminated immediately. Please check the log:" >&2
    echo "  ${log_file}" >&2
    echo " In case of port conflict: lsof -i :${port}" >&2
    return 1
  fi

  local started_at
  started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  write_pid_file "${server_pid}" "${port}" "${root}" "${started_at}"

  echo "Dashboard started successfully!"
  echo "  URL        : http://127.0.0.1:${port}"
  echo "  PID        : ${server_pid}"
  echo " Log: ${log_file}"
  echo "Start time: ${started_at}"
  return 0
}

# ---------------------------------------------------------------------------
# dashboard_stop
#   Reads PID from file, kills process (graceful), removes PID file.
# Multi-workspace intent: The dashboard server is a single process, so stop is a registered
# Terminate all workspaces together (not unregister each individual, but terminate the server itself).
# ---------------------------------------------------------------------------
dashboard_stop() {
  local pid_file
  pid_file="$(pid_file_path)"

  if [[ ! -f "${pid_file}" ]]; then
    echo "Dashboard is not running (no PID file)."
    return 0
  fi

  local pid
  pid="$(grep '^PID=' "${pid_file}" | cut -d= -f2)"

  if [[ -z "${pid}" ]]; then
    echo "The PID file is corrupted. Delete the file." >&2
    rm -f "${pid_file}"
    return 0
  fi

  if kill -0 "${pid}" 2>/dev/null; then
    echo "Terminating the Dashboard server (PID ${pid}) — all registered workspaces will be stopped as well."
    if ! kill "${pid}" 2>/dev/null; then
      echo "Warning: kill ${pid} failed. Treat as already terminated." >&2
    else
      echo "Shutdown complete."
    fi
  else
    echo "Warning: Process PID ${pid} already exists. Cleaning only PID files." >&2
  fi

  rm -f "${pid_file}"
  echo "Dashboard has stopped."
  return 0
}

# ---------------------------------------------------------------------------
# dashboard_status
#   Reports running/stopped/stale. Stale → auto-clean PID file.
# ---------------------------------------------------------------------------
dashboard_status() {
  local pid_file
  pid_file="$(pid_file_path)"

  if [[ ! -f "${pid_file}" ]]; then
    echo "Status: stopped (Dashboard is not running)"
    return 0
  fi

  local pid port started_at
  pid="$(grep '^PID=' "${pid_file}" | cut -d= -f2)"
  port="$(grep '^PORT=' "${pid_file}" | cut -d= -f2)"
  started_at="$(grep '^STARTED_AT=' "${pid_file}" | cut -d= -f2-)"

  if [[ -z "${pid}" ]]; then
    echo "Warning: PID file is corrupted. Deleting the file." >&2
    rm -f "${pid_file}"
    echo "Status: stopped"
    return 0
  fi

  if kill -0 "${pid}" 2>/dev/null; then
    echo "Status: running"
    echo "  URL        : http://127.0.0.1:${port:-8765}"
    echo "  PID        : ${pid}"
    echo "Start time: ${started_at}"
    echo ""
    _fetch_workspaces_summary "${port:-8765}" || true
  else
    echo "Status: stopped (stale PID file detected → automatic cleanup)"
    rm -f "${pid_file}"
  fi
  return 0
}

# ---------------------------------------------------------------------------
# _fetch_workspaces_summary <port>
#   Print a plain-text table of registered workspaces + collector health.
#   Tries:
#     1) curl GET http://127.0.0.1:<port>/workspaces (timeout 1s)
#     2) node -e require('../scripts/dashboard/workspaces').list()  → health=unknown
#     3) workspaces.json direct read                                 → health=unknown
#   Always returns 0 — best-effort, status command must not fail because of this.
# ---------------------------------------------------------------------------
_fetch_workspaces_summary() {
  local port="${1:-8765}"
  local body=""
  local source=""

  # Try 1: curl
  if command -v curl >/dev/null 2>&1; then
    body="$(curl -sS --max-time 1 "http://127.0.0.1:${port}/workspaces" 2>/dev/null || true)"
    if [[ -n "${body}" ]]; then
      source="http"
    fi
  fi

  # Try 2: node http
  if [[ -z "${body}" ]] && command -v node >/dev/null 2>&1; then
    body="$(node -e "
      const http=require('http');
      const req=http.get({host:'127.0.0.1',port:${port},path:'/workspaces',timeout:1000},(res)=>{
        let b='';res.on('data',(c)=>b+=c);res.on('end',()=>process.stdout.write(b));
      });
      req.on('error',()=>process.exit(0));
      req.on('timeout',()=>{req.destroy();process.exit(0)});
    " 2>/dev/null || true)"
    if [[ -n "${body}" ]]; then
      source="http"
    fi
  fi

  # Try 3: workspaces.json direct (health=unknown)
  if [[ -z "${body}" ]] && command -v node >/dev/null 2>&1; then
    local plugin_root="${CLAUDE_PLUGIN_ROOT:-}"
    if [[ -n "${plugin_root}" && -f "${plugin_root}/scripts/dashboard/workspaces.js" ]]; then
      body="$(node -e "
        const w=require('${plugin_root}/scripts/dashboard/workspaces');
        const list=w.list();
        process.stdout.write(JSON.stringify({workspaces:list.map((e)=>({path:e.path,registeredAt:e.registeredAt,lastSeenAt:e.lastSeenAt,status:e.status,health:'unknown',worktreeCount:0})),serverPluginRoot:null,serverNowMs:Date.now()}));
      " 2>/dev/null || true)"
      if [[ -n "${body}" ]]; then
        source="registry-file"
      fi
    fi
  fi

  if [[ -z "${body}" ]]; then
    echo " Workspaces : (lookup failed — no server response)"
    return 0
  fi

  # Parse JSON via node and emit a plain-text table.
  printf '%s' "${body}" | WS_SRC="${source}" node -e '
    let raw="";process.stdin.on("data",(c)=>raw+=c);process.stdin.on("end",()=>{
      let j;try{j=JSON.parse(raw)}catch{console.log(" Workspaces : (Response parsing failed)");return;}
      const ws=Array.isArray(j.workspaces)?j.workspaces:[];
      const src=process.env.WS_SRC||"";
      console.log("  Workspaces (" + ws.length + (src?" / source="+src:"") + "):");
      if(ws.length===0){console.log(" (No registered workspace)");return;}
      const rows=ws.map((w)=>({
        path:String(w.path||""),
        last:String(w.lastSeenAt||"").replace(/\.\d+Z$/,"Z"),
        health:String(w.health||"unknown"),
        wc:Number(w.worktreeCount||0),
      }));
      const wPath=Math.max(4,...rows.map((r)=>r.path.length));
      const wLast=Math.max(9,...rows.map((r)=>r.last.length));
      const wHealth=Math.max(6,...rows.map((r)=>r.health.length));
      const pad=(s,n)=>s+" ".repeat(Math.max(0,n-s.length));
      console.log("    " + pad("PATH",wPath) + "  " + pad("LAST_SEEN",wLast) + "  " + pad("HEALTH",wHealth) + "  WT");
      for(const r of rows){
        console.log("    " + pad(r.path,wPath) + "  " + pad(r.last,wLast) + "  " + pad(r.health,wHealth) + "  " + r.wc);
      }
    });
  ' 2>/dev/null || echo " Workspaces : (Output failed)"
  return 0
}

# ---------------------------------------------------------------------------
# dashboard_register_and_attach
#   Register cwd into the workspace registry and print attach status.
#   Idempotent — repeated calls just bump lastSeenAt.
#
#   On registry write failure: warn + still print status (graceful degrade).
# ---------------------------------------------------------------------------
dashboard_register_and_attach() {
  require_plugin_root
  local cwd
  cwd="$(pwd)"

  if ! command -v node >/dev/null 2>&1; then
    echo "Warning: No node found. Skipping workspace registration." >&2
    dashboard_status
    return 0
  fi

  # Call workspaces.register(cwd) and detect new vs existing entry.
  # Output: "NEW" or "EXISTING" or "ERROR:<msg>"
  local result
  result="$(CWD_VAL="${cwd}" node -e "
    try{
      const w=require(process.env.CLAUDE_PLUGIN_ROOT + '/scripts/dashboard/workspaces');
      const before=w.list().some((e)=>e.path===require('path').resolve(process.env.CWD_VAL));
      const entry=w.register(process.env.CWD_VAL);
      process.stdout.write(before?'EXISTING':'NEW');
    }catch(err){process.stdout.write('ERROR:'+err.message);}
  " 2>/dev/null || echo "ERROR:node-failed")"

  case "${result}" in
    NEW)
      echo "Attach to Dashboard — cwd is currently registered as a new workspace."
      echo "  cwd : ${cwd}"
      ;;
    EXISTING)
      echo "Attach to Dashboard — current cwd is already registered (update lastSeenAt)."
      echo "  cwd : ${cwd}"
      ;;
    ERROR:*)
      echo "Warning: Failed to register workspace — only proceed with attach." >&2
      echo " Reason: ${result#ERROR:}" >&2
      ;;
  esac

  echo ""
  dashboard_status
  return 0
}

# ---------------------------------------------------------------------------
# cmd_default
#   No-argument entrypoint: status check → stopped=setup+start, stale=cleanup+start,
#   running=register+attach (multi-workspace: never restart on plugin-root change).
# ---------------------------------------------------------------------------
cmd_default() {
  require_plugin_root

  # Check running state
  # NOTE: is_running returns non-zero for stopped/stale; use || true to prevent
  # set -e from terminating the script before we can inspect the exit code.
  local run_state
  is_running || run_state=$?
  run_state=${run_state:-0}
  # run_state: 0=running, 1=stopped, 2=stale

  if [[ "${run_state}" -eq 0 ]]; then
    # Running — register cwd into the workspace registry and attach.
    # Multi-workspace: PLUGIN_ROOT differences are normal (different plugin roots are possible for each worktree).
    dashboard_register_and_attach
    return $?
  elif [[ "${run_state}" -eq 2 ]]; then
    # Stale: clean up and start fresh
    echo "Cleaning up old PID files and starting Dashboard..."
    local pid_file
    pid_file="$(pid_file_path)"
    rm -f "${pid_file}"
    dashboard_start
    return $?
  else
    # Stopped: setup + start
    dashboard_start
    return $?
  fi
}

# ---------------------------------------------------------------------------
# main dispatcher
# ---------------------------------------------------------------------------
main() {
  local action="${1:-}"
  case "${action}" in
    start)  dashboard_start ;;
    stop)   dashboard_stop ;;
    status) dashboard_status ;;
    setup)  dashboard_setup ;;
    "")     cmd_default ;;
    *)
      echo "Usage: /jira dashboard [start|stop|status|setup]" >&2
      echo " (no arguments): Automatically start after checking Dashboard status" >&2
      echo " start : Start Dashboard" >&2
      echo " stop : Stop Dashboard" >&2
      echo " status : Check current status" >&2
      echo " setup : Only install npm dependencies and build UI" >&2
      exit 1
      ;;
  esac
}

main "$@"
