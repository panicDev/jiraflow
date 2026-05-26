'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createStore, startSessionSweep } = require('../store');

// U1: ring buffer evict
test('U1: ring buffer evicts oldest entry when full', () => {
  const store = createStore({ ringBufferSize: 3 });
  store.upsertWorktree({ path: '/a', taskId: 't1' });

  store.pushActivity('/a', { ts: '1', type: 'x', data: {} });
  store.pushActivity('/a', { ts: '2', type: 'x', data: {} });
  store.pushActivity('/a', { ts: '3', type: 'x', data: {} });
  store.pushActivity('/a', { ts: '4', type: 'x', data: {} }); // evicts ts='1'

  // getSnapshot truncates at 50, but ring buffer has 3 slots
  const snap = store.getSnapshot();
  const entry = snap.find((w) => w.path === '/a');
  assert.ok(entry, 'entry should exist');
  assert.equal(entry.activity.length, 3);
  assert.equal(entry.activity[0].ts, '2', 'oldest should have been evicted');
  assert.equal(entry.activity[2].ts, '4');
});

// U2: upsertWorktree emits 'worktree.added' for new, 'worktree.changed' for existing
test('U2: upsertWorktree emits worktree.added for new path', (t, done) => {
  const store = createStore();
  store.on('worktree.added', ({ path }) => {
    assert.equal(path, '/new-path');
    done();
  });
  store.upsertWorktree({ path: '/new-path' });
});

test('U2b: upsertWorktree emits worktree.changed for existing path', (t, done) => {
  const store = createStore();
  store.upsertWorktree({ path: '/existing' });
  store.on('worktree.changed', ({ path }) => {
    assert.equal(path, '/existing');
    done();
  });
  store.upsertWorktree({ path: '/existing', branch: 'feat/x' });
});

// U3: getStaleEntries filters correctly
test('U3: getStaleEntries returns only stale entries with taskId', () => {
  const store = createStore();
  const now = Date.now();

  // Stale (6 min old)
  store.upsertWorktree({
    path: '/stale',
    taskId: 'T-1',
    lastFetchedAt: new Date(now - 6 * 60 * 1000).toISOString(),
    noContext: false,
  });
  // Fresh (1 min old)
  store.upsertWorktree({
    path: '/fresh',
    taskId: 'T-2',
    lastFetchedAt: new Date(now - 1 * 60 * 1000).toISOString(),
    noContext: false,
  });
  // No taskId (no context)
  store.upsertWorktree({
    path: '/nocontext',
    taskId: null,
    lastFetchedAt: new Date(now - 6 * 60 * 1000).toISOString(),
    noContext: true,
  });

  const stale = store.getStaleEntries(5 * 60 * 1000);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].path, '/stale');
});

// U4: removeWorktree emits worktree.removed; no-op for unknown path
test('U4: removeWorktree emits worktree.removed for existing path', (t, done) => {
  const store = createStore();
  store.upsertWorktree({ path: '/rm' });
  store.on('worktree.removed', ({ path }) => {
    assert.equal(path, '/rm');
    done();
  });
  store.removeWorktree('/rm');
});

test('U4b: removeWorktree is a no-op for unknown path', () => {
  const store = createStore();
  let emitted = false;
  store.on('worktree.removed', () => { emitted = true; });
  store.removeWorktree('/does-not-exist');
  assert.equal(emitted, false);
});

