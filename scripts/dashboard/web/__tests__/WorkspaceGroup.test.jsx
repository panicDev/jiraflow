import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkspaceGroup from '../src/components/WorkspaceGroup.jsx';

// MAE-280: WorkspaceGroup component unit tests (U5-U8)

const baseWs = {
  path: '/ws/my-project',
  registeredAt: '2026-01-01T00:00:00Z',
  lastSeenAt: null,
  status: 'active',
  health: 'healthy',
  worktreeCount: 2,
};

describe('WorkspaceGroup — U5: health=healthy', () => {
  it('.health-badge--healthy class exists', () => {
    render(<WorkspaceGroup workspace={baseWs} label="my-project" count={2}><span /></WorkspaceGroup>);
    expect(document.querySelector('.health-badge--healthy')).not.toBeNull();
  });
});

describe('WorkspaceGroup — U6: health=creds-missing', () => {
  it('.health-badge--creds-missing class exists', () => {
    const ws = { ...baseWs, health: 'creds-missing' };
    render(<WorkspaceGroup workspace={ws} label="my-project" count={1}><span /></WorkspaceGroup>);
    expect(document.querySelector('.health-badge--creds-missing')).not.toBeNull();
  });
});

describe('WorkspaceGroup — U7: Unknown health value fallback', () => {
  it('weird-value → .health-badge--unknown', () => {
    const ws = { ...baseWs, health: 'weird-value' };
    render(<WorkspaceGroup workspace={ws} label="my-project" count={1}><span /></WorkspaceGroup>);
    expect(document.querySelector('.health-badge--unknown')).not.toBeNull();
    expect(document.querySelector('.health-badge--weird-value')).toBeNull();
  });

  it('no-worktrees → .health-badge--no-worktrees', () => {
    const ws = { ...baseWs, health: 'no-worktrees' };
    render(<WorkspaceGroup workspace={ws} label="my-project" count={0}><span /></WorkspaceGroup>);
    expect(document.querySelector('.health-badge--no-worktrees')).not.toBeNull();
  });

  it('undefined health → .health-badge--unknown', () => {
    const ws = { ...baseWs, health: undefined };
    render(<WorkspaceGroup workspace={ws} label="my-project" count={1}><span /></WorkspaceGroup>);
    expect(document.querySelector('.health-badge--unknown')).not.toBeNull();
  });
});

describe('WorkspaceGroup — U8: count/lastSeenAt render', () => {
  it('count=3 → Include "3" text in header', () => {
    render(<WorkspaceGroup workspace={baseWs} label="my-project" count={3}><span /></WorkspaceGroup>);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('lastSeenAt=5 minutes ago → Display relative time text', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const ws = { ...baseWs, lastSeenAt: fiveMinAgo };
    render(<WorkspaceGroup workspace={ws} label="my-project" count={2}><span /></WorkspaceGroup>);
    // Check "5 minutes ago" or similar minute-by-minute text
    const timeEl = document.querySelector('.workspace-group__time');
    expect(timeEl?.textContent).toMatch(/minutes ago/);
  });

  it('lastSeenAt=null → show "—"', () => {
    render(<WorkspaceGroup workspace={baseWs} label="my-project" count={1}><span /></WorkspaceGroup>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('label text render', () => {
    render(<WorkspaceGroup workspace={baseWs} label="my-project" count={1}><span /></WorkspaceGroup>);
    expect(screen.getByText('my-project')).toBeInTheDocument();
  });

  it('children slot render', () => {
    render(
      <WorkspaceGroup workspace={baseWs} label="x" count={1}>
        <span data-testid="child-node">child</span>
      </WorkspaceGroup>
    );
    expect(screen.getByTestId('child-node')).toBeInTheDocument();
  });
});

describe('WorkspaceGroup — fallback(no workspace) group', () => {
  it('workspace=null → health-badge--unknown, title empty string', () => {
    render(<WorkspaceGroup workspace={null} label="(no workspace)" count={1}><span /></WorkspaceGroup>);
    expect(document.querySelector('.health-badge--unknown')).not.toBeNull();
    expect(screen.getByText('(no workspace)')).toBeInTheDocument();
  });
});
