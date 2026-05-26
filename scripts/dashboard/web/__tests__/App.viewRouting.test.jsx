import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

const App = (await import('../src/App.jsx')).default;

describe('App — Card/Graph View Routing (MAE-259)', () => {
  it('In initial card mode, dashboard-grid is rendered and no graph-canvas', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.dashboard-grid')).not.toBeNull();
    expect(screen.queryByTestId('graph-canvas')).toBeNull();
  });

  it('When you switch to graph mode, the graph-canvas is rendered and the dashboard-grid disappears', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'Graph' }));
    expect(screen.getByTestId('graph-canvas')).toBeInTheDocument();
    expect(container.querySelector('.dashboard-grid')).toBeNull();
  });

  it('When you switch back to card mode, the dashboard-grid returns and the graph-canvas disappears', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'Graph' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Card' }));
    expect(container.querySelector('.dashboard-grid')).not.toBeNull();
    expect(screen.queryByTestId('graph-canvas')).toBeNull();
  });
});
