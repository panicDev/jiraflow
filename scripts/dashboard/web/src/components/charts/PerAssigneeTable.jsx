import React from 'react';

/**
 * Table of throughput per person.
 *
 * @param {{
 *   perAssignee: Array<{ assignee: string, completed: number, wip: number }>,
 *   weeks: number,
 * }} props
 */
export default function PerAssigneeTable({ perAssignee, weeks = 8 }) {
  if (!perAssignee || perAssignee.length === 0) {
    return <div className="chart-empty">No throughput data by person</div>;
  }

  return (
    <table className="per-assignee-table" aria-label="Throughput per person">
      <thead>
        <tr>
          <th className="per-assignee-table__th">Assignee</th>
          <th className="per-assignee-table__th per-assignee-table__th--num">Completed ({weeks} weeks)</th>
          <th className="per-assignee-table__th per-assignee-table__th--num">Current WIP</th>
        </tr>
      </thead>
      <tbody>
        {perAssignee.map((row, i) => (
          <tr key={row.assignee} className="per-assignee-table__row" style={{ animationDelay: `${i * 40}ms` }}>
            <td className="per-assignee-table__td">
              {row.assignee === '__unassigned__'
                ? <span className="per-assignee-table__unassigned">Unassignee</span>
                : row.assignee}
            </td>
            <td className="per-assignee-table__td per-assignee-table__td--num">{row.completed}</td>
            <td className="per-assignee-table__td per-assignee-table__td--num">{row.wip}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
