/**
 * MAE-267: Graph analysis utility unit tests.
 */
import { describe, it, expect } from 'vitest';
import { findIsolatedNodes, findCycleEdges } from '../src/components/graph/analysis.js';

const n = (id) => ({ id });
const e = (id, source, target) => ({ id, source, target });

describe('findIsolatedNodes', () => {
  it('U1: All nodes are connected to edges → empty Set', () => {
    const nodes = [n('A'), n('B'), n('C')];
    const edges = [e('e1', 'A', 'B'), e('e2', 'B', 'C')];
    expect(Array.from(findIsolatedNodes(nodes, edges)).sort()).toEqual([]);
  });

  it('U2: A node is not on any edge → Return only that node', () => {
    const nodes = [n('A'), n('B'), n('C')];
    const edges = [e('e1', 'A', 'B')];
    expect(Array.from(findIsolatedNodes(nodes, edges))).toEqual(['C']);
  });

  it('U3: All nodes isolated → return all', () => {
    const nodes = [n('A'), n('B')];
    expect(Array.from(findIsolatedNodes(nodes, [])).sort()).toEqual(['A', 'B']);
  });

  it('Enter empty nodes → Empty Set', () => {
    expect(findIsolatedNodes([], []).size).toBe(0);
  });
});

describe('findCycleEdges', () => {
  it('U4: simple 2-cycle (A↔B)', () => {
    const nodes = [n('A'), n('B')];
    const edges = [e('e1', 'A', 'B'), e('e2', 'B', 'A')];
    expect(Array.from(findCycleEdges(nodes, edges)).sort()).toEqual(['e1', 'e2']);
  });

  it('U5: 3-cycle (A→B→C→A)', () => {
    const nodes = [n('A'), n('B'), n('C')];
    const edges = [e('e1', 'A', 'B'), e('e2', 'B', 'C'), e('e3', 'C', 'A')];
    expect(Array.from(findCycleEdges(nodes, edges)).sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('U6: No cycle (DAG) → empty Set', () => {
    const nodes = [n('A'), n('B'), n('C')];
    const edges = [e('e1', 'A', 'B'), e('e2', 'B', 'C'), e('e3', 'A', 'C')];
    expect(findCycleEdges(nodes, edges).size).toBe(0);
  });

  it('U7: Two separate cycles (A↔B, C↔D)', () => {
    const nodes = [n('A'), n('B'), n('C'), n('D')];
    const edges = [
      e('e1', 'A', 'B'), e('e2', 'B', 'A'),
      e('e3', 'C', 'D'), e('e4', 'D', 'C'),
    ];
    expect(Array.from(findCycleEdges(nodes, edges)).sort()).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('U8: cycle + DAG mixed → cycle edge only', () => {
    const nodes = [n('A'), n('B'), n('C')];
    const edges = [e('e1', 'A', 'B'), e('e2', 'B', 'A'), e('e3', 'A', 'C')];
    expect(Array.from(findCycleEdges(nodes, edges)).sort()).toEqual(['e1', 'e2']);
  });

  it('U9: Ignore self-referential edges (source===target)', () => {
    const nodes = [n('A')];
    const edges = [e('e1', 'A', 'A')];
    expect(findCycleEdges(nodes, edges).size).toBe(0);
  });

  it('Empty Input → Empty Set', () => {
    expect(findCycleEdges([], []).size).toBe(0);
  });

  it('U10: SCC internal chord edges are also marked with cycles (Tarjan SCC accuracy)', () => {
    // Add chord A→C to 4-cycle A→B→C→D→A → All 5 single SCC.
    // A→C is missing using the gray-back-edge DFS method. All SCC methods included.
    const nodes = [n('A'), n('B'), n('C'), n('D')];
    const edges = [
      e('AB', 'A', 'B'),
      e('BC', 'B', 'C'),
      e('CD', 'C', 'D'),
      e('DA', 'D', 'A'),
      e('AC', 'A', 'C'),
    ];
    expect(Array.from(findCycleEdges(nodes, edges)).sort())
      .toEqual(['AB', 'AC', 'BC', 'CD', 'DA']);
  });

  it('U11: SCC and edges going out of SCC are not cycles', () => {
    // A↔B (SCC) + A→C (outside SCC)
    const nodes = [n('A'), n('B'), n('C')];
    const edges = [
      e('AB', 'A', 'B'),
      e('BA', 'B', 'A'),
      e('AC', 'A', 'C'),
    ];
    expect(Array.from(findCycleEdges(nodes, edges)).sort()).toEqual(['AB', 'BA']);
  });
});
