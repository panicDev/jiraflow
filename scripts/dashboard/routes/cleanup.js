'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Express Router: git worktree + branch cleanup of completed worktree.
 *
 * POST /cleanup
 *   body: { path: "<worktree absolute path>" }
 *   → 200: { ok: true, removed: { worktree: true, branch: true|false } }
 *   → 400: { error: 'reason' }
 *
 * Safety device:
 * - The path must be a path registered in the store (blocks arbitrary paths).
 * - Only allowed when cachedIssue.status is "Complete" / "Done".
 * - Reject if dirty working tree (git status --porcelain result should be empty).
 * - The branch name is taken from the store's worktree.branch field (not from the request body).
 * - Use shell X, separate arguments with spawnSync (prevent injection).
 *
 * @param {object} store
 * @param {object} [logger]
 * @param {string} repoRoot - Main repo path to run git commands on
 * @returns {import('express').Router}
 */
function createCleanupRouter(store, logger, repoRoot) {
  const express = require('express');
  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));

  router.post('/', (req, res) => {
    const wtPath = req.body?.path;
    if (typeof wtPath !== 'string' || !wtPath) {
      return res.status(400).json({ error: 'path required' });
    }

    // Only worktrees registered in the store are allowed.
    const snapshot = store.getSnapshot();
    const entry = snapshot.find((w) => w.path === wtPath);
    if (!entry) {
      logger && logger.warn('cleanup.unknown-path', { path: wtPath });
      return res.status(400).json({ error: 'unknown worktree path' });
    }

    // After confirming the entry, derive the workspace child logger
    const log = logger && typeof logger.child === 'function' && entry.workspaceRoot
      ? logger.child({ workspace: entry.workspaceRoot })
      : logger;

    // Only allow completed status.
    const status = entry.cachedIssue?.status ?? entry.status ?? null;
    const doneStatuses = new Set(['Done', 'Done', 'done']);
    if (!doneStatuses.has(status)) {
      log && log.warn('cleanup.not-done', { path: wtPath, status });
      return res.status(400).json({ error: 'worktree not in done state', status });
    }

    // Dirty check. If the .git link in the worktree is broken, git status will fail,
    // In that case, it is considered a "stale worktree" and skips the dirty check and goes to the fallback path
    // Enter (case where only the admin record remains and the working directory is in an abnormal state).
    let staleWorktree = false;
    const dirtyCheck = spawnSync('git', ['status', '--porcelain'], {
      cwd: wtPath,
      encoding: 'utf8',
      timeout: 10_000,
    });
    if (dirtyCheck.status !== 0) {
      staleWorktree = true;
      log && log.warn('cleanup.git-status-failed-stale', { path: wtPath, stderr: dirtyCheck.stderr });
    } else if (dirtyCheck.stdout.trim().length > 0) {
      return res.status(400).json({ error: 'worktree has uncommitted changes' });
    }

    const branch = entry.branch ?? null;

    // 1st step: git worktree remove --force (--force also handles some cases of dirty/missing .git).
    const wtRemove = spawnSync('git', ['worktree', 'remove', '--force', wtPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 15_000,
    });

    let removalMode = 'git';
    if (wtRemove.status !== 0) {
      // Secondary fallback: Case where the directory remains or the admin record is stale.
      // Even if there are Windows reserved name files (nul, con, etc.), they are cleaned up with walk-based deletion.
      log && log.warn('cleanup.worktree-remove-failed-falling-back', {
        path: wtPath,
        stderr: wtRemove.stderr?.slice(0, 200),
      });
      try {
        if (fs.existsSync(wtPath)) {
          fs.rmSync(wtPath, { recursive: true, force: true, maxRetries: 3 });
        }
        const prune = spawnSync('git', ['worktree', 'prune'], {
          cwd: repoRoot,
          encoding: 'utf8',
          timeout: 10_000,
        });
        if (prune.status !== 0) {
          log && log.error('cleanup.prune-failed', { stderr: prune.stderr });
          return res.status(500).json({
            error: 'git worktree prune failed',
            detail: prune.stderr?.slice(0, 200),
          });
        }
        removalMode = 'fallback';
      } catch (err) {
        log && log.error('cleanup.fallback-rm-failed', { path: wtPath, err: err.message });
        return res.status(500).json({
          error: 'worktree directory removal failed',
          detail: err.message,
        });
      }
    }
    log && log.info('cleanup.worktree-removed', { path: wtPath, mode: removalMode, stale: staleWorktree });

    // Delete the branch (best-effort — even if it fails, the worktree has already been removed).
    let branchRemoved = false;
    if (branch && /^[a-zA-Z0-9_/.-]+$/.test(branch)) {
      const brRemove = spawnSync('git', ['branch', '-d', branch], {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: 10_000,
      });
      if (brRemove.status === 0) {
        branchRemoved = true;
        log && log.info('cleanup.branch-removed', { branch });
      } else {
        log && log.warn('cleanup.branch-remove-failed', { branch, stderr: brRemove.stderr?.slice(0, 200) });
      }
    }

    // Remove from store immediately (the worktree collector will remove it anyway in the next poll, but
    // Call explicitly to broadcast immediately).
    store.removeWorktree(wtPath);

    return res.json({
      ok: true,
      removed: { worktree: true, branch: branchRemoved },
      branch,
    });
  });

  return router;
}

module.exports = { createCleanupRouter };
