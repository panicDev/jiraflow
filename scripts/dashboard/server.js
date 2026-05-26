'use strict';

const path = require('node:path');
const http = require('node:http');

const { createStore, startSessionSweep } = require('./store');
const { createLogger } = require('./logger');
const { loadCredentials } = require('./credentials');
const { startWorktreeCollector } = require('./collectors/worktree');
const { startJiraCollector } = require('./collectors/jira');
const { startMetricsCollector } = require('./collectors/jira-metrics');
const { createIngestRouter } = require('./routes/ingest');
const { createCleanupRouter } = require('./routes/cleanup');
const { createWorkspacesRouter } = require('./routes/workspaces');
const { createSpacesRouter } = require('./routes/spaces');
const { createMetricsRouter } = require('./routes/metrics');
const { openBrowser } = require('./openBrowser');
const workspaces = require('./workspaces');
const { createMetricsStore } = require('./metrics-store');
const { discoverSpaces } = require('./metrics-spaces');

const DEFAULT_PORT = 8765;

let cachedPluginVersion = null;
function getPluginVersion() {
  if (cachedPluginVersion !== null) return cachedPluginVersion;
  try {
    const pkg = require('../../.claude-plugin/plugin.json');
    cachedPluginVersion = pkg.version || '';
  } catch {
    cachedPluginVersion = '';
  }
  return cachedPluginVersion;
}

/**
 * Start the dashboard backend server.
 *
 * @param {{ port?: number, workspaceRoot?: string, openBrowser?: boolean }} [opts]
 * @returns {Promise<{ stop(): Promise<void> }>}
 */
