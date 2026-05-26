import { describe, it, expect } from 'vitest';
import { getStepState, SDLC_STEPS } from '../src/constants/sdlc.js';

const ALL_STEPS = SDLC_STEPS.map(s => s.id);

// Note: SDLC_STEPS has 7 steps (start, approach, impl, test, review, merge, done) excluding `init`.
// `init` is excluded from the stepper because the existence of the worktree itself means that init has been completed.
// Even if init is included in payload(`completedSteps`), it has no effect because it is not in SDLC_STEPS.
// `plan` + `design` combined into a single `approach` step.

describe('getStepState', () => {
  // U1
  it('U1 — done phase recognition', () => {
    expect(getStepState('start', ['start', 'approach'])).toBe('done');
  });

  // U2
  it('U2 — active phase recognition (sequential)', () => {
    expect(getStepState('impl', ['start', 'approach'])).toBe('active');
  });

  // U3
  it('U3 — pending phase recognition', () => {
    expect(getStepState('test', ['start', 'approach'])).toBe('pending');
  });

  // U4
  it('U4 — empty array → start is active (first visible phase)', () => {
    expect(getStepState('start', [])).toBe('active');
  });

  // U5
  it('U5 — empty array → rest pending', () => {
    expect(getStepState('approach', [])).toBe('pending');
  });

  // U6
  it('U6 — undefined safe', () => {
    expect(getStepState('start', undefined)).toBe('active');
  });

  // U7
  it('U7 — null safe', () => {
    expect(getStepState('start', null)).toBe('active');
  });

  // U8
  it('U8 — non-array safe (string)', () => {
    expect(getStepState('start', 'start')).toBe('active');
  });

  // U9
  it('U9 — all steps completed → done step is done', () => {
    expect(getStepState('done', ALL_STEPS)).toBe('done');
  });

  // U10
  it('U10 — all steps completed → start is also done', () => {
    expect(getStepState('start', ALL_STEPS)).toBe('done');
  });

  // U11
  it('U11 — Out-of-order: start missing → start is active', () => {
    expect(getStepState('start', ['approach'])).toBe('active');
  });

  // U12
  it('U12 — out-of-order: approach done if in completedSteps', () => {
    expect(getStepState('approach', ['approach'])).toBe('done');
  });

  // U13
  it('U13 — init in payload is ignored and start is treated as the first visible step', () => {
    // init is not in SDLC_STEPS, so it is irrelevant for visualization even if it is in completedSteps
    expect(getStepState('start', ['init'])).toBe('active');
  });

  // U14 — regression defense
  it('U14 — init is not included in SDLC_STEPS, plan/design is integrated into approach', () => {
    expect(SDLC_STEPS.find(s => s.id === 'init')).toBeUndefined();
    expect(SDLC_STEPS.find(s => s.id === 'plan')).toBeUndefined();
    expect(SDLC_STEPS.find(s => s.id === 'design')).toBeUndefined();
    expect(SDLC_STEPS.find(s => s.id === 'approach')).toBeDefined();
    expect(SDLC_STEPS).toHaveLength(7);
    expect(SDLC_STEPS[0].id).toBe('start');
    expect(SDLC_STEPS[6].id).toBe('done');
  });
});
