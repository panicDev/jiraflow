'use strict';

const DEFAULT_STALE_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_TICK_MS = 60 * 1000;       // check every 1 minute
const DEFAULT_BACKOFF_MS = 100;
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetch a single Jira issue via REST API.
 *
 * @param {{ jiraUrl: string, email: string, apiToken: string }} creds
 * @param {string} key  Issue key, e.g. "MAE-123"
 * @returns {Promise<object>}  Jira issue object
 * @throws  On non-2xx response (includes status in error)
 */
/**
 * Extract link information to display on the card from Jira issuelinks/parent response.
 * Current Phase 1: Parsing only Blocks type (blocks/blockedBy bidirectional). parent is a separate field.
 *
 * @param {object} fields
 * @returns {{ blocks: Array<{key:string,status:string|null,statusCategory:string|null,summary:string|null}>,
 *            blockedBy: Array<{key:string,status:string|null,statusCategory:string|null,summary:string|null}> }}
 */
function extractLinks(fields) {
  const out = { blocks: [], blockedBy: [] };
  if (!fields || !Array.isArray(fields.issuelinks)) return out;
  for (const link of fields.issuelinks) {
    const typeName = link?.type?.name || '';
    if (typeName !== 'Blocks') continue; // Phase 1: Blocks only
    // Jira API: outwardIssue is "the issue in the outward direction from the current issue".
    // In the Blocks type, outward label = "blocks", so outwardIssue is currently
    // blocks the issue → current issue is blocked by that issue → blockedBy.
    if (link.outwardIssue) {
      out.blockedBy.push(linkSummary(link.outwardIssue));
    }
    // Conversely, inwardIssue is what the current issue blocks → blocks.
    if (link.inwardIssue) {
      out.blocks.push(linkSummary(link.inwardIssue));
    }
  }
  return out;
}

function linkSummary(issue) {
  return {
    key: issue.key,
    summary: issue.fields?.summary ?? null,
    status: issue.fields?.status?.name ?? null,
    statusCategory: issue.fields?.status?.statusCategory?.key ?? null, // 'done'|'indeterminate'|'new'
  };
}

function extractParent(fields) {
  const parent = fields?.parent;
  if (!parent || !parent.key) return null;
  return {
    key: parent.key,
    summary: parent.fields?.summary ?? null,
    status: parent.fields?.status?.name ?? null,
    statusCategory: parent.fields?.status?.statusCategory?.key ?? null,
  };
}

function isEpic(issuetype) {
  const name = issuetype?.name;
  return name === 'Epic' || name === 'Epic';
}

/**
 * Extract epic key from Jira issue response.
 * Policy (MAE-256): If the parent of Story/Task ('Task' hierarchyLevel 0) is Epic, return its key.
 * Subtask returns null because the grandparent is not expanded in the response —
 in selector (MAE-261) * Solved with parent join between worktrees.
 *
 * @param {object|null|undefined} fields fields object from Jira issue response
 * @returns {string|null} epic issue key (e.g. "MAE-249") or null
 */
function extractEpic(fields) {
  if (!fields) return null;
  if (isEpic(fields.issuetype)) return null;
  const parent = fields.parent;
  if (parent && isEpic(parent.fields?.issuetype)) {
    return parent.key ?? null;
  }
  return null;
}

