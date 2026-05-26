import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GraphErrorBoundary from '../src/components/GraphErrorBoundary.jsx';

function Bomb({ shouldThrow }) {
  if (shouldThrow) throw new Error('boom');
  return <div data-testid="bomb-ok">ok</div>;
}

describe('GraphErrorBoundary (MAE-266)', () => {
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // React 18 prints the caught error to console.error — silence it for clean output.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('If the child is normal, render it as is', () => {
    render(
      <GraphErrorBoundary>
        <Bomb shouldThrow={false} />
      </GraphErrorBoundary>
    );
    expect(screen.getByTestId('bomb-ok')).toBeInTheDocument();
  });

  it('Catch child render errors and display fallback UI', () => {
    render(
      <GraphErrorBoundary>
        <Bomb shouldThrow={true} />
      </GraphErrorBoundary>
    );
    expect(screen.getByTestId('graph-error-fallback')).toBeInTheDocument();
    expect(screen.getByText('The graph cannot be displayed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to card view' })).toBeInTheDocument();
  });

  it('When an error occurs, log it to console.warn (dashboard logging)', () => {
    render(
      <GraphErrorBoundary>
        <Bomb shouldThrow={true} />
      </GraphErrorBoundary>
    );
    expect(warnSpy).toHaveBeenCalled();
    const [tag, payload] = warnSpy.mock.calls[0];
    expect(tag).toBe('[GraphCanvas] render error');
    expect(payload).toMatchObject({ message: 'boom' });
    expect(typeof payload.componentStack).toBe('string');
  });

  it('onFallback is called when the "Switch to card view" button is clicked', () => {
    const onFallback = vi.fn();
    render(
      <GraphErrorBoundary onFallback={onFallback}>
        <Bomb shouldThrow={true} />
      </GraphErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Switch to card view' }));
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it('role="alert" and aria-live are set in fallback, so the screen reader is notified', () => {
    render(
      <GraphErrorBoundary>
        <Bomb shouldThrow={true} />
      </GraphErrorBoundary>
    );
    const fb = screen.getByTestId('graph-error-fallback');
    expect(fb).toHaveAttribute('role', 'alert');
    expect(fb).toHaveAttribute('aria-live', 'assertive');
  });
});
