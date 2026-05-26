const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const KOREAN_RE = /[가-힯ᄀ-ᇿ㄰-㆏]/;

function walkMd(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) results.push(...walkMd(full));
    else if (entry.endsWith('.md')) results.push(full);
  }
  return results;
}

const SCAN_DIRS = ['skills', 'commands', 'agents', 'templates'];
const allMd = SCAN_DIRS.flatMap(d => walkMd(path.join(ROOT, d)));
const skillMd = walkMd(path.join(ROOT, 'skills'));
const taskSkillFiles = fs.readdirSync(path.join(ROOT, 'skills'))
  .filter(d => d.startsWith('jira-task-'))
  .map(d => path.join(ROOT, 'skills', d, 'SKILL.md'));

// Policy 1: No Korean characters in runtime-facing Markdown
for (const file of allMd) {
  const rel = path.relative(ROOT, file);
  test(`no-korean: ${rel}`, () => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      assert.ok(
        !KOREAN_RE.test(lines[i]),
        `Korean text at line ${i + 1}: "${lines[i].trim()}"`
      );
    }
  });
}

// Policy 2: No jira_add_comment in allowed-tools frontmatter section
for (const file of skillMd) {
  const rel = path.relative(ROOT, file);
  test(`no-add-comment: ${rel}`, () => {
    const content = fs.readFileSync(file, 'utf8');
    // Extract frontmatter only (between first and second ---)
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = match ? match[1] : '';
    assert.ok(
      !frontmatter.includes('jira_add_comment'),
      `Forbidden jira_add_comment in allowed-tools frontmatter of ${rel}`
    );
  });
}

// Policy 3: English-only Language Rule declared in every jira-task-* skill
for (const file of taskSkillFiles) {
  const rel = path.relative(ROOT, file);
  test(`has-language-rule: ${rel}`, () => {
    assert.ok(
      fs.readFileSync(file, 'utf8').includes('Language Rule'),
      `Missing Language Rule in ${rel}`
    );
  });
}