// U7: upsertWorktree returns cachedIssue populated by jira-collector(updateCachedIssue)
// Do not overwrite (worktree collector vs jira-collector conflict regression guard).
test('U7: upsertWorktree preserves existing cachedIssue against partial overwrite', () => {
  const store = createStore();
  // Cold-start: Worktree collector puts cachedIssue in file format (no links).
  store.upsertWorktree({
    path: '/wt',
    taskId: 'T-1',
    cachedIssue: { key: 'T-1', summary: 'from-file', status: 'In Progress' },
  });
  // jira-collector updates with live API data (including links).
  store.updateCachedIssue('/wt', {
    key: 'T-1', summary: 'live', status: 'In Progress',
    links: { blocks: [{ key: 'T-2' }], blockedBy: [] },
  });
  // Now the worktree collector sends the file format (no links) back to the chokidar trigger.
  store.upsertWorktree({
    path: '/wt',
    taskId: 'T-1',
    cachedIssue: { key: 'T-1', summary: 'from-file', status: 'In Progress' },
  });
  const snap = store.getSnapshot();
  const entry = snap.find((w) => w.path === '/wt');
  // links must be alive (will become undefined when regressing).
  assert.deepEqual(entry.cachedIssue.links, { blocks: [{ key: 'T-2' }], blockedBy: [] });
  assert.equal(entry.cachedIssue.summary, 'live');
});

// U7b: When cold-start (cachedIssue=null), the worktree collector fills in.
test('U7b: upsertWorktree fills cachedIssue when null (cold-start)', () => {
  const store = createStore();
  store.upsertWorktree({
    path: '/wt2',
    taskId: 'T-3',
    cachedIssue: { key: 'T-3', summary: 'from-file' },
  });
  const snap = store.getSnapshot();
  const entry = snap.find((w) => w.path === '/wt2');
  assert.equal(entry.cachedIssue.summary, 'from-file');
});

// U7c: Paths that the unlink handler explicitly clears with cachedIssue=null pass through the guard.
test('U7c: upsertWorktree allows explicit cachedIssue=null clear', () => {
  const store = createStore();
  store.upsertWorktree({ path: '/wt3', cachedIssue: { key: 'T-4' } });
  store.upsertWorktree({ path: '/wt3', cachedIssue: null, noContext: true });
  const snap = store.getSnapshot();
  const entry = snap.find((w) => w.path === '/wt3');
  assert.equal(entry.cachedIssue, null);
  assert.equal(entry.noContext, true);
});

// U7d: ​​If the worktree collector does not send the cachedIssue key itself, the jira-collector
// Filled memory cache (including links/parent) must be preserved. (Ground truth regression:
// Bug where cachedIssue was overwritten with null every 30 seconds and relationship data in the graph view disappeared)
test('U7d: upsertWorktree preserves cachedIssue when key absent in update', () => {
  const store = createStore();
  // jira-collector puts live data
  store.updateCachedIssue('/wt4', {
    key: 'T-5', summary: 'live', status: 'In progress',
    links: { blocks: [{ key: 'T-6' }], blockedBy: [] },
    parent: { key: 'EPIC-1' },
    fetchedAt: new Date().toISOString(),
  });
  // worktree-collector updates meta only without cachedIssue key (normal 30 second poll)
  store.upsertWorktree({
    path: '/wt4',
    taskId: 'T-5',
    branch: 'feature/T-5',
    summary: 'meta-only',
    status: 'In progress',
    noContext: false,
  });
  const snap = store.getSnapshot();
  const entry = snap.find((w) => w.path === '/wt4');
  assert.ok(entry.cachedIssue, 'cachedIssue must survive');
  assert.deepEqual(entry.cachedIssue.links, { blocks: [{ key: 'T-6' }], blockedBy: [] });
  assert.equal(entry.cachedIssue.parent.key, 'EPIC-1');
  assert.equal(entry.branch, 'feature/T-5'); // Meta updated
});

// U_tz_naive: timezone-naive lastFetchedAt → classified as stale
test('U_tz_naive: getStaleEntries treats timezone-naive lastFetchedAt as stale', () => {
  const store = createStore();
  // 5 minute stale window, set to 1 second ago → If normal, it should be fresh, but since it is a naive string, stale
  const recentNaive = new Date(Date.now() - 1000).toISOString().replace('Z', ''); // strip Z
  store.upsertWorktree({
    path: '/tz-naive',
    taskId: 'T-tz1',
    lastFetchedAt: recentNaive,
  });
  const stale = store.getStaleEntries(5 * 60 * 1000);
  assert.ok(stale.some((e) => e.path === '/tz-naive'), 'timezone-naive entry should be stale');
});

