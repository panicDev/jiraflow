import React from 'react';
import WorktreeCard from '../WorktreeCard.jsx';

/**
 * Side panel displayed when clicking on a graph node.
 *
 * @param {{ worktree: object | null, onClose: () => void }} props
 * - worktree: actual worktree state object (phantom node if null)
 * - onClose: close button callback
 */
export default function GraphSidePanel({ worktree, onClose }) {
  // worktree === undefined: no selection (should not be rendered in parent, but defended)
  if (worktree === undefined) return null;

  return (
    <aside className="graph-side-panel" aria-label="Node Details">
      <button
        type="button"
        className="graph-side-panel__close"
        onClick={onClose}
        aria-label="Close panel"
      >
        ×
      </button>
      {worktree ? (
        <WorktreeCard worktree={worktree} />
      ) : (
        <div className="graph-side-panel__phantom">
          <p className="graph-side-panel__phantom-title">External issues</p>
          <p className="graph-side-panel__phantom-desc">There is no worktree corresponding to this node.</p>
        </div>
      )}
    </aside>
  );
}
