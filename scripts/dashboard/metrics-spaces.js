'use strict';

/**
 * metrics-spaces.js
 *
 * Derive/dedupe a (site, projectKey) pair from the registered workspace registry.
 *
 * Rule:
 * - Derive projectKey: JIRA_DEFAULT_PROJECT env → If not, from workspace path
 * Issue key prefix inference (TODO file scan based, env fallback first)
 * - Whether credentials can be interpreted is indicated with the credsOk flag
 * - (site, projectKey) dedupe: duplicates keep only first entry
 */

const path = require('node:path');
const fs = require('node:fs');
const { resolveCredentials } = require('./credentials');

/**
 * Infer the Jira project key from the workspace path.
 * 1. .jira-context.json context prefix (single taskId/parent + aggregate tasks[]/epic)
 * 2. JIRA_DEFAULT_PROJECT environment variable (fallback)
 * 3. null (inference failure)
 *
 * You must set env as a fallback so that multi-workspaces (MAE/ATL) are interpreted as individual keys.
 * If env is ranked 1st, all workspaces are lumped into one key.
 *
 * @param {string} workspacePath
 * @returns {string|null}
 */
function inferProjectKey(workspacePath) {
  // 1. Project key prefix
  try {
    const ctxFile = path.join(workspacePath, '.jira-context.json');
    if (fs.existsSync(ctxFile)) {
      const ctx = JSON.parse(fs.readFileSync(ctxFile, 'utf8'));
      const candidates = [ctx.taskId, ctx.parent, ctx.epic];
      if (Array.isArray(ctx.tasks)) {
        for (const t of ctx.tasks) candidates.push(t.taskId, t.parent);
      }
      for (const c of candidates) {
        if (typeof c === 'string') {
          const match = c.match(/^([A-Z][A-Z0-9]*)-\d+$/);
          if (match) return match[1];
        }
      }
    }
  } catch {
    // Inference from .jira-context.json failed — fallback to env
  }

  // 2. Fallback to environment variables
  if (process.env.JIRA_DEFAULT_PROJECT) {
    return process.env.JIRA_DEFAULT_PROJECT.trim().toUpperCase();
  }

  return null;
}

/**
 * Derive a (site, projectKey) pair from the registered workspace list.
 *
 * credential·site is interpreted as the entire chain (env → local .mcp.json →
 * ~/.claude.json → settings) for each workspace. Projects that use local .mcp.json and
 * Even if projects using home global settings are mixed, they are interpreted individually.
 *
 * @param {object} workspacesModule workspaces.js module (DI capable — testing support)
 * @param {{ logger?: object, site?: string, resolveCreds?: (path:string)=>object|null }} [opts]
 * resolveCreds: credential resolver injection (test determinism). The default is resolveCredentials.
 * site: Fallback site when analysis fails for each workspace.
 * @returns {Array<{
 *   id: string,
 *   site: string,
 *   projectKey: string,
 *   credsOk: boolean,
 *   workspacePath: string,
 * }>}
 */
function discoverSpaces(workspacesModule, opts = {}) {
  const logger = opts.logger || null;
  const resolveCreds = opts.resolveCreds || ((wsPath) => {
    try { return resolveCredentials({ workspaceRoot: wsPath }); } catch { return null; }
  });
  const fallbackSite = (opts.site || process.env.JIRA_URL || '').replace(/\/$/, '');

  let entries;
  try {
    const { workspaces } = workspacesModule.loadAndPrune({ logger });
    entries = workspaces;
  } catch (err) {
    logger && logger.warn('metrics-spaces.loadAndPrune-failed', { error: err.message });
    return [];
  }

  const seen = new Set(); // (site::projectKey) dedupe
  const spaces = [];

  for (const entry of entries) {
    const workspacePath = entry.path;

    const projectKey = inferProjectKey(workspacePath);
    if (!projectKey) {
      // Do not register uninterpreted spaces — prevent SPACE selector contamination
      logger && logger.warn('metrics-spaces.no-project-key', { path: workspacePath });
      continue;
    }

    const creds = resolveCreds(workspacePath);
    const credsOk = !!creds;
    const site = ((creds && creds.jiraUrl) || fallbackSite || '').replace(/\/$/, '') || 'unknown';

    const dedupeKey = `${site}::${projectKey}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    spaces.push({
      id: dedupeKey,
      site,
      projectKey,
      credsOk,
      workspacePath,
    });
  }

  return spaces;
}

module.exports = { discoverSpaces, inferProjectKey };
