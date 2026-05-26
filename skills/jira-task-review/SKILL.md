---
name: jira-task-review
description: "Run code review and gap analysis on a Jira task's changes, then save local results and attachments without Jira comments. Triggers: jira-task review, code review."
user-invocable: false
argument-hint: "<TASK-ID>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
  - mcp__atlassian__jira_get_issue
---

# jira-task-review: Code Review + Gap Analysis with Jira Reporting

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Reviewer Independence Rule (Required)

For full text of Mode A/B branching rules and Mode A subagent prompt, see `Read skills/jira-task-review/refs/reviewer-mode.md`.

Summary: If the `[review-self-mode]` marker is not present, Mode A (Agent delegates, enforces opus), if present, Mode B (wrapper agent performs directly). Self-praise / The purpose is to block missing blind spots.

## Workflow

### Context Optimization

If you need to call `mcp__atlassian__jira_get_issue` in this skill, first check `cachedIssue` in `.jira-context.json` (see CLAUDE.md "Issue Cache"). If it is a hit, the call is omitted. If it is a miss, update the cache after calling with the following parameters:
- `fields="summary,status,description,issuetype"`
- `comment_limit=0`

### Step 1: Prepare Context (main session)

Prepare the review context — the main session does this.

```bash
git log --oneline <base-branch>..feature/<TASK-ID>
git diff --name-only <base-branch>..feature/<TASK-ID>
```

Check for existence of design document:
- Does `docs/design/<TASK-ID>.design.md` exist? (Gap Analysis availability)
- Does `docs/plan/<TASK-ID>.plan.md` exist? (See Acceptance Criteria)

### Step 2: Perform Review (Mode A: delegate / Mode B: self)

Branch by checking if the calling prompt has a `[review-self-mode]` marker.

#### Mode B (self-mode) — with marker

Since this wrapper agent is already in an isolated context, do not launch an additional agent and **perform the following directly**:

1. **Gap Analysis**: If there is `docs/design/<TASK-ID>.design.md`, check whether each Implementation Plan item is actually implemented using `Glob`/`Grep` and calculate the matching rate. If you don't have it, skip it.
2. **Lint & Format Check**: Run lint/format for the following extensions among changed files:
   - Node.js: `.js`/`.ts`/`.jsx`/`.tsx`/`.mjs`/`.cjs` → `npx eslint` / `npx prettier --check`
   - Python: `.py` → `ruff check` / `ruff format --check` or `flake8`
   - Java/Kotlin: `.java`/`.kt`/`.kts` → `checkstyle`
   Targets only change files, skips without tools, takes precedence over existing project settings. Even if there is a lint failure, it does not stop the review and is included as information.
3. **Code Quality Review**: Review changed files with `Read` — security vulnerabilities (injection/XSS/hard-coding credentials), missing error handling, naming consistency, unnecessary complexity.
4. **Compile Findings**: Categorized into 3 levels: Critical / Warning / Info. File:Includes line references.

Output: Same structure as the subagent return in Mode A (Results / Number of reviewed files / Gap matchRate / Lint table / findings / Positive Notes). Pass this to Step 4 and save it as `docs/review/<TASK-ID>.review.md`.

Even in self-mode, do not directly modify the code with Edit/Write — limited to the review itself. Fix is ​​a separate step (e.g. review-fix sub-agent in auto).

#### Mode A (delegate) — No marker

Explicitly call `subagent_type: "jira-reviewer"`, `model: "opus"` with the `Agent` tool. **Subagent call prompt text + prohibitions follow `Read skills/jira-task-review/refs/reviewer-mode.md`** (Mode A paragraph).

If the `Agent` tool cannot be used in an environment, it immediately stops with an error and informs the caller of the missing `[review-self-mode]` marker — As a fallback, the main session does not review directly.

### Step 3: Receive Subagent Result

Receives the return value of the `Agent` tool. This result is the single truth of the review (main session is prohibited from arbitrarily adding/editing).

