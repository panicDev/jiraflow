import { useState, useEffect, useRef } from 'react';

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Polling GET /workspaces every 60s.
 * If visibilityState === 'hidden', polling is paused and fetched immediately upon resumption.
 *
 * @param {object} [opts]
 * @param {number} [opts.intervalMs] polling cycle (for override in tests)
 * @param {typeof fetch} [opts.fetchImpl] fetch implementation (for mock injection in tests)
 * @returns {{ workspaces: WorkspaceEntry[], lastFetchAt: number|null, error: string|null }}
 */
export function useWorkspaces({ intervalMs = DEFAULT_INTERVAL_MS, fetchImpl } = {}) {
  const [workspaces, setWorkspaces] = useState([]);
  const [lastFetchAt, setLastFetchAt] = useState(null);
  const [error, setError] = useState(null);

  // Store the previous successful workspaces in ref → Maintain in case of fetch failure
  const prevWorkspacesRef = useRef([]);

  const fetcher = fetchImpl ?? fetch;

  useEffect(() => {
    let timerId = null;

    async function doFetch() {
      try {
        const res = await fetcher('/workspaces');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const items = Array.isArray(json.workspaces) ? json.workspaces : [];
        // Item-level verification: if there is no path field, skip + warn
        const valid = [];
        for (const item of items) {
          try {
            if (typeof item.path !== 'string' || !item.path) {
              console.warn('[useWorkspaces] No path in workspace item, skip:', item);
              continue;
            }
            valid.push(item);
          } catch (e) {
            console.warn('[useWorkspaces] Workspace item parsing error, skip:', e.message);
          }
        }
        prevWorkspacesRef.current = valid;
        setWorkspaces(valid);
        setLastFetchAt(Date.now());
        setError(null);
      } catch (e) {
        console.warn('[useWorkspaces] GET /workspaces failed:', e.message);
        // Maintain previous value
        setWorkspaces(prevWorkspacesRef.current);
        setError(e.message);
      }
    }

    function schedule() {
      timerId = setTimeout(async () => {
        await doFetch();
        if (document.visibilityState !== 'hidden') {
          schedule();
        }
      }, intervalMs);
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        // Cancel pending timer when hidden
        if (timerId !== null) {
          clearTimeout(timerId);
          timerId = null;
        }
      } else {
        // Resume: Immediately restart timer after fetch
        doFetch().then(() => schedule());
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    // first fetch
    doFetch().then(() => {
      if (document.visibilityState !== 'hidden') {
        schedule();
      }
    });

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timerId !== null) clearTimeout(timerId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, fetcher]);

  return { workspaces, lastFetchAt, error };
}
