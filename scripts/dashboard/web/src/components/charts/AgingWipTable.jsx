import React from 'react';

/**
 * Aging WIP table (in descending order of elapsed days in Progress).
 *
 * @param {{
 *   agingWip: Array<{ issueKey: string, summary: string, assignee: string|null, created: string, ageDays: number }>,
 * }} props
 */
export default function AgingWipTable({ agingWip }) {
  if (!agingWip || agingWip.length === 0) {
    return <div className="chart-empty">No Aging WIP</div>;
  }

  function ageBadgeClass(days) {
    if (days >= 30) return 'aging-wip-table__age--critical';
    if (days >= 14) return 'aging-wip-table__age--warn';
    return 'aging-wip-table__age--ok';
  }

  return (
    <table className="aging-wip-table" aria-label="Aging WIP">
      <thead>
        <tr>
          <th className="aging-wip-table__th">Issue</th>
          <th className="aging-wip-table__th">Title</th>
          <th className="aging-wip-table__th">Person in charge</th>
          <th className="aging-wip-table__th aging-wip-table__th--num">Elapsed date</th>
        </tr>
      </thead>
      <tbody>
        {agingWip.map((row, i) => (
          <tr key={row.issueKey} className="aging-wip-table__row" style={{ animationDelay: `${i * 40}ms` }}>
            <td className="aging-wip-table__td aging-wip-table__td--key">{row.issueKey}</td>
            <td className="aging-wip-table__td aging-wip-table__td--summary" title={row.summary}>
              {row.summary || '—'}
            </td>
            <td className="aging-wip-table__td">
              {row.assignee
                ? row.assignee
                : <span className="aging-wip-table__unassigned">Unassigned</span>}
            </td>
            <td className={`aging-wip-table__td aging-wip-table__td--num ${ageBadgeClass(row.ageDays)}`}>
              {row.ageDays}d
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
