---
name: jira-task-test
description: "Run tests for a Jira task (Playwright E2E, vitest/jest, custom), then save local results and attachments without Jira comments. Triggers: jira-task test, run tests, E2E tests."
user-invocable: false
argument-hint: "<TASK-ID>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - mcp__atlassian__jira_get_issue
---

# jira-task-test: Run Tests & Report to Jira

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Prerequisites
- Implementation should be complete for the task
- Test framework should be installed in the project

## Workflow

### Context Optimization

If you need to call `mcp__atlassian__jira_get_issue` in this skill, first check `cachedIssue` in `.jira-context.json` (see CLAUDE.md "Issue Cache"). If it is a hit, the call is omitted. If it is a miss, update the cache after calling with the following parameters:
- `fields="summary,status,issuetype"`
- `comment_limit=0`

### Step 1: Detect Test Environment

Scan the project to determine the test setup:

```bash
# Check for test frameworks
ls package.json 2>/dev/null       # Node.js project
ls playwright.config.* 2>/dev/null # Playwright
ls vitest.config.* 2>/dev/null     # Vitest
ls jest.config.* 2>/dev/null       # Jest
ls pytest.ini 2>/dev/null          # Python pytest
ls pyproject.toml 2>/dev/null      # Python pyproject
```

Also check `package.json` for test scripts:
```bash
cat package.json | grep -A5 '"scripts"'
```

Determine available test types:
- **E2E (Playwright)**: If `playwright.config.*` exists
- **Unit (Vitest/Jest)**: If `vitest.config.*` or `jest.config.*` exists
- **Custom**: If `package.json` has a `test` script

### Step 1.5: Author Tests (separated from the impl step)

Writing test code is the responsibility of this skill. The impl phase only deals with production code and does not write test code.

**Check existing tests:**

Check with Glob/Grep if there is already a test related to this task:
- Search TASK-ID or function keyword in test file
- `tests/`, `e2e/`, `__tests__/`, `*.test.*`, `*.spec.*` pattern search

**Test writing procedure (default behavior):**

1. Use the Test Plan section of the design document as the primary specification (Unit + E2E case + AC mapping)
2. If there is no Design document or the Test Plan is empty, use the Acceptance Criteria of the Jira issue
3. Create new only missing cases (preserve existing tests)
4. Framework/location follows project convention (vitest/jest/pytest, `__tests__/` or `*.test.*`, etc.)

```typescript
import { test, expect } from '@playwright/test';

test.describe('<Feature Name> - <TASK-ID>', () => {
  test('should <acceptance criterion 1>', async ({ page }) => {
    // Test implementation
  });
});
```

**Skip Condition (Exception):**
- There is no test framework in the project at all → Skip writing and process fallback to Step 2
- When the user explicitly says "Do not create tests"

### Step 2: Run Tests

Execute tests in order of speed (unit first, then E2E):

#### Unit Tests
```bash
# Vitest
npx vitest run --reporter=verbose 2>&1

# Jest
npx jest --verbose 2>&1

# pytest
python -m pytest -v 2>&1
```

#### Playwright E2E Tests
```bash
# Install browsers if needed
npx playwright install --with-deps 2>&1

# Run all E2E tests
npx playwright test --reporter=list 2>&1

# Or run specific tests related to the task (search by TASK-ID or feature name)
npx playwright test --grep "<feature-keyword>" --reporter=list 2>&1
```

#### Custom Test Command
```bash
npm test 2>&1
```

Capture ALL output (stdout + stderr) for the report.

### Step 3: Analyze Results

Parse the test output to extract:
- **Total tests**: Count of all tests run
- **Passed**: Count of passing tests
- **Failed**: Count of failing tests (with details)
- **Skipped**: Count of skipped tests
- **Duration**: Total execution time

For failed tests, capture:
- Test name
- Error message
- Stack trace (truncated if very long)
- Screenshot path (Playwright auto-captures on failure)

### Step 4: Generate Test Report

Create a test report at `docs/test/<TASK-ID>.test-report.md`.

Before writing the output, be sure to read `templates/test-report.template.md` using the Read tool and follow the contract (required/optional classification, optional marker protocol).

### Step 5: Skip Jira Comment

Jira ticket comments are disabled. Do not call `mcp__atlassian__jira_add_comment`. Keep the test summary in `docs/test/<TASK-ID>.test-report.md` and continue with attachment upload.

Upload the test report and failure screenshot as a public script. To determine the script path, run the lookup block after `Read skills/_shared/script-lookup.md`:

```bash
SCRIPT_NAME="jira-attach.sh" OUT_VAR="JIRA_ATTACH_SH"
# Read skills/_shared/script-lookup.md and execute its lookup block here

# Report
[ -n "$JIRA_ATTACH_SH" ] && bash "$JIRA_ATTACH_SH" <TASK-ID> docs/test/<TASK-ID>.test-report.md

# Playwright failure screenshot (only when present)
shots=$(find test-results/ playwright-report/ -name "*.png" -type f 2>/dev/null)
[ -n "$JIRA_ATTACH_SH" ] && [ -n "$shots" ] && bash "$JIRA_ATTACH_SH" <TASK-ID> $shots
```

The output of each call is in the format `HTTP <code>: <file>`. If it is not 200, upload failed — provide local path and continue.

### Step 6: Completion Summary

Only when the test passes, update `.jira-context.json` with the `skills/_shared/context-update.md` pattern (test has no Jira transition → `STATUS="-"`). Do not call on failure:

```bash
SCRIPT_NAME="jira-context-update.py" OUT_VAR="JIRA_CTX_UPDATE_PY"
# Read skills/_shared/script-lookup.md and execute its lookup block here
python3 "$JIRA_CTX_UPDATE_PY" <TASK-ID> test "-" \
    ".jira-context.json"
```

Branch based on test results and complete summary output:

**If the test passes:**
```
---
✅ **Test Complete** — <TASK-ID>

- Total: <N>, passed: <N>, failed: 0
- Test report: `docs/test/<TASK-ID>.test-report.md`
- Jira comment: skipped (disabled)
- Jira attachments: report + <N> screenshots, or local path shown if upload fails

**Progress**: discover → create → init → start → approach → impl → **test ✓** → review → pr → done

**Next**: `/jira-task review <TASK-ID>` — Run a code review
---
```

**If test fails:**
```
---
⚠️ **Test Failed** — <TASK-ID>

- Total: <N> items, Passed: <N> items, Failed: <N> items
- Failure list:
  - <test name>: <error summary>
- Test report: `docs/test/<TASK-ID>.test-report.md`

**Progress**: init → start → approach → impl → **test ✗** → review → pr → done

**Next**: Re-run `/jira-task test <TASK-ID>` after correcting failed items
---
```

