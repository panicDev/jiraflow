/**
 * Graph Analysis Utility (MAE-267).
 *
 * - findIsolatedNodes: A set of node ids that do not appear on any edges.
 * - findCycleEdges: Set of edge ids belonging to a cycle (inside SCC) among blocks edges.
 * The caller must pre-filter and pass only type === 'blocks' edges (parent/epic excludes cycle judgment due to hierarchical relationship).
 */

/**
 * @param {Array<{id:string}>} nodes
 * @param {Array<{source:string, target:string}>} edges
 * @returns {Set<string>}
 */
export function findIsolatedNodes(nodes, edges) {
  const connected = new Set();
  for (const e of edges) {
    connected.add(e.source);
    connected.add(e.target);
  }
  const isolated = new Set();
  for (const n of nodes) {
    if (!connected.has(n.id)) isolated.add(n.id);
  }
  return isolated;
}

/**
 * Find all edge IDs belonging to a cycle in the blocks edge graph.
 *
 * Based on Tarjan SCC: Find SCCs with size ≥ 2 or SCCs with self-loop,
 * Within that SCC, edges (tree/forward/back/cross all) whose departure/arrival are all in the same SCC are marked as cycles.
 * This method also accurately includes chord/forward edges (solving the limitations of the DFS gray-back-edge method).
 *
 * Self-referencing edges (source === target) are filtered out by selectors, but are defensively ignored.
 *
 * @param {Array<{id:string}>} nodes
 * @param {Array<{id:string, source:string, target:string}>} blocksEdges
 * @returns {Set<string>}
 */
export function findCycleEdges(nodes, blocksEdges) {
  // Adjacency list
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, []);
  const safeEdges = [];
  for (const e of blocksEdges) {
    if (e.source === e.target) continue;
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source).push(e.target);
    safeEdges.push(e);
  }

  // Tarjan iterative SCC
  // index/lowlink is per node. Tracking whether you are currently a SCC candidate with onStack.
  const indexOf = new Map();
  const lowlink = new Map();
  const onStack = new Set();
  const sccStack = [];
  const sccId = new Map(); // node -> scc id
  let nextIndex = 0;
  let nextSccId = 0;

  for (const start of adj.keys()) {
    if (indexOf.has(start)) continue;

    // iterative DFS frame: { node, neighbors, idx }
    const work = [{ node: start, neighbors: adj.get(start), idx: 0 }];
    indexOf.set(start, nextIndex);
    lowlink.set(start, nextIndex);
    nextIndex++;
    sccStack.push(start);
    onStack.add(start);

    while (work.length > 0) {
      const frame = work[work.length - 1];
      if (frame.idx < frame.neighbors.length) {
        const w = frame.neighbors[frame.idx++];
        if (!indexOf.has(w)) {
          indexOf.set(w, nextIndex);
          lowlink.set(w, nextIndex);
          nextIndex++;
          sccStack.push(w);
          onStack.add(w);
          work.push({ node: w, neighbors: adj.get(w), idx: 0 });
        } else if (onStack.has(w)) {
          // back-edge or cross to current SCC candidate
          lowlink.set(frame.node, Math.min(lowlink.get(frame.node), indexOf.get(w)));
        }
        // else: Already settled on another SCC → ignore
      } else {
        // All neighbors processed → root check
        if (lowlink.get(frame.node) === indexOf.get(frame.node)) {
          // SCC extraction
          const id = nextSccId++;
          while (true) {
            const w = sccStack.pop();
            onStack.delete(w);
            sccId.set(w, id);
            if (w === frame.node) break;
          }
        }
        work.pop();
        // Update parent lowlink (post-processing of recursion)
        if (work.length > 0) {
          const parent = work[work.length - 1];
          parent && lowlink.set(
            parent.node,
            Math.min(lowlink.get(parent.node), lowlink.get(frame.node))
          );
        }
      }
    }
  }

  // Count the number of SCC members (if size ≥ 2 cycle)
  const sccSize = new Map();
  for (const id of sccId.values()) {
    sccSize.set(id, (sccSize.get(id) ?? 0) + 1);
  }

  // Internal edges of the same SCC (size ≥ 2) are cycle members
  const cycle = new Set();
  for (const e of safeEdges) {
    const sId = sccId.get(e.source);
    const tId = sccId.get(e.target);
    if (sId !== undefined && sId === tId && (sccSize.get(sId) ?? 0) >= 2) {
      cycle.add(e.id);
    }
  }

  return cycle;
}
