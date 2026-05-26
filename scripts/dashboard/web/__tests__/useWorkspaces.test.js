import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkspaces } from '../src/hooks/useWorkspaces.js';

// MAE-280: useWorkspaces hook unit test (U1-U4)

function makeFetch(data, { ok = true, reject = false } = {}) {
  return vi.fn(() => {
    if (reject) return Promise.reject(new Error('network error'));
    return Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve(data),
    });
  });
}

const W1 = { path: '/ws/a', registeredAt: '2026-01-01T00:00:00Z', lastSeenAt: null, status: 'active', health: 'healthy', worktreeCount: 1 };
const W2 = { path: '/ws/b', registeredAt: '2026-01-01T00:00:00Z', lastSeenAt: null, status: 'active', health: 'creds-missing', worktreeCount: 2 };

describe('useWorkspaces — U1: first fetch successful', () => {
  it('return workspaces array, error null', async () => {
    const fetchImpl = makeFetch({ workspaces: [W1, W2] });
    const { result } = renderHook(() => useWorkspaces({ intervalMs: 60000, fetchImpl }));

    await waitFor(() => expect(result.current.workspaces).toHaveLength(2));
    expect(result.current.error).toBeNull();
    expect(result.current.workspaces[0].path).toBe('/ws/a');
    expect(result.current.workspaces[1].path).toBe('/ws/b');
  });
});

describe('useWorkspaces — U2: fetch failed', () => {
  it('error setting, keep empty array in workspaces', async () => {
    const fetchImpl = makeFetch(null, { reject: true });
    const { result } = renderHook(() => useWorkspaces({ intervalMs: 60000, fetchImpl }));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.workspaces).toHaveLength(0);
    expect(result.current.error).toMatch(/network error/i);
  });

  it('Keep the previous value when the first fetch succeeds and the second fails', async () => {
    let callCount = 0;
    const fetchImpl = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ workspaces: [W1] }),
        });
      }
      return Promise.reject(new Error('fail'));
    });

    const { result } = renderHook(() => useWorkspaces({ intervalMs: 50, fetchImpl }));
    await waitFor(() => expect(result.current.workspaces).toHaveLength(1));

    // After second fetch (polling) failure
    await waitFor(() => expect(result.current.error).not.toBeNull(), { timeout: 500 });
    expect(result.current.workspaces).toHaveLength(1); // Maintain previous value
  });
});

describe('useWorkspaces — U3: polling tick', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('Call fetch twice after intervalMs', async () => {
    const fetchImpl = makeFetch({ workspaces: [W1] });
    renderHook(() => useWorkspaces({ intervalMs: 100, fetchImpl }));

    // Wait for initial fetch completion
    await act(async () => { await Promise.resolve(); });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // 100ms elapsed → polling fetch
    await act(async () => {
      vi.advanceTimersByTime(110);
      await Promise.resolve();
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('useWorkspaces — U4: Stop polling when visibility is hidden', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible', writable: true, configurable: true,
    });
  });

  it('No additional fetch even if interval elapses in hidden state', async () => {
    const fetchImpl = makeFetch({ workspaces: [W1] });
    renderHook(() => useWorkspaces({ intervalMs: 100, fetchImpl }));

    // initial fetch
    await act(async () => { await Promise.resolve(); });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // switch to hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden', writable: true, configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => { await Promise.resolve(); });

    // No fetch additions even after time passes
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('useWorkspaces — skip items without path', () => {
  it('Exclude items without path, return only valid items', async () => {
    const fetchImpl = makeFetch({ workspaces: [W1, { health: 'healthy' } /* no path */, W2] });
    const { result } = renderHook(() => useWorkspaces({ intervalMs: 60000, fetchImpl }));

    await waitFor(() => expect(result.current.workspaces).toHaveLength(2));
    expect(result.current.workspaces.every(w => w.path)).toBe(true);
  });
});
