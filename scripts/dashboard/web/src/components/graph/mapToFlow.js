import { MarkerType } from '@xyflow/react';

// Edge color by relationship type (matches RELATION_STYLES in edgeTypes.jsx).
// Given by mapToFlow to match markerEnd color with stroke.
const EDGE_STROKE = {
  blocks: '#dc2626',
  parent: '#64748b',
  epic: '#9333ea',
};

/**
 * Build a cache key for mapToFlow.
 * Key: graphData reference identity (object identity) + sorted matchedKeys join +
 *      sorted isolatedSet join + sorted cycleEdgeSet join.
 */
function buildMapToFlowCacheKey(graphData, matchedKeys, isolatedSet, cycleEdgeSet) {
  const gKey = graphData; // reference — same object means same content (selector already memoized)
  const mKey = matchedKeys === null ? 'null' : [...matchedKeys].sort().join(',');
  const iKey = isolatedSet === null ? 'null' : [...isolatedSet].sort().join(',');
  const cKey = cycleEdgeSet === null ? 'null' : [...cycleEdgeSet].sort().join(',');
  return { gKey, mKey, iKey, cKey };
}

// Module-level 1-slot cache for mapToFlow.
let _mapCache = null; // { gKey, mKey, iKey, cKey, result }

/** Reset the mapToFlow cache. Intended for tests only. */
export function __resetMapToFlowCache() {
  _mapCache = null;
}

/**
 * Convert selectGraphData results to React Flow Node/Edge array.
 *
 * Returns the same reference when inputs (by content key) are unchanged (1-slot memoization).
 *
 * @param {{ nodes: Array, edges: Array }} graphData
 * @param {{ matchedKeys?: Set<string> | null, isolatedSet?: Set<string> | null, cycleEdgeSet?: Set<string> | null }} [options]
 * matchedKeys === null → filter disabled, match all
 * matchedKeys instanceof Set → matches only the keys inside it, the outside is dimmed
 * isolatedSet → data.isolated = true (MAE-267)
 * cycleEdgeSet → data.cycle = true for the corresponding edge id (MAE-267)
 * @returns {{ flowNodes: import('@xyflow/react').Node[], flowEdges: import('@xyflow/react').Edge[] }}
 */
export function mapToFlow(graphData, options = {}) {
  const { nodes, edges } = graphData;
  const { matchedKeys = null, isolatedSet = null, cycleEdgeSet = null } = options;

  // 1-slot cache check
  // The graphData reference is stabilized by the 1-slot cache of selectGraphData, so identity comparison is accurate.
  const ck = buildMapToFlowCacheKey(graphData, matchedKeys, isolatedSet, cycleEdgeSet);
  if (
    _mapCache !== null &&
    _mapCache.gKey === ck.gKey &&
    _mapCache.mKey === ck.mKey &&
    _mapCache.iKey === ck.iKey &&
    _mapCache.cKey === ck.cKey
  ) {
    return _mapCache.result;
  }

  const isMatched = (key) => matchedKeys === null || matchedKeys.has(key);
  const isIsolated = (key) => isolatedSet !== null && isolatedSet.has(key);
  const isCycle = (id) => cycleEdgeSet !== null && cycleEdgeSet.has(id);

  const flowNodes = nodes.map((n, i) => {
    const dimmed = !isMatched(n.id);
    const isolated = isIsolated(n.id);
    return {
      id: n.id,
      type: 'graphNode',
      // Improve simulation convergence speed and result stability by distributing the initial position circularly.
      position: (() => {
        const total = nodes.length;
        const angle = (i / Math.max(total, 1)) * Math.PI * 2;
        const radius = Math.max(120, total * 30);
        return {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        };
      })(),
      data: {
        label: n.label,
        ...n.data,
        dimmed,
        isolated,
      },
    };
  });

  const flowEdges = edges.map(e => {
    const dimmed = !isMatched(e.source) || !isMatched(e.target);
    const cycle = isCycle(e.id);
    const stroke = EDGE_STROKE[e.type] ?? '#94a3b8';
    // Separate handle:
    // - parent/epic: source=child → target=parent. Exit from the top of the child and enter the bottom of the parent.
    // - blocks: source=blocker → target=blocked. Exit from the bottom of the blocker and enter the top of the blocked.
    const isHier = (e.type === 'parent' || e.type === 'epic');
    const sourceHandle = isHier ? 's-top' : 's-bottom';
    const targetHandle = isHier ? 't-bottom' : 't-top';
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle,
      targetHandle,
      type: e.type,
      className: dimmed ? 'marching-ants graph-edge--dimmed' : 'marching-ants',
      data: { ...(e.data ?? {}), dimmed, cycle },
      // For edge level markerEnd, react-flow automatically registers <marker>.
      // Passing an object with the BezierEdge prop is not visible because [object Object] is entered in the SVG marker-end attribute.
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: stroke,
        width: 18,
        height: 18,
      },
    };
  });

  const result = { flowNodes, flowEdges };
  _mapCache = { gKey: ck.gKey, mKey: ck.mKey, iKey: ck.iKey, cKey: ck.cKey, result };
  return result;
}