If the subagent call fails (timeout, permission denied, etc.) or the result is clearly insufficient, **retry or report to the user**. The main session does not review directly as a fallback.

### Step 4: Save Review Report (main session)

Save subagent return value to `docs/review/<TASK-ID>.review.md`. It is standardized according to the template contract.

Read `templates/review.template.md` and follow the contract (required: Summary, Gap Analysis, Lint & Format, Code Quality Findings, Positive Notes).

### Step 4.7: Append Review Log (best-effort)

Append the review results saved in Step 4 to the `docs/review-log/` log. Failure does not block the workflow.

> **Prerequisite**: The subagent result received in Step 3 must be stored in the `SUBAGENT_RESULT_JSON` variable (JSON string).
> subagent return value structure: `{ result: "Approve"|"Request Changes"|"Needs Discussion", findings: [{severity, file, line, category, message}, ...], ... }`

To determine the script path, run the lookup block after `Read skills/_shared/script-lookup.md`:

```bash
SCRIPT_NAME="append-review-log-wrapper.sh" OUT_VAR="APPEND_LOG_SH"
# Read skills/_shared/script-lookup.md and execute its lookup block here

set +e
[ -n "$APPEND_LOG_SH" ] && SUBAGENT_RESULT_JSON="$SUBAGENT_RESULT_JSON" bash "$APPEND_LOG_SH" "<TASK-ID>"
set -e
```

### Step 4.5: Attach Review Report to Jira

Upload the saved `docs/review/<TASK-ID>.review.md` as a public script. To determine the script path, run the lookup block after `Read skills/_shared/script-lookup.md`:

```bash
SCRIPT_NAME="jira-attach.sh" OUT_VAR="JIRA_ATTACH_SH"
# Read skills/_shared/script-lookup.md and execute its lookup block here
[ -n "$JIRA_ATTACH_SH" ] && bash "$JIRA_ATTACH_SH" <TASK-ID> docs/review/<TASK-ID>.review.md
```

The output is `HTTP 200: <file>` (success) / otherwise failure. In case of failure, continue after providing local file path information.

### Step 5: Skip Jira Comment

Jira ticket comments are disabled. Do not call `mcp__atlassian__jira_add_comment`. Keep review details in `docs/review/<TASK-ID>.review.md`, append the review log, and upload the report attachment when available.

### Step 6: Completion Summary

Update `.jira-context.json` with `skills/_shared/context-update.md` pattern only when Approve (no Jira transition in review → `STATUS="-"`). Do not call on Request Changes:

```bash
SCRIPT_NAME="jira-context-update.py" OUT_VAR="JIRA_CTX_UPDATE_PY"
# Read skills/_shared/script-lookup.md and execute its lookup block here
python3 "$JIRA_CTX_UPDATE_PY" <TASK-ID> review "-" \
    ".jira-context.json"
```

**When Approve:**
```
---
✅ **Review Complete** — <TASK-ID>

- Result: Approve
- Reviewer: jira-reviewer subagent (opus)
- Design/implementation match rate: <N>%
- Reviewed files: <N>
- Jira comment: skipped (disabled)
- Jira attachment: uploaded, or local path shown if upload fails

**Progress**: discover → create → init → start → approach → impl → test → **review ✓** → merge → pr → done

**Next**: `/jira-task merge <TASK-ID>` — After local merge, `/jira-task pr <TASK-ID>` in main repo
---
```

**Request Changes:**
```
---
⚠️ **Review: Changes Requested** — <TASK-ID>

- Result: Request Changes
- Reviewer: jira-reviewer subagent (opus)
- Key issues:
  - <Critical/Warning findings>
- Jira comment: skipped (disabled)

**Progress**: init → start → approach → impl → test → **review ✗** → merge → pr → done

**Next**: fix the issues, then rerun `/jira-task review <TASK-ID>`
---
```
