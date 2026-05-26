import { useEffect, useRef } from 'react';

/**
 * Subscribes to the backend SSE `/events` stream and dispatches actions
 * to the dashboard reducer.
 *
 * EventSource does not support
 in some environments (particularly macOS Safari/Chrome sleep, wake after sleep). * Automatic reconnection sometimes stops. Compensate with explicit close → backoff reconnection.
 *
 * @param {React.Dispatch<any>} dispatch
 */
export function useDashboardStream(dispatch) {
  const everConnected = useRef(false);

  useEffect(() => {
    let es = null;
    let retryTimer = null;
    let visibilityHandler = null;
    let backoffMs = 500;
    const BACKOFF_MAX = 8000;
    let unmounted = false;

    function scheduleReconnect() {
      if (unmounted) return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connect();
      }, backoffMs);
      backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX);
    }

    function connect() {
      if (unmounted) return;
      if (es) {
        try { es.close(); } catch {}
        es = null;
      }
      es = new EventSource('/events');

      es.addEventListener('snapshot', (e) => {
        try {
          const data = JSON.parse(e.data);
          everConnected.current = true;
          backoffMs = 500; // Reset backoff on success
          dispatch({
            type: 'SNAPSHOT',
            worktrees: data.worktrees ?? [],
            sessions: data.sessions ?? [],
            lastTickAt: data.lastTickAt ?? null,
            tickMs: data.tickMs ?? null,
            serverNowMs: data.serverNowMs ?? null,
          });
          dispatch({ type: 'LIVE_EVENT', at: Date.now() });
        } catch {
          console.warn('[useDashboardStream] failed to parse snapshot event');
        }
      });

      es.addEventListener('jira-collector.tick', (e) => {
        try {
          const data = JSON.parse(e.data);
          dispatch({
            type: 'JIRA_TICK',
            at: data.at,
            tickMs: data.tickMs,
            serverNowMs: data.at, // The tick event is immediately after the server is issued, so it is approximated as at == serverNow
          });
        } catch {}
      });

      es.addEventListener('worktree.added', (e) => {
        try {
          const data = JSON.parse(e.data);
          dispatch({ type: 'WORKTREE_ADDED', path: data.path, state: data.state });
          dispatch({ type: 'LIVE_EVENT', at: Date.now() });
        } catch {}
      });

      es.addEventListener('worktree.changed', (e) => {
        try {
          const data = JSON.parse(e.data);
          dispatch({ type: 'WORKTREE_CHANGED', path: data.path, state: data.state });
          dispatch({ type: 'LIVE_EVENT', at: Date.now() });
        } catch {}
      });

      es.addEventListener('worktree.removed', (e) => {
        try {
          const data = JSON.parse(e.data);
          dispatch({ type: 'WORKTREE_REMOVED', path: data.path });
          dispatch({ type: 'LIVE_EVENT', at: Date.now() });
        } catch {}
      });

      es.addEventListener('session.added', (e) => {
        try {
          const data = JSON.parse(e.data);
          dispatch({ type: 'SESSION_ADDED', sessionId: data.sessionId, state: data.state });
          dispatch({ type: 'LIVE_EVENT', at: Date.now() });
        } catch {}
      });

      es.addEventListener('session.changed', (e) => {
        try {
          const data = JSON.parse(e.data);
          dispatch({ type: 'SESSION_CHANGED', sessionId: data.sessionId, state: data.state });
          dispatch({ type: 'LIVE_EVENT', at: Date.now() });
        } catch {}
      });

      es.addEventListener('session.removed', (e) => {
        try {
          const data = JSON.parse(e.data);
          dispatch({ type: 'SESSION_REMOVED', sessionId: data.sessionId });
          dispatch({ type: 'LIVE_EVENT', at: Date.now() });
        } catch {}
      });

      es.onerror = () => {
        if (everConnected.current) {
          dispatch({ type: 'CONNECTION_LOST' });
        } else {
          dispatch({ type: 'CONNECTION_FAILED_INITIAL' });
        }
        // Explicitly close and retry the EventSource without trusting its default reconnection.
        try { es?.close(); } catch {}
        es = null;
        scheduleReconnect();
      };
    }

    // If the tab is visible again, check the connection status and try to reconnect immediately.
    visibilityHandler = () => {
      if (document.visibilityState === 'visible' && (!es || es.readyState === 2)) {
        backoffMs = 500;
        connect();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    connect();

    return () => {
      unmounted = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      if (es) {
        try { es.close(); } catch {}
      }
    };
  }, [dispatch]);
}
