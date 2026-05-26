import React, { useState } from 'react';
import ActivityPanel from './ActivityPanel.jsx';
import Stepper from './Stepper.jsx';
import {
  pickIsBusy,
  pickIsAwaitingUser,
  pickLastActivityTs,
  pickToolCallCount,
} from '../selectors/activity.js';
import { formatRelative } from '../utils/relativeTime.js';
import { IconTool, IconTrash, IconWarning } from './Icons.jsx';
import { useNowTick } from '../hooks/useNowTick.js';

/** Placeholder used when there are no fields to display */
const EMPTY = '—';

/**
 * @param {string|null|undefined} val
 * @returns {string}
 */
function fmt(val) {
  if (val == null) return EMPTY;
  if (typeof val === 'string' || typeof val === 'number') return val;
  if (typeof val === 'object') {
    return val.displayName || val.display_name || val.name || val.key || EMPTY;
  }
  return String(val);
}

/**
 * Returns only the last segment of the path. Trailing slash defense processing.
 * @param {string|null|undefined} path
 * @returns {string}
 */
function lastPathSegment(path) {
  if (!path) return EMPTY;
  return path.replace(/\/$/, '').split('/').pop() || path;
}

/**
 * Absolute path is shortened based on home(~). macOS/Linux only.
 * @param {string|null|undefined} path
 * @returns {string}
 */
function tildify(path) {
  if (!path) return EMPTY;
  // Since the client does not know the user's home, remove common patterns (/Users/<u>/, /home/<u>/).
  return path
    .replace(/^\/Users\/[^/]+/, '~')
    .replace(/^\/home\/[^/]+/, '~');
}

/**
 * Convert Korean Jira status value to CSS class slug.
 * Mapping failure or null/undefined → 'neutral'
 * @param {string|null|undefined} value
 * @returns {'todo'|'in-progress'|'in-review'|'done'|'blocked'|'neutral'}
 */
function statusSlug(value) {
  const v = String(value ?? '').trim();
  switch (v) {
    case 'todo': return 'todo';
    case 'in progress': return 'in-progress';
    case 'in review': return 'in-review';  // Actual Jira Korean value is "under review" (with space)
    case 'review': return 'in-review';  // Preserve transformation (maybe used in other instances)
    case 'done': return 'done';
    case 'blocked': return 'blocked';
    default:        return 'neutral';
  }
}

/**
 * Convert Korean Jira priority value to CSS class slug.
 * Mapping failure or null/undefined → 'neutral'
 * @param {string|null|undefined} value
 * @returns {'highest'|'high'|'major'|'medium'|'low'|'lowest'|'neutral'}
 */
function prioritySlug(value) {
  const v = String(value ?? '').trim();
  switch (v) {
    case 'very high': return 'highest';
    case 'high': return 'high';
    case 'major': return 'major';
    case 'medium': return 'medium';
    case 'low': return 'low';
    case 'very low': return 'lowest';
    default:          return 'neutral';
  }
}

/**
 * One card. Receives WorktreeState as a prop and displays 7 fields + ActivityPanel.
 *
 * @param {{ worktree: import('../state/reducer.js').WorktreeState }} props
 */
