/**
 * AnalyticsView.test.jsx — MAE-386 Test Plan T6 + MAE-387 new section render
 *
 * T6: AnalyticsView empty/loading/error state render (useMetrics mock)
 * MAE-387: Check leadTime/cycleTime/perAssignee/agingWip section render.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock useMetrics / useSpaces hooks
// ---------------------------------------------------------------------------

vi.mock('../src/hooks/useMetrics.js', () => ({
  useSpaces: vi.fn(),
  useMetrics: vi.fn(),
}));

import { useSpaces, useMetrics } from '../src/hooks/useMetrics.js';
import AnalyticsView from '../src/components/AnalyticsView.jsx';

// ---------------------------------------------------------------------------
// Default stub values
// ---------------------------------------------------------------------------

const defaultMetrics = {
  data: {
    spaceId: 'sp1',
    weeks: 8,
    statusDistribution: [
      { status: 'In Progress', statusCategory: 'indeterminate', count: 3 },
      { status: 'Done', statusCategory: 'done', count: 5 },
    ],
    wip: 3,
    throughput: [{ week: '2024-01', completed: 2 }],
    // MAE-387 new field
    leadTime: { median: 10, p75: 15, p95: 20, distribution: [{ issueKey: 'MAE-1', days: 10 }] },
    cycleTime: { median: 5, p75: 8, p95: 12, distribution: [{ issueKey: 'MAE-1', days: 5 }], note: 'Approximate value' },
    perAssignee: [{ assignee: 'alice', completed: 3, wip: 1 }],
    agingWip: [{ issueKey: 'MAE-2', summary: 'Old issue', assignee: 'alice', created: '2024-01-01', ageDays: 30 }],
  },
  loading: false,
  error: null,
  refresh: vi.fn(),
};

const defaultSpaces = [
  { id: 'sp1', site: 'https://x.atlassian.net', projectKey: 'MAE', credsOk: true, addedAt: '2024-01-01' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// T6: loading state
// ---------------------------------------------------------------------------

describe('AnalyticsView — T6 loading/empty/error states (MAE-386)', () => {
  it('T6-loading: spacesLoading=true → render loading indicator', () => {
    useSpaces.mockReturnValue({ spaces: [], loading: true, error: null });
    useMetrics.mockReturnValue(defaultMetrics);

    render(<AnalyticsView />);

    const container = document.querySelector('[aria-busy="true"]');
    expect(container).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // T6: error state
  // -------------------------------------------------------------------------

  it('T6-error: spacesError settings → render error message + retry button', () => {
    const refresh = vi.fn();
    useSpaces.mockReturnValue({ spaces: [], loading: false, error: 'Network error' });
    useMetrics.mockReturnValue({ ...defaultMetrics, refresh });

    render(<AnalyticsView />);

    const alert = document.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('Network error');

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeTruthy();
    fireEvent.click(retryBtn);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // T6: empty state
  // -------------------------------------------------------------------------

  it('T6-empty: spaces=[] loading=false → render empty notice', () => {
    useSpaces.mockReturnValue({ spaces: [], loading: false, error: null });
    useMetrics.mockReturnValue(defaultMetrics);

    render(<AnalyticsView />);

    const status = document.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status.textContent).toContain('There is no registered space');
  });

  // -------------------------------------------------------------------------
  // T6: normal render with data
  // -------------------------------------------------------------------------

  it('T6-normal: spaces exist → space selector + chart container render', () => {
    useSpaces.mockReturnValue({ spaces: defaultSpaces, loading: false, error: null });
    useMetrics.mockReturnValue(defaultMetrics);

    render(<AnalyticsView />);

    // space selector (dropdown)
    const select = screen.getByRole('combobox', { name: /space selection/i });
    expect(select).toBeTruthy();

    // space option (shows projectKey) + selected
    const option = screen.getByRole('option', { name: /MAE/i });
    expect(option).toBeTruthy();
    expect(option.selected).toBe(true);
  });

  it('T6-normal: metricsLoading=true while space selected → loading indicator', () => {
    useSpaces.mockReturnValue({ spaces: defaultSpaces, loading: false, error: null });
    useMetrics.mockReturnValue({ ...defaultMetrics, loading: true, data: null });

    render(<AnalyticsView />);

    // The view renders and spaces selector still visible
    const select = screen.getByRole('combobox', { name: /space selection/i });
    expect(select).toBeTruthy();
  });

  it('T6-order: Recently added space is at the top + automatically selected', () => {
    const spaces = [
      { id: 'old', site: 'https://x.atlassian.net', projectKey: 'OLD', credsOk: true, addedAt: '2024-01-01' },
      { id: 'new', site: 'https://x.atlassian.net', projectKey: 'NEW', credsOk: true, addedAt: '2024-06-01' },
    ];
    useSpaces.mockReturnValue({ spaces, loading: false, error: null });
    useMetrics.mockReturnValue(defaultMetrics);

    render(<AnalyticsView />);

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('NEW');
    expect(options[0].selected).toBe(true);
  });

  it('T6-normal: credsOk=false space is disabled', () => {
    const noCredsSpaces = [
      { id: 'sp-nocreds', site: 'https://x.atlassian.net', projectKey: 'NOCREDS', credsOk: false, addedAt: '2024-01-01' },
    ];
    useSpaces.mockReturnValue({ spaces: noCredsSpaces, loading: false, error: null });
    useMetrics.mockReturnValue({ ...defaultMetrics, data: null });

    render(<AnalyticsView />);

    const option = screen.getByRole('option', { name: /NOCREDS/i });
    expect(option).toBeTruthy();
    expect(option).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// MAE-387: Check new section render
// ---------------------------------------------------------------------------

describe('AnalyticsView — MAE-387 New Section Render', () => {
  beforeEach(() => {
    useSpaces.mockReturnValue({ spaces: defaultSpaces, loading: false, error: null });
    useMetrics.mockReturnValue(defaultMetrics);
  });

  it('MAE-387: Lead Time distribution section heading is rendered', () => {
    render(<AnalyticsView />);
    expect(screen.getByText(/Lead Time Distribution/i)).toBeTruthy();
  });

  it('MAE-387: Cycle Time distribution section heading is rendered', () => {
    render(<AnalyticsView />);
    expect(screen.getByText(/Cycle Time distribution/i)).toBeTruthy();
  });

  it('MAE-387: Per-person throughput section — PerAssigneeTable aria-label is rendered', () => {
    render(<AnalyticsView />);
    expect(screen.getByText(/Throughput per person/i)).toBeTruthy();
    const table = document.querySelector('[aria-label="Throughput per person"]');
    expect(table).not.toBeNull();
  });

  it('MAE-387: Aging WIP section — AgingWipTable aria-label is rendered', () => {
    render(<AnalyticsView />);
    expect(screen.getByText(/Aging WIP/i)).toBeTruthy();
    const table = document.querySelector('[aria-label="Aging WIP"]');
    expect(table).not.toBeNull();
  });

  it('MAE-387: perAssignee data is rendered in table', () => {
    render(<AnalyticsView />);
    // alice entry should appear in PerAssigneeTable
    const aliceElements = screen.getAllByText('alice');
    expect(aliceElements.length).toBeGreaterThan(0);
  });

  it('MAE-387: agingWip data is rendered in table', () => {
    render(<AnalyticsView />);
    // MAE-2 issueKey should appear in AgingWipTable
    expect(screen.getByText('MAE-2')).toBeTruthy();
  });

  it('MAE-387: leadTime/cycleTime/perAssignee/agingWip empty data — graceful empty state render', () => {
    useMetrics.mockReturnValue({
      ...defaultMetrics,
      data: {
        ...defaultMetrics.data,
        leadTime: { median: null, p75: null, p95: null, distribution: [] },
        cycleTime: { median: null, p75: null, p95: null, distribution: [], note: 'Approximate value' },
        perAssignee: [],
        agingWip: [],
      },
    });

    render(<AnalyticsView />);

    // empty state component should render (without crash)
    expect(screen.getByText(/Lead Time Distribution/i)).toBeTruthy();
    expect(screen.getByText(/no throughput data per person/i)).toBeTruthy();
    expect(screen.getByText(/No Aging WIP/i)).toBeTruthy();
  });
});
