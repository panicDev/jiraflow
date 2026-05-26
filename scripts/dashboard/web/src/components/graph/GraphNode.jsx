import React from 'react';
import { Handle, Position } from '@xyflow/react';

/**
 * Basic graph node.
 * If data.phantom === true, time is distinguished by applying the .graph-node--phantom class.
 */
export default function GraphNode({ data }) {
  const isPhantom = Boolean(data?.phantom);
  const isDimmed = Boolean(data?.dimmed);
  const isIsolated = Boolean(data?.isolated);
  const className = [
    'graph-node',
    isPhantom ? 'graph-node--phantom' : '',
    isDimmed ? 'graph-node--dimmed' : '',
    isIsolated ? 'graph-node--isolated' : '',
  ].filter(Boolean).join(' ');
  // Extract only issue key (e.g. "MAE-263 [graph-view][4.1] marching ants..." → "MAE-263")
  const fullLabel = data?.label ?? data?.id ?? '?';
  const compactKey = (data?.id) ?? String(fullLabel).split(/\s+/)[0];
  return (
    <div className={className} title={fullLabel}>
      {/* Top handle: parent/epic edge is used (child → parent direction, exit upward/enter upward) */}
      <Handle id="t-top" type="target" position={Position.Top} />
      <Handle id="s-top" type="source" position={Position.Top} />
      <div className="graph-node__label">
        {compactKey}
      </div>
      {data?.status && !isPhantom && (
        <div className="graph-node__status">{data.status}</div>
      )}
      {/* Bottom handle: blocks edge is used (blocker → blocked direction, exits downward/enters downward) */}
      <Handle id="s-bottom" type="source" position={Position.Bottom} />
      <Handle id="t-bottom" type="target" position={Position.Bottom} />
    </div>
  );
}
