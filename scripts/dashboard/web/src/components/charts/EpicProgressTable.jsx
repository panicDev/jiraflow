import React from 'react';

/**
 * Progress table by Epic.
 *
 * @param {{ epicProgress: Array<{epic:string, total:number, done:number, pct:number}> }} props
 */
export default function EpicProgressTable({ epicProgress }) {
  if (!epicProgress || epicProgress.length === 0) {
    return <div className="chart-empty">No epic data</div>;
  }

  return (
    <table className="analytics-table" aria-label="Progress by Epic">
      <thead>
        <tr>
          <th className="analytics-table__th">Epic</th>
          <th className="analytics-table__th analytics-table__th--num">Total</th>
          <th className="analytics-table__th analytics-table__th--num">Complete</th>
          <th className="analytics-table__th analytics-table__th--num">Progress</th>
          <th className="analytics-table__th analytics-table__th--bar">Progress</th>
        </tr>
      </thead>
      <tbody>
        {epicProgress.map((row, i) => (
          <tr key={row.epic} className="analytics-table__row" style={{ animationDelay: `${i * 40}ms` }}>
            <td className="analytics-table__td analytics-table__td--label">{row.epic}</td>
            <td className="analytics-table__td analytics-table__td--num">{row.total}</td>
            <td className="analytics-table__td analytics-table__td--num">{row.done}</td>
            <td className="analytics-table__td analytics-table__td--num">{row.pct}%</td>
            <td className="analytics-table__td analytics-table__td--bar">
              <div className="progress-bar" aria-label={`${row.pct}%`}>
                <div
                  className="progress-bar__fill"
                  style={{ width: `${row.pct}%`, background: 'var(--chart-done, #4ade80)' }}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
