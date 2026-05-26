---
name: jira-task-impl
description: "Implement a Jira task based on the approach document and save progress locally without Jira comments. Triggers: jira-task impl, implement task, start implementation, start coding."
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

# jira-task-impl: Implement a Jira Task

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Prerequisites
- Approach document should exist at `docs/approach/<TASK-ID>.approach.md` (warn if missing)
- Feature branch `feature/<TASK-ID>` should already exist (suggest `/jira-task start` if not)

## Workflow

### Step 1: Load Context

1. Read `.jira-context.json` for active task info
2. **Cache-first**: Check `cachedIssue` of `.jira-context.json` first (refer to CLAUDE.md "Issue Cache"). If it is a hit, the call is omitted. If it is a miss, update the cache after calling `mcp__atlassian__jira_get_issue` (`fields="summary,status,description,issuetype"`, `comment_limit=0` — in the implementation, the approach document is the primary source, so the issue body is minimal).
3. Read `docs/approach/<TASK-ID>.approach.md` if it exists

### Step 2: Implement Based on Approach Document

Implemented according to the Implementation Plan (L2) or 5-line summary (L1) in `docs/approach/<TASK-ID>.approach.md`. L3 Epic is not used as input to this step because the child Story is responsible for implementation.

Implementation Principle:
1. Follow the order of Implementation Plan
2. Adhere to existing code conventions and patterns
3. Reflection of Risks/Key Decisions in Approach Document
4. Upon completion of each step, perform **only syntactic verification such as type check/compilation** (test execution prohibited)

If there is no approach document, implementation is based on Jira issue description and Acceptance Criteria.

**Test operation prohibited (forced):**
- **Do not write test code** at this stage — applies to all unit/integration/E2E
- Prohibit test execution (`npm test`, `pytest`, `playwright test`, etc.)
- New creation/editing of test files (`*.test.*`, `*.spec.*`, `__tests__/`, `tests/` subcategories, etc.) is prohibited.
- Both writing and running test code are the responsibility of the `/jira-task test` step
- However, if the implementation target file itself happens to be test code (e.g. a task that implements the test utility itself), it is allowed only as specified in the approach document Implementation Plan

### Step 2.5: Parallel Implementation for Independent Work Packages (L2/L3 only)

**Skip for L1 tasks.** For L2/L3 tasks where the approach document's Implementation Plan has 2+ independent packages:

1. **Identify independent packages**: Group implementation steps by target files/modules. Two packages are independent if their target file sets do not overlap.

2. **If 2+ independent packages**:
   - Spawn one sub-agent per package using the `Agent` tool
   - Each agent prompt must include:
     - The specific implementation steps for that package
     - The exact list of files it is allowed to modify
     - Current branch: `feature/<TASK-ID>` (all agents work on the same branch)
     - Relevant approach doc sections
     - Instruction: "Implement only your assigned package. Do not modify files outside your assigned scope. Do not run tests."
   - Wait for all agents to complete before proceeding
   - After completion, verify no overlapping changes exist between agents

3. **Fallback**: If file scopes overlap or conflict detected → sequential implementation (skip this step, use Step 2 flow).

**All agents work on the same branch (`feature/<TASK-ID>`) in the same repository directory. Do not create additional branches.**

### Step 3: Skip Jira Progress Comment

Jira ticket comments are disabled. Do not call `mcp__atlassian__jira_add_comment`. Summarize implementation details only in the local completion summary and generated documents.

### Step 4: Completion Summary

Update `.jira-context.json` with `skills/_shared/context-update.md` pattern (impl has no Jira transition → `STATUS="-"`):

```bash
SCRIPT_NAME="jira-context-update.py" OUT_VAR="JIRA_CTX_UPDATE_PY"
# Read skills/_shared/script-lookup.md and execute its lookup block here
python3 "$JIRA_CTX_UPDATE_PY" <TASK-ID> impl "-" \
    ".jira-context.json"
```

Then print the completed summary in the format below:

```
---
✅ **Implementation Complete** — <TASK-ID>

- Created files: <list>
- Modified files: <list>
- Jira comment: skipped (disabled)

**Progress**: discover → create → init → start → approach → **impl ✓** → test → review → pr → done

**Next**: `/jira-task test <TASK-ID>` — write and run tests
---
```

For projects without a test framework, `/jira-task review <TASK-ID>` is recommended instead.
