/**
 * Pure selector functions for deriving display values from a worktree's
 * activity ring buffer.
 *
 * activity: ActivityEvent[]
 *   { ts: ISO8601, type: string, data: { payload, ... } }
 */

/**
 * Returns the most recent UserPromptSubmit event's prompt text, truncated to
 * 80 characters with ellipsis if needed.
 *
 * @param {Array<{ts:string,type:string,data:{payload?:Record<string,unknown>}}>} activity
 * @returns {{ text: string, ts: string } | null}
 */
function _formatPrompt(ev) {
  if (!ev) return null;
  const raw =
    ev.data?.payload?.prompt ??
    ev.data?.payload?.user_prompt ??
    null;
  if (raw == null) return null;
  const normalized = String(raw).replace(/\n/g, ' ');
  const text = normalized.length > 80 ? normalized.slice(0, 79) + '…' : normalized;
  return { text, ts: ev.ts };
}

export function pickLatestPrompt(activity, fallbackEvent) {
  if (Array.isArray(activity)) {
    for (let i = activity.length - 1; i >= 0; i--) {
      const ev = activity[i];
      if (ev?.type !== 'UserPromptSubmit') continue;
      const r = _formatPrompt(ev);
      if (r) return r;
    }
  }
  // If the ring buffer disappears due to evict, use a separate preservation field in the store.
  return _formatPrompt(fallbackEvent);
}

/**
 * Returns the most recent "in-progress" tool (PreToolUse without a matching
 * subsequent PostToolUse for the same tool_name).
 *
 * @param {Array<{ts:string,type:string,data:{payload?:Record<string,unknown>}}>} activity
 * @returns {{ name: string, startedAt: string } | null}
 */
export function pickCurrentTool(activity) {
  if (!Array.isArray(activity)) return null;
  // Walk newest→oldest. Track PostToolUse closures.
  // User interrupt (UserPromptSubmit) or end of turn (Stop/SessionEnd)
  // If it occurs later than PreToolUse, the tool call is considered canceled.
  // (PostToolUse hook is not dropped for canceled calls, preventing the problem of appearing to be in-flight forever)
  const closedTools = new Set();
  let sawTerminator = false;
  for (let i = activity.length - 1; i >= 0; i--) {
    const ev = activity[i];
    const t = ev?.type;
    if (t === 'PostToolUse') {
      const name = _toolNameOf(ev);
      if (name) closedTools.add(name);
    } else if (t === 'UserPromptSubmit' || t === 'Stop' || t === 'SessionEnd') {
      sawTerminator = true;
    } else if (t === 'PreToolUse') {
      const name = _toolNameOf(ev);
      if (name && !closedTools.has(name) && !sawTerminator) {
        return { name, startedAt: ev.ts };
      }
    }
  }
  return null;
}

// Protects against the rare case where payload.tool_name comes in the form of an object ({name: "..."}).
// Always normalize to string to prevent #31 from appearing in React render.
function _toolNameOf(ev) {
  const raw = ev?.data?.payload?.tool_name;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.name === 'string') return raw.name;
  return null;
}

/**
 * Returns true if there appears to be an active sub-agent session.
 * Heuristic: if the last terminator-type event is SubagentStop (not plain
 * Stop or SessionEnd), a sub-agent may still be running. SessionEnd counts
 * as a terminator because Claude Code may end a session without emitting a
 * top-level Stop hook after a SubagentStop.
 *
 * @param {Array<{ts:string,type:string,data?:unknown}>} activity
 * @returns {boolean}
 */
export function pickActiveSubagent(activity) {
  if (!Array.isArray(activity)) return false;
  for (let i = activity.length - 1; i >= 0; i--) {
    const type = activity[i]?.type;
    if (type === 'Stop' || type === 'SessionEnd') return false;
    if (type === 'SubagentStop') return true;
  }
  return false;
}

/**
 * Event types that may carry an assistant text preview in
 * `data.payload.lastAssistantText`. Stop is the canonical end-of-turn signal;
 * PostToolUse fires mid-turn so its preview shows intermediate text as the
 * assistant pauses between tool calls.
 */
const RESPONSE_EVENT_TYPES = new Set(['Stop', 'PostToolUse']);

/**
 * Returns the most recent event's lastAssistantText preview, truncated
 * to 120 characters with ellipsis if needed.
 *
 * @param {Array<{ts:string,type:string,data:{payload?:Record<string,unknown>}}>} activity
 * @returns {{ text: string, ts: string, stale?: boolean } | null}
 */
