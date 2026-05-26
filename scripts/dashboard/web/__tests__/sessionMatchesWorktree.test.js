/**
 * MAE-333: sessionMatchesWorktree helper unit test.
 *
 * Since it is an internal function of App.jsx, duplicate the logic and verify it with a pure unit test.
 * (When separating into a utility module in the future, only the import path needs to be replaced)
 */
import { describe, it, expect } from 'vitest';

// Mirror sessionMatchesWorktree/normalizePath logic in App.jsx
function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

function sessionMatchesWorktree(cwd, wtPath) {
  if (!cwd) return false;
  const normCwd = normalizePath(cwd);
  const normWt = normalizePath(wtPath);
  return normCwd === normWt || normCwd.startsWith(normWt + '/');
}

describe('sessionMatchesWorktree (MAE-333)', () => {
  // M1: cwd === exactly match wtPath
  it('true if cwd exactly matches the worktree path', () => {
    expect(sessionMatchesWorktree('/wt/project', '/wt/project')).toBe(true);
  });

  // M2: cwd is a subdirectory of wtPath
  it('true if cwd is a subdirectory of worktree path', () => {
    expect(sessionMatchesWorktree('/wt/project/subdir', '/wt/project')).toBe(true);
  });

  // M3: cwd is a subdirectory of wtPath Irrelevant path
  it('false if cwd is a path unrelated to the worktree', () => {
    expect(sessionMatchesWorktree('/tmp/other', '/wt/project')).toBe(false);
  });

  // M4: false if cwd is null
  it('false if cwd is null', () => {
    expect(sessionMatchesWorktree(null, '/wt/project')).toBe(false);
  });

  // M5: partial prefix defense — "/wt/projectX" is not a child of "/wt/project"
  it('Partial prefix is not considered a match (respect path boundaries)', () => {
    expect(sessionMatchesWorktree('/wt/projectX', '/wt/project')).toBe(false);
  });

  // M6: Normalize Windows paths (backslashes)
  it('Matches after normalization', () => {
    expect(sessionMatchesWorktree('C:\\wt\\project', 'C:/wt/project')).toBe(true);
  });

  // M7: wtPath with trailing slash — subpath matching defense
  it('Matching subpath even without trailing slash in worktree path', () => {
    expect(sessionMatchesWorktree('/wt/project/src/foo', '/wt/project')).toBe(true);
  });
});
