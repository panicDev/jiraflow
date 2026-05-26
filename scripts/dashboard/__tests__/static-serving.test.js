'use strict';

/**
 * Smoke test: Check whether server.js serves index.html through express.static('public/').
 * E1 (design Test Plan)
 *
 * Uses node:test.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { startServer } = require('../server');

// Port for testing (avoid conflict with 4173)
const TEST_PORT = 4283;

/**
 * @param {string} urlPath
 * @returns {Promise<{statusCode:number, body:string, headers:Record<string,string>}>}
 */
function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${TEST_PORT}${urlPath}`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () =>
        resolve({ statusCode: res.statusCode, body, headers: res.headers })
      );
    }).on('error', reject);
  });
}

test('server.js static serving — index.html 200', async (t) => {
  // Temporarily create public/ directory and index.html for testing
  const publicDir = path.join(__dirname, '..', 'public');
  const indexPath = path.join(publicDir, 'index.html');
  let createdPublicDir = false;
  let createdIndex = false;

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    createdPublicDir = true;
  }
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, '<html><body><div id="root"></div></body></html>');
    createdIndex = true;
  }

  // If there are no credentials, startServer throws, so temporarily set environment variables
  const origUrl = process.env.JIRA_URL;
  const origUser = process.env.JIRA_USERNAME;
  const origToken = process.env.JIRA_API_TOKEN;
  process.env.JIRA_URL = process.env.JIRA_URL ?? 'https://example.atlassian.net';
  process.env.JIRA_USERNAME = process.env.JIRA_USERNAME ?? 'test@example.com';
  process.env.JIRA_API_TOKEN = process.env.JIRA_API_TOKEN ?? 'test-token';

  const server = await startServer({ port: TEST_PORT, openBrowser: false });

  try {
    const res = await get('/');
    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}`);
    assert.ok(
      res.body.includes('<div id="root">'),
      `response body should include <div id="root">`
    );
  } finally {
    await server.stop();

    // Clean up temporarily created files/directories
    if (createdIndex) fs.rmSync(indexPath);
    if (createdPublicDir) fs.rmdirSync(publicDir);

    // Restore environment variables
    if (origUrl === undefined) delete process.env.JIRA_URL;
    else process.env.JIRA_URL = origUrl;
    if (origUser === undefined) delete process.env.JIRA_USERNAME;
    else process.env.JIRA_USERNAME = origUser;
    if (origToken === undefined) delete process.env.JIRA_API_TOKEN;
    else process.env.JIRA_API_TOKEN = origToken;
  }
});