// U_tz_invalid: Random string lastFetchedAt → classified as stale
test('U_tz_invalid: getStaleEntries treats invalid lastFetchedAt as stale', () => {
  const store = createStore();
  store.upsertWorktree({
    path: '/tz-invalid',
    taskId: 'T-tz2',
    lastFetchedAt: 'not-a-date',
  });
  const stale = store.getStaleEntries(5 * 60 * 1000);
  assert.ok(stale.some((e) => e.path === '/tz-invalid'), 'invalid date entry should be stale');
});

// U_guard_new: fetchedAt the newer cachedIssue is reflected
test('U_guard_new: upsertWorktree replaces cachedIssue when incoming fetchedAt is newer', () => {
  const store = createStore();
  const T0 = new Date(Date.now() - 2000).toISOString(); // T0 (2 seconds ago)
  const T1 = new Date(Date.now() - 1000).toISOString(); // T0+1s (1 second ago)

  // Fetch T0 with updateCachedIssue (fetchedAt is set directly on the issue object)
  store.upsertWorktree({ path: '/guard', taskId: 'T-g1' });
  store.upsertWorktree({
    path: '/guard',
    cachedIssue: { key: 'T-g1', status: 'In Progress', fetchedAt: T0 },
  });

  // Send cachedIssue (status="Complete") for T0+1 seconds
  store.upsertWorktree({
    path: '/guard',
    cachedIssue: { key: 'T-g1', status: 'Complete', fetchedAt: T1 },
  });

  const snap = store.getSnapshot();
  const entry = snap.find((w) => w.path === '/guard');
  assert.equal(entry.cachedIssue.status, 'Complete', 'newer cachedIssue should replace existing');
});

// ─── MAE-331: session entry API ─────────────────────────────────────────────

test('SU1: upsertSession new → emits session.added, snapshot has 1', (t, done) => {
  const store = createStore();
  store.on('session.added', ({ sessionId }) => {
    assert.equal(sessionId, 's1');
    const snap = store.getSessionsSnapshot();
    assert.equal(snap.length, 1);
    assert.equal(snap[0].sessionId, 's1');
    assert.equal(snap[0].cwd, '/tmp/x');
    assert.equal(snap[0].source, 'startup');
    done();
  });
  store.upsertSession({
    sessionId: 's1', cwd: '/tmp/x', source: 'startup',
    startedAt: '2026-05-04T00:00:00Z', lastActiveAt: '2026-05-04T00:00:00Z',
  });
});

test('SU2: upsertSession partial update preserves existing fields', () => {
  const store = createStore();
  store.upsertSession({
    sessionId: 's2', cwd: '/tmp/y', source: 'resume',
    startedAt: '2026-05-04T01:00:00Z', lastActiveAt: '2026-05-04T01:00:00Z',
  });
  store.upsertSession({ sessionId: 's2', lastActiveAt: '2026-05-04T01:05:00Z' });
  const snap = store.getSessionsSnapshot();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].cwd, '/tmp/y', 'cwd preserved');
  assert.equal(snap[0].source, 'resume', 'source preserved');
  assert.equal(snap[0].startedAt, '2026-05-04T01:00:00Z', 'startedAt preserved');
  assert.equal(snap[0].lastActiveAt, '2026-05-04T01:05:00Z', 'lastActiveAt updated');
});

test('SU2b: upsertSession existing → emits session.changed (not added)', (t, done) => {
  const store = createStore();
  store.upsertSession({ sessionId: 's2b', cwd: '/a' });
  store.on('session.added', () => assert.fail('should not re-add'));
  store.on('session.changed', ({ sessionId }) => {
    assert.equal(sessionId, 's2b');
    done();
  });
  store.upsertSession({ sessionId: 's2b', lastActiveAt: '2026-05-04T02:00:00Z' });
});

