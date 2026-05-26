/**
 * Graph filter pure function test (MAE-265).
 */
import { describe, it, expect } from 'vitest';
import {
  buildFilterOptions,
  computeMatchedKeys,
  isFilterActive,
} from '../src/components/graph/filter.js';

function wt(key, status, assignee) {
  return {
    [`/work/${key}`]: {
      path: `/work/${key}`,
      cachedIssue: { key, status, assignee, summary: `${key} sum` },
    },
  };
}
function merge(...objs) {
  return Object.assign({}, ...objs);
}

describe('buildFilterOptions', () => {
  it('U1: Return status / assignee options in descending order of frequency → alphabetically', () => {
    const worktrees = merge(
      wt('A-1', 'in progress', 'alice'),
      wt('A-2', 'in progress', 'bob'),
      wt('A-3', 'to do', 'alice'),
    );
    const { statuses, assignees } = buildFilterOptions(worktrees);
    expect(statuses).toEqual([
      { value: 'in progress', count: 2 },
      { value: 'To Do', count: 1 },
    ]);
    expect(assignees).toEqual([
      { value: 'alice', count: 2 },
      { value: 'bob',   count: 1 },
    ]);
  });

  it('U2: assignee missing → counted as "Unassigned"', () => {
    const worktrees = merge(
      wt('A-1', 'In Progress', null),
      wt('A-2', 'In Progress', undefined),
      wt('A-3', 'in progress', 'alice'),
    );
    const { assignees } = buildFilterOptions(worktrees);
    expect(assignees).toEqual([
      { value: 'Unassigned', count: 2 },
      { value: 'alice',      count: 1 },
    ]);
  });

  it('U3: Ignore worktrees without cachedIssue', () => {
    const worktrees = {
      '/work/no-cache': { path: '/work/no-cache' },
      ...wt('A-1', 'In Progress', 'alice'),
    };
    const { statuses } = buildFilterOptions(worktrees);
    expect(statuses).toEqual([{ value: 'In Progress', count: 1 }]);
  });

  it('U4: null worktrees → empty options', () => {
    expect(buildFilterOptions(null)).toEqual({ statuses: [], assignees: [] });
  });
});

describe('isFilterActive', () => {
  it('U5: false if both sides are empty', () => {
    expect(isFilterActive(new Set(), new Set())).toBe(false);
  });
  it('U6: true if there is a value on even one side', () => {
    expect(isFilterActive(new Set(['In Progress']), new Set())).toBe(true);
    expect(isFilterActive(new Set(), new Set(['alice']))).toBe(true);
  });
});

describe('computeMatchedKeys', () => {
  const worktrees = merge(
    wt('A-1', 'in progress', 'alice'),
    wt('A-2', 'in progress', 'bob'),
    wt('A-3', 'to do', 'alice'),
  );

  it('U7: Filter disabled → null (match all)', () => {
    expect(computeMatchedKeys(worktrees, new Set(), new Set())).toBeNull();
  });

  it('U8: status single filter', () => {
    const m = computeMatchedKeys(worktrees, new Set(['In Progress']), new Set());
    expect(m).toEqual(new Set(['A-1', 'A-2']));
  });

  it('U9: assignee single filter', () => {
    const m = computeMatchedKeys(worktrees, new Set(), new Set(['alice']));
    expect(m).toEqual(new Set(['A-1', 'A-3']));
  });

  it('U10: status + assignee AND combination', () => {
    const m = computeMatchedKeys(
      worktrees,
      new Set(['In Progress']),
      new Set(['alice'])
    );
    expect(m).toEqual(new Set(['A-1']));
  });

  it('U11: multiple status (OR within group)', () => {
    const m = computeMatchedKeys(
      worktrees,
      new Set(['In Progress', 'To Do']),
      new Set()
    );
    expect(m).toEqual(new Set(['A-1', 'A-2', 'A-3']));
  });

  it('U12: phantom key (not in worktrees) always does not match', () => {
    // computeMatchedKeys only looks at the cachedIssue of the worktrees.
    // The phantom key 'A-99' is not found anywhere, so it is not included in the result set.
    const m = computeMatchedKeys(worktrees, new Set(['In Progress']), new Set());
    expect(m.has('A-99')).toBe(false);
  });
});
