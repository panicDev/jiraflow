'use strict';

// SDLC step order (for funnel aggregation) — matches store.js SDLC_STEPS
const SDLC_STEPS = ['start', 'approach', 'impl', 'test', 'review', 'pr', 'done'];

/**
 * Assemble SDLC funnel and agent throughput based on worktree store snapshot.
 * Restrict scope to projectKey prefix of spaceId.
 *
 * @param {object} worktreeStore createStore() return value (supports getWorktreeActivityByTask)
 * @param {string} spaceId
 * @returns {{ sdlcFunnel: Array<{step,count}>, agentThroughput: Array<{taskId,toolCallCount,completedSteps}> }}
 */
function buildWorktreeMetrics(worktreeStore, spaceId) {
  if (!worktreeStore || typeof worktreeStore.getWorktreeActivityByTask !== 'function') {
    return { sdlcFunnel: [], agentThroughput: [] };
  }

  // spaceId format: "<site>::<projectKey>" — Filter by projectKey prefix
  const projectKey = spaceId.split('::')[1] || '';

  const allActivity = worktreeStore.getWorktreeActivityByTask();
  // Among the local worktrees, only those belonging to the project in this space (taskId prefix matching)
  const matched = projectKey
    ? allActivity.filter((a) => a.taskId && a.taskId.startsWith(projectKey + '-'))
    : allActivity;

  // SDLC Funnel: Number of taskIds included for each step in completedSteps
  const stepCounts = {};
  for (const step of SDLC_STEPS) stepCounts[step] = 0;
  for (const entry of matched) {
    for (const step of entry.completedSteps) {
      if (step in stepCounts) stepCounts[step]++;
    }
  }
  const sdlcFunnel = SDLC_STEPS.map((step) => ({ step, count: stepCounts[step] }));

  // Agent throughput (approximately based on recent activity)
  const agentThroughput = matched
    .filter((a) => a.toolCallCount > 0 || a.completedSteps.length > 0)
    .map((a) => ({ taskId: a.taskId, toolCallCount: a.toolCallCount, completedSteps: a.completedSteps }))
    .sort((a, b) => b.toolCallCount - a.toolCallCount);

  return { sdlcFunnel, agentThroughput };
}

/**
 * GET /metrics?space=<spaceId>&weeks=<n>
 *
 * Returns throughput JSON by status distribution, WIP, and week in the selected space.
 *
 * Response:
 * {
 *   spaceId: string,
 *   weeks: number,
 *   statusDistribution: Array<{ status, statusCategory, count }>,
 *   wip: number,
 *   throughput: Array<{ week, completed }>,
 *   leadTime: { median, p75, p95, distribution: Array<{ issueKey, days }> },
 *   cycleTime: { median, p75, p95, distribution: Array<{ issueKey, days }>, note: string },
 *   perAssignee: Array<{ assignee, completed, wip }>,
 *   agingWip: Array<{ issueKey, summary, assignee, created, ageDays }>,
 *   sdlcFunnel: Array<{ step, count }>,
 *   agentThroughput: Array<{ taskId, toolCallCount, completedSteps }>,
 *   priorityDistribution: Array<{ priority, count }>,
 *   epicProgress: Array<{ epic, total, done, pct }>,
 * }
 *
 * @param {object} metricsStore
 * @param {object} [logger]
 * @param {object} [worktreeStore] createStore() Return value
 * @returns {import('express').Router}
 */
function createMetricsRouter(metricsStore, logger, worktreeStore) {
  const express = require('express');
  const router = express.Router();

  router.get('/', (req, res) => {
    const spaceId = req.query.space;
    if (!spaceId || typeof spaceId !== 'string') {
      return res.status(400).json({ error: 'space query parameter required' });
    }

    const weeksRaw = parseInt(req.query.weeks, 10);
    const weeks = Number.isFinite(weeksRaw) && weeksRaw > 0 ? weeksRaw : 8;

    let statusDistribution, wip, throughput, leadTime, cycleTime, perAssignee, agingWip;
    let priorityDistribution, epicProgress;
    try {
      statusDistribution = metricsStore.getStatusDistribution(spaceId);
      wip = metricsStore.getWip(spaceId);
      throughput = metricsStore.getThroughput(spaceId, weeks);
      leadTime = metricsStore.getLeadTime(spaceId);
      cycleTime = metricsStore.getCycleTime(spaceId);
      perAssignee = metricsStore.getPerAssignee(spaceId, weeks);
      agingWip = metricsStore.getAgingWip(spaceId);
      priorityDistribution = metricsStore.getPriorityDistribution(spaceId);
      epicProgress = metricsStore.getEpicProgress(spaceId);
    } catch (err) {
      logger && logger.error('metrics-route.query-failed', { spaceId, error: err.message });
      return res.status(500).json({ error: 'metrics query failed' });
    }

    const { sdlcFunnel, agentThroughput } = buildWorktreeMetrics(worktreeStore, spaceId);

    res.json({
      spaceId, weeks,
      statusDistribution, wip, throughput, leadTime, cycleTime, perAssignee, agingWip,
      sdlcFunnel, agentThroughput,
      priorityDistribution, epicProgress,
    });
  });

  return router;
}

module.exports = { createMetricsRouter };
