import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// MAE-280: App workspace grouping integration test (E1-E6)

beforeAll(() => {
  globalThis.EventSource = class {
    constructor() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
});

vi.mock('../src/hooks/useDashboardStream.js', () => ({
  useDashboardStream: () => {},
}));

// useWorkspaces mock — managed as a ref so that values ​​can be replaced for each test
let mockWorkspaces = [];
vi.mock('../src/hooks/useWorkspaces.js', () => ({
  useWorkspaces: () => ({ workspaces: mockWorkspaces, lastFetchAt: Date.now(), error: null }),
}));

// DashboardContext mock — replace Context to inject worktrees
let mockWorktrees = {};
vi.mock('../src/state/DashboardContext.jsx', () => {
  const { createContext, useContext } = require('react');
  const Ctx = createContext({ state: { connection: 'connected', lastConnectedAt: null, worktrees: {}, sessions: {}, lastEventAt: null, pollCycleAnchorMs: null, pollCycleTickMs: null }, dispatch: () => {} });
  return {
    DashboardProvider: ({ children }) => {
      const { createElement } = require('react');
      return createElement(Ctx.Provider, {
        value: {
          state: {
            connection: 'connected',
            lastConnectedAt: null,
            worktrees: mockWorktrees,
            sessions: {},
            lastEventAt: null,
            pollCycleAnchorMs: null,
            pollCycleTickMs: null,
          },
          dispatch: () => {},
        },
      }, children);
    },
    useDashboard: () => useContext(Ctx),
  };
});

async function mountApp() {
  const { default: App } = await import('../src/App.jsx');
  return render(<App />);
}

// Clear the module cache so that the mock value is reflected in each test
function resetModules() {
  vi.resetModules();
  // Mock needs to be re-registered after resetting the module cache
  vi.mock('../src/hooks/useDashboardStream.js', () => ({
    useDashboardStream: () => {},
  }));
  vi.mock('../src/hooks/useWorkspaces.js', () => ({
    useWorkspaces: () => ({ workspaces: mockWorkspaces, lastFetchAt: Date.now(), error: null }),
  }));
  vi.mock('../src/state/DashboardContext.jsx', () => {
    const { createContext, useContext } = require('react');
    const Ctx = createContext({});
    return {
      DashboardProvider: ({ children }) => {
        const { createElement } = require('react');
        return createElement(Ctx.Provider, {
          value: {
            state: {
              connection: 'connected',
              lastConnectedAt: null,
              worktrees: mockWorktrees,
              sessions: {},
              lastEventAt: null,
              pollCycleAnchorMs: null,
              pollCycleTickMs: null,
            },
            dispatch: () => {},
          },
        }, children);
      },
      useDashboard: () => useContext(Ctx),
    };
  });
}

const WS_A = { path: '/ws/alpha', registeredAt: '2026-01-01T00:00:00Z', lastSeenAt: null, status: 'active', health: 'healthy', worktreeCount: 1 };
const WS_B = { path: '/ws/beta', registeredAt: '2026-01-01T00:00:00Z', lastSeenAt: null, status: 'active', health: 'creds-missing', worktreeCount: 1 };

const WT_A1 = { path: '/ws/alpha/task1', branch: 'feature/A1', taskId: 'A-1', noContext: false, workspaceRoot: '/ws/alpha', cachedIssue: { key: 'A-1', summary: 'Alpha task 1', status: 'In progress', priority: 'Main', assignee: null, issuetype: 'Task' }, activity: [] };
const WT_B1 = { path: '/ws/beta/task2', branch: 'feature/B1', taskId: 'B-1', noContext: false, workspaceRoot: '/ws/beta', cachedIssue: { key: 'B-1', summary: 'Beta task 1', status: 'In progress', priority: 'Main', assignee: null, issuetype: 'Task' }, activity: [] };

describe('App grouping — E1: N=2 workspace group header render', () => {
  it('Render 2 WorkspaceGroup headers when there are 2 workspaces', async () => {
    mockWorkspaces = [WS_A, WS_B];
    mockWorktrees = {
      [WT_A1.path]: WT_A1,
      [WT_B1.path]: WT_B1,
    };
    resetModules();

    const { container } = await mountApp();
    const groups = container.querySelectorAll('.workspace-group');
    expect(groups.length).toBe(2);
  });
});

describe('App grouping — E2: N=1 auto-flat mode', () => {
  it('Flat card without workspace-group when there is 1 workspace', async () => {
    mockWorkspaces = [WS_A];
    mockWorktrees = { [WT_A1.path]: WT_A1 };
    resetModules();

    const { container } = await mountApp();
    expect(container.querySelector('.workspace-group')).toBeNull();
    expect(container.querySelector('.dashboard-grid')).not.toBeNull();
  });
});

describe('App grouping — E3: health badge accuracy', () => {
  it('WS_A=healthy, WS_B=creds-missing → apply badge class to each', async () => {
    mockWorkspaces = [WS_A, WS_B];
    mockWorktrees = {
      [WT_A1.path]: WT_A1,
      [WT_B1.path]: WT_B1,
    };
    resetModules();

    const { container } = await mountApp();
    expect(container.querySelector('.health-badge--healthy')).not.toBeNull();
    expect(container.querySelector('.health-badge--creds-missing')).not.toBeNull();
  });
});

describe('App grouping — E5: 0 results for one group with search filter → Mirrender the group header', () => {
  it('When searching for B group keywords, A header mirrored, only B header displayed', async () => {
    mockWorkspaces = [WS_A, WS_B];
    mockWorktrees = {
      [WT_A1.path]: WT_A1,
      [WT_B1.path]: WT_B1,
    };
    resetModules();

    const { container } = await mountApp();

    // Filter by B group keyword ("Beta task")
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'Beta task' } });

    await waitFor(() => {
      const groups = container.querySelectorAll('.workspace-group');
      // Alpha group is hidden because there are 0 items → Only 1 group must remain
      expect(groups.length).toBe(1);
    });
  });
});

describe('App grouping — E6: fallback group (workspaceRoot not in registry)', () => {
  it('No matching worktree → Display as "(no workspace)" header', async () => {
    mockWorkspaces = [WS_A, WS_B];
    const wtOrphan = { path: '/ws/orphan/task3', branch: 'feature/ORG', taskId: 'ORG-1', noContext: false, workspaceRoot: '/ws/orphan', cachedIssue: { key: 'ORG-1', summary: 'Orphan task', status: 'In Progress', priority: 'Main', assignee: null, issuetype: 'Task' }, activity: [] };
    mockWorktrees = {
      [WT_A1.path]: WT_A1,
      [wtOrphan.path]: wtOrphan,
    };
    resetModules();

    const { container } = await mountApp();
    // alpha(1 card) + __unaassigned__(1 card) = 2 groups
    const groups = container.querySelectorAll('.workspace-group');
    expect(groups.length).toBe(2);
    // "(no workspace)" text exists
    expect(screen.getByText('(no workspace)')).toBeInTheDocument();
  });
});

describe('App grouping — E2 boundary: flat mode with 0 workspaces', () => {
  it('If workspaces is an empty array, then no workspace-group', async () => {
    mockWorkspaces = [];
    mockWorktrees = { [WT_A1.path]: WT_A1 };
    resetModules();

    const { container } = await mountApp();
    expect(container.querySelector('.workspace-group')).toBeNull();
  });
});
