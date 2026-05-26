import React, { useState, useMemo } from 'react';
import { useSpaces, useMetrics } from '../hooks/useMetrics.js';
import CountUp from './CountUp.jsx';
import StatusChart from './charts/StatusChart.jsx';
import ThroughputChart from './charts/ThroughputChart.jsx';
import TimeDistChart from './charts/TimeDistChart.jsx';
import PerAssigneeTable from './charts/PerAssigneeTable.jsx';
import AgingWipTable from './charts/AgingWipTable.jsx';
import FunnelChart from './charts/FunnelChart.jsx';
import PriorityChart from './charts/PriorityChart.jsx';
import EpicProgressTable from './charts/EpicProgressTable.jsx';
import AgentThroughputTable from './charts/AgentThroughputTable.jsx';

/**
 * Analytics view.
 * - Space selector (GET /spaces)
 * - Status distribution of selected space, WIP, throughput by week (GET /metrics)
 */
export default function AnalyticsView() {
  const { spaces, loading: spacesLoading, error: spacesError } = useSpaces();
  const [selectedSpaceId, setSelectedSpaceId] = useState(null);

  // Recently added spaces are at the top (in descending order of addedAt)
  const sortedSpaces = useMemo(
    () => spaces.slice().sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')),
    [spaces],
  );

  // Automatically select the first space (priority to those that can be authenticated)
  React.useEffect(() => {
    if (!selectedSpaceId && sortedSpaces.length > 0) {
      const first = sortedSpaces.find((s) => s.credsOk) ?? sortedSpaces[0];
      setSelectedSpaceId(first.id);
    }
  }, [sortedSpaces, selectedSpaceId]);

  const { data, loading: metricsLoading, error: metricsError, refresh } = useMetrics(selectedSpaceId);

  // ---------- Render ----------

  if (spacesLoading) {
    return (
      <div className="analytics-view analytics-view--loading" role="status" aria-busy="true">
        <div className="analytics-loading">Loading space list... </div>
      </div>
    );
  }

  if (spacesError) {
    return (
      <div className="analytics-view analytics-view--error" role="alert">
        <div className="analytics-error">
          <p className="analytics-error__title">Failed to load space</p>
          <p className="analytics-error__detail">{spacesError}</p>
          <button type="button" className="analytics-error__retry" onClick={refresh}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (spaces.length === 0) {
    return (
      <div className="analytics-view analytics-view--empty" role="status">
        <div className="analytics-empty">
          <p className="analytics-empty__title">There is no registered space</p>
          <p className="analytics-empty__hint">
            When you register a workspace, analytics data will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-view">
      {/* header: space selector + WIP */}
      <div className="analytics-header">
      <div className="analytics-spaces">
        <label className="analytics-spaces__label" htmlFor="analytics-space-select">SPACE</label>
        <select
          id="analytics-space-select"
          className="analytics-spaces__select"
          aria-label="Select space"
          value={selectedSpaceId ?? ''}
          onChange={(e) => setSelectedSpaceId(e.target.value)}
        >
          {sortedSpaces.map((sp) => (
            <option key={sp.id} value={sp.id} disabled={!sp.credsOk}>
              {sp.projectKey} — {sp.site}{!sp.credsOk ? ' (no authentication information)' : ''}
            </option>
          ))}
        </select>
      </div>
      {data && (
        <div className="analytics-wip">
          <span className="analytics-wip__label">WIP</span>
          <span className="analytics-wip__count"><CountUp value={data.wip} /></span>
        </div>
      )}
      </div>

      {/* Matrix panel (remount → play animation when switching spaces) */}
      <div className="analytics-metrics" key={selectedSpaceId}>
        {metricsLoading && !data ? (
          <div className="analytics-loading" role="status" aria-busy="true">
            Loading data…
          </div>
        ) : metricsError ? (
          <div className="analytics-error" role="alert">
            <p className="analytics-error__title">Failed to load metrics</p>
            <p className="analytics-error__detail">{metricsError}</p>
            <button type="button" className="analytics-error__retry" onClick={refresh}>
              Try again
            </button>
          </div>
        ) : data ? (
          <>
            {/* Status distribution */}
            <div className="analytics-section">
              <h3 className="analytics-section__title">Status Distribution</h3>
              <div className="analytics-section__body">
                <StatusChart distribution={data.statusDistribution} />
              </div>
            </div>

            {/* Throughput */}
            <div className="analytics-section">
              <h3 className="analytics-section__title">Throughput by week (completed/week)</h3>
              <div className="analytics-section__body analytics-section__body--throughput">
                <ThroughputChart throughput={data.throughput} />
              </div>
            </div>

            {/* Lead Time Distribution */}
            <div className="analytics-section">
              <h3 className="analytics-section__title">Lead Time Distribution (days)</h3>
              <div className="analytics-section__body">
                <TimeDistChart
                  distribution={data.leadTime.distribution}
                  median={data.leadTime.median}
                  p75={data.leadTime.p75}
                  p95={data.leadTime.p95}
                  label="Lead Time"
                />
              </div>
            </div>

            {/* Cycle Time Distribution */}
            <div className="analytics-section">
              <h3 className="analytics-section__title">Cycle Time Distribution (Day, Approximation)</h3>
              <div className="analytics-section__body">
                <TimeDistChart
                  distribution={data.cycleTime.distribution}
                  median={data.cycleTime.median}
                  p75={data.cycleTime.p75}
                  p95={data.cycleTime.p95}
                  label="Cycle Time"
                  note={data.cycleTime.note}
                />
              </div>
            </div>

            {/* Throughput per person */}
            <div className="analytics-section">
              <h3 className="analytics-section__title">Throughput per person</h3>
              <div className="analytics-section__body">
                <PerAssigneeTable perAssignee={data.perAssignee} weeks={8} />
              </div>
            </div>

            {/* Aging WIP */}
            <div className="analytics-section">
              <h3 className="analytics-section__title">Aging WIP (in chronological order)</h3>
              <div className="analytics-section__body">
                <AgingWipTable agingWip={data.agingWip} />
              </div>
            </div>

            {/* SDLC Funnel */}
            <div className="analytics-section">
              <h3 className="analytics-section__title">SDLC Stage Funnel (based on local worktree)</h3>
              <div className="analytics-section__body">
                <FunnelChart funnel={data.sdlcFunnel} />
              </div>
            </div>

            {/* Agent throughput */}
            <div className="analytics-section">
              <h3 className="analytics-section__title">Agent throughput (issue units, approximate)</h3>
              <div className="analytics-section__body">
                <AgentThroughputTable agentThroughput={data.agentThroughput} />
              </div>
            </div>

            {/* Priority distribution */}
            <div className="analytics-section">
              <h3 className="analytics-section__title">Priority distribution</h3>
              <div className="analytics-section__body">
                <PriorityChart distribution={data.priorityDistribution} />
              </div>
            </div>

            {/* Progress by Epic */}
            <div className="analytics-section">
              <h3 className="analytics-section__title">Progress by Epic</h3>
              <div className="analytics-section__body">
                <EpicProgressTable epicProgress={data.epicProgress} />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
