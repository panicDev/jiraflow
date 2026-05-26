# Enhancement Roadmap — v0.12.0 → Commercialization

## Overview

Based on external reviews (analysis based on v0.5.0 reorganized for v0.12.0), work plan to elevate this plugin to **in-house official tool candidate**.

**Current Status (v0.12.0)**

- Workflow: `create → init → start → plan → design → impl → test → review → merge → pr → done`
- Hooks: only two, `session-start` and `stop-sync`
- Templates: Only two, `plan.template.md` and `report.template.md`
- Reviewer: There is fail→retry within a single session, but no cumulative calibration
- Closed network/Server-DC not supported, no CI result fetch

**Key gaps from a commercialization perspective** (in order of priority)

1. Absence of requirements collection/analysis stage — no pre-init flow of discovery → requirements document → issue decomposition
2. Phase gate No guardrail — Impl possible without design, step skipping possible
3. No reviewer calibration — risk of convergence to self-praise over time
4. Insufficient template for each step — Absence of design/test/review template
5. No CI/CD post-processing — ends in PR creation
6. Multi-worktree cross-check manually
7. Closed network/Server-DC not supported

---

## Phase 1 — Commercialization Guardrail (Priority)

The part that is buried first when commercially introduced. The amount of code change is small, but the effect is large.

### Task 1.1: Introduction of requirements collection/analysis stage

**Background**
Currently, `create` only goes so far as to "register Jira issues in natural language." There is no **discovery → requirements document → issue decomposition** flow that should precede it. If a company wants to take AI-Native SDLC from start to finish rather than a separate PO/PM model, this step must be most strongly supplemented.

**Output**

- New skill: `jira-task-discover` (or `jira-task-requirements`)
- New action: `/jira-task discover [natural language topic]`
- Output document: `docs/requirements/<TOPIC-SLUG>.requirements.md`
- Follow-up connection: Automatically transfers the discover results to `jira-task-create` to register epics/stories/subtasks in bulk

**Confirmed Workflow** (Decided 2026-04-26, refer to MAE-42 ADR)

```
discover (new) → create → init → start → plan → design → impl → test → review → merge → pr → done
```

Place `discover` as a separate step before `create` (optional A).

**Subtask**

1. **Determine workflow location** ✅ — Decision completed (MAE-42, recorded as ADR). Option A adopted.
2. **Creating the `jira-task-discover` skill**
   - Input: Natural language topic (e.g. "Payment module renewal", "Introducing internal SSO")
   - Step:
     1. Gather context — Automatically explore relevant areas of the current codebase (Glob/Grep)
     2. Batched questions — questions to users that group ambiguous points together (stakeholders, success criteria, constraints, non-functional requirements, etc.)
     3. Create requirements document — `docs/requirements/<TOPIC-SLUG>.requirements.md`
     4. Issue decomposition proposal — Epic 1 + Story N + Subtask M structure proposal (confirmation in the next step)
3. **Connection with `jira-task-create`**
   - After completing `discover`, `Next: /jira-task create --from-requirements <TOPIC-SLUG>` instructions
   - Add branch to allow `create` to read requirements documents and create issues in bulk
4. **Template creation required** — `templates/requirements.template.md` (plan only, not implemented in this work)
5. **Extend `completedSteps`** — Add `"discover"` to valid steps
6. **Add `commands/jira-task.md` routing** — `discover` action branch
7. **CLAUDE.md update** — Add requirements to PDCA document list, update workflow graph
8. **README Workflow Diagram Update**

**Considerations**

- Overkill on small tickets if the requirements document is too heavy. Consider also providing a lightweight route in `--lite` mode (3 questions or less, one page document).
- If there are requirements already written by PO/PM, they can be imported with `discover --from <file path>`.
- Confirm that there is no conflict with the existing `init`/`create` flow.

---

### Task 1.2: Phase gate hooks

**Background**
Currently, there are only two `hooks/`: `session-start.js` and `stop-sync.js`. There is no guard at the code level to prevent violations such as "entry into impl without design," "creation of PR without passing test," and "skip of unapproved phase." Required to use as an official company tool.

**Output**

- New hook: `PreToolUse` based phase gate
- New script: `hooks/scripts/phase-gate.js`
- Register in `hooks/hooks.json`

**Subtask**

1. **Definition of Phase Dependency Graph**
   - `start` predecessor: None (at any point after init)
   - `plan` predecessor: `start`
   - `design` predecessor: `plan`
   - `impl` predecessor: `design` (document exists + includes completedSteps)
   - `test` predecessor: `impl`
   - `review` predecessor: `test`
   - `merge` precedence: `review` passed
   - `pr` predecessor: `merge`
   - `done` predecessor: `pr`
   - Externalize dependency graph to `hooks/scripts/phase-gate.config.json` (room for customization per company/project)
