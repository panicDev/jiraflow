import React from 'react';
import { formatRelative } from '../utils/relativeTime.js';

/**
 * Convert health value to CSS class suffix.
 * Unknown values ​​fallback to 'unknown'.
 * @param {string|undefined} health
 * @returns {string}
 */
function healthBadgeClass(health) {
  switch (health) {
    case 'healthy':
    case 'creds-missing':
    case 'no-worktrees':
    case 'unknown':
      return health;
    default:
      return 'unknown';
  }
}

/**
 * Workspace group header + children slot.
 *
 * @param {object} props
 * @param {object} props.workspace WorkspaceEntry (GET /workspaces item) or null (fallback group)
 * @param {string} props.label Label to display in header (basename or "(no workspace)")
 * @param {number} props.count Number of cards after applying filter
 * @param {React.ReactNode} props.children
 */
export default function WorkspaceGroup({ workspace, label, count, children }) {
  const health = workspace?.health;
  const badgeSuffix = healthBadgeClass(health);
  const lastSeenAt = workspace?.lastSeenAt ?? null;
  const relTime = formatRelative(lastSeenAt);

  return (
    <section className="workspace-group">
      <header
        className="workspace-group__header"
        title={workspace?.path ?? ''}
      >
        <span className={`health-badge health-badge--${badgeSuffix}`} aria-label={`health: ${badgeSuffix}`} />
        <span className="workspace-group__name">{label}</span>
        <span className="workspace-group__meta">
          <span className="workspace-group__count">{count}</span>
          <span className="workspace-group__sep">·</span>
          <span className="workspace-group__time">{relTime}</span>
        </span>
      </header>
      <div className="workspace-group__cards">
        {children}
      </div>
    </section>
  );
}
