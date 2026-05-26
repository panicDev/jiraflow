import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Stepper from '../src/components/Stepper.jsx';

describe('Stepper', () => {
  // Helper for finding a step with aria-label(`<step>: <state>`).
  // With the introduction of chip style, the title changed to "<step>: <state>"
  // The same text can be captured in multiple places with just the child span text, so aria-label takes priority.
  const findStep = (label, state) => screen.getByLabelText(`${label}: ${state}`);

  // U14
  it('U14 — Render in 7 step order (excluding init, plan+design→approach), first label start / last done', () => {
    render(<Stepper completedSteps={[]} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(7);
    // If completedSteps is empty, start=active, rest=pending
    expect(items[0]).toHaveAttribute('aria-label', 'start: active');
    expect(items[6]).toHaveAttribute('aria-label', 'done: pending');
  });

  // U15
  it('U15 — done step --done modifier class', () => {
    render(<Stepper completedSteps={['start']} />);
    const startItem = findStep('start', 'done');
    expect(startItem.className).toContain('wt-stepper__step--done');
  });

  // U16
  it('U16 — active modifier class', () => {
    render(<Stepper completedSteps={['start']} />);
    const approachItem = findStep('approach', 'active');
    expect(approachItem.className).toContain('wt-stepper__step--active');
  });

  // U17
  it('U17 — --pending modifier class in pending phase', () => {
    render(<Stepper completedSteps={['start']} />);
    const doneItem = findStep('done', 'pending');
    expect(doneItem.className).toContain('wt-stepper__step--pending');
  });

  // U18
  it('U18 — container aria-label="SDLC progress"', () => {
    render(<Stepper completedSteps={[]} />);
    expect(screen.getByRole('list', { name: 'SDLC progress' })).toBeInTheDocument();
  });

  // U19
  it('U19 — undefined props defense: no exceptions, start is active', () => {
    render(<Stepper completedSteps={undefined} />);
    const startItem = findStep('start', 'active');
    expect(startItem.className).toContain('wt-stepper__step--active');
  });

  // U20 — Even if init is included in the payload, visualization is not affected (init is excluded from SDLC_STEPS)
  it('U20 — Even if there is init in the payload, the first visible step is start (active)', () => {
    render(<Stepper completedSteps={['init']} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    expect(findStep('start', 'active')).toBeInTheDocument();
  });

  // U1 (MAE-239): Grant data-just-completed property when transitioning from pending → done
  it('U1 — grant data-just-completed when transitioning from pending→done', async () => {
    const { rerender } = render(<Stepper completedSteps={[]} />);
    // start is not done yet (active)
    expect(findStep('start', 'active')).not.toHaveAttribute('data-just-completed');

    await act(async () => {
      rerender(<Stepper completedSteps={['start']} />);
    });
    // start is changed to done and data-just-completed is granted
    expect(findStep('start', 'done')).toHaveAttribute('data-just-completed');
  });

  // U2 (MAE-239): Do not assign properties when re-rendering the same completedSteps
  it('U2 — No data-just-completed when re-rendering same completedSteps', async () => {
    const { rerender } = render(<Stepper completedSteps={['start']} />);

    // Wait until the property is removed (500ms timeout)
    await act(async () => {
      await new Promise(r => setTimeout(r, 520));
    });

    // Render again with the same completedSteps
    await act(async () => {
      rerender(<Stepper completedSteps={['start']} />);
    });
    expect(findStep('start', 'done')).not.toHaveAttribute('data-just-completed');
  });
});