function _formatResponse(ev) {
  if (!ev) return null;
  const raw = ev.data?.payload?.lastAssistantText;
  if (raw == null || typeof raw !== 'string' || !raw.trim()) return null;

  // Extract a meaningful "last line", excluding blank lines/code fences/delimiters (HR + box drawing characters).
  const SEPARATOR_RE = /^[\s\-=*_~─━═─-╿]+$/;
  const rows = raw.split('\n').map(s => s.trim());
  let lastLine = '';
  for (let j = rows.length - 1; j >= 0; j--) {
    const r = rows[j];
    if (!r) continue;
    if (/^`{3,}/.test(r)) continue;
    if (SEPARATOR_RE.test(r)) continue;
    lastLine = r;
    break;
  }
  if (!lastLine) lastLine = raw.trim();

  const text = lastLine.length > 120 ? lastLine.slice(0, 119) + '…' : lastLine;
  return { text, ts: ev.ts };
}

export function pickLatestResponse(activity, fallbackEvent) {
  if (Array.isArray(activity)) {
    // Seek behind the last response event (holding lastAssistantText during Stop/PostToolUse).
    // At the same time, check if there is a UserPromptSubmit after that event (=start of a new turn)
    // Mark the response as stale. Until a new response event comes in, the previous response is
    // Corrects the problem of "old response is visible" by displaying it as is.
    let sawNewerPrompt = false;
    for (let i = activity.length - 1; i >= 0; i--) {
      const ev = activity[i];
      const type = ev?.type;
      if (type === 'UserPromptSubmit') {
        sawNewerPrompt = true;
        continue;
      }
      if (!RESPONSE_EVENT_TYPES.has(type)) continue;
      const r = _formatResponse(ev);
      if (r) return sawNewerPrompt ? { ...r, stale: true } : r;
    }
  }
  return _formatResponse(fallbackEvent);
}

/**
 * The last Notification event contains 'permission' or 'blocked', and
 * **true when there is no other activity after that**.
 * When the user grants permission or another tool is run (=when a subsequent event occurs)
 * The blocking status is deemed to have been lifted.
 *
 * @param {Array<{ts:string,type:string,data:{payload?:Record<string,unknown>}}>} activity
 * @returns {boolean}
 */
export function pickBlockedFlag(activity) {
  if (!Array.isArray(activity)) return false;
  let lastNotifIdx = -1;
  for (let i = activity.length - 1; i >= 0; i--) {
    if (activity[i]?.type === 'Notification') { lastNotifIdx = i; break; }
  }
  if (lastNotifIdx === -1) return false;
  // If any hook is dropped after notification, it is considered to be unblocked.
  for (let i = lastNotifIdx + 1; i < activity.length; i++) {
    if (activity[i]?.type) return false;
  }
  const msg = String(activity[lastNotifIdx].data?.payload?.message ?? '').toLowerCase();
  return msg.includes('permission') || msg.includes('blocked');
}

/**
 * Busy = A matching Stop has not yet arrived since the most recent UserPromptSubmit.
 * No time threshold. Accurately identifying the state in which Claude is making a response.
 *
 * @param {Array<{ts:string,type:string}>} activity
 * @returns {boolean}
 */
export function pickIsBusy(activity, fallback) {
  if (Array.isArray(activity)) {
    for (let i = activity.length - 1; i >= 0; i--) {
      const t = activity[i]?.type;
      if (t === 'Stop') return false;
      if (t === 'UserPromptSubmit') return true;
    }
  }
  // Ring buffer eviction correction — fallback Timestamp comparison in separate fields.
  const promptTs = fallback?.lastPromptEvent?.ts;
  const stopTs = fallback?.lastStopEvent?.ts;
  if (!promptTs) return false;
  if (!stopTs) return true;
  return Date.parse(promptTs) > Date.parse(stopTs);
}

/**
 * Awaiting = In busy state, the last Notification is input/permission/waiting
 * means, **if no other hooks are dropped after that**.
 * Released when the user approves the permission, sends a prompt, or runs the tool again.
 *
 * The Notification hook is the only correct
 * It's a signal. PreToolUse time-based estimation distinguishes between "running tool" and "waiting for permission"
 * Cannot be introduced (both PreToolUse + PostToolUse are absent).
 *
 * @param {Array<{ts:string,type:string,data?:{payload?:Record<string,unknown>}}>} activity
 * @returns {boolean}
 */
export function pickIsAwaitingUser(activity, fallback) {
  if (!pickIsBusy(activity, fallback)) return false;
  if (!Array.isArray(activity)) return false;
  let lastNotifIdx = -1;
  for (let i = activity.length - 1; i >= 0; i--) {
    if (activity[i]?.type === 'Notification') { lastNotifIdx = i; break; }
  }
  if (lastNotifIdx === -1) return false;
  for (let i = lastNotifIdx + 1; i < activity.length; i++) {
    if (activity[i]?.type) return false;
  }
  const msg = String(activity[lastNotifIdx].data?.payload?.message ?? '').toLowerCase();
  return msg.includes('permission') || msg.includes('input') || msg.includes('waiting');
}

/**
 * Timestamp of the most recent activity (any hook).
 *
 * @param {Array<{ts:string}>} activity
 * @returns {string|null}
 */
export function pickLastActivityTs(activity) {
  if (!Array.isArray(activity) || activity.length === 0) return null;
  return activity[activity.length - 1]?.ts ?? null;
}

/**
 * Cumulative PreToolUse count (currently in ring buffer).
 *
 * @param {Array<{type:string}>} activity
 * @returns {number}
 */
export function pickToolCallCount(activity) {
  if (!Array.isArray(activity)) return 0;
  let n = 0;
  for (const ev of activity) if (ev?.type === 'PreToolUse') n++;
  return n;
}
