/**
 * MAE-333: SESSION_* reducer action unit tests
 */
import { describe, it, expect } from 'vitest';
import { reducer, initialState } from '../src/state/reducer.js';

const makeSession = (sessionId, extras = {}) => ({
  sessionId,
  cwd: null,
  source: null,
  startedAt: null,
  lastActiveAt: null,
  activity: [],
  ...extras,
});

describe('reducer — SESSION actions (MAE-333)', () => {
  // S1: Initialize SNAPSHOT sessions collection
  it('SNAPSHOT: Initialize the sessions collection to a sessionId keyed map', () => {
    const s = makeSession('sess-aaa', { cwd: '/tmp/foo', source: 'startup' });
    const state = reducer(initialState, { type: 'SNAPSHOT', worktrees: [], sessions: [s] });
    expect(state.sessions['sess-aaa']).toBeDefined();
    expect(state.sessions['sess-aaa'].cwd).toBe('/tmp/foo');
    expect(state.sessions['sess-aaa'].source).toBe('startup');
    expect(state.connection).toBe('connected');
  });

  // S2: Empty map if there are no SNAPSHOT sessions
  it('SNAPSHOT: Empty object if there is no sessions field', () => {
    const state = reducer(initialState, { type: 'SNAPSHOT', worktrees: [] });
    expect(state.sessions).toEqual({});
  });

  // S3: SESSION_ADDED New session Add
  it('SESSION_ADDED: Add new sessionId, preserve existing sessions', () => {
    const s1 = reducer(initialState, {
      type: 'SNAPSHOT',
      worktrees: [],
      sessions: [makeSession('sess-aaa')],
    });
    const s2 = reducer(s1, {
      type: 'SESSION_ADDED',
      sessionId: 'sess-bbb',
      state: makeSession('sess-bbb', { cwd: '/tmp/bar' }),
    });
    expect(s2.sessions['sess-bbb']).toBeDefined();
    expect(s2.sessions['sess-bbb'].cwd).toBe('/tmp/bar');
    expect(s2.sessions['sess-aaa']).toBeDefined(); // Maintain existing
  });

  // S4: SESSION_CHANGED Update session state
  it('SESSION_CHANGED: Update only sessionId, other sessions are immutable', () => {
    const s1 = reducer(initialState, {
      type: 'SNAPSHOT',
      worktrees: [],
      sessions: [
        makeSession('sess-aaa', { cwd: '/tmp/a' }),
        makeSession('sess-bbb', { cwd: '/tmp/b' }),
      ],
    });
    const updated = makeSession('sess-aaa', { cwd: '/tmp/a', source: 'resume' });
    const s2 = reducer(s1, { type: 'SESSION_CHANGED', sessionId: 'sess-aaa', state: updated });
    expect(s2.sessions['sess-aaa'].source).toBe('resume');
    expect(s2.sessions['sess-bbb']).toEqual(s1.sessions['sess-bbb']); // immutable
  });

  // S5: SESSION_REMOVED Remove session
  it('SESSION_REMOVED: Delete sessionId, keep existing sessions, original immutable', () => {
    const s1 = reducer(initialState, {
      type: 'SNAPSHOT',
      worktrees: [],
      sessions: [makeSession('sess-aaa'), makeSession('sess-bbb')],
    });
    const prevSessions = s1.sessions;
    const s2 = reducer(s1, { type: 'SESSION_REMOVED', sessionId: 'sess-aaa' });
    expect(s2.sessions['sess-aaa']).toBeUndefined();
    expect(s2.sessions['sess-bbb']).toBeDefined();
    // Original immutable
    expect(prevSessions['sess-aaa']).toBeDefined();
  });

  // S6: SESSION_REMOVED Non-existent ID — pass without error
  it('SESSION_REMOVED: Safely handle non-existent sessionId', () => {
    const s1 = reducer(initialState, {
      type: 'SNAPSHOT',
      worktrees: [],
      sessions: [makeSession('sess-aaa')],
    });
    const s2 = reducer(s1, { type: 'SESSION_REMOVED', sessionId: 'nonexistent' });
    expect(s2.sessions['sess-aaa']).toBeDefined();
  });

  // S7: Worktrees and sessions coexist
  it('SNAPSHOT: Worktrees and sessions can be included at the same time', () => {
    const state = reducer(initialState, {
      type: 'SNAPSHOT',
      worktrees: [{ path: '/wt/a', branch: null, taskId: 'X-1', cachedIssue: null, noContext: false, activity: [] }],
      sessions: [makeSession('sess-aaa', { cwd: '/tmp/foo' })],
    });
    expect(Object.keys(state.worktrees)).toHaveLength(1);
    expect(Object.keys(state.sessions)).toHaveLength(1);
  });
});
