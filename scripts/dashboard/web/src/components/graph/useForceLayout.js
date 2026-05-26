import { useEffect, useRef } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceY } from 'd3-force';

/**
 * Force-directed layout hook based on d3-force.
 *
 * - If input nodes/edges change, simulation is reinitialized.
 * - setNodes is called only once per frame through RAF throttle per tick.
 * - When unmounting, simulation.stop() + RAF cancel.
 * - If pinnedRef.current[id] = {x, y}, the node is pinned to that coordinate (fx/fy).
 * Used to hold the node dragged by the user. Simulation can be stopped externally using the returned stop().
 *
 * @param {import('@xyflow/react').Node[]} initialNodes - React Flow Node array (including position)
 * @param {import('@xyflow/react').Edge[]} edges - React Flow Edge array
 * @param {(updater: (prev: import('@xyflow/react').Node[]) => import('@xyflow/react').Node[]) => void} setNodes
 * @param {{ pinnedRef?: React.MutableRefObject<Record<string, {x:number,y:number}>> }} [opts]
 */
export function useForceLayout(initialNodes, edges, setNodes, opts = {}) {
  const { pinnedRef } = opts;
  // d3 simulation mutates nodes, so keep them in ref.
  const simRef = useRef(null);
  const rafRef = useRef(null);
  // d3 node array ref currently used in simulation (for reading coordinate values).
  const d3NodesRef = useRef([]);

  // Key for deps change detection: Node ID list + Edge ID list
  const nodeIdsKey = initialNodes.map(n => n.id).join(',');
  const edgeIdsKey = edges.map(e => e.id).join(',');

  useEffect(() => {
    if (initialNodes.length === 0) return;

    // Prints the number of simulation reinitializations to the console in dev mode. For regression detection.
    if (import.meta.env.DEV) console.debug('[useForceLayout] re-init', { nodeCount: initialNodes.length, edgeCount: edges.length });

    // Create a copy for d3 to mutate. If there are coordinates in pinnedRef, pin them to fx/fy.
    const pinned = pinnedRef?.current ?? {};
    const d3Nodes = initialNodes.map(n => {
      const pin = pinned[n.id];
      const base = {
        id: n.id,
        x: n.position?.x ?? 0,
        y: n.position?.y ?? 0,
      };
      if (pin) {
        base.fx = pin.x;
        base.fy = pin.y;
      }
      return base;
    });
    d3NodesRef.current = d3Nodes;

    // Separate link strength/distance by preserving edge type.
    const d3Links = edges.map(e => ({
      source: e.source,
      target: e.target,
      relType: e.type,  // 'blocks' | 'parent' | 'epic'
    }));

    // Calculate depth with BFS along the parent/epic edge (target=parent → small y, source=child → large y).
    // Pull with forceY so that the parent-child hierarchy flows naturally from top to bottom.
    const targetY = computeHierarchyTargetY(d3Nodes, edges);

    const simulation = forceSimulation(d3Nodes)
      .force('link', forceLink(d3Links).id(d => d.id)
        // parent/epic is short and strong (hierarchical cohesion), blocks are long and weak (loose).
        .distance(l => (l.relType === 'parent' || l.relType === 'epic') ? 140 : 220)
        .strength(l => (l.relType === 'parent' || l.relType === 'epic') ? 0.9 : 0.3))
      .force('charge', forceManyBody().strength(-900).distanceMax(600))
      .force('center', forceCenter(0, 0))
      .force('collide', forceCollide(80))
      // Hierarchical y-pinning: Nodes with defined depth are strongly attracted to their y (clear top → bottom sorting).
      // strength 0.6 = superior to link/charge force → Parent is clearly placed above and children are placed below.
      .force('y', forceY().y(d => targetY[d.id] ?? 0).strength(d => targetY[d.id] != null ? 0.6 : 0))
      .alphaDecay(0.04)
      .alphaMin(0.02);

    simRef.current = simulation;

    let pending = false;

    simulation.on('tick', () => {
      if (pending) return; // Already RAF reserved
      pending = true;
      rafRef.current = requestAnimationFrame(() => {
        pending = false;
        const positions = {};
        for (const n of d3NodesRef.current) {
          positions[n.id] = { x: n.x, y: n.y };
        }
        setNodes(prev =>
          prev.map(node => {
            const pos = positions[node.id];
            if (!pos) return node;
            // The node that the user is directly dragging (dragging=true) has RF coordinates
            // Since it is updated directly, simulation does not overwrite it.
            if (node.dragging) return node;
            return { ...node, position: pos };
          })
        );
      });
    });

    return () => {
      simulation.stop();
      simRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIdsKey, edgeIdsKey]);

  // Used to pin/unpin a node from the outside. Immediately reflect in simulation and slightly reheat.
  return {
    pinNode: (id, x, y) => {
      const sim = simRef.current;
      if (!sim) return;
      const node = d3NodesRef.current.find(n => n.id === id);
      if (!node) return;
      node.fx = x;
      node.fy = y;
      sim.alpha(0.3).restart();
    },
    unpinNode: (id) => {
      const sim = simRef.current;
      if (!sim) return;
      const node = d3NodesRef.current.find(n => n.id === id);
      if (!node) return;
      delete node.fx;
      delete node.fy;
      sim.alpha(0.3).restart();
    },
  };
}

/**
 * Calculate the hierarchical depth of the node along the parent/epic edge and give it a target y coordinate.
 *
 * Rule:
 * - On parent/epic edge, source = child, target = parent (selectGraphData contract).
 * - The parent must have smaller y than the child (above). That is target.depth = source.depth - 1.
 * - The root (node ​​with no children or parents) is placed close to depth 0.
 *
 * Algorithm:
 * 1. Construct parent → child graph with parent/epic edges.
 * 2. Find a node (=root) that has no edges as a parent and start at depth 0.
 * 3. With BFS, child depth = parent depth + 1.
 *   4. y = depth * 200.
 *
 * @param {Array<{id:string}>} d3Nodes
 * @param {Array<{source:string, target:string, type:string}>} edges
 * @returns {Record<string, number>} id → target y (undefined if not present)
 */
function computeHierarchyTargetY(d3Nodes, edges) {
  // Use both types of hierarchies together to determine depth:
  // - parent/epic: source=child, target=parent. Children are under their parents.
  // - blocks: source=blocker, target=blocked. blocked is under blocker.
  // BFS progresses from "top node" to "bottom node". The larger value of the depth derived from the two trees is adopted
  // If there is a block dependency between siblings, they are separated rather than staying in the same y.
  const hier = edges.filter(e => e.type === 'parent' || e.type === 'epic');
  const blocks = edges.filter(e => e.type === 'blocks');
  if (hier.length === 0 && blocks.length === 0) return {};

  // "Up → Down" adjacency list (direction: parent/blocker → child/blocked).
  const downstreamOf = new Map();
  const hasIncoming = new Set();
  for (const e of hier) {
    // parent/epic: target=parent (top), source=child (bottom)
    if (!downstreamOf.has(e.target)) downstreamOf.set(e.target, []);
    downstreamOf.get(e.target).push(e.source);
    hasIncoming.add(e.source);
  }
  for (const e of blocks) {
    // blocks: source=blocker(top), target=blocked(bottom)
    if (!downstreamOf.has(e.source)) downstreamOf.set(e.source, []);
    downstreamOf.get(e.source).push(e.target);
    hasIncoming.add(e.target);
  }

  const allIds = d3Nodes.map(n => n.id);
  // Root: Nodes that send out downstream edges but do not receive incoming.
  const roots = allIds.filter(id => downstreamOf.has(id) && !hasIncoming.has(id));

  const depth = {};
  const queue = [];
  for (const r of roots) { depth[r] = 0; queue.push(r); }

  // BFS — choose deeper depth first (max). Sibling separation effect when combining two trees.
  while (queue.length) {
    const cur = queue.shift();
    const downs = downstreamOf.get(cur) ?? [];
    for (const d of downs) {
      const next = depth[cur] + 1;
      if (depth[d] == null || next > depth[d]) {
        depth[d] = next;
        queue.push(d);
      }
    }
  }

  // Convert to y coordinates. Set the average to 0 and spread it out in the center of the canvas.
  const depths = Object.values(depth);
  if (depths.length === 0) return {};
  const avg = depths.reduce((a,b) => a+b, 0) / depths.length;
  const out = {};
  for (const [id, d] of Object.entries(depth)) {
    out[id] = (d - avg) * 240;
  }
  return out;
}
