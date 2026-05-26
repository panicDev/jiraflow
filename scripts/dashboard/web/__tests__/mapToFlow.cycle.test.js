/**
 * MAE-267: Testing mapToFlow's isolated / cycle flag attachment.
 */
import { describe, it, expect } from 'vitest';
import { mapToFlow } from '../src/components/graph/mapToFlow.js';

const graphData = {
  nodes: [
    { id: 'A', label: 'A', data: {} },
    { id: 'B', label: 'B', data: {} },
    { id: 'C', label: 'C', data: {} },
  ],
  edges: [
    { id: 'e1', source: 'A', target: 'B', type: 'blocks', data: {} },
    { id: 'e2', source: 'B', target: 'A', type: 'blocks', data: {} },
  ],
};

describe('mapToFlow + isolated/cycle', () => {
  it('U10: When passing isolatedSet, only the corresponding node data.isolated=true', () => {
    const { flowNodes } = mapToFlow(graphData, { isolatedSet: new Set(['C']) });
    const byId = Object.fromEntries(flowNodes.map(n => [n.id, n.data.isolated]));
    expect(byId).toEqual({ A: false, B: false, C: true });
  });

  it('U11: When passing cycleEdgeSet, only the edge data.cycle=true', () => {
    const { flowEdges } = mapToFlow(graphData, { cycleEdgeSet: new Set(['e1']) });
    const byId = Object.fromEntries(flowEdges.map(e => [e.id, e.data.cycle]));
    expect(byId).toEqual({ e1: true, e2: false });
  });

  it('U12: If options are not delivered, isolated/cycle are all false (maintain existing operation)', () => {
    const { flowNodes, flowEdges } = mapToFlow(graphData);
    expect(flowNodes.every(n => n.data.isolated === false)).toBe(true);
    expect(flowEdges.every(e => e.data.cycle === false)).toBe(true);
    // dimmed operation should not be broken either
    expect(flowNodes.every(n => n.data.dimmed === false)).toBe(true);
  });

  it('isolated and dimmed accumulate independently', () => {
    const { flowNodes } = mapToFlow(graphData, {
      matchedKeys: new Set(['A']),
      isolatedSet: new Set(['C']),
    });
    const c = flowNodes.find(n => n.id === 'C');
    expect(c.data.dimmed).toBe(true);
    expect(c.data.isolated).toBe(true);
  });
});
