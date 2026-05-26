/**
 * graph-stability.test.js — MAE-328 regression prevention unit test
 *
 * Verification items:
 * (a) selectGraphData 1-slot cache: Returns the same reference when entering the same content (U1, U2, U3)
 
 * (c) mergeNodesById: Preserve position + Add new id + Remove missing id (U8, U9)
 * (d) selectGraphData → mapToFlow pipeline: Stable flowNodes reference when inputting the same worktrees
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  selectGraphData,
  __resetGraphCache,
} from '../src/selectors/graph.js';
import {
  mapToFlow,
  __resetMapToFlowCache,
} from '../src/components/graph/mapToFlow.js';
import {
  mergeNodesById,
} from '../src/components/GraphCanvas.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorktree(key, overrides = {}) {
  return {
    cachedIssue: {
      key,
      summary: `Summary of ${key}`,
      status: 'In Progress',
      assignee: 'dev',
      issuetype: 'Story',
      links: { blocks: [], blockedBy: [] },
      parent: null,
      epic: null,
      ...overrides,
    },
  };
}

function makeRFNode(id, x = 0, y = 0, extraData = {}) {
  return {
    id,
    type: 'graphNode',
    position: { x, y },
    data: { label: id, ...extraData },
  };
}

// ---------------------------------------------------------------------------
// (a) selectGraphData 1-slot cache (U1, U2, U3)
// ---------------------------------------------------------------------------

describe('selectGraphData — 1-slot cache (MAE-328)', () => {
  beforeEach(() => {
    __resetGraphCache();
  });

  // U1: input same content twice → same reference
  it('U1: return same reference when calling worktrees with same content twice', () => {
    const worktrees = {
      '/a': makeWorktree('MAE-1'),
      '/b': makeWorktree('MAE-2'),
    };
    const r1 = selectGraphData(worktrees);
    const r2 = selectGraphData(worktrees);
    expect(r1).toBe(r2); // Reference equality (===)
  });

  // U1 variant: new object with same content (same content, different reference)
  it('U1b: Call with new worktrees object with same content returns same reference', () => {
    const wt1a = { '/a': makeWorktree('MAE-1') };
    const r1 = selectGraphData(wt1a);
    
    const wt1b = { '/a': makeWorktree('MAE-1') };
    const r2 = selectGraphData(wt1b);
    expect(r1).toBe(r2);
  });

  // U2: Return new reference when display field (status/summary) changes
  it('U2: Return new reference when status changes (prevent stale)', () => {
    const wt1 = { '/a': makeWorktree('MAE-1', { status: 'In Progress' }) };
    const r1 = selectGraphData(wt1);

    __resetGraphCache();

    const wt2 = { '/a': makeWorktree('MAE-1', { status: 'Done' }) };
    const r2 = selectGraphData(wt2);
    expect(r1).not.toBe(r2);
    expect(r2.nodes[0].data.status).toBe('Done');
  });

  // U3: New reference + added node when adding node id
  it('U3: When called after adding a node, return a new reference + contain the new node', () => {
    const wt1 = { '/a': makeWorktree('MAE-1') };
    const r1 = selectGraphData(wt1);

    __resetGraphCache();

    const wt2 = { '/a': makeWorktree('MAE-1'), '/b': makeWorktree('MAE-2') };
    const r2 = selectGraphData(wt2);
    expect(r1).not.toBe(r2);
    expect(r2.nodes.map(n => n.id)).toContain('MAE-2');
  });
});

// ---------------------------------------------------------------------------
// (b) mapToFlow 1-slot cache (U4, U5)
// ---------------------------------------------------------------------------

describe('mapToFlow — 1-slot cache (MAE-328)', () => {
  beforeEach(() => {
    __resetGraphCache();
    __resetMapToFlowCache();
  });

  // U4: Same graphData reference + same option twice → same reference
  it('U4: same graphData + same option returned when called twice', () => {
    const graphData = selectGraphData({ '/a': makeWorktree('MAE-1') });
    const r1 = mapToFlow(graphData);
    const r2 = mapToFlow(graphData);
    expect(r1).toBe(r2);
  });

  // U5: new reference when matchedKeys change + update dimmed flag
  it('U5: Return new reference when matchedKeys change', () => {
    const worktrees = {
      '/a': makeWorktree('MAE-1'),
      '/b': makeWorktree('MAE-2'),
    };
    const graphData = selectGraphData(worktrees);

    const r1 = mapToFlow(graphData, { matchedKeys: null });
    const matchedSet = new Set(['MAE-1']);
    const r2 = mapToFlow(graphData, { matchedKeys: matchedSet });

    expect(r1).not.toBe(r2);
    // MAE-2 nodes are dimmed
    const mae2 = r2.flowNodes.find(n => n.id === 'MAE-2');
    expect(mae2.data.dimmed).toBe(true);
    // MAE-1 nodes are not dimmed
    const mae1 = r2.flowNodes.find(n => n.id === 'MAE-1');
    expect(mae1.data.dimmed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (c) mergeNodesById (U8, U9)
// ---------------------------------------------------------------------------

describe('mergeNodesById (MAE-328)', () => {
  // U8: Preserve existing id → position, replace data with new value
  it('U8: The position of the existing id is preserved and the data is replaced with the new value', () => {
    const prev = [makeRFNode('A', 100, 200, { label: 'old' })];
    const next = [makeRFNode('A', 0, 0, { label: 'new' })];

    const result = mergeNodesById(prev, next);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('A');
    // position preserves the prev value
    expect(result[0].position).toEqual({ x: 100, y: 200 });
    // data is the next value (label: 'new')
    expect(result[0].data.label).toBe('new');
  });

  // U9a: Add new id — preserve existing A + add new B (using next pos)
  it('U9a: When adding a new id, preserve the existing id position + the new id remains in the next position', () => {
    const prev = [makeRFNode('A', 100, 200)];
    const next = [makeRFNode('A', 0, 0), makeRFNode('B', 50, 60)];

    const result = mergeNodesById(prev, next);

    expect(result).toHaveLength(2);
    // A: Maintain position
    const a = result.find(n => n.id === 'A');
    expect(a.position).toEqual({ x: 100, y: 200 });
    // B: Maintain next position
    const b = result.find(n => n.id === 'B');
    expect(b.position).toEqual({ x: 50, y: 60 });
  });

  // U9b: Remove missing id — prev=[A,B], next=[B] → result=[B]
  it('U9b: Missing ids are removed from the result', () => {
    const prev = [makeRFNode('A', 100, 200), makeRFNode('B', 300, 400)];
    const next = [makeRFNode('B', 0, 0)];

    const result = mergeNodesById(prev, next);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('B');
    // B's position preserves prev value
    expect(result[0].position).toEqual({ x: 300, y: 400 });
  });

  // U9c: First mount (prev is empty) → All new, next position is used
  it('U9c: If prev is empty on first mount, all new next positions are used', () => {
    const prev = [];
    const next = [makeRFNode('A', 10, 20), makeRFNode('B', 30, 40)];

    const result = mergeNodesById(prev, next);

    expect(result).toHaveLength(2);
    expect(result.find(n => n.id === 'A').position).toEqual({ x: 10, y: 20 });
    expect(result.find(n => n.id === 'B').position).toEqual({ x: 30, y: 40 });
  });
});

// ---------------------------------------------------------------------------
// (d) Integration: selectGraphData → mapToFlow pipeline reference stability
// ---------------------------------------------------------------------------

describe('selectGraphData → mapToFlow pipeline reference stability (MAE-328)', () => {
  beforeEach(() => {
    __resetGraphCache();
    __resetMapToFlowCache();
  });

  it('flowNodes/flowEdges reference immutable when repeating input of the same worktrees object', () => {
    const worktrees = {
      '/a': makeWorktree('MAE-1'),
      '/b': makeWorktree('MAE-2'),
    };

    const g1 = selectGraphData(worktrees);
    const m1 = mapToFlow(g1);

    const g2 = selectGraphData(worktrees);
    const m2 = mapToFlow(g2);

    // Reference stability
    expect(g1).toBe(g2);
    expect(m1).toBe(m2);
  });

  it('When content changes, selectGraphData new reference → mapToFlow also new reference', () => {
    const worktrees1 = { '/a': makeWorktree('MAE-1', { status: 'In Progress' }) };
    const g1 = selectGraphData(worktrees1);
    const m1 = mapToFlow(g1);

    __resetGraphCache();
    __resetMapToFlowCache();

    const worktrees2 = { '/a': makeWorktree('MAE-1', { status: 'Done' }) };
    const g2 = selectGraphData(worktrees2);
    const m2 = mapToFlow(g2);

    expect(g1).not.toBe(g2);
    expect(m1).not.toBe(m2);
  });
});
