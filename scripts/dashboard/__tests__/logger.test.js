'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createLogger } = require('../logger');

/**
 * Create a temp log file, write entries, close, and read back parsed lines.
 */
async function withTempLog(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-mae300-'));
  const filePath = path.join(dir, 'test.log');
  const logger = createLogger(filePath);
  await fn(logger);
  await logger.close();
  const content = fs.readFileSync(filePath, 'utf8').trim();
  fs.rmSync(dir, { recursive: true, force: true });
  return content ? content.split('\n').map((l) => JSON.parse(l)) : [];
}

// U1: child merges context into all lines
test('U1: child merges context into every log line', async () => {
  const lines = await withTempLog((logger) => {
    logger.child({ workspace: '/a' }).info('some.event', { x: 1 });
  });

  assert.equal(lines.length, 1, 'exactly one line');
  assert.deepEqual(lines[0].data, { workspace: '/a', x: 1 });
});

// U2: root logger does not include workspace
test('U2: root logger does not include workspace field', async () => {
  const lines = await withTempLog((logger) => {
    logger.info('server.started', { port: 3000 });
  });

  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].data, { port: 3000 });
  assert.ok(!('workspace' in lines[0].data), 'root line must not have workspace');
});

// U3: data overwrites context
test('U3: data argument overrides context on same key', async () => {
  const lines = await withTempLog((logger) => {
    logger.child({ workspace: '/a' }).info('some.event', { workspace: '/b' });
  });

  assert.equal(lines[0].data.workspace, '/b', 'data argument must win');
});

// U4: redact also applies to context
test('U4: redact applies to context fields', async () => {
  const lines = await withTempLog((logger) => {
    logger.child({ apiToken: 'secret' }).info('some.event');
  });

  assert.equal(lines[0].data.apiToken, '[REDACTED]', 'apiToken in context must be redacted');
});

// U5: redact is applied to data (regression)
test('U5: redact applies to data fields (regression)', async () => {
  const lines = await withTempLog((logger) => {
    logger.info('some.event', { apiToken: 'x' });
  });

  assert.equal(lines[0].data.apiToken, '[REDACTED]');
});

// U6: child.close does not close root stream
test('U6: child.close does not close root stream', async () => {
  const lines = await withTempLog(async (logger) => {
    const ch = logger.child({ workspace: '/a' });
    await ch.close();
    logger.info('after.child.close', { ok: true });
  });

  const last = lines[lines.length - 1];
  assert.equal(last.event, 'after.child.close', 'root logger must still work after child.close');
});

// U7: child(undefined) is equivalent to root (no workspace field)
test('U7: child(undefined) behaves like root — no extra fields', async () => {
  const lines = await withTempLog((logger) => {
    logger.child().info('some.event', { x: 1 });
  });

  assert.deepEqual(lines[0].data, { x: 1 }, 'child(undefined) must not inject workspace or other fields');
  assert.ok(!('workspace' in lines[0].data));
});
