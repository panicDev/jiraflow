/**
 * GraphFilterBar interaction test (MAE-265).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GraphFilterBar from '../src/components/graph/GraphFilterBar.jsx';

const baseOptions = {
  statuses: [
    { value: 'in progress', count: 2 },
    { value: 'To Do', count: 1 },
  ],
  assignees: [
    { value: 'alice', count: 2 },
    { value: 'bob',   count: 1 },
  ],
};

function setup(overrides = {}) {
  const props = {
    options: baseOptions,
    statusSet: new Set(),
    assigneeSet: new Set(),
    onToggleStatus: vi.fn(),
    onToggleAssignee: vi.fn(),
    onClearStatus: vi.fn(),
    onClearAssignee: vi.fn(),
    matchedCount: 3,
    totalCount: 3,
    ...overrides,
  };
  return { props, ...render(<GraphFilterBar {...props} />) };
}

describe('GraphFilterBar', () => {
  it('U1: render all status / assignee options and display count', () => {
    setup();
    expect(screen.getByText('STATUS')).toBeInTheDocument();
    expect(screen.getByText('ASSIGNEE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /in progress/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /alice/ })).toBeInTheDocument();
  });

  it('U2: Match count not displayed when filter is disabled', () => {
    setup();
    expect(screen.queryByText(/match/)).toBeNull();
  });

  it('U3: Display "x/y match" when filter is active', () => {
    setup({ statusSet: new Set(['In Progress']), matchedCount: 2, totalCount: 3 });
    expect(screen.getByText('2/3 match')).toBeInTheDocument();
  });

  it('U4: Call onToggleStatus(value) when clicking on status chip', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: /in progress/ }));
    expect(props.onToggleStatus).toHaveBeenCalledWith('In Progress');
  });

  it('U5: Call onClearStatus when clicking the STATUS "All" button', () => {
    const { props } = setup({ statusSet: new Set(['In Progress']) });
    // The "All" button in the STATUS group is the first.
    const allButtons = screen.getAllByRole('button', { name: /^all/ });
    fireEvent.click(allButtons[0]);
    expect(props.onClearStatus).toHaveBeenCalled();
  });

  it('U6: aria-pressed=true' on active chip, () => {
    setup({ assigneeSet: new Set(['alice']) });
    const aliceBtn = screen.getByRole('button', { name: /alice/ });
    expect(aliceBtn.getAttribute('aria-pressed')).toBe('true');
    const bobBtn = screen.getByRole('button', { name: /bob/ });
    expect(bobBtn.getAttribute('aria-pressed')).toBe('false');
  });
});
