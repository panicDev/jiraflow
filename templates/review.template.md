# Code Review: {task_id} - {summary}

**Date**: {ISO date}
**Branch**: feature/{task_id}
**Reviewed by**: {reviewer}

<!--
Section contract:
- Required: Summary, Gap Analysis, Lint & Format, Code Quality Findings, Positive Notes
- Recommended: Changed Files, Conclusion / Recommendation
- Optional: Acceptance Criteria Verification, Security Review, Out of Scope, Open Items / Follow-ups, Verification Commands

Variable section marker convention: `<!-- optional: <condition or reason> -->` on the line immediately before the heading. Not processed automatically; for human/LLM reference only.
-->

## Summary

**Result**: **Approve / Request Changes / Needs Discussion**

{One-paragraph summary of what was reviewed and the key basis for the verdict.}

<!-- optional: when there are many changed files or categorization helps. -->
## Changed Files

| File | Type | Description |
|------|------|------|
| `{path}` | New/Modified/Deleted | {1-line description} |

## Gap Analysis

**Design/implementation match rate**: **{n}% ({passed}/{total})**

| Design Implementation Plan | Implemented? | Location |
|---------------------------|----------|------|
| {plan item} | O / X / Partial | `{file}:{line}` |

{Summarize differences between design and implementation. If 100% aligned, write "No differences."}

## Lint & Format

| Tool | Target File Count | Result |
|------|------------|------|
| ESLint | {n} | Pass / Fail / Skipped(reason) |
| Prettier | {n} | Pass / Fail / Skipped |
| {other syntax check} | {n} | Pass / Fail |

{If the project does not use lint tools, state the skip reason and alternative verification, e.g. `node -c`.}

## Code Quality Findings

### Critical

{Must fix immediately. If none, write "None."}

### Warning

{Recommended fixes. If none, write "None."}

### Info

{Informational suggestions. If none, write "None."}

## Positive Notes

{Specific positives: YAGNI adherence, appropriate abstraction, useful test coverage, etc. Do not invent positives.}

<!-- optional: when acceptance criteria are verified again during review; may overlap with the test report. -->
## Acceptance Criteria Verification

| AC | Verification Method | Result |
|----|----------|------|
| AC-1 | {how} | Pass/Fail |

<!-- optional: when there is security impact. -->
## Security Review

- {finding}

<!-- optional: items intentionally excluded from this review scope. -->
## Out of Scope (intentional)

- {item}

<!-- optional: items to move into follow-up tasks. -->
## Open Items / Follow-ups

- {item}

<!-- optional: record commands so someone else can reproduce the verification. -->
## Verification Commands

```bash
{commands used}
```

<!-- optional: recommended. Overall conclusion and next actions. -->
## Conclusion

{Approval rationale / requested fixes / next steps.}
