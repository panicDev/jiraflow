# PR Title

`{TASK-ID}: {Jira summary}`

---

<!--
Section contract (PR body):
- Required: Summary, Jira Issue, Changes, Acceptance Criteria, Test Plan
- Optional: Key Changes (may be folded into Changes), Screenshots (omit if no UI change), Notes

Variable section marker convention: `<!-- optional: <condition or reason> -->` on the line immediately before the heading. Not processed automatically; for human/LLM reference only.
-->

## Summary

{Summarize the Jira issue description in 2-4 lines.}

## Jira Issue

- **Key**: [{TASK-ID}]({JIRA_HOST}/browse/{TASK-ID})
- **Type**: {Story / Bug / Task / Subtask}
- **Priority**: {priority}

## Changes

{Summarize changed files from `git diff --stat` in 1-3 lines.}

<!-- optional: when many files changed, highlight only the key items as bullets. May be folded into Changes. -->
### Key Changes

- {key change 1}
- {key change 2}

## Acceptance Criteria

- [ ] {Jira issue acceptance criterion 1}
- [ ] {Jira issue acceptance criterion 2}

## Test Plan

{If a test report exists, summarize `docs/test/<TASK-ID>.test-report.md`.
Otherwise provide a manual test checklist.}

<!-- optional: only when UI changed. -->
## Screenshots

{images or links}

<!-- optional: extra context reviewers should know. -->
## Notes

- {note}
