import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

beforeAll(() => {
  // There is no EventSource in jsdom, so useDashboardStream crashes — no-op stub.
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

describe('App — Card/Graph View Toggle (MAE-258)', () => {
  it('Card mode is active during initial render', () => {
    render(<App />);
    const cardsBtn = screen.getByRole('radio', { name: 'card' });
    const graphBtn = screen.getByRole('radio', { name: 'Graph' });
    expect(cardsBtn).toHaveAttribute('aria-checked', 'true');
    expect(graphBtn).toHaveAttribute('aria-checked', 'false');
    expect(cardsBtn.className).toContain('view-toggle__btn--active');
  });

  it('When the graph button is clicked, the active state switches to graph', () => {
    render(<App />);
    const graphBtn = screen.getByRole('radio', { name: 'Graph' });
    fireEvent.click(graphBtn);
    expect(graphBtn).toHaveAttribute('aria-checked', 'true');
    expect(graphBtn.className).toContain('view-toggle__btn--active');
    expect(screen.getByRole('radio', { name: 'card' })).toHaveAttribute('aria-checked', 'false');
  });

  it('Return to card mode when clicking the card button', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'Graph' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Card' }));
    expect(screen.getByRole('radio', { name: 'card' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'graph' })).toHaveAttribute('aria-checked', 'false');
  });
});