async function startServer(opts = {}) {
  const port = opts.port ?? DEFAULT_PORT;
  const shouldOpenBrowser = opts.openBrowser ?? true;

  // -----------------------------------------------------------------------
  // Resolve workspace roots
  // -----------------------------------------------------------------------
  // AC6: if caller explicitly passes workspaceRoot, use it as-is (ad-hoc mode,
  //      registry is ignored — backward compatible).
  // Otherwise: load registry, auto-register cwd if empty.
  let workspaceRoots;
  if (opts.workspaceRoot) {
    workspaceRoots = [opts.workspaceRoot];
  } else {
    // The project cwd that started the dashboard is always registered (idempotent — if it already exists,
    // Only updates lastSeenAt). That way, even if you turn on the dashboard in another repo, the
    // Worktree is included in the collector target.
    workspaces.register(process.cwd());
    const { workspaces: registered } = workspaces.loadAndPrune();
    workspaceRoots = registered.map((e) => e.path);
  }

  // The "primary" workspace is used for credentials, log file location, and
  // the cleanup router (these are single-workspace concerns).
  // The dashboard command is always executed in the cwd of the parent workspace, so use cwd first.
  // workspaceRoots[0] may be a stale worktree depending on the registry registration order.
  const workspaceRoot = opts.workspaceRoot ?? process.cwd();
  const logFile = path.join(workspaceRoot, 'logs', 'dashboard-server.log');

  const logger = createLogger(logFile);

  // Validate credentials early — throw CredentialsNotFoundError if missing.
  const creds = loadCredentials({ workspaceRoot });
  logger.info('server.credentials-loaded', { source: creds.source });

  const store = createStore();

  // Metrics store (SQLite + JSON fallback)
  const metricsStore = createMetricsStore();

  // Wire up SSE broadcasts from store events.
  /** @type {Set<import('node:http').ServerResponse>} */
  const clients = new Set();

  function broadcast(eventName, data) {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
      try {
        res.write(payload);
      } catch {
        clients.delete(res);
      }
    }
  }

  store.on('worktree.added', ({ path: wPath, state }) => {
    logger.info('store.worktree-added', { path: wPath });
    broadcast('worktree.added', { path: wPath, state, ts: new Date().toISOString() });
  });
  store.on('worktree.changed', ({ path: wPath, state }) => {
    broadcast('worktree.changed', { path: wPath, state, ts: new Date().toISOString() });
  });
  store.on('worktree.removed', ({ path: wPath }) => {
    logger.info('store.worktree-removed', { path: wPath });
    broadcast('worktree.removed', { path: wPath, ts: new Date().toISOString() });
  });

  store.on('session.added', ({ sessionId, state }) => {
    logger.info('store.session-added', { sessionId });
    broadcast('session.added', { sessionId, state, ts: new Date().toISOString() });
  });
  store.on('session.changed', ({ sessionId, state }) => {
    broadcast('session.changed', { sessionId, state, ts: new Date().toISOString() });
  });
  store.on('session.removed', ({ sessionId }) => {
    logger.info('store.session-removed', { sessionId });
    broadcast('session.removed', { sessionId, ts: new Date().toISOString() });
  });

  // jira-collector tick state — declared early so the /workspaces route can
  // capture it via getter closure before the collector is started below.
  let lastTickAt = null;
  let lastTickMs = null;

  // Create minimal HTTP server (avoids Express dependency at import time for tests,
  // but in production we use express if available, falling back to node:http).
  let app;
  try {
    const express = require('express');
    app = express();
    app.get('/events', handleSSE);
    app.get('/health', (_req, res) => res.json({ ok: true, version: getPluginVersion() }));
    app.use('/ingest', createIngestRouter(store, logger, workspaces));
    app.use('/cleanup', createCleanupRouter(store, logger, workspaceRoot));
    app.use('/workspaces', createWorkspacesRouter(store, logger, {
      getLastTickAt: () => lastTickAt,
      pluginRoot: process.env.CLAUDE_PLUGIN_ROOT || null,
    }));
    app.use('/spaces', createSpacesRouter(metricsStore, logger));
    app.use('/metrics', createMetricsRouter(metricsStore, logger, store));
    app.use(express.static(path.join(__dirname, 'public')));
  } catch {
    // express not available — use raw http (minimal, for environments without npm install)
    app = null;
  }

  function handleSSE(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders && res.flushHeaders();

    clients.add(res);
    logger.info('sse.client-connected', { total: clients.size });

    // Send initial snapshot — New clients immediately enter the polling cycle phase
    // Include lastTickAt/tickMs/serverNowMs to match.
    const snapshot = store.getSnapshot();
    const sessions = store.getSessionsSnapshot();
    res.write(`event: snapshot\ndata: ${JSON.stringify({
      worktrees: snapshot,
      sessions,
      ts: new Date().toISOString(),
      lastTickAt,
      tickMs: lastTickMs,
      serverNowMs: Date.now(),
    })}\n\n`);

    req.on('close', () => {
      clients.delete(res);
      logger.info('sse.client-disconnected', { total: clients.size });
    });
  }

  const httpServer = app
    ? http.createServer(app)
    : http.createServer((req, res) => {
        if (req.url === '/events') return handleSSE(req, res);
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, version: getPluginVersion() }));
          return;
        }
        res.writeHead(404);
        res.end();
      });

  // Start collectors
  const worktreeCollector = startWorktreeCollector(store, { workspaceRoots, logger });

  // Session entry TTL sweep — removes zombie session cards when SessionEnd is
  // missed (Ctrl+C, kill, crash). 30s tick, 5min TTL.
  const sessionSweep = startSessionSweep(store, { logger });

  // D-5: on new workspace registration, immediately re-collect worktrees so the
  // same ingest response can already see the new workspace's worktrees.
  workspaces.events.on('workspace.registered', ({ path: newRoot }) => {
    try {
      const { collectWorktrees } = require('./collectors/worktree');
      // Extend workspaceRoots in-place so future polls also cover the new root.
      if (!workspaceRoots.includes(newRoot)) workspaceRoots.push(newRoot);
      collectWorktrees(store, workspaceRoots, logger);
      logger && logger.info('server.workspace-registered-collect', { newRoot });
    } catch (err) {
      logger && logger.error('server.workspace-registered-collect-error', { newRoot, error: err.message });
    }
  });

  // Mirror: drop a removed workspace from the in-memory roots so the collector
  // stops polling it and stale worktrees disappear on the next tick.
  workspaces.events.on('workspace.unregistered', ({ path: oldRoot }) => {
    const idx = workspaceRoots.indexOf(oldRoot);
    if (idx >= 0) workspaceRoots.splice(idx, 1);
    logger && logger.info('server.workspace-unregistered', { oldRoot });
  });

  // Watch the registry file so external mutations (register-workspace.js from
  // another process, manual JSON edits) are picked up without a restart.
  workspaces.startWatcher({ logger });
  // Last jira-collector tick time/period — include it in snapshot event
  // Allows new SSE clients to immediately enter the polling cycle phase.
  // (lastTickAt/lastTickMs declared just before upper express setup — captured in /workspaces route)
  const jiraCollector = startJiraCollector(store, {
    logger,
    getCredentials: () => loadCredentials({ workspaceRoot }),
    getCredentialsForWorkspace: (root) => loadCredentials({ workspaceRoot: root, force: true }),
    onTick: ({ at, tickMs }) => {
      lastTickAt = at;
      lastTickMs = tickMs;
      broadcast('jira-collector.tick', { at, tickMs });
    },
  });

  // Discover spaces and seed metrics store, then start periodic metrics collection
  try {
    const spaces = discoverSpaces(workspaces, { logger, site: creds.jiraUrl });
    metricsStore.replaceSpaces(spaces);
    logger.info('server.metrics-spaces-discovered', { count: spaces.length });
  } catch (err) {
    logger.warn('server.metrics-spaces-error', { error: err.message });
  }

  const metricsCollector = startMetricsCollector(metricsStore, {
    getSpaces: () => metricsStore.listSpaces(),
    getCredentials: () => loadCredentials({ workspaceRoot }),
    logger,
  });

  await new Promise((resolve, reject) => {
    httpServer.listen(port, '127.0.0.1', () => {
      logger.info('server.started', { port, workspaceRoots });
      console.log(`[dashboard] server listening on http://127.0.0.1:${port}`);
      console.log(`[dashboard] log file: ${logFile}`);
      if (shouldOpenBrowser) {
        openBrowser(`http://127.0.0.1:${port}`, { logger });
      }
      resolve();
    });
    httpServer.once('error', reject);
  });

  return {
    async stop() {
      worktreeCollector.stop();
      jiraCollector.stop();
      metricsCollector.stop();
      sessionSweep.stop();
      workspaces.stopWatcher();
      try { metricsStore.close(); } catch { /* ignore */ }
      await new Promise((resolve) => httpServer.close(resolve));
      await logger.close();
    },
  };
}

// CLI entry point
if (require.main === module) {
  startServer().catch((err) => {
    console.error('[dashboard] startup error:', err.message);
    process.exit(1);
  });
}

module.exports = { startServer };