2. **Creating `phase-gate.js`**
   - Intercept `Skill` tool calls with PreToolUse hook
   - If the called skill name is `jira-task-*` pattern, phase extraction
   - Comparison of `completedSteps` in `.jira-context.json` and dependency graph
   - In case of violation: block + clear message ("design step is required. Run /jira-task design <ID> first")
3. **Bypass mechanism**
   - Explicit bypass flags (e.g. environment variable `JIRA_PHASE_GATE_BYPASS=1`) — for debugging
   - or `bypassGate: true` field in `.jira-context.json` — persistent bypass
   - When bypassing, a warning is output to the console
4. **Test Scenario**
   - call impl without design → should be blocked
   - Normal sequence call → Must pass
   - bypass flag → pass + warning
   - No context file → Pass after guidance (first entry protection)
5. **Update `hooks/hooks.json`** — Register PreToolUse
6. **Documentation** — "Phase Gate" section in README, specifying bypass method

**Considerations**

- If the phase gate is too tight, the user experience deteriorates. **Warning + confirmation prompt**, which is stronger than blocking**, is also reviewed (however, hooks cannot receive user input through stdin → only block/pass is possible).
- In a multi-worktree environment, you must see a different `.jira-context.json` for each worktree. cwd based navigation.

---

### Task 1.3: Template maintenance for each step

**Background**
There are only `plan.template.md` and `report.template.md` in `templates/`. There are no `design`, `test-report`, `review-report`, `requirements` (Task 1.1), and `pr-description` templates. In order for "all document formats to be opinionated", the template for each step must be in a forced format, and each step must operate as a contract that fills the template.

**⚠️ This work is planning only. Actual template creation is separated into a separate task.**

**Subtask (planning level)**

1. **Need to create template for each step** — Target:
   - `requirements.template.md` (Linked with Task 1.1)
   - `design.template.md`
   - `test-report.template.md`
   - `review-report.template.md`
   - `pr-description.template.md`
2. **Determination of variable section policy by ticket type (Story/Bug/Task)** — UIX/Data/SW/HW 4-partitioning is applied according to type (UIX section is usually unnecessary for Bugs)
3. **Modified so that each skill directly references the template** — SKILL.md now contains section definitions inline. Externalize into templates.
4. **How ​​to verify consistency with skill when changing template** — Review adding lint at CI stage

---

### Task 1.4: Reviewer Calibration Log (Step 1 — Cumulative only)

**Background**
fail→retry in `auto` mode is only a single session loop, and there is no cumulative learning. As reviewer quality levels off over time, there is a risk of convergence toward self-praise (anthropic harness paper key message).

**In this task, only "building logs" is done. prompt automatic calibration is Phase 3.**

**Output**

- New directory: `docs/review-log/`
- File format: `docs/review-log/<TASK-ID>.review.json` (per-task) + `docs/review-log/_index.jsonl` (full cumulative)

**Subtask**

1. **Log schema definition**
   - Fields: `taskId`, `timestamp`, `reviewerVersion` (the SKILL.md hash at that point in time), `findings` (array), `severity`, `falsePositive` (can be marked after the fact by the user), `userOverride` (if the reviewer conclusion has been overturned by the user)
2. **Modify `jira-task-review` skill**
   - At the end of the review, append the results to `docs/review-log/<TASK-ID>.review.json`
   - Add one line to `_index.jsonl` (easy to analyze by period)
3. **User Feedback Channel**
   - Lightweight command that allows the user to indicate "This finding was a false positive" — `/jira-task review-feedback <TASK-ID>` (CLI interaction)
   - Or edit the review-log JSON file directly (simple path)
4. **Log analysis script** — `scripts/analyze-review-log.py`
   - Cumulative finding frequency, false positive rate, severity distribution output
   - Used as a basis for updating the reviewer prompt at the time of calibration (used in Phase 3)
5. **gitignore policy decision** — Should the review-log be committed or kept locally
   - Recommended: commit (team-based learning assets), but only without user identification

**Considerations**

- Prevent log volume explosion — Logs older than 90 days are compressed/archived.
- Review automatic masking of sensitive information (passwords in code snippets, etc.).

---

## Phase 2 — Workflow Depth

Functional differentiation. Commenced after completion of Phase 1.

### Task 2.1: Automatically create Test Scaffold (RED→GREEN)

**Background**
Currently, "test case specifications" are mandatory in the `design` stage, but the actual failing test file is created in the `impl` stage. There is a possibility that the generator weakly writes tests to make its code pass. In the design stage, if you scaffold a failing test first, impl becomes the order to meet the spec.

**Subtask**

1. **`jira-task-design` skill expansion**
   - Generate actual test files by parsing the Test Plan section of the design document (initially failing)
   - Auto-detection of frameworks — Playwright (E2E), Jest/Vitest (unit), pytest, etc.
   - Creation location follows project convention (search for existing test location using Glob)
