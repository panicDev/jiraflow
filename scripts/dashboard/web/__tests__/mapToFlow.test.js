import { describe, it, expect } from 'vitest';
import { MarkerType } from '@xyflow/react';
import { mapToFlow } from '../src/components/graph/mapToFlow.js';

const makeGraphData = (edges = []) => ({
  nodes: [{ id: 'MAE-1', label: 'MAE-1', data: {} }],
  edges,
});

describe('mapToFlow', () => {
  it('U1: Give className marching-ants to all edges', () => {
    const graphData = makeGraphData([
      { id: 'e1', source: 'MAE-1', target: 'MAE-2', type: 'blocks',  data: {} },
      { id: 'e2', source: 'MAE-1', target: 'MAE-3', type: 'parent',  data: {} },
      { id: 'e3', source: 'MAE-1', target: 'MAE-4', type: 'epic',    data: {} },
    ]);
    const { flowEdges } = mapToFlow(graphData);
    expect(flowEdges).toHaveLength(3);
    flowEdges.forEach(edge => {
      expect(edge.className).toBe('marching-ants');
    });
  });

  it('U2: Return empty array when edges array is empty, no error', () => {
    const graphData = makeGraphData([]);
    const { flowEdges } = mapToFlow(graphData);
    expect(flowEdges).toEqual([]);
  });

  it('U3: edge level markerEnd is given stroke color for each relationship type', () => {
    const graphData = makeGraphData([
      { id: 'e1', source: 'MAE-1', target: 'MAE-2', type: 'blocks', data: {} },
      { id: 'e2', source: 'MAE-1', target: 'MAE-3', type: 'parent', data: {} },
      { id: 'e3', source: 'MAE-1', target: 'MAE-4', type: 'epic',   data: {} },
    ]);
    const { flowEdges } = mapToFlow(graphData);
    const byId = Object.fromEntries(flowEdges.map(e => [e.id, e]));
    expect(byId.e1.markerEnd).toMatchObject({ type: MarkerType.ArrowClosed, color: '#dc2626' });
    expect(byId.e2.markerEnd).toMatchObject({ type: MarkerType.ArrowClosed, color: '#64748b' });
    expect(byId.e3.markerEnd).toMatchObject({ type: MarkerType.ArrowClosed, color: '#9333ea' });
  });
});
