import React from 'react';

/**
 * Agent throughput table (per issue, approximated based on recent activity).
 *
 * @param {{ agentThroughput: Array<{taskId:string, toolCallCount:number, completedSteps:string[]}> }} props
 */
export default function AgentThroughputTable({ agentThroughput }) {
  if (!agentThroughput || agentThroughput.length === 0) {
    return <div className="chart-empty">No agent activity data (approximation based on local worktree)</div>;
  }

  return (
    <table className="analytics-table" aria-label="Agent throughput (unit of issues)">
      <thead>
        <tr>
          <th className="analytics-table__th">Task</th>
          <th className="analytics-table__th analytics-table__th--num">Tool call count</th>
          <th className="analytics-table__th">Completion Steps</th>
        </tr>
      </thead>
      <tbody>
        {agentThroughput.map((row) => (
          <tr key={row.taskId} className="analytics-table__row">
            <td className="analytics-table__td analytics-table__td--label">{row.taskId}</td>
            <td className="analytics-table__td analytics-table__td--num">{row.toolCallCount}</td>
            <td className="analytics-table__td">
              {row.completedSteps.length > 0 ? row.completedSteps.join(' → ') : '—'}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className="analytics-table__td analytics-table__note" colSpan={3}>
            * Approximate value based on recent activity (reset on session/restart)
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
