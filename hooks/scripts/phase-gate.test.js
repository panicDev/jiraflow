const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  isBypassed,
  isEnvTruthy,
  validate,
  formatBlockMessage,
  extractPhase,
} = require('./phase-gate.js');

// ─── isBypassed ──────────────────────────────────────────────────────────

test('U1: env not set, context normal → null', () => {
  assert.equal(isBypassed({}, { completedSteps: [] }), null);
});

test('U2: env="1" → "env"', () => {
  assert.equal(isBypassed({ JIRA_PHASE_GATE_BYPASS: '1' }, {}), 'env');
});

test('U3: env="" (empty string) → null', () => {
  assert.equal(isBypassed({ JIRA_PHASE_GATE_BYPASS: '' }, {}), null);
});

test('U4: env="0" → null', () => {
  assert.equal(isBypassed({ JIRA_PHASE_GATE_BYPASS: '0' }, {}), null);
});

test('U5: env="FALSE" (case-insensitive) → null', () => {
  assert.equal(isBypassed({ JIRA_PHASE_GATE_BYPASS: 'FALSE' }, {}), null);
  assert.equal(isBypassed({ JIRA_PHASE_GATE_BYPASS: 'false' }, {}), null);
});

test('U6: env=empty string " " → null', () => {
  assert.equal(isBypassed({ JIRA_PHASE_GATE_BYPASS: '  ' }, {}), null);
});

test('U7: context.bypassGate === true → "context"', () => {
  assert.equal(isBypassed({}, { bypassGate: true }), 'context');
});

test('U8: context.bypassGate === false → null', () => {
  assert.equal(isBypassed({}, { bypassGate: false }), null);
});

test('U9: context.bypassGate === "true" (string) → null', () => {
  assert.equal(isBypassed({}, { bypassGate: 'true' }), null);
});

test('U10: both active — env first', () => {
  assert.equal(
    isBypassed({ JIRA_PHASE_GATE_BYPASS: '1' }, { bypassGate: true }),
    'env'
  );
});

test('U11: env="yes" (arbitrary truthy) → "env"', () => {
  assert.equal(isBypassed({ JIRA_PHASE_GATE_BYPASS: 'yes' }, {}), 'env');
});

test('isEnvTruthy: non-string → false', () => {
  assert.equal(isEnvTruthy(undefined), false);
  assert.equal(isEnvTruthy(null), false);
  assert.equal(isEnvTruthy(1), false);
});

// ─── validate (regression) ───────────────────────────────────────────────

const baseConfig = {
  phases: {
    discover: { requires: [], enforced: false },
    approach: {
      requires: ['start'],
      artifacts: [{ fileGlob: 'docs/approach/{TASK_ID}.approach.md' }],
      enforced: true,
    },
    impl: {
      requires: ['approach'],
      artifacts: [{ fileGlob: 'docs/approach/{TASK_ID}.approach.md' }],
      enforced: true,
    },
  },
};

test('V1: enforced=false phase → ok', () => {
  const r = validate('discover', baseConfig, { completedSteps: [] }, '/tmp');
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'phase-not-enforced');
});

test('V2: requires missing → missing-requires', () => {
  const r = validate(
    'approach',
    baseConfig,
    { completedSteps: [], taskId: 'T-1' },
    '/tmp'
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'missing-requires');
  assert.deepEqual(r.requiredPhases, ['start']);
});

test('V3: Missing artifacts → missing-artifact', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-gate-test-'));
  try {
    const r = validate(
      'impl',
      baseConfig,
      { completedSteps: ['start', 'approach'], taskId: 'T-1' },
      tmp
    );
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'missing-artifact');
    assert.deepEqual(r.missingArtifacts, ['docs/approach/T-1.approach.md']);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('V4: All satisfied → ok', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-gate-test-'));
  try {
    const approachDir = path.join(tmp, 'docs/approach');
    fs.mkdirSync(approachDir, { recursive: true });
    fs.writeFileSync(path.join(approachDir, 'T-1.approach.md'), '# approach');
    const r = validate(
      'impl',
      baseConfig,
      { completedSteps: ['start', 'approach'], taskId: 'T-1' },
      tmp
    );
    assert.equal(r.ok, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── MAE-357 migration: legacy plan+design → approach ───────────────────

test('MIG1: legacy plan+design completedSteps → impl requires.approach met', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-gate-test-'));
  try {
    const planDir = path.join(tmp, 'docs/plan');
    const designDir = path.join(tmp, 'docs/design');
    fs.mkdirSync(planDir, { recursive: true });
    fs.mkdirSync(designDir, { recursive: true });
    fs.writeFileSync(path.join(planDir, 'T-1.plan.md'), '# plan');
    fs.writeFileSync(path.join(designDir, 'T-1.design.md'), '# design');
    const r = validate(
      'impl',
      baseConfig,
      { completedSteps: ['start', 'plan', 'design'], taskId: 'T-1' },
      tmp
    );
    assert.equal(r.ok, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('MIG2: only plan completed (no design) → migration insufficient, missing-requires', () => {
  const r = validate(
    'impl',
    baseConfig,
    { completedSteps: ['start', 'plan'], taskId: 'T-1' },
    '/tmp'
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'missing-requires');
  assert.deepEqual(r.requiredPhases, ['approach']);
});

test('MIG3: legacy plan.md+design.md only (no steps) → artifact meets', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-gate-test-'));
  try {
    const planDir = path.join(tmp, 'docs/plan');
    const designDir = path.join(tmp, 'docs/design');
    fs.mkdirSync(planDir, { recursive: true });
    fs.mkdirSync(designDir, { recursive: true });
    fs.writeFileSync(path.join(planDir, 'T-1.plan.md'), '# plan');
    fs.writeFileSync(path.join(designDir, 'T-1.design.md'), '# design');
    // Assuming the steps have an approach — only artifacts are marked (legacy docs)
    const r = validate(
      'impl',
      baseConfig,
      { completedSteps: ['start', 'approach'], taskId: 'T-1' },
      tmp
    );
    assert.equal(r.ok, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('MIG4: only design.md (no plan.md) → insufficient artifact migration', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-gate-test-'));
  try {
    const designDir = path.join(tmp, 'docs/design');
    fs.mkdirSync(designDir, { recursive: true });
    fs.writeFileSync(path.join(designDir, 'T-1.design.md'), '# design');
    const r = validate(
      'impl',
      baseConfig,
      { completedSteps: ['start', 'approach'], taskId: 'T-1' },
      tmp
    );
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'missing-artifact');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── update formatBlockMessage message ───────────────────────────────────────

test('M1: Message includes two lines of new detour instructions', () => {
  const msg = formatBlockMessage('plan', {
    reason: 'missing-requires',
    requiredPhases: ['start'],
    taskId: 'T-1',
  });
  assert.match(msg, /JIRA_PHASE_GATE_BYPASS=1/);
  assert.match(msg, /"bypassGate": true/);
});

test('M2: absence of old placeholder("To be introduced in MAE-124")', () => {
  const msg = formatBlockMessage('plan', {
    reason: 'missing-requires',
    requiredPhases: ['start'],
    taskId: 'T-1',
  });
  assert.doesNotMatch(msg, /to be introduced in MAE-124/);
});

// ─── extractPhase (sanity) ───────────────────────────────────────────────

test('extractPhase: jiraflow:jira-task-design → "design"', () => {
  assert.equal(
    extractPhase('Skill', { skill: 'jiraflow:jira-task-design' }),
    'design'
  );
});

test('extractPhase: non-Skill tool → null', () => {
  assert.equal(extractPhase('Bash', { command: 'ls' }), null);
});
