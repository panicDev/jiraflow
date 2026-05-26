import React from 'react';
import ActivityPanel from './ActivityPanel.jsx';
import { pickIsBusy, pickIsAwaitingUser } from '../selectors/activity.js';

const EMPTY = '—';

/**
 * Returns the last segment of the path.
 * @param {string|null|undefined} cwd
 * @returns {string}
 */
function cwdBasename(cwd) {
  if (!cwd) return '(no cwd)';
  return cwd.replace(/\/$/, '').split('/').pop() || cwd;
}

/**
 * Only the first 8 characters of sessionId are returned.
 * @param {string} sessionId
 * @returns {string}
 */
function shortId(sessionId) {
  return sessionId ? sessionId.slice(0, 8) : EMPTY;
}

/**
 * worktree-independent Claude session card.
 * No stepper. ActivityPanel reuse.
 *
 * @param {{ session: {
 *   sessionId: string,
 *   cwd: string|null,
 *   source: 'startup'|'resume'|'continue'|null,
 *   startedAt: string|null,
 *   lastActiveAt: string|null,
 *   activity: Array<{ts:string,type:string,data:unknown}>
 * } }} props
 */
export default function SessionCard({ session }) {
  const { sessionId, cwd, source, activity = [] } = session;

  const isBusy = pickIsBusy(activity);
  const isAwaiting = pickIsAwaitingUser(activity);

  // Card active state class: awaiting (priority) > busy > idle.
  const stateClass = isAwaiting
    ? 'session-card--awaiting'
    : isBusy
      ? 'session-card--busy'
      : '';
  const cardClass = ['session-card', stateClass].filter(Boolean).join(' ');

  return (
    <div className={cardClass}>
      <div className="session-card__header">
        <span className="session-card__cwd" title={cwd ?? '(no cwd)'}>
          {cwdBasename(cwd)}
        </span>
        {source && (
          <span className={`session-card__source-badge session-card__source-badge--${source}`}>
            {source}
          </span>
        )}
        {isAwaiting && <span className="session-card__awaiting-badge">Awaiting response</span>}
        <span className="session-card__sid" title={sessionId}>
          {shortId(sessionId)}
        </span>
      </div>
      <ActivityPanel activity={activity} />
    </div>
  );
}
