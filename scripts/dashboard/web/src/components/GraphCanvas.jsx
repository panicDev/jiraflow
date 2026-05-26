import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { selectGraphData } from '../selectors/graph.js';
import { mapToFlow } from './graph/mapToFlow.js';
import { useForceLayout } from './graph/useForceLayout.js';
import { edgeTypes } from './graph/edgeTypes.jsx';
import GraphNode from './graph/GraphNode.jsx';
import GraphSidePanel from './graph/GraphSidePanel.jsx';
import GraphFilterBar from './graph/GraphFilterBar.jsx';
import {
  buildFilterOptions,
  computeMatchedKeys,
  isFilterActive,
} from './graph/filter.js';
import { findIsolatedNodes, findCycleEdges } from './graph/analysis.js';

const nodeTypes = { graphNode: GraphNode };

/**
 * ID-based node merge: Preserve the position of the existing node and replace only the data.
 *
 * - Existing id: position maintained, data replaced with next value (dimmed/isolated, etc. reflected immediately)
 * - New id: Add next node as is (mapToFlow initial coordinates, simulation is settled)
 * - missing id: removed from results
 *
 * @param {import('@xyflow/react').Node[]} prev
 * @param {import('@xyflow/react').Node[]} next
 * @returns {import('@xyflow/react').Node[]}
 */
export function mergeNodesById(prev, next) {
  const prevMap = new Map(prev.map(n => [n.id, n]));
  return next.map(nextNode => {
    const prevNode = prevMap.get(nextNode.id);
    if (!prevNode) return nextNode; // new id → mapToFlow use initial coordinates
    // Maintain existing id → position, replace data with new value
    return { ...nextNode, position: prevNode.position };
  });
}

/**
 * React Flow based graph canvas.
 * worktrees: Receives a Record<path, WorktreeState> object and automatically places nodes/edges.
 *
 * @param {{ worktrees: Record<string, object> }} props
 */
export default function GraphCanvas({ worktrees }) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner worktrees={worktrees} />
    </ReactFlowProvider>
  );
}

function GraphCanvasInner({ worktrees }) {
  // selectGraphData is a pure function, so memoize with useMemo.
  const graphData = useMemo(
    () => selectGraphData(worktrees),
    [worktrees]
  );

  const filterOptions = useMemo(
    () => buildFilterOptions(worktrees),
    [worktrees]
  );

  const [statusSet, setStatusSet] = useState(() => new Set());
  const [assigneeSet, setAssigneeSet] = useState(() => new Set());

  const matchedKeys = useMemo(
    () => computeMatchedKeys(worktrees, statusSet, assigneeSet),
    [worktrees, statusSet, assigneeSet]
  );
  const filterActive = isFilterActive(statusSet, assigneeSet);

  const isolatedSet = useMemo(
    () => findIsolatedNodes(graphData.nodes, graphData.edges),
    [graphData]
  );
  const cycleEdgeSet = useMemo(
    () => findCycleEdges(graphData.nodes, graphData.edges.filter(e => e.type === 'blocks')),
    [graphData]
  );

  const { flowNodes: initialNodes, flowEdges: initialEdges } = useMemo(
    () => mapToFlow(graphData, { matchedKeys, isolatedSet, cycleEdgeSet }),
    [graphData, matchedKeys, isolatedSet, cycleEdgeSet]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // When initialNodes/initialEdges change, React Flow state is also updated.
  // (useNodesState/useEdgesState only uses initial values, so explicit update is required)
  //
  // setNodes preserves the position of existing nodes with an id-based merge policy:
  // - Existing id → position maintained, data replaced with new value (dimmed/isolated, etc. reflected immediately)
  // - New id → mapToFlow Add initial coordinates as is (simulation settles later)
  // - disappeared id → remove
  // setEdges has no coordinates, so keep simple replacement.
  const newNodesKey = initialNodes.map(n => `${n.id}:${n.data?.dimmed ? 'd' : 'n'}:${n.data?.isolated ? 'i' : '_'}`).join(',');
  const newEdgesKey = initialEdges.map(e => `${e.id}:${e.data?.dimmed ? 'd' : 'n'}:${e.data?.cycle ? 'c' : '_'}`).join(',');
  useEffect(() => {
    setNodes(prev => mergeNodesById(prev, initialNodes));
    setEdges(initialEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newNodesKey, newEdgesKey]);

  // Pin the node dragged by the user in place.
  const pinnedRef = useRef({});

  // Apply force-directed layout. Receive pinNode/unpinNode to reflect drag results in simulation.
  const { pinNode } = useForceLayout(nodes, edges, setNodes, { pinnedRef });

  const onNodeDragStop = useCallback((_event, node) => {
    // Pin the position where the drag ended. The simulation is fixed at this location.
    pinnedRef.current[node.id] = { x: node.position.x, y: node.position.y };
    pinNode(node.id, node.position.x, node.position.y);
  }, [pinNode]);

  // ReactFlow instance (for manual calls to fitView).
  const rf = useReactFlow();
  // fitView when the node first enters + when the simulation has stabilized to some extent.
  useEffect(() => {
    if (initialNodes.length === 0) return;
    const t1 = setTimeout(() => rf.fitView({ padding: 0.2, duration: 300 }), 800);
    const t2 = setTimeout(() => rf.fitView({ padding: 0.2, duration: 400 }), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [newNodesKey, rf]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selected node key (issue key).
  const [selectedKey, setSelectedKey] = useState(null);

  const onNodeClick = useCallback((_event, node) => {
    setSelectedKey(node.id);
  }, []);

  // Close the panel when clicking on an empty space on the canvas.
  const onPaneClick = useCallback(() => setSelectedKey(null), []);

  // Close the panel also with the ESC key.
  useEffect(() => {
    if (selectedKey === null) return;
    const handler = (e) => {
      if (e.key === 'Escape') setSelectedKey(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedKey]);

  // Find the worktree corresponding to selectedKey.
  // phantom node: becomes null because there is no path in the worktrees.
  const selectedWorktree = useMemo(() => {
    if (!selectedKey) return undefined;
    if (!worktrees || typeof worktrees !== 'object') return null;
    // Traverse based on path and return worktree where cachedIssue.key === selectedKey.
    for (const wt of Object.values(worktrees)) {
      if (wt?.cachedIssue?.key === selectedKey) return wt;
    }
    // If there is no worktree with that key, phantom → null
    return null;
  }, [selectedKey, worktrees]);

  const toggleInSet = useCallback((setter) => (value) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const onToggleStatus = useMemo(() => toggleInSet(setStatusSet), [toggleInSet]);
  const onToggleAssignee = useMemo(() => toggleInSet(setAssigneeSet), [toggleInSet]);
  const onClearStatus = useCallback(() => setStatusSet(new Set()), []);
  const onClearAssignee = useCallback(() => setAssigneeSet(new Set()), []);

  const matchedCount = filterActive ? matchedKeys.size : graphData.nodes.length;

  return (
    <main className="graph-canvas" data-testid="graph-canvas" aria-label="Graph View">
      <GraphFilterBar
        options={filterOptions}
        statusSet={statusSet}
        assigneeSet={assigneeSet}
        onToggleStatus={onToggleStatus}
        onToggleAssignee={onToggleAssignee}
        onClearStatus={onClearStatus}
        onClearAssignee={onClearAssignee}
        matchedCount={matchedCount}
        totalCount={graphData.nodes.length}
      />
      <div className="graph-canvas__flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          minZoom={0.2}
          maxZoom={2}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      {selectedKey !== null && (
        <GraphSidePanel
          worktree={selectedWorktree}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </main>
  );
}
