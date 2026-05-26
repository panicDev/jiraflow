/**
 * status/assignee filter model (MAE-265).
 *
 * Empty Set = "Filter Disabled" → Match all nodes.
 * If the Set contains an item, only cachedIssue matching that value is matched.
 *
 * Phantom nodes (external issues with no worktree in the workspace) have status/assignee metadata
 * Since there is no filter, if either filter is activated, it is judged as a non-match.
 */

/**
 * Collects possible status / assignee values ​​from worktrees and returns them as a list of options in order of frequency.
 *
 * @param {Record<string, object>} worktrees
 * @returns {{ statuses: Array<{value:string, count:number}>, assignees: Array<{value:string, count:number}> }}
 */
export function buildFilterOptions(worktrees) {
  const statusCount = new Map();
  const assigneeCount = new Map();
  if (worktrees && typeof worktrees === 'object') {
    for (const wt of Object.values(worktrees)) {
      const issue = wt?.cachedIssue;
      if (!issue?.key) continue;
      if (issue.status) {
        statusCount.set(issue.status, (statusCount.get(issue.status) ?? 0) + 1);
      }
      const assignee = issue.assignee || 'Unassigned';
      assigneeCount.set(assignee, (assigneeCount.get(assignee) ?? 0) + 1);
    }
  }
  const toSorted = (m) =>
    Array.from(m, ([value, count]) => ({ value, count })).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.value.localeCompare(b.value);
    });
  return { statuses: toSorted(statusCount), assignees: toSorted(assigneeCount) };
}

/**
 * Whether the filter is active (true if either option is selected).
 *
 * @param {Set<string>} statusSet
 * @param {Set<string>} assigneeSet
 */
export function isFilterActive(statusSet, assigneeSet) {
  return (statusSet?.size ?? 0) > 0 || (assigneeSet?.size ?? 0) > 0;
}

/**
 * Calculate matching issue key set from worktrees + filter status.
 * Returns null if filter is inactive (interpreted as "match all" by the caller).
 * Phantom keys (keys not found in worktrees) are not included in the results, so they are automatically non-matched.
 *
 * @param {Record<string, object>} worktrees
 * @param {Set<string>} statusSet
 * @param {Set<string>} assigneeSet
 * @returns {Set<string> | null}
 */
export function computeMatchedKeys(worktrees, statusSet, assigneeSet) {
  if (!isFilterActive(statusSet, assigneeSet)) return null;
  const matched = new Set();
  if (!worktrees || typeof worktrees !== 'object') return matched;
  for (const wt of Object.values(worktrees)) {
    const issue = wt?.cachedIssue;
    if (!issue?.key) continue;
    if (statusSet.size > 0 && !statusSet.has(issue.status)) continue;
    const assignee = issue.assignee || 'Unassigned';
    if (assigneeSet.size > 0 && !assigneeSet.has(assignee)) continue;
    matched.add(issue.key);
  }
  return matched;
}
