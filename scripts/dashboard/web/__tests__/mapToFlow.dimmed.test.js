/**
 *Tested dimmed processing based on matchedKeys in mapToFlow (MAE-265).
 */
import { describe, it, expect } from 'vitest';
import { mapToFlow } from '../src/components/graph/mapToFlow.js';

const graphData = {
  nodes: [
    { id: 'A-1', label: 'A-1', data: { status: 'In Progress' } },
    { id: 'A-2', label: 'A-2', data: { status: 'To Do' } },
    { id: 'A-3', label: 'A-3', data: { phantom: true } },
  ],
  edges: [
    { id: 'e1', source: 'A-1', target: 'A-2', type: 'blocks', data: {} },
    { id: 'e2', source: 'A-2', target: 'A-3', type: 'parent', data: {} },
  ],
};

describe('mapToFlow + matchedKeys', () => {
  it('U1: matchedKeys=null → all nodes dimmed=false', () => {
    const { flowNodes, flowEdges } = mapToFlow(graphData, { matchedKeys: null });
    expect(flowNodes.every(n => n.data.dimmed === false)).toBe(true);
    expect(flowEdges.every(e => e.className === 'marching-ants')).toBe(true);
  });

  it('U2: matchedKeys not specified → Same operation as null', () => {
    const { flowNodes } = mapToFlow(graphData);
    expect(flowNodes.every(n => n.data.dimmed === false)).toBe(true);
  });

  it('U3: matchedKeys=Set(["A-1"]) → Only A-1 is alive and the rest are dimmed', () => {
    const { flowNodes, flowEdges } = mapToFlow(graphData, {
      matchedKeys: new Set(['A-1']),
    });
    const dimmedById = Object.fromEntries(flowNodes.map(n => [n.id, n.data.dimmed]));
    expect(dimmedById).toEqual({ 'A-1': false, 'A-2': true, 'A-3': true });

    // Both endpoints must match for the edge to be alive.
    const e1 = flowEdges.find(e => e.id === 'e1');
    expect(e1.data.dimmed).toBe(true); // A-2 non-match
    expect(e1.className).toContain('graph-edge--dimmed');
  });

  it('U4: Both endpoints match → edge alive', () => {
    const { flowEdges } = mapToFlow(graphData, {
      matchedKeys: new Set(['A-1', 'A-2']),
    });
    const e1 = flowEdges.find(e => e.id === 'e1');
    expect(e1.data.dimmed).toBe(false);
    expect(e1.className).toBe('marching-ants');
  });

  it('U5: phantom node (A-3) is dimmed if not in matchedKeys', () => {
    const { flowNodes } = mapToFlow(graphData, {
      matchedKeys: new Set(['A-1', 'A-2']),
    });
    const phantom = flowNodes.find(n => n.id === 'A-3');
    expect(phantom.data.dimmed).toBe(true);
    expect(phantom.data.phantom).toBe(true);
  });
});