async function fetchIssue(creds, key) {
  const url = `${creds.jiraUrl.replace(/\/$/, '')}/rest/api/3/issue/${encodeURIComponent(key)}` +
    '?fields=summary,status,priority,assignee,issuetype,description,issuelinks,parent';

  const auth = Buffer.from(`${creds.email}:${creds.apiToken}`).toString('base64');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const err = new Error(`Jira REST ${response.status} for ${key}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

/**
 * Sleep helper.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start the Jira stale-refresh collector.
 *
 * @param {object} store
 * @param {{
 *   staleMs?: number, tickMs?: number, backoffMs?: number, logger?: object,
 *   getCredentials: Function,
 *   getCredentialsForWorkspace?: (workspaceRoot: string) => object,
 *   onTick?: Function
 * }} opts
 *
 * `getCredentialsForWorkspace` (optional): called with each entry's workspaceRoot.
 *   If provided, per-workspace credential loading is used (AC-5).
 *   Entries whose credentials fail with CredentialsNotFoundError are skipped and
 *   their `credsStatus` is set to 'missing' in the store.
 *   Falls back to `getCredentials` (global) when workspaceRoot is absent.
 *
 * @returns {{ stop(): void }}
 */
function startJiraCollector(store, opts) {
  const {
    staleMs = DEFAULT_STALE_MS,
    tickMs = DEFAULT_TICK_MS,
    backoffMs = DEFAULT_BACKOFF_MS,
    logger = null,
    getCredentials,
    getCredentialsForWorkspace = null,
    onTick = null,
  } = opts;

  // per-workspace credentials status cache (runtime only, D-6)
  // Map<workspaceRoot, 'ok' | 'missing'>
  const credsStatusByRoot = new Map();

  let stopped = false;
  let tickTimer = null;

  /**
   * Resolve credentials for a stale entry.
   * Returns { creds } on success, or { skip: true } when creds are missing.
   *
   * Also upserts credsStatus into the store for each worktree of the workspace.
   */
  function resolveCredsForEntry(entry) {
    if (!getCredentialsForWorkspace || !entry.workspaceRoot) {
      // Fall back to global credentials
      try {
        return { creds: getCredentials() };
      } catch (err) {
        return { skip: true, err };
      }
    }

    const root = entry.workspaceRoot;
    // Skip immediately if we already know this workspace is missing creds
    if (credsStatusByRoot.get(root) === 'missing') {
      return { skip: true };
    }

    try {
      const creds = getCredentialsForWorkspace(root);
      if (credsStatusByRoot.get(root) !== 'ok') {
        credsStatusByRoot.set(root, 'ok');
        store.upsertWorktree({ path: entry.path, credsStatus: 'ok' });
      }
      return { creds };
    } catch (err) {
      const { CredentialsNotFoundError } = require('../credentials');
      if (err instanceof CredentialsNotFoundError) {
        if (credsStatusByRoot.get(root) !== 'missing') {
          credsStatusByRoot.set(root, 'missing');
          logger && logger.warn('jira-collector.creds-missing', { workspaceRoot: root });
        }
        store.upsertWorktree({ path: entry.path, credsStatus: 'missing' });
        return { skip: true };
      }
      // Unexpected error — log and skip this entry
      logger && logger.error('jira-collector.credentials-error', { workspaceRoot: root, error: err.message });
      return { skip: true, err };
    }
  }

  async function runCycle() {
    if (stopped) return;
    if (typeof onTick === 'function') {
      try { onTick({ at: Date.now(), tickMs }); } catch {}
    }

    const stale = store.getStaleEntries(staleMs);
    if (stale.length === 0) return;

    // Reset per-cycle 'missing' cache so we re-check on each tick
    // (user may have added credentials since last cycle)
    credsStatusByRoot.clear();

    for (const entry of stale) {
      if (stopped) break;
      if (!entry.taskId) continue;

      const { creds, skip } = resolveCredsForEntry(entry);
      if (skip) continue;

      const entryLog = logger && typeof logger.child === 'function' && entry.workspaceRoot
        ? logger.child({ workspace: entry.workspaceRoot })
        : logger;

      try {
        const issue = await fetchIssue(creds, entry.taskId);
        store.updateCachedIssue(entry.path, {
          key: issue.key,
          summary: issue.fields && issue.fields.summary,
          status: issue.fields && issue.fields.status && issue.fields.status.name,
          priority: issue.fields && issue.fields.priority && issue.fields.priority.name,
          assignee: issue.fields && issue.fields.assignee
            ? (issue.fields.assignee.displayName || issue.fields.assignee.emailAddress)
            : 'Unassigned',
          issuetype: issue.fields && issue.fields.issuetype && issue.fields.issuetype.name,
          links: extractLinks(issue.fields),
          parent: extractParent(issue.fields),
          epic: extractEpic(issue.fields),
          fetchedAt: new Date().toISOString(),
        });
        entryLog && entryLog.info('jira-collector.refreshed', { path: entry.path, key: entry.taskId });
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          // Auth failure — abort this cycle entirely
          entryLog && entryLog.error('jira-collector.auth-error', { key: entry.taskId, status: err.status });
          return;
        }
        if (err.status === 429) {
          // Rate limit — abort this cycle, next tick will retry
          entryLog && entryLog.error('jira-collector.rate-limited', { key: entry.taskId });
          return;
        }
        // 5xx / timeout / network — skip this entry, continue
        entryLog && entryLog.warn('jira-collector.fetch-error', { key: entry.taskId, error: err.message });
      }

      // Sequential backoff between requests
      await sleep(backoffMs);
    }
  }

  function scheduleTick() {
    tickTimer = setTimeout(async () => {
      try {
        await runCycle();
      } catch (err) {
        logger && logger.error('jira-collector.cycle-error', { error: err.message });
      }
      if (!stopped) scheduleTick();
    }, tickMs);
    if (tickTimer.unref) tickTimer.unref();
  }

  // Run an initial cycle immediately to fill cold-start entries.
  // Subsequent cycles are scheduled by scheduleTick() at every `tickMs` interval.
  (async () => {
    try {
      await runCycle();
    } catch (err) {
      logger && logger.error('jira-collector.cycle-error', { error: err.message });
    }
    if (!stopped) scheduleTick();
  })();

  return {
    stop() {
      stopped = true;
      clearTimeout(tickTimer);
    },
  };
}

module.exports = { startJiraCollector, fetchIssue, extractEpic, extractParent, extractLinks };