2. **Change `impl` step behavior**
   - "Completed when the failing test created in design becomes GREEN" is an explicit termination condition
   - Prohibit adding `impl` to `completedSteps` before test passes
3. **fallback** — If the test framework is not detected, only a specification document is created and the user is informed

---

### Task 2.2: Multi-Worktree Cross-Check Automation

**Background**
Although the README says "Check file overlap at design time," there is no cross-worktree automatic check logic in the actual design SKILL. The user must manually run `git diff --name-only`.

**Subtask**

1. **Active worktree navigation logic** — `git worktree list --porcelain` parsing
2. **Collect a set of changed files for each worktree** — `git diff --name-only main...HEAD` per worktree
3. **Cross-check algorithm** — Intersection of files scheduled to be covered by the design document of the current task (Implementation Plan section) vs. set of changed files in other worktrees
4. **Automatically adds a "Conflict Risk" section to the design document when a conflict is found** — indicates which file in which worktree overlaps and needs to be negotiated
5. **Integrated into `jira-task-design` skill**

---

### Task 2.3: CI Result Fetch + 1st Self-Heal

**Background**
Currently ends after `pr`. Even if CI fails, the plugin does not know. To advocate for a full life cycle, at least "poll CI results after PR → attempt automatic correction once if it fails."

**Subtask**

1. **GitHub Actions API integration** — `gh run list --branch feature/<TASK-ID>`, `gh run view <id>`
2. **New action `/jira-task verify <TASK-ID>`** — Check CI status of PR
3. **Automatic call timing** — Short polling mode after `pr` completion (optional, default off — requires user intent to work)
4. **Attempt self-healing in case of failure**
   - Log parsing → Estimating the cause of failure
   - First modification attempt compared to the design document
   - After modification, push → re-polling
   - Escalation to user after 2 failures
5. **Third-party CI system abstraction** — GitLab CI, Jenkins adapter interface definition other than GitHub Actions (only GitHub is implemented first)

---

## Phase 3 — Differentiation / Long Term

### Task 3.1: Reviewer Prompt Auto-Calibration

Analyze the review-log accumulated in Task 1.4 and periodically update reviewer SKILL.md.

**Subtask**

1. **Determine analysis cycle** — Explicit command (`/jira-task calibrate-reviewer`) or automatic trigger when N logs are accumulated
2. **Analysis logic** — Finding patterns with frequent false positives, conclusions frequently overturned by users
3. **Reviewer SKILL.md automatic patch suggestion** — presented to user in diff format, applied upon approval
4. **Version Management** — Record calibration history in `docs/review-log/_calibration-history.md`

---

### Task 3.2: Strengthening Discovery Mode

Enhancing the `discover` stage of Task 1.1.

**Subtask**

1. **Stakeholder Interview Simulation** — Questions for each persona (Developer/Operations/Security/User)
2. **Search for similar past requirements** — Search similar cases in `docs/requirements/` accumulation
3. **Automatically apply NFR (Non-Functional Requirements) checklist**

---

### Task 3.3: Closed network / Server-DC / In-house Git support

**Subtask**

1. **Jira Server/DC PAT authentication branch** — Select Cloud/Server in `setup` wizard
2. **In-house Git Hosting Adapter** — GitLab, Gitea, Bitbucket Server (PR creation/CI integration)
3. **Dependencies in Internet Isolated Environments** — Guide to an in-house PyPI mirror instead of uvx
4. **Documentation** — Closed Network Setup Guide (`docs/setup-airgapped.md`)

---

## Non-code operations

### Task X.1: README Comparison Table Update / Positioning

**Subtask**

1. **Add competitors** — cc-sdd, claude-code-harness, sdlc-studio, Vantor, etc.
2. **2-axis comparison table** — Jira integration depth / full life cycle depth
3. **State your position** — "Jira-native full-cycle harness"

---

## Summary of task sequence

```
Phase 1 (Commercialization Guardrail)
  1.1 Requirements Phase ───────┐
  1.2 Phase gate hooks ├─ Parallel possible
  1.3 Template maintenance (plan only)┘
  1.4 Reviewer log accumulation

Phase 2 (Workflow Depth)
  2.1 Test scaffold (depends on 1.3)
  2.2 Cross-worktree check
  2.3 CI fetch + self-heal

Phase 3 (Differentiation)
  3.1 Reviewer auto-calibrate (depends on 1.4)
  3.2 Discovery Enhancement (depends on 1.1)
  3.3 Closed network support

Bcode
  X.1 README update (available at any time)
```

---

## Ignored external review items

- **"Test does not extract spec from design"** — Test case specification is already enforced in design SKILL.md L54-58. However, I did not create an actual test scaffold, so I used Task 2.1.
- **"The workflow starts from init, so there are no requirements steps"** — Only half true. It is true that the area before init is empty, but this is complemented by Task 1.1. However, the basic premise of this plugin, "starting from the moment a Jira ticket exists" is maintained (standard in the PO/PM separation model).
