/**
 * useForceLayout unit test (MAE-262)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

beforeEach(() => {
  if (typeof global.requestAnimationFrame === 'undefined') {
    global.requestAnimationFrame = cb => setTimeout(cb, 0);
    global.cancelAnimationFrame = id => clearTimeout(id);
  }
});

/** Create a simple node/edge for testing */
function makeNodes(ids) {
  return ids.map((id, i) => ({
    id,
    position: { x: i * 10, y: 0 },
    data: { label: id },
  }));
}

function makeEdges(pairs) {
  return pairs.map(([source, target]) => ({
    id: `${source}->${target}`,
    source,
    target,
    type: 'blocks',
  }));
}

describe('useForceLayout', () => {
  it('U2: setNodes is no longer called after unmount', async () => {
    const { useForceLayout } = await import('../src/components/graph/useForceLayout.js');
    const nodes = makeNodes(['A', 'B', 'C']);
    const edges = makeEdges([['A', 'B']]);
    const setNodes = vi.fn();

    const { unmount } = renderHook(() =>
      useForceLayout(nodes, edges, setNodes)
    );

    // Give time for simulation to start
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    unmount();

    // Record the number of setNodes calls after unmounting
    const callCountAfterUnmount = setNodes.mock.calls.length;

    // Additional time elapses after unmounting
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });

    // There should be no new calls after unmount (simulation.stop + RAF cancel)
    expect(setNodes.mock.calls.length).toBe(callCountAfterUnmount);
  });

  it('U4: mapToFlow — edge type preservation + node/edge 1:1 mapping', async () => {
    const { mapToFlow } = await import('../src/components/graph/mapToFlow.js');
    const graphData = {
      nodes: [
        { id: 'MAE-1', label: 'MAE-1 task', data: { status: 'In progress' } },
        { id: 'MAE-2', label: 'MAE-2 task', data: { phantom: true } },
      ],
      edges: [
        { id: 'blocks:MAE-1->MAE-2', source: 'MAE-1', target: 'MAE-2', type: 'blocks' },
      ],
    };

    const { flowNodes, flowEdges } = mapToFlow(graphData);

    expect(flowNodes).toHaveLength(2);
    expect(flowEdges).toHaveLength(1);
    expect(flowNodes[0].id).toBe('MAE-1');
    expect(flowNodes[1].id).toBe('MAE-2');
    expect(flowEdges[0].type).toBe('blocks');
    expect(flowEdges[0].source).toBe('MAE-1');
    expect(flowEdges[0].target).toBe('MAE-2');
  });

  it('U4b: mapToFlow — node position initialized', async () => {
    const { mapToFlow } = await import('../src/components/graph/mapToFlow.js');
    const { flowNodes } = mapToFlow({
      nodes: [{ id: 'X', label: 'X', data: {} }],
      edges: [],
    });
    expect(flowNodes[0].position).toBeDefined();
    expect(typeof flowNodes[0].position.x).toBe('number');
    expect(typeof flowNodes[0].position.y).toBe('number');
  });

  it('setNodes is not called when empty nodes are entered', async () => {
    const { useForceLayout } = await import('../src/components/graph/useForceLayout.js');
    const setNodes = vi.fn();

    renderHook(() => useForceLayout([], [], setNodes));

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(setNodes).not.toHaveBeenCalled();
  });
});
