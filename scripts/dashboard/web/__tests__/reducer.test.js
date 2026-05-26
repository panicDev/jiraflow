import { describe, it, expect } from 'vitest';
import { reducer, initialState } from '../src/state/reducer.js';

const makeWorktree = (path, extras = {}) => ({
  path,
  branch: null,
  taskId: null,
  cachedIssue: null,
  noContext: false,
  activity: [],
  ...extras,
});

describe('reducer', () => {
  // U1
  it('SNAPSHOT: replace worktrees map + connection=connected', () => {
    const wt = makeWorktree('/a', { taskId: 'X-1' });
    const state = reducer(initialState, { type: 'SNAPSHOT', worktrees: [wt] });
    expect(state.worktrees['/a']).toBeDefined();
    expect(state.worktrees['/a'].taskId).toBe('X-1');
    expect(state.connection).toBe('connected');
  });

  // U2
  it('WORKTREE_ADDED: Add new path + maintain existing', () => {
    const s1 = reducer(initialState, {
      type: 'SNAPSHOT',
      worktrees: [makeWorktree('/a', { taskId: 'X-1' })],
    });
    const s2 = reducer(s1, {
      type: 'WORKTREE_ADDED',
      path: '/b',
      state: makeWorktree('/b'),
    });
    expect(s2.worktrees['/b']).toBeDefined();
    expect(s2.worktrees['/a']).toBeDefined();
  });

  // U3
  it('WORKTREE_CHANGED: Update only the path', () => {
    const s1 = reducer(initialState, {
      type: 'SNAPSHOT',
      worktrees: [
        makeWorktree('/a', { taskId: 'X-1' }),
        makeWorktree('/b'),
      ],
    });
    const newState = makeWorktree('/a', {
      taskId: 'X-1',
      cachedIssue: { key: 'X-1', summary: 'updated' },
    });
    const s2 = reducer(s1, { type: 'WORKTREE_CHANGED', path: '/a', state: newState });
    expect(s2.worktrees['/a'].cachedIssue.summary).toBe('updated');
    expect(s2.worktrees['/b']).toEqual(s1.worktrees['/b']);
  });

  // U4
  it('WORKTREE_REMOVED: path deleted, existing object not changed (immutable)', () => {
    const s1 = reducer(initialState, {
      type: 'SNAPSHOT',
      worktrees: [makeWorktree('/a'), makeWorktree('/b')],
    });
    const prevWorktrees = s1.worktrees;
    const s2 = reducer(s1, { type: 'WORKTREE_REMOVED', path: '/a' });
    expect(s2.worktrees['/a']).toBeUndefined();
    expect(s2.worktrees['/b']).toBeDefined();
    // Original state is immutable
    expect(prevWorktrees['/a']).toBeDefined();
  });

  // U5
  it('CONNECTION_LOST: switch to disconnected, preserve worktrees', () => {
    const s1 = reducer(initialState, {
      type: 'SNAPSHOT',
      worktrees: [makeWorktree('/a')],
    });
    const s2 = reducer(s1, { type: 'CONNECTION_LOST' });
    expect(s2.connection).toBe('disconnected');
    expect(s2.worktrees['/a']).toBeDefined();
  });

  // U6
  it('CONNECTION_FAILED_INITIAL: never-connected remains', () => {
    const s2 = reducer(initialState, { type: 'CONNECTION_FAILED_INITIAL' });
    expect(s2.connection).toBe('never-connected');
  });

  // U6 (MAE-239): LIVE_EVENT — Only update lastEventAt, rest remains unchanged
  it('LIVE_EVENT: lastEventAt updated, remaining state unchanged', () => {
    const s1 = reducer(initialState, {
      type: 'SNAPSHOT',
      worktrees: [makeWorktree('/a', { taskId: 'X-1' })],
    });
    const s2 = reducer(s1, { type: 'LIVE_EVENT', at: 123 });
    expect(s2.lastEventAt).toBe(123);
    expect(s2.connection).toBe(s1.connection);
    expect(s2.worktrees).toBe(s1.worktrees); // same reference (no mutation)
  });
});
