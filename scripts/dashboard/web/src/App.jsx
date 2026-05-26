import React, { useEffect, useMemo, useState } from 'react';
import { DashboardProvider, useDashboard } from './state/DashboardContext.jsx';
import { useDashboardStream } from './hooks/useDashboardStream.js';
import { useIdle } from './hooks/useIdle.js';
import { useWorkspaces } from './hooks/useWorkspaces.js';
import ConnectionBanner from './components/ConnectionBanner.jsx';
import KittBar from './components/KittBar.jsx';
import WorktreeCard from './components/WorktreeCard.jsx';
import WorkspaceGroup from './components/WorkspaceGroup.jsx';
import GraphCanvas from './components/GraphCanvas.jsx';
import GraphErrorBoundary from './components/GraphErrorBoundary.jsx';
import SessionCard from './components/SessionCard.jsx';
import AnalyticsView from './components/AnalyticsView.jsx';
import { IconSearch, IconInbox, IconHourglass } from './components/Icons.jsx';

/**
 * Backslash → forward slash (trailing slash remains — same rules as backend normalizePath).
 * @param {string} p
 * @returns {string}
 */
function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Determine whether session cwd is under the registered worktree path.
 * Mirroring backend lookupWorktree rules: only applies `\\`→`/` substitution.
 * @param {string|null} cwd
 * @param {string} wtPath
 * @returns {boolean}
 */
function sessionMatchesWorktree(cwd, wtPath) {
  if (!cwd) return false;
  const normCwd = normalizePath(cwd);
  const normWt = normalizePath(wtPath);
  return normCwd === normWt || normCwd.startsWith(normWt + '/');
}

/**
 * Extract basename from path.
 * @param {string} p fully qualified path
 * @returns {string}
 */
function basename(p) {
  return p.split('/').pop() || p;
}

/**
 * Last activity ts (null if none).
 * @param {import('./state/reducer.js').WorktreeState} wt
 */
function lastActivityMs(wt) {
  const a = wt.activity;
  if (!Array.isArray(a) || a.length === 0) return 0;
  const ts = a[a.length - 1]?.ts;
  if (!ts) return 0;
  const t = Date.parse(ts);
  return Number.isNaN(t) ? 0 : t;
}

function getSummary(wt) {
  return wt.cachedIssue?.summary ?? wt.summary ?? '';
}

/**
 * Creation of comparison function based on sort key and direction.
 * @param {'activity'|'taskId'|'summary'} key
 * @param {'asc'|'desc'} dir
 */
function makeSorter(key, dir) {
  const sign = dir === 'desc' ? -1 : 1;
  return (a, b) => {
    let cmp = 0;
    if (key === 'activity') {
      cmp = lastActivityMs(a) - lastActivityMs(b);
    } else if (key === 'taskId') {
      const av = a.taskId ?? '';
      const bv = b.taskId ?? '';
      if (!av && bv) cmp = 1;
      else if (av && !bv) cmp = -1;
      else cmp = av.localeCompare(bv, undefined, { numeric: true });
    } else if (key === 'summary') {
      cmp = getSummary(a).localeCompare(getSummary(b), 'ko');
    }
    if (cmp === 0) cmp = (a.path || '').localeCompare(b.path || '');
    return cmp * sign;
  };
}

/**
 * Inner component that consumes context after Provider is mounted.
 */
const SORT_OPTIONS = [
  { key: 'activity', label: 'Recent activity', defaultDir: 'desc' },
  { key: 'taskId', label: 'Issue key', defaultDir: 'asc' },
  { key: 'summary',  label: 'summary',  defaultDir: 'asc'  },
];

