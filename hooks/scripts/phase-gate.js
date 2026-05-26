#!/usr/bin/env node

/**
 * PreToolUse Hook: Phase gate for /jira-task workflow.
 *
 * Intercepts Skill tool calls to `jiraflow:jira-task-<phase>` and
 * blocks them when prerequisite phases or required artifacts are missing,
 * based on `phase-gate.config.json` (MAE-122).
 *
 * Fail-open: any unexpected error (missing context, broken config, parse
 * failure, etc.) results in exit 0 so the gate cannot break the hook chain.
 *
 * See docs/design/MAE-123.design.md for the full specification.
 */

const fs = require('fs');
const path = require('path');

const MAX_UPWARD_LEVELS = 6;
const SKILL_PATTERN = /^(?:jiraflow:)?jira-task-([a-z]+)$/;
const BYPASS_ENV_VAR = 'JIRA_PHASE_GATE_BYPASS';

function isEnvTruthy(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  const lower = trimmed.toLowerCase();
  if (lower === '0' || lower === 'false') return false;
  return true;
}

function isBypassed(env, context) {
  if (env && isEnvTruthy(env[BYPASS_ENV_VAR])) return 'env';
  if (context && context.bypassGate === true) return 'context';
  return null;
}

function readStdinSync() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractPhase(toolName, toolInput) {
  if (toolName !== 'Skill') return null;
  if (!toolInput || typeof toolInput !== 'object') return null;
  const skill = toolInput.skill;
  if (typeof skill !== 'string') return null;
  const m = skill.match(SKILL_PATTERN);
  return m ? m[1] : null;
}

function findContextFile(startDir) {
  let dir = startDir;
  for (let i = 0; i <= MAX_UPWARD_LEVELS; i++) {
    const candidate = path.join(dir, '.jira-context.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function loadConfig(scriptDir) {
  return loadJsonSafe(path.join(scriptDir, 'phase-gate.config.json'));
}

function validate(phase, config, context, contextDir) {
  const phases = config && config.phases;
  if (!phases || typeof phases !== 'object') {
    return { ok: true, reason: 'no-config' };
  }
  const rule = phases[phase];
  if (!rule) {
    return { ok: true, reason: 'phase-not-defined' };
  }
  if (rule.enforced === false) {
    return { ok: true, reason: 'phase-not-enforced' };
  }

  const completedSteps = Array.isArray(context.completedSteps)
    ? context.completedSteps
    : [];
  // MAE-357 migration: legacy plan+design completed counts as approach satisfied.
  const effectiveSteps = completedSteps.slice();
  if (
    completedSteps.includes('plan') &&
    completedSteps.includes('design') &&
    !effectiveSteps.includes('approach')
  ) {
    effectiveSteps.push('approach');
  }
  const requires = Array.isArray(rule.requires) ? rule.requires : [];
  const missingPhases = requires.filter((p) => !effectiveSteps.includes(p));
  if (missingPhases.length > 0) {
    return {
      ok: false,
      reason: 'missing-requires',
      requiredPhases: missingPhases,
      taskId: context.taskId,
    };
  }

  const taskId = typeof context.taskId === 'string' ? context.taskId : null;
  const artifacts = Array.isArray(rule.artifacts) ? rule.artifacts : [];
  if (artifacts.length > 0 && taskId) {
    const missingArtifacts = [];
    for (const a of artifacts) {
      if (!a || typeof a.fileGlob !== 'string') continue;
      const replaced = a.fileGlob.replace(/\{TASK_ID\}/g, taskId);
      const abs = path.resolve(contextDir, replaced);
      if (fs.existsSync(abs)) continue;
      // MAE-357 migration: accept legacy plan.md + design.md when approach.md missing.
      const isApproachDoc = /docs[\\/]approach[\\/].+\.approach\.md$/.test(replaced);
      if (isApproachDoc) {
        const planLegacy = path.resolve(contextDir, `docs/plan/${taskId}.plan.md`);
        const designLegacy = path.resolve(contextDir, `docs/design/${taskId}.design.md`);
        if (fs.existsSync(planLegacy) && fs.existsSync(designLegacy)) continue;
      }
      missingArtifacts.push(replaced);
    }
    if (missingArtifacts.length > 0) {
      return {
        ok: false,
        reason: 'missing-artifact',
        missingArtifacts,
        taskId,
      };
    }
  }

  return { ok: true };
}

function formatBlockMessage(phase, result) {
  const taskId = result.taskId || '<TASK-ID>';
  const lines = [];
  lines.push(`🚫 phase gate: Block entry to '${phase}' phase (${taskId})`);
  if (result.reason === 'missing-requires') {
    const missing = result.requiredPhases.join(', ');
    lines.push(`Required prerequisite: ${missing}`);
    const first = result.requiredPhases[0];
    lines.push(`Run first: /jira-task ${first} ${taskId}`);
  } else if (result.reason === 'missing-artifact') {
    lines.push(`Missing required output:`);
    for (const p of result.missingArtifacts) lines.push(`  - ${p}`);
    lines.push(`Execute the step first to generate the output.`);
  }
  lines.push(`Bypass (one-time): JIRA_PHASE_GATE_BYPASS=1`);
  lines.push(`Bypass (persistent): Add "bypassGate": true to .jira-context.json`);
  return lines.join('\n');
}

function emitDeny(message) {
  const payload = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: message,
    },
  };
  try {
    process.stdout.write(JSON.stringify(payload));
  } catch {
    // ignore — stderr + exit 2 still blocks
  }
  try {
    process.stderr.write(message + '\n');
  } catch {
    // ignore
  }
}

function main() {
  let payload;
  try {
    payload = readStdinSync();
  } catch {
    process.exit(0);
    return;
  }
  if (!payload) {
    process.exit(0);
    return;
  }

  const phase = extractPhase(payload.tool_name, payload.tool_input);
  if (!phase) {
    process.exit(0);
    return;
  }

  const contextPath = findContextFile(process.cwd());
  if (!contextPath) {
    process.exit(0);
    return;
  }
  const context = loadJsonSafe(contextPath);
  if (!context) {
    process.exit(0);
    return;
  }
  const contextDir = path.dirname(contextPath);

  const config = loadConfig(__dirname);
  if (!config) {
    process.exit(0);
    return;
  }

  let result;
  try {
    result = validate(phase, config, context, contextDir);
  } catch {
    process.exit(0);
    return;
  }

  if (result.ok) {
    process.exit(0);
    return;
  }

  const bypassChannel = isBypassed(process.env, context);
  if (bypassChannel) {
    const taskId = context.taskId || '<TASK-ID>';
    const detail = bypassChannel === 'env'
      ? `(${BYPASS_ENV_VAR} environment variable)`
      : `(.jira-context.json: bypassGate=true)`;
    const msg = `⚠️ phase gate bypassed (${bypassChannel}): Phase '${phase}' does not meet prerequisites but was bypassed ${detail} — ${taskId}`;
    try {
      process.stderr.write(msg + '\n');
    } catch {
      // ignore
    }
    process.exit(0);
    return;
  }

  emitDeny(formatBlockMessage(phase, result));
  process.exit(2);
}

if (require.main === module) {
  try {
    main();
  } catch {
    process.exit(0);
  }
}

module.exports = {
  extractPhase,
  findContextFile,
  loadConfig,
  validate,
  formatBlockMessage,
  isBypassed,
  isEnvTruthy,
};
