# SKILL Refactoring Regression Verification Checklist Template

> **Note**: This file is a template. Story 2~5 In each refactoring PR, create a copy with the command below and record it.

## How to Use

**1. Create a copy (run on PR working branch)**

```bash
cp tasks/skill-refactor-regression-checklist.md tasks/regression-<STORY-ID>.md
```

Example: `cp tasks/skill-refactor-regression-checklist.md tasks/regression-MAE-193.md`

**2. Results Recording Procedure**

1. Execute only the changed SKILL section in the story.
2. Perform each scenario manually.
3. In case of passing, change from `- [ ]` to `- [x]` and record `✅` in the `Result:` line, and `❌` in case of failure.
4. Reproduction commands, error messages, etc. can be freely recorded in the `Notes:` line.
5. Attach the completed copy to the PR body or Jira comment.

---

## Review SKILL

### Scenario

- [ ] review-log append best-effort behavior — If the review-log append step fails, the entire review workflow completes without interruption
  - Result:
  - Notes:

- [ ] Apply redact — Sensitive patterns (secrets, etc.) in review result comments are redacted and output
  - Result:
  - Notes:

- [ ] ApprovedFinding 0 cases — When there are no approved findings, the review comment is output normally and ends without error
  - Result:
  - Notes:

---

## Init SKILL

### Scenario

- [ ] count mode (`/jira-task init N`) — When a number is passed as an argument, a work tree is created for the top N tasks
  - Result:
  - Notes:

- [ ] issue-key mode (`/jira-task init ISSUE-KEY`) — When a specific issue key is passed, a work tree is created by analyzing the subtasks of the task
  - Result:
  - Notes:

- [ ] Natural language mode (`/jira-task init description`) — Generates a work tree by identifying appropriate issues when passing a natural language description
  - Result:
  - Notes:

---

## Discover SKILL

### Scenario

- [ ] default mode (`/jira-task discover topic`) — A requirements document is created when the topic is passed as an argument
  - Result:
  - Notes:

- [ ] `--lite` mode (`/jira-task discover --lite`) — When using the lite flag, a simplified requirements gathering flow is executed
  - Result:
  - Notes:

- [ ] `--from` mode (`/jira-task discover --from <file>`) — When an existing file is passed as input, a requirements document is created based on its contents
  - Result:
  - Notes:

- [ ] Step 4.5 confirm branch — When a modification is requested at the user confirmation stage after collecting requirements, the re-collection branch operates normally
  - Result:
  - Notes:

---

## Create SKILL

### Scenario

- [ ] default mode (`/jira-task create`) — Jira issues are created normally through an interactive flow.
  - Result:
  - Notes:

- [ ] `--from-requirements` mode (`/jira-task create --from-requirements <file>`) — When a requirements file is passed as input, a Jira issue is created based on its contents
  - Result:
  - Notes:
