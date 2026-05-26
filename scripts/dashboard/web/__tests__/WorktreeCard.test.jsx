import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorktreeCard from '../src/components/WorktreeCard.jsx';

const fullWorktree = {
  path: '/workspace/project',
  branch: 'feature/MAE-211',
  taskId: 'MAE-211',
  noContext: false,
  cachedIssue: {
    key: 'MAE-211',
    summary: 'React UI dashboard',
    status: 'In progress',
    priority: 'Main',
    assignee: 'Test User',
    issuetype: 'task',
  },
  activity: [],
};

// U12
describe('WorktreeCard — Pool Data', () => {
  it('Show taskId', () => {
    render(<WorktreeCard worktree={fullWorktree} />);
    expect(screen.getByText('MAE-211')).toBeInTheDocument();
  });

  it('Show branch', () => {
    render(<WorktreeCard worktree={fullWorktree} />);
    expect(screen.getByText('feature/MAE-211')).toBeInTheDocument();
  });

  it('path — display only the last segment', () => {
    render(<WorktreeCard worktree={fullWorktree} />);
    expect(screen.getByText('project')).toBeInTheDocument();
  });

  it('path — full path is in title attribute', () => {
    render(<WorktreeCard worktree={fullWorktree} />);
    const dd = screen.getByTitle('/workspace/project');
    expect(dd).toBeInTheDocument();
  });

  it('Show summary', () => {
    render(<WorktreeCard worktree={fullWorktree} />);
    expect(screen.getByText('React UI dashboard')).toBeInTheDocument();
  });

  it('Show status', () => {
    render(<WorktreeCard worktree={fullWorktree} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('Priority display', () => {
    render(<WorktreeCard worktree={fullWorktree} />);
    expect(screen.getByText('Main')).toBeInTheDocument();
  });

  it('Show assignee', () => {
    render(<WorktreeCard worktree={fullWorktree} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
});

// U20, U21
describe('WorktreeCard — stepper integration', () => {
  it('U20 — When there are completedSteps, stepper render + impl is active (init is excluded from visualization)', () => {
    const worktree = {
      ...fullWorktree,
      completedSteps: ['init', 'start', 'approach'],
    };
    render(<WorktreeCard worktree={worktree} />);
    const stepper = document.querySelector('.wt-stepper');
    expect(stepper).not.toBeNull();
    const implStep = document.querySelector('[aria-label="impl: active"]');
    expect(implStep?.className).toContain('wt-stepper__step--active');
  });

  it('U21 — completedSteps missing worktree → stepper normal render, start is active', () => {
    const worktree = { ...fullWorktree, completedSteps: undefined };
    render(<WorktreeCard worktree={worktree} />);
    const startStep = document.querySelector('[aria-label="start: active"]');
    expect(startStep?.className).toContain('wt-stepper__step--active');
  });
});

// U14
describe('WorktreeCard — path last-segment', () => {
  it('Return the last segment in the trailing slash path', () => {
    const worktree = { ...fullWorktree, path: '/foo/bar/' };
    render(<WorktreeCard worktree={worktree} />);
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('Return TASK-ID segment from long absolute path', () => {
    const worktree = {
      ...fullWorktree,
      path: '/Users/foo/WORK/workspace/jira-claude-code-integration_worktree/MAE-238',
    };
    render(<WorktreeCard worktree={worktree} />);
    expect(screen.getByText('MAE-238')).toBeInTheDocument();
  });

  it('In a long absolute path, the title is full path', () => {
    const fullPath = '/Users/foo/WORK/workspace/jira-claude-code-integration_worktree/MAE-238';
    const worktree = { ...fullWorktree, path: fullPath };
    render(<WorktreeCard worktree={worktree} />);
    expect(screen.getByTitle(fullPath)).toBeInTheDocument();
  });
});

// U15
describe('WorktreeCard — summary null placeholder', () => {
  const noSummaryWorktree = {
    path: '/workspace/project',
    branch: 'feature/MAE-238',
    taskId: 'MAE-238',
    noContext: false,
    cachedIssue: null,
    summary: null,
    activity: [],
  };

  it('Show (no summary) text', () => {
    render(<WorktreeCard worktree={noSummaryWorktree} />);
    expect(screen.getByText('(no summary)')).toBeInTheDocument();
  });

  it('class wt-card__summary--empty on (no summary) element', () => {
    render(<WorktreeCard worktree={noSummaryWorktree} />);
    const el = screen.getByText('(no summary)');
    expect(el).toHaveClass('wt-card__summary--empty');
  });

  it('The title of the (no summary) element is "no Jira summary cached"', () => {
    render(<WorktreeCard worktree={noSummaryWorktree} />);
    const el = screen.getByText('(no summary)');
    expect(el).toHaveAttribute('title', 'no Jira summary cached');
  });
});

// U13
describe('WorktreeCard — noContext fallback', () => {
  const noCtxWorktree = {
    path: '/workspace/no-ctx',
    branch: null,
    taskId: null,
    noContext: true,
    cachedIssue: null,
    activity: [],
  };

  it('Show "no jira" badge', () => {
    render(<WorktreeCard worktree={noCtxWorktree} />);
    expect(screen.getByText('no jira')).toBeInTheDocument();
  });

  it('Show "—" in place of Jira fields', () => {
    render(<WorktreeCard worktree={noCtxWorktree} />);
    // status/priority/assignee positions are all "—"
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });
});
