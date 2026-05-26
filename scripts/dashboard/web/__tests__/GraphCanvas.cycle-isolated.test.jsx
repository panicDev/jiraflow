/**
 * GraphCanvas integration test (MAE-267) — isolated node/cycle edge visual processing.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

beforeAll(() => {
  if (!globalThis.EventSource) {
    globalThis.EventSource = class {
      constructor() {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    };
  }
  if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = cb => setTimeout(cb, 0);
    global.cancelAnimationFrame = id => clearTimeout(id);
  }
});

vi.mock('../src/hooks/useDashboardStream.js', () => ({
  useDashboardStream: () => {},
}));
vi.mock('../src/components/graph/useForceLayout.js', () => ({
  useForceLayout: () => ({ pinNode: () => {}, unpinNode: () => {} }),
}));

// Replace ReactFlow with a spyable stub: verify by exposing nodes/edges props.
const reactFlowSpy = vi.fn();
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    ReactFlow: (props) => {
      reactFlowSpy(props);
      return null; // Actual SVG rendering has no meaning in jsdom
    },
    Background: () => null,
    Controls: () => null,
  };
});

const GraphCanvas = (await import('../src/components/GraphCanvas.jsx')).default;

function getLatestProps() {
  expect(reactFlowSpy).toHaveBeenCalled();
  return reactFlowSpy.mock.calls[reactFlowSpy.mock.calls.length - 1][0];
}

/**
 * worktrees fixture. Specify links.blocks / parent.key as options.
 */
function makeWorktrees(entries = []) {
  const result = {};
  for (const { key, path, links, parent } of entries) {
    result[path] = {
      path,
      taskId: key,
      cachedIssue: {
        key,
        summary: `${key} summary`,
        status: 'In progress',
        priority: 'Main',
        assignee: 'tester',
        links: links ?? {},
        parent: parent ?? null,
      },
    };
  }
  return result;
}

describe('GraphCanvas — isolated/cycle (MAE-267)', () => {
  it('E2: Only isolated nodes have data.isolated=true passed to ReactFlow', () => {
    // A↔B are each other's blocks, C does not appear in any link → only C is isolated
    const worktrees = makeWorktrees([
      { key: 'P-A', path: '/wt/a', links: { blocks: ['P-B'] } },
      { key: 'P-B', path: '/wt/b', links: { blocks: ['P-A'] } },
      { key: 'P-C', path: '/wt/c' },
    ]);
    render(<GraphCanvas worktrees={worktrees} />);
    const { nodes } = getLatestProps();
    const byId = Object.fromEntries(nodes.map(n => [n.id, n.data.isolated]));
    expect(byId).toEqual({ 'P-A': false, 'P-B': false, 'P-C': true });
  });

  it('E1: data.cycle=true is passed to blocks cycle edge', () => {
    const worktrees = makeWorktrees([
      { key: 'P-A', path: '/wt/a', links: { blocks: ['P-B'] } },
      { key: 'P-B', path: '/wt/b', links: { blocks: ['P-A'] } },
    ]);
    render(<GraphCanvas worktrees={worktrees} />);
    const { edges } = getLatestProps();
    const blocksEdges = edges.filter(e => e.type === 'blocks');
    expect(blocksEdges.length).toBeGreaterThan(0);
    expect(blocksEdges.every(e => e.data.cycle === true)).toBe(true);
  });

  it('AC-5: Parent edge is excluded from cycle judgment (only blocks are checked)', () => {
    // P-A is the parent of P-B, and blocks of P-B point to P-A.
    // If you check the cycle up to the parent, it may appear as (P-B → P-A blocks) + (P-B → P-A parent)
    // Because it is in the same direction, a single SCC is not created. A clearer case: blocks single edge + parent single edge → no SCC
    const worktrees = makeWorktrees([
      { key: 'P-A', path: '/wt/a' },
      { key: 'P-B', path: '/wt/b', parent: { key: 'P-A' }, links: { blocks: ['P-A'] } },
    ]);
    render(<GraphCanvas worktrees={worktrees} />);
    const { edges } = getLatestProps();
    // No edge must have cycle=true (cannot cycle with 1 block in a single direction)
    expect(edges.every(e => e.data.cycle === false)).toBe(true);
  });
});
