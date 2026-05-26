import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdle } from '../src/hooks/useIdle.js';

describe('useIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // U3: lastEventAt=null → false (connecting, not idle)
  it('U3 — lastEventAt=null → false', () => {
    const { result } = renderHook(() => useIdle(null));
    expect(result.current).toBe(false);
  });

  // U4: Below threshold → false
  it('U4 — below threshold (1000ms) → false', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const { result } = renderHook(() => useIdle(now - 1000, 15_000));
    expect(result.current).toBe(false);
  });

  // U5: Threshold exceeded → true (proceeds for 16s with fake timer)
  it('U5 — After 16 seconds → true', () => {
    const start = Date.now();
    vi.setSystemTime(start);
    const { result } = renderHook(() => useIdle(start, 15_000));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(16_000);
    });

    expect(result.current).toBe(true);
  });

  // Clock jump protection: now < lastEventAt → false
  it('clock jump guard — now < lastEventAt → false', () => {
    const future = Date.now() + 60_000;
    const { result } = renderHook(() => useIdle(future, 15_000));
    expect(result.current).toBe(false);
  });

  // Reset idle when lastEventAt changes
  it('Idle reset when lastEventAt update', () => {
    const start = Date.now();
    vi.setSystemTime(start);

    const { result, rerender } = renderHook(
      ({ ts }) => useIdle(ts, 15_000),
      { initialProps: { ts: start } }
    );

    // idle after 16 seconds
    act(() => { vi.advanceTimersByTime(16_000); });
    expect(result.current).toBe(true);

    // New event arrives → idle reset
    const refreshed = Date.now();
    act(() => { rerender({ ts: refreshed }); });
    expect(result.current).toBe(false);
  });
});