test('SU3: removeSession existing → emits session.removed, snapshot empty', (t, done) => {
  const store = createStore();
  store.upsertSession({ sessionId: 's3', cwd: '/a' });
  store.on('session.removed', ({ sessionId }) => {
    assert.equal(sessionId, 's3');
    assert.equal(store.getSessionsSnapshot().length, 0);
    done();
  });
  store.removeSession('s3');
});

test('SU4: removeSession unknown → no-op, no event', () => {
  const store = createStore();
  let emitted = false;
  store.on('session.removed', () => { emitted = true; });
  store.removeSession('nope');
  assert.equal(emitted, false);
});

test('SU5: pushSessionActivity beyond ring size truncates and snapshot caps at 50', () => {
  const store = createStore({ ringBufferSize: 3 });
  store.upsertSession({ sessionId: 's5', cwd: '/a' });
  store.pushSessionActivity('s5', { ts: '1', type: 'x', data: {} });
  store.pushSessionActivity('s5', { ts: '2', type: 'x', data: {} });
  store.pushSessionActivity('s5', { ts: '3', type: 'x', data: {} });
  store.pushSessionActivity('s5', { ts: '4', type: 'x', data: {} }); // evicts ts=1
  const snap = store.getSessionsSnapshot();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].activity.length, 3);
  assert.equal(snap[0].activity[0].ts, '2', 'oldest evicted');
});

test('SU6: getSnapshot does not include sessions (worktree-only, backward compat)', () => {
  const store = createStore();
  store.upsertWorktree({ path: '/wt', taskId: 'T-1' });
  store.upsertSession({ sessionId: 's6', cwd: '/tmp/z' });
  const wts = store.getSnapshot();
  assert.equal(wts.length, 1);
  assert.equal(wts[0].path, '/wt');
  // sessions are exposed only via getSessionsSnapshot
  assert.equal(store.getSessionsSnapshot().length, 1);
});

test('SU7: upsertSession ignores invalid input (no sessionId)', () => {
  const store = createStore();
  store.upsertSession({ cwd: '/a' });
  store.upsertSession(null);
  store.upsertSession({ sessionId: '' });
  assert.equal(store.getSessionsSnapshot().length, 0);
});

// U_guard_old: cachedIssue whose fetchedAt is old preserves its old value
test('U_guard_old: upsertWorktree preserves cachedIssue when incoming fetchedAt is older', () => {
  const store = createStore();
  const T0 = new Date(Date.now() - 1000).toISOString(); // T0 (1 second ago)
  const Told = new Date(Date.now() - 2000).toISOString(); // T0-1s (2 seconds ago, older)

  store.upsertWorktree({ path: '/guard2', taskId: 'T-g2' });
  store.upsertWorktree({
    path: '/guard2',
    cachedIssue: { key: 'T-g2', status: 'In Progress', fetchedAt: T0 },
  });

  // send cachedIssue (status="complete") of older fetchedAt
  store.upsertWorktree({
    path: '/guard2',
    cachedIssue: { key: 'T-g2', status: 'Complete', fetchedAt: Told },
  });

  const snap = store.getSnapshot();
  const entry = snap.find((w) => w.path === '/guard2');
  assert.equal(entry.cachedIssue.status, 'In Progress', 'older cachedIssue should be discarded');
});

// ─── MAE-332: session entry TTL sweep ───────────────────────────────────────

// SW1: sweep removes entry whose lastActiveAt is older than ttlMs
test('SW1: sweep removes entry past TTL', () => {
  const store = createStore();
  const now = 10_000_000;
  // lastActiveAt 6 minutes ago → 5 minutes TTL exceeded
  const stale = new Date(now - 6 * 60 * 1000).toISOString();
  const fresh = new Date(now - 1 * 60 * 1000).toISOString();
  store.upsertSession({ sessionId: 'old', lastActiveAt: stale });
  store.upsertSession({ sessionId: 'new', lastActiveAt: fresh });

  const sweeper = startSessionSweep(store, {
    ttlMs: 5 * 60 * 1000,
    intervalMs: 1_000_000, // Virtually automatic ignition
    now: () => now,
  });
  try {
    const removed = sweeper.sweep();
    assert.deepEqual(removed, ['old']);
    const remaining = store.getSessionsSnapshot().map((s) => s.sessionId);
    assert.deepEqual(remaining, ['new']);
  } finally {
    sweeper.stop();
  }
});