export default function WorktreeCard({ worktree }) {
  const { path, branch, taskId, noContext, cachedIssue, activity = [], completedSteps, lastActiveAt } = worktree;

  // Automatically updates relative time in 1 second ticks.
  const now = useNowTick(1000);

  // Signal preserved separately in addition to the ring buffer (prevention of evict in case of PreToolUse congestion).
  const fallbackEvents = {
    lastPromptEvent: worktree.lastPromptEvent ?? null,
    lastStopEvent: worktree.lastStopEvent ?? null,
  };

  const isBusy = pickIsBusy(activity, fallbackEvents);
  const isAwaiting = pickIsAwaitingUser(activity, fallbackEvents);
  const lastActivityTs = pickLastActivityTs(activity);
  const toolCount = pickToolCallCount(activity);

  // Fallback priority: cachedIssue (Jira live) → top-level (value serialized directly from .jira-context.json by worktree collector).
  // Allows cards to be drawn with the meta of .jira-context.json even while cachedIssue=null during cold-start.
  const summary = cachedIssue?.summary ?? worktree.summary ?? null;
  const status = cachedIssue?.status ?? worktree.status ?? null;
  const priority = cachedIssue?.priority ?? worktree.priority ?? null;
  const assignee = cachedIssue?.assignee ?? null; // No assignee at top-level
  const issueType = cachedIssue?.issuetype ?? null;
  const links = cachedIssue?.links ?? null;

  // Among unresolved blockers = blockedBy, statusCategory is not done.
  const openBlockers = Array.isArray(links?.blockedBy)
    ? links.blockedBy.filter(b => b.statusCategory !== 'done')
    : [];
  const isBlocked = openBlockers.length > 0;

  const sSlug = noContext ? 'neutral' : statusSlug(status);
  const pSlug = noContext ? 'neutral' : prioritySlug(priority);

  const showStatusBadge = !noContext && status != null;

  // Active badge: Displayed if lastActiveAt is less than 5 minutes. The boundary is also naturally updated by useNowTick(1000).
  const isActive = lastActiveAt != null && (now - new Date(lastActiveAt).getTime() < 5 * 60 * 1000);

  // Stale = Jira status is complete, but the worktree is still alive (targeted for cleanup).
  const isStale = !noContext && status === 'Complete';

  // Clean button state.
  const [cleaning, setCleaning] = useState(false);
  const [cleanupError, setCleanupError] = useState(null);

  async function handleCleanup() {
    if (!path) return;
    const ok = window.confirm(
      `Do you want to remove the worktree and branch?\n\n` +
      `- worktree: ${path}\n` +
      `- branch: ${branch ?? '(none)'}\n\n` +
      `(Any uncommitted changes will be rejected.)`
    );
    if (!ok) return;
    setCleaning(true);
    setCleanupError(null);
    try {
      const res = await fetch('/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCleanupError(json.error ?? `HTTP ${res.status}`);
      }
      // When successful: The card disappears with SSE worktree.removed, so no separate processing is required.
    } catch (err) {
      setCleanupError(err.message);
    } finally {
      setCleaning(false);
    }
  }

  // Card active state class: awaiting (priority) > busy > idle.
  const stateClass = isAwaiting
    ? 'wt-card--awaiting'
    : isBusy
      ? 'wt-card--busy'
      : '';

  const cardClass = [
    'wt-card',
    `wt-card--prio-${pSlug}`,
    stateClass,
    isStale ? 'wt-card--stale' : '',
    isBlocked ? 'wt-card--blocked' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass}>
      {isBlocked && (
        <span
          className="wt-card__blocked-corner"
          title={openBlockers.map(b => `${b.key} · ${b.status ?? ''}`).join('\n')}
        >
          BLOCKED
        </span>
      )}
      {/* === Step 1: Header (taskId + type + meta + status badge) === */}
      <header className="wt-card__header">
        <span className="wt-card__task-id">
          {taskId ?? lastPathSegment(path)}
        </span>
        {issueType && <span className="wt-card__issue-type">{issueType}</span>}
        {noContext && <span className="wt-card__no-context-badge" title={path}>no jira</span>}
        {isAwaiting && <span className="wt-card__awaiting-badge">Awaiting response</span>}
        {isStale && <span className="wt-card__stale-badge">stale</span>}
        <span className="wt-card__header-spacer" />
        {toolCount > 0 && (
          <span className="wt-card__tool-count" title={`${toolCount} times the tool has been called this session`}>
            <IconTool size={11} /> {toolCount}
          </span>
        )}
        {lastActivityTs && (
          <span className="wt-card__last-activity" title={lastActivityTs}>
            {formatRelative(lastActivityTs, now)}
          </span>
        )}
        {isActive && (
          <span className="wt-card__active-badge" title={`Last Activity ${lastActiveAt}`}>
            <span className="wt-card__active-dot" aria-hidden="true" />
            active
          </span>
        )}
        {showStatusBadge && (
          <span
            key={status}
            className={`wt-badge wt-badge--status-${sSlug} wt-badge--status-flip wt-badge--jira-status`}
            title="Jira workflow status"
          >
            <span className="wt-badge__jira-dot" aria-hidden="true" />
            {status}
          </span>
        )}
      </header>

      {/* === 2nd stage: summary (if noContext, replace path with one line) === */}
      <div className="wt-card__summary">
        {summary != null ? (
          <span title={summary}>{summary}</span>
        ) : noContext ? (
          <span className="wt-card__summary--empty wt-card__summary--path" title={path}>
            {tildify(path)}
          </span>
        ) : (
          <span className="wt-card__summary--empty" title="no Jira summary cached">(no summary)</span>
        )}
      </div>

      {/* === Step 3: SDLC stepper (lifecycle flow) — If there is noContext, it is meaningless, so it is hidden === */}
      {!noContext && <Stepper completedSteps={completedSteps} />}

      {/* === Column 4: One meta line === */}
      <dl className="wt-card__meta">
        {branch && (
          <div className="wt-card__meta-item">
            <dt className="wt-card__meta-label">branch</dt>
            <dd className="wt-card__meta-value wt-card__meta-value--mono" title={branch}>{branch}</dd>
          </div>
        )}
        {!noContext && (
          <div className="wt-card__meta-item">
            <dt className="wt-card__meta-label">path</dt>
            <dd className="wt-card__meta-value wt-card__meta-value--mono" title={path}>{lastPathSegment(path)}</dd>
          </div>
        )}
        {!noContext && priority != null && (
          <div className="wt-card__meta-item">
            <dt className="wt-card__meta-label">prio</dt>
            <dd className={`wt-card__meta-value wt-card__meta-value--prio-${pSlug}`}>{priority}</dd>
          </div>
        )}
        {!noContext && (
          <div className="wt-card__meta-item">
            <dt className="wt-card__meta-label">@</dt>
            <dd className="wt-card__meta-value">{fmt(assignee)}</dd>
          </div>
        )}
      </dl>

      {/* === Column 5: Issue link (blocks/blocked by) === */}
      {(links?.blocks?.length || links?.blockedBy?.length) ? (
        <div className="wt-card__links">
          {links.blockedBy?.length > 0 && (
            <div className="wt-card__link-row">
              <span className="wt-card__link-label">blocked by</span>
              <ul className="wt-card__link-list">
                {links.blockedBy.map(b => (
                  <li
                    key={b.key}
                    className={`wt-card__link-item${b.statusCategory === 'done' ? ' wt-card__link-item--done' : ' wt-card__link-item--open'}`}
                    title={`${b.summary ?? ''} (${b.status ?? '?'})`}
                  >
                    {b.key}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {links.blocks?.length > 0 && (
            <div className="wt-card__link-row">
              <span className="wt-card__link-label">blocks</span>
              <ul className="wt-card__link-list">
                {links.blocks.map(b => (
                  <li
                    key={b.key}
                    className={`wt-card__link-item${b.statusCategory === 'done' ? ' wt-card__link-item--done' : ''}`}
                    title={`${b.summary ?? ''} (${b.status ?? '?'})`}
                  >
                    {b.key}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      <ActivityPanel activity={activity} fallback={fallbackEvents} />

      {isStale && (
        <button
          type="button"
          className="wt-card__cleanup-fab"
          onClick={handleCleanup}
          disabled={cleaning}
          title={cleanupError ?? `${branch ?? path} remove`}
          aria-label="Remove worktree and branch"
        >
          {cleaning ? 'Organizing... ' : <><IconTrash size={11} /> Cleanup</>}
        </button>
      )}
      {cleanupError && (
        <span className="wt-card__cleanup-error" title={cleanupError}><IconWarning size={11} /> {cleanupError}</span>
      )}
    </div>
  );
}
