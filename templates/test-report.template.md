# Test Report: {task_id}

**Date**: {ISO date}
**Branch**: feature/{task_id}
**Command**: `{test command used}`

<!--
Section contract:
- Required: Summary, at least one test category (Unit/E2E/Scenario/Manual/etc.), Failed Tests Detail, Screenshots
  · "Failed Tests Detail" must say "None" even when there are zero failures.
  · "Screenshots" must say "N/A" when there is no UI.
  · Test category heading names are flexible. `## Test Suites` is the recommended default; use `## Unit Tests`, `## E2E Tests (Playwright)`, `## Manual Verification`, etc. as appropriate. At least one category heading must exist.
- Recommended: Notes, Conclusion
- Optional: Test Strategy, Test Environment, Skipped Tests, Acceptance Criteria Mapping, Raw Output, Out of Scope

Variable section marker convention: `<!-- optional: <condition or reason> -->` on the line immediately before the heading. Not processed automatically; for human/LLM reference only.
-->

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | {n} |
| Passed | {n} |
| Failed | {n} |
| Skipped | {n} |
| Duration | {time} |
| Result | **PASS / FAIL** |

<!-- optional: when test strategy needs explanation beyond the plan/design. -->
## Test Strategy

{Testing approach, framework, coverage scope, etc.}

<!-- optional: when tests depend on environment details. -->
## Test Environment

- OS: {}
- Node/Python/etc: {}
- Other dependencies: {}

## Test Suites

{At least one suite is required. Category names are flexible — e.g., "Unit Tests", "E2E Tests (Playwright)", "Scenario Tests", "Manual Verification".}

### {Suite Name}

{Description + result table or per-case results.}

| # | Case | Result | Notes |
|---|------|------|------|
| 1 | {case} | ✓ pass / ✗ fail / ⊘ skip | {} |

## Failed Tests Detail

{Failed test details. If there are zero failures, write one line: "None."}

## Screenshots

{Screenshots for UI verification. If there is no UI, write one line: "N/A."}

<!-- optional: when tests were intentionally skipped, record the rationale. -->
## Skipped Tests Rationale

- {test name}: {reason}

<!-- optional: when explicitly mapping acceptance criteria to test results; may also be covered during review. -->
## Acceptance Criteria Mapping

| AC | Verification Method | Result |
|----|----------|------|
| AC-1 | {how} | Pass/Fail |

<!-- optional: when including part of the raw test runner output. -->
## Raw Output

```
{output}
```

<!-- optional: verification items intentionally not covered by this report. -->
## Out of Scope

- {item}

<!-- optional: recommended when result interpretation or follow-up actions are needed. -->
## Conclusion

{Overall verdict and follow-up actions.}

<!-- optional: recommended. Other notes. -->
## Notes

- {note}
