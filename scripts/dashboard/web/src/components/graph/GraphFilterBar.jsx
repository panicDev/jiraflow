import React from 'react';

/**
 * Graph view status/assignee filter bar (MAE-265).
 *
 * - Multiple selection (Set). Click on the same chip again to turn it off.
 * - The "All" button deselects all groups.
 * - Options are pre-calculated based on worktrees frequency and entered as props.
 */
export default function GraphFilterBar({
  options,
  statusSet,
  assigneeSet,
  onToggleStatus,
  onToggleAssignee,
  onClearStatus,
  onClearAssignee,
  matchedCount,
  totalCount,
}) {
  const { statuses, assignees } = options;
  const hasActive =
    (statusSet?.size ?? 0) > 0 || (assigneeSet?.size ?? 0) > 0;

  return (
    <div className="graph-filter-bar" role="toolbar" aria-label="Graph Filter">
      <div className="graph-filter-bar__group">
        <span className="graph-filter-bar__label">STATUS</span>
        <button
          type="button"
          className={`graph-filter-chip${statusSet.size === 0 ? ' graph-filter-chip--active' : ''}`}
          onClick={onClearStatus}
          aria-pressed={statusSet.size === 0}
        >
          entire
        </button>
        {statuses.map(({ value, count }) => {
          const active = statusSet.has(value);
          return (
            <button
              key={value}
              type="button"
              className={`graph-filter-chip${active ? ' graph-filter-chip--active' : ''}`}
              onClick={() => onToggleStatus(value)}
              aria-pressed={active}
            >
              {value}
              <span className="graph-filter-chip__count">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="graph-filter-bar__group">
        <span className="graph-filter-bar__label">ASSIGNEE</span>
        <button
          type="button"
          className={`graph-filter-chip${assigneeSet.size === 0 ? ' graph-filter-chip--active' : ''}`}
          onClick={onClearAssignee}
          aria-pressed={assigneeSet.size === 0}
        >
          entire
        </button>
        {assignees.map(({ value, count }) => {
          const active = assigneeSet.has(value);
          return (
            <button
              key={value}
              type="button"
              className={`graph-filter-chip${active ? ' graph-filter-chip--active' : ''}`}
              onClick={() => onToggleAssignee(value)}
              aria-pressed={active}
            >
              {value}
              <span className="graph-filter-chip__count">{count}</span>
            </button>
          );
        })}
      </div>
      {hasActive && (
        <span className="graph-filter-bar__count" aria-live="polite">
          {matchedCount}/{totalCount} match
        </span>
      )}
    </div>
  );
}