// SW2: missing/invalid lastActiveAt is also treated as stale
test('SW2: sweep removes entries with missing/invalid lastActiveAt', () => {
  const store = createStore();
  store.upsertSession({ sessionId: 'no-ts' }); // lastActiveAt = null
  store.upsertSession({ sessionId: 'naive', lastActiveAt: '2026-05-04T01:00:00' }); // naive (no Z)
  store.upsertSession({ sessionId: 'ok', lastActiveAt: new Date().toISOString() });

  const sweeper = startSessionSweep(store, { intervalMs: 1_000_000 });
  try {
    const removed = sweeper.sweep().sort();
    assert.deepEqual(removed, ['naive', 'no-ts']);
    const remaining = store.getSessionsSnapshot().map((s) => s.sessionId);
    assert.deepEqual(remaining, ['ok']);
  } finally {
    sweeper.stop();
  }
});

// SW3: entry refreshed within TTL survives a later sweep (lastActiveAt update verification)
test('SW3: refreshed session survives sweep (lastActiveAt update extends TTL)', () => {
  const store = createStore();
  const t0 = 10_000_000;
  const t1 = t0 + 4 * 60 * 1000; // PreToolUse fires after 4 minutes
  const t2 = t1 + 4 * 60 * 1000; // First sweep time (t0+8min, 4 minutes after update)

  store.upsertSession({ sessionId: 's', lastActiveAt: new Date(t0).toISOString() });
  // partial update after 4 minutes (imitating ingest's lastActiveAt update)
  store.upsertSession({ sessionId: 's', lastActiveAt: new Date(t1).toISOString() });

  const sweeper = startSessionSweep(store, {
    ttlMs: 5 * 60 * 1000,
    intervalMs: 1_000_000,
    now: () => t2,
  });
  try {
    assert.deepEqual(sweeper.sweep(), []);
    assert.equal(store.getSessionsSnapshot().length, 1);
  } finally {
    sweeper.stop();
  }
});

// SW4: independent TTL per session (N simultaneously)
test('SW4: each session has independent TTL', () => {
  const store = createStore();
  const now = 10_000_000;
  store.upsertSession({ sessionId: 'a', lastActiveAt: new Date(now - 6 * 60 * 1000).toISOString() });
  store.upsertSession({ sessionId: 'b', lastActiveAt: new Date(now - 4 * 60 * 1000).toISOString() });
  store.upsertSession({ sessionId: 'c', lastActiveAt: new Date(now - 7 * 60 * 1000).toISOString() });

  const sweeper = startSessionSweep(store, {
    ttlMs: 5 * 60 * 1000,
    intervalMs: 1_000_000,
    now: () => now,
  });
  try {
    const removed = sweeper.sweep().sort();
    assert.deepEqual(removed, ['a', 'c']);
    assert.deepEqual(store.getSessionsSnapshot().map((s) => s.sessionId), ['b']);
  } finally {
    sweeper.stop();
  }
});

// SW5: timer is unref'd (does not keep process alive) and stop() clears it
test('SW5: setInterval handle is unref\'d and stop() clears it', () => {
  const store = createStore();
  const sweeper = startSessionSweep(store, { intervalMs: 30_000 });
  // Since it is difficult to directly verify the timer handle, just check that the stop() call operates without throwing.
  // unref() is called with a typeof check inside startSessionSweep, so it only prevents syntactic regression.
  assert.doesNotThrow(() => sweeper.stop());
  // Calling it twice must also be safe (clearInterval is idempotent)
  assert.doesNotThrow(() => sweeper.stop());
});