function Dashboard() {
  const { state, dispatch } = useDashboard();
  useDashboardStream(dispatch);

  const isIdle = useIdle(state.lastEventAt);
  const { workspaces } = useWorkspaces();

  const [sortKey, setSortKey] = useState('activity');
  const [sortDir, setSortDir] = useState('desc');
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState('cards');
  const [pluginVersion, setPluginVersion] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/health')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (!cancelled && j && j.version) setPluginVersion(j.version); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function handleSortClick(key) {
    if (key === sortKey) {
      // Press the same chip again to toggle direction
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      // If it is a different chip, switch to the default direction of that key
      setSortKey(key);
      const opt = SORT_OPTIONS.find(o => o.key === key);
      setSortDir(opt?.defaultDir ?? 'asc');
    }
  }

  const filtered = useMemo(() => {
    const all = Object.values(state.worktrees);
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter(wt => {
      const hay = [
        wt.taskId,
        getSummary(wt),
        wt.branch,
        wt.path,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [state.worktrees, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort(makeSorter(sortKey, sortDir));
  }, [filtered, sortKey, sortDir]);

  // Configure the workspace registry path (normalization) set.
  // If there are no workspaces (before fetch / failure), it naturally falls into the N<=1 branch.
  const workspaceMap = useMemo(() => {
    /** @type {Map<string, object>} normalized path → WorkspaceEntry */
    const m = new Map();
    for (const ws of workspaces) {
      if (ws.path) m.set(normalizePath(ws.path), ws);
    }
    return m;
  }, [workspaces]);

  // When N=2+, sorted cards are grouped based on workspace.
  // If N<=1, return null and branch on the call side.
  const groupedFiltered = useMemo(() => {
    if (workspaceMap.size <= 1) return null;
    /** @type {Map<string, { workspace: object|null, wts: object[] }>} */
    const groups = new Map();

    // Initialize groups in registry order (sorting reference point)
    for (const [normPath, ws] of workspaceMap.entries()) {
      groups.set(normPath, { workspace: ws, wts: [] });
    }
    // fallback group
    const UNASSIGNED = '__unassigned__';

    for (const wt of sorted) {
      const wtRoot = wt.workspaceRoot ? normalizePath(wt.workspaceRoot) : null;
      if (wtRoot && groups.has(wtRoot)) {
        groups.get(wtRoot).wts.push(wt);
      } else {
        if (!groups.has(UNASSIGNED)) {
          groups.set(UNASSIGNED, { workspace: null, wts: [] });
        }
        groups.get(UNASSIGNED).wts.push(wt);
      }
    }

    // Hide group of 0 cards (empty group after applying filter)
    const result = [];
    for (const [key, group] of groups.entries()) {
      if (group.wts.length === 0) continue;
      const normPath = key === UNASSIGNED ? null : key;
      const label = normPath ? basename(normPath) : '(no workspace)';
      result.push({ key, label, workspace: group.workspace, wts: group.wts });
    }
    // __unaassigned__ is always the last
    result.sort((a, b) => {
      if (a.key === UNASSIGNED) return 1;
      if (b.key === UNASSIGNED) return -1;
      return 0;
    });
    return result;
  }, [workspaceMap, sorted]);

  // set worktree path — used in sessionMatchesWorktree defense filter
  const worktreePaths = useMemo(() => Object.keys(state.worktrees), [state.worktrees]);

  // sessions: exclude sessions belonging to worktree, sort by lastActiveAt descending
  const visibleSessions = useMemo(() => {
    return Object.values(state.sessions)
      .filter((s) => !worktreePaths.some((wtPath) => sessionMatchesWorktree(s.cwd, wtPath)))
      .sort((a, b) => {
        const ta = a.lastActiveAt ? Date.parse(a.lastActiveAt) : 0;
        const tb = b.lastActiveAt ? Date.parse(b.lastActiveAt) : 0;
        return tb - ta;
      });
  }, [state.sessions, worktreePaths]);

  const totalCount = Object.keys(state.worktrees).length;

  const connState = state.connection;
  const connLabel =
    connState === 'connected' ? 'LIVE' :
    connState === 'disconnected' ? 'RECONNECTING…' :
    'CONNECTING…';
  const connClass =
    connState === 'connected' ? 'conn-chip conn-chip--live' :
    'conn-chip conn-chip--off';

  // Progress until the next jira-collector polling (0~1).
  // Based on pollCycleAnchorMs (client clock correction applied) received from the server.
  const POLL_CYCLE_FALLBACK_MS = 60_000;
  const anchorMs = state.pollCycleAnchorMs;
  const cycleMs = state.pollCycleTickMs ?? POLL_CYCLE_FALLBACK_MS;
  const [cycleProgress, setCycleProgress] = useState(0);
  useEffect(() => {
    if (connState !== 'connected' || anchorMs == null) {
      setCycleProgress(0);
      return undefined;
    }
    const id = setInterval(() => {
      const elapsed = (Date.now() - anchorMs) % cycleMs;
      setCycleProgress(elapsed / cycleMs);
    }, 250);
    return () => clearInterval(id);
  }, [connState, anchorMs, cycleMs]);

  // Exposing the mouse position as a CSS variable → Spotlight glow on the background grid.
  // Throttle with rAF so that it runs smoothly without layout pressure even at 60fps or higher.
  useEffect(() => {
    let pendingX = null, pendingY = null, raf = 0;
    const flush = () => {
      raf = 0;
      if (pendingX == null) return;
      const root = document.documentElement.style;
      root.setProperty('--mx', `${pendingX}px`);
      root.setProperty('--my', `${pendingY}px`);
    };
    const onMove = (e) => {
      pendingX = e.clientX; pendingY = e.clientY;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="cursor-glow" aria-hidden="true" />
      <KittBar connection={connState} />
      <ConnectionBanner connection={connState} />
      <header className="dashboard-header">
        <div className="dashboard-header__inner">
          <div className="dashboard-header__title-block">
            <h1 className="dashboard-header__title">Claude Code Worktree Dashboard</h1>
            <p className="dashboard-header__subtitle">Real-time worktree activity monitor</p>
          </div>
          <div className="dashboard-header__meta">
            <span className="dashboard-header__count">
              <span className="dashboard-header__count-num">
                {filter ? `${sorted.length}/${totalCount}` : totalCount}
              </span>
              <span className="dashboard-header__count-label">worktrees</span>
            </span>
            <span
              className={connClass}
              aria-live="polite"
              style={
                connState === 'connected'
                  ? { '--cycle-fill': `${(cycleProgress * 100).toFixed(1)}%` }
                  : undefined
              }
            >
              <span className="conn-chip__dot" aria-hidden="true" />
              {connLabel}
            </span>
          </div>
        </div>
        <div className="dashboard-header__controls">
          <div className="view-toggle" role="radiogroup" aria-label="view mode">
            <span className="view-toggle__label">VIEW</span>
            <button
              type="button"
              className={`view-toggle__btn${viewMode === 'cards' ? ' view-toggle__btn--active' : ''}`}
              role="radio"
              aria-checked={viewMode === 'cards'}
              onClick={() => setViewMode('cards')}
            >
              Card
            </button>
            <button
              type="button"
              className={`view-toggle__btn${viewMode === 'graph' ? ' view-toggle__btn--active' : ''}`}
              role="radio"
              aria-checked={viewMode === 'graph'}
              onClick={() => setViewMode('graph')}
            >
              Graph
            </button>
            <button
              type="button"
              className={`view-toggle__btn${viewMode === 'analytics' ? ' view-toggle__btn--active' : ''}`}
              role="radio"
              aria-checked={viewMode === 'analytics'}
              onClick={() => setViewMode('analytics')}
            >
              Analysis
            </button>
          </div>
          <div className="sort-chips" role="toolbar" aria-label="Sort by">
            <span className="sort-chips__label">SORT</span>
            {SORT_OPTIONS.map(opt => {
              const active = sortKey === opt.key;
              const arrow = active ? (sortDir === 'asc' ? '↑' : '↓') : '';
              return (
                <button
                  key={opt.key}
                  type="button"
                  className={`sort-chip${active ? ' sort-chip--active' : ''}`}
                  onClick={() => handleSortClick(opt.key)}
                  aria-pressed={active}
                >
                  {opt.label}
                  {arrow && <span className="sort-chip__arrow">{arrow}</span>}
                </button>
              );
            })}
          </div>
          <div className="filter-input">
            <span className="filter-input__icon" aria-hidden="true"><IconSearch size={13} /></span>
            <input
              type="search"
              className="filter-input__field"
              placeholder="Title / Issue Key / Branch Search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Title Filter"
            />
            {filter && (
              <button
                type="button"
                className="filter-input__clear"
                onClick={() => setFilter('')}
                aria-label="Clear Filter"
              >×</button>
            )}
          </div>
        </div>
      </header>
      {viewMode === 'analytics' ? (
        <AnalyticsView />
      ) : viewMode === 'graph' ? (
        <GraphErrorBoundary onFallback={() => setViewMode('cards')}>
          <GraphCanvas worktrees={state.worktrees} />
        </GraphErrorBoundary>
      ) : (
        <div className={`dashboard-body${visibleSessions.length > 0 ? ' dashboard-body--with-sessions' : ''}`}>
          <main className={`dashboard-grid${isIdle ? ' is-idle' : ''}${groupedFiltered ? ' dashboard-grid--grouped' : ''}`}>
            {sorted.length === 0 ? (
              <div className="dashboard-empty">
                <div className="dashboard-empty__card" role="status">
                  <div className="dashboard-empty__icon" aria-hidden="true">
                    {filter
                      ? <IconSearch size={36} />
                      : connState === 'connected'
                        ? <IconInbox size={36} />
                        : <IconHourglass size={36} />}
                  </div>
                  <p className="dashboard-empty__title">
                    {filter
                      ? 'No search results found'
                      : connState === 'connected'
                        ? 'Worktree does not exist'
                        : 'Waiting for connection' }
                  </p>
                  <p className="dashboard-empty__hint">
                    {filter
                      ? <>There are no items matching "<span className="dashboard-empty__query">{filter}</span>"</>
                      : connState === 'connected'
                        ? <>If you set up the task environment with <code>/jira-task init</code>, the card will appear here.</>
                        : 'Trying to connect to the Dashboard server… '}
                  </p>
                </div>
              </div>
            ) : groupedFiltered ? (
              // N=2+ workspace: group header + card
              groupedFiltered.map(({ key, label, workspace, wts }) => (
                <WorkspaceGroup
                  key={key}
                  workspace={workspace}
                  label={label}
                  count={wts.length}
                >
                  {wts.map((wt) => <WorktreeCard key={wt.path} worktree={wt} />)}
                </WorkspaceGroup>
              ))
            ) : (
              // N<=1 workspace: flat card grid
              sorted.map((wt) => <WorktreeCard key={wt.path} worktree={wt} />)
            )}
          </main>
          {visibleSessions.length > 0 && (
            <aside className="sessions-section" aria-label="Claude Sessions">
              <div className="sessions-section__header">
                <span className="sessions-section__title">Claude Sessions</span>
                <span className="sessions-section__count">{visibleSessions.length}</span>
              </div>
              <div className="sessions-section__grid">
                {visibleSessions.map((s) => (
                  <SessionCard key={s.sessionId} session={s} />
                ))}
              </div>
            </aside>
          )}
        </div>
      )}
      <footer className="dashboard-footer">
        <span className="dashboard-footer__brand">
          jira-integration-plugin{pluginVersion && `@${pluginVersion}`}
        </span>
        <span className="dashboard-footer__sep">·</span>
        <span className="dashboard-footer__bind">127.0.0.1:8765</span>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>
  );
}
