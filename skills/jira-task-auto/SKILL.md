---
name: jira-task-auto
description: "Auto-execute the full Jira task workflow (start → approach → impl → test → review) sequentially. Triggers: jira-task auto, auto run, full workflow automation."
user-invocable: false
argument-hint: "<TASK-ID>"
allowed-tools:
  - Read
  - Edit
  - Agent
---

# jira-task-auto: Auto-Execute Full Workflow

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Overview

**Lightweight orchestrator** that automatically sequentially executes the steps `start → approach → impl → test → review`.

- Each step is executed as an independent sub-agent (`Agent` tool)** → Context isolation + Persona isolation
- Assignment of appropriate model for each stage (model differential)
- Does not include `merge`, `pr`, `done` (external public actions requiring manual execution)
- Already completed steps are skipped (based on `completedSteps` in `.jira-context.json`)
- When a problem is found in the review → fix sub-agent → test → retry the review (maximum 2 times)
- If any other step fails, stop immediately

**Core principle: Keep the orchestrator light.** Only checks `.jira-context.json`, calls Agent, and judges the result. All step-by-step tasks are delegated to sub-agents. The output body does not come into the parent context (only the path is traced).

## Step 1: Load Context and Plan Execution

Read `.jira-context.json` with the `Read` tool to check `completedSteps`.

**Steps to run**: `["start", "approach", "impl", "test", "review"]`

Decide on an action plan excluding steps that have already been completed.

Show the user the execution plan:

```
🚀 Auto mode: <TASK-ID>

Steps to execute: start → approach → impl → test → review
Completed Steps: <completedSteps list or "none">
Steps to skip: <list of steps already completed or "none">

Each step is executed sequentially as an independent sub-agent (differential application of model).
PDCA advisories are applied automatically — to change them, exit auto and step through them.
```

### Step 1.5: start Reflection of recommendation (PDCA skip)

After the start sub-agent is completed, if there is a "PDCA recommendation" block in the response body, steps included in the "skipable" list will output only a one-line reason **without calling the sub-agent** and proceed to the next step. The main session (this orchestrator) reads the text directly and makes decisions — no separate parsing logic or storage schema.

Rule:
- Skipped steps are not added to `completedSteps` (they are not executed).
- If there is no advisory block or "Skip possible: None", all steps are executed normally.
- If the user reverses the recommendation in natural language ("Please include the test"), it is followed — the recommendation is a suggestion, not a compulsion.

Example output (when skipped):
```
⏭ Skip test (start recommendation: change text without changing behavior)
```

## Step 2: Sequential Execution

Execute each step in the order below. **Each step is delegated by creating an independent sub-agent with the `Agent` tool.** It is not called directly from the parent context with the Skill tool.

**Important Rule:**
- Before calling each step, read `.jira-context.json` again with `Read` and skip if already completed
- Each Agent runs in the foreground (you must receive the result to proceed to the next step)
- After completing the Agent, read `.jira-context.json` again with `Read` to check whether it has been added to `completedSteps`.
- If it is not added, the step is judged to have failed → Stop (except for review, see Step 3)

### Sub-agent call standard contract

If each step is not in `completedSteps`, it calls `Agent` with the pattern below:

```
Agent({
  description: "Jira-task <step> for <TASK-ID>",
  subagent_type: <subagent_type by stage>,
  model: <step-by-step model>,
  prompt: <step-by-step prompt — see standard prompt format below>
})
```

### subagent_type and model step by step

| order | steps | subagent_type | model | Accident type |
|------|------|---------------|------|----------|
| 1 | start | `general-purpose` | haiku | State transitions + branch setup, almost no judgment |
| 2 | approach | `general-purpose` | opus | Scope/architecture integration decisions — thought-intensive (level-aware) |
| 3 | impl | `general-purpose` | sonnet | Generate code, consume large amounts of tokens |
| 4 | test | `general-purpose` | sonnet | Run + organize results |
| 5 | review | `general-purpose` | opus | Orchestration only — the actual review work is performed by the inner `jira-reviewer` agent |

All stages are unified as ‘general-purpose'. Blocking the review's self-praise bias is handled by the `jira-reviewer` subagent, which is launched within the `jira-task-review` skill (Step 2, `Reviewer Independence Rule`).

> See `Read skills/jira-task-auto/refs/review-wrapper.md` for the reason for setting the wrapper as `general-purpose` and the basis for avoiding nesting.

### Standard Prompt Format

Steps other than review (start/approach/impl/test):

```
Perform step <step name> of Jira task <TASK-ID>.

Follow these steps:
1. Call the `jiraflow:jira-task-<step name>` skill (argument: "<TASK-ID>").
2. Perform all steps defined by the skill.
3. After completion, return only the *minimal summary* to the parent context in the following format:

---
- step: <step name>
- result: success | failed
- artifactPath: <docs/.../<TASK-ID>.<type>.md etc. or null>
- jiraCommentPosted: yes | no
- nextStepHint: <optional, one line. Only when parents have recommendations to pass on to the next step>
- failureReason: <only when result=failed, one line>
---

Do not output the output body (approach/test/review document content, etc.) directly to the parent — avoid polluting the parent context.
```

review step (general-purpose wrapper, **`[review-self-mode]` marker required**):

```
[review-self-mode]

Perform the review step of Jira task <TASK-ID>. Call the `jiraflow:jira-task-review` skill and return only the results in the same *minimal summary* format. The output body is not returned.

Note: This wrapper is already in an isolated sub-agent context, so it does not have permission to use additional `Agent` tools. According to the `[review-self-mode]` marker, Step 2 of the skill is performed in self-mode (performed directly) — gap analysis / lint / code quality review is performed directly by the wrapper agent. Since it is a fresh context that is already separated from the approach/impl, there is no concern about self-praise bias.
```

> The `[review-self-mode]` marker is required. If missing, the skill enters Mode A (Agent delegation) and then fails due to the absence of the Agent tool in the sub-agent environment.

### Progress messages between stages

Print after completing each step and before starting the next step:

```
✅ <step name> completed → Next: Starting <next step name>...
```

## Step 3: Review Quality Gate

After completing the review sub-agent, read `.jira-context.json` with `Read` to check whether `"review"` is in `completedSteps`.

### Approve

If `"review"` is in `completedSteps` → proceed to Step 5 (Completion Summary).

### Not Passed (Request Changes) — Scope branch + autocorrect loop

If `"review"` is not in `completedSteps` → the quality gate does not pass. **Before entering the fix loop** Determine scope shortfall using the following heuristic.

#### Scope Shortfall Triage

Read `docs/review/<TASK-ID>.review.md` with `Read` and extract the following signal:
- **Gap matchRate**: Percentage listed in "Design-Implementation Matching Rate" or "Implementation Plan Matching" (regular expression: `Match Rate[^0-9]*([0-9]+)%` or `(\d+)\s*/\s*\d+\s*\(([0-9.]+)%\)`).
- **Critical count**: Number of "Critical" section items.
- **Warning count**: Number of "Warning" section entries.

**Branching Rule**:

| Conditions | Judgment | Action |
|------|------|------|
| matchRate < 70% **OR** Critical count ≥ 3 | **Scope shortfall** | Do not enter fix loop, stop immediately (Scope Shortfall Bail below) |
| matchRate ≥ 70% **and** Critical count < 3 | **Trivial fix** | Enter existing fix loop (maximum 2 times) |
| Failure to extract the above two signals (parse error) | Preserve existing behavior | Enter fix loop (fail-safe) |

> **Threshold 70% / 3 cases evidence**: `skills/jira-task-auto/refs/review-wrapper.md` "Scope Shortfall Branch Evidence" section — Observation distribution-based heuristic. Please refer to the same file for detailed branch grounds.

#### Scope Shortfall Bail

```
❌ Auto mode outage (scope shortfall): The review quality gate showed signs of partial implementation.

Signal:
- Design-implementation matching rate: <matchRate>% (threshold 70%)
- Critical issues: <count> (threshold 3)

Judgment: It appears to be a scope omission that is difficult to fill with a single fix sub-agent. Skip the automatic fix loop and delegate to user decisions.

Current progress: <completedSteps>

Choose one of the following recommended flows:
1. Accept partial implementation as is and end with Phase 1 → After `/jira-task merge <TASK-ID>`, unimplemented subtasks are separately init
2. Perform additional implementation directly → After additional work on the feature branch, re-execute `/jira-task review <TASK-ID>`
3. Manually rerun only the impl/test/review steps → Call `/jira-task <step> <TASK-ID>` step by step
```

#### Trivial Fix Path — Auto-correct loop

If the above branch is "Trivial fix", it is automatically corrected up to **twice** and then re-verified.

**Quality Standard:**
- Design-implementation matching rate 100%
- No Critical/Warning issues in Code Quality

**Loop procedure (per round, all delegated to sub-agent):**

1. **Edit sub-agent** (`general-purpose`, sonnet):

   ```
   Agent({
     description: "Apply review fixes for <TASK-ID>",
     subagent_type: "general-purpose",
     model: "sonnet",
     prompt: <prompt below>
   })
   ```

   prompt:
   ```
   Please directly edit the review comments in Jira task <TASK-ID>.

   1. Read `docs/review/<TASK-ID>.review.md` with Read.
   2. Identify Critical/Warning items and Gap Analysis unsatisfied items.
   3. Reflect the pointed out issues directly in the code by editing. Scope of modification is limited to review points — no unrelated refactoring.
   4. Read `.jira-context.json` with Read, remove "test" and "review" from completedSteps, and rewrite it with Edit (making it re-executable).
   5. Return only the following minimal summary to the parent:
      - step: review-fix
      - result: success | failed
      - filesEdited: <Number of files edited>
      - failureReason: <one line upon failure>
   ```

2. **Rerun test**: Recall test sub-agent with the standard call of Step 2.
3. **Rerun review**: Recall the review sub-agent (`jiraflow:jira-reviewer`) with the standard call from Step 2.
4. **Recheck quality gate**: Read `.jira-context.json` to check whether `"review"` exists in `completedSteps`.

Output while modifying loop:

```
🔄 Review quality gate failed (Attempts <N>/2) — Delegate to modification sub-agent and re-verify.
```

### Stop after 2 failures

If the review does not pass after two automatic corrections, stop and report to the user:

```
❌ Auto mode stuck: Failed to pass review quality gate after 2 attempts.

Open issues:
- <Remaining Critical/Warning items — extracted from sub-agent return summary>

Current progress: <completedSteps>

Please edit and rerun manually: /jira-task review <TASK-ID>
```

## Step 4: Failure Handling (review, etc.)

If any step except review fails, stop immediately and receive instructions:

```
❌ Auto mode aborted: Step <step name> failed.

Cause: <failureReason in sub-agent return summary>
Current progress: <completedSteps>

Fix the problem manually and rerun, or
Run the step directly from there: /jira-task <step name> <TASK-ID>
```

## Step 5: Completion Summary

Upon completion of all steps:

```
─────────────────────────────────────────
🎉 Auto mode completed — <TASK-ID>
─────────────────────────────────────────
✅ Completed steps: start → approach → impl → test → review

**Next steps** (requires manual execution):
- merge: `/jira-task merge <TASK-ID>` — Merge feature branch into base
- pr: `/jira-task pr <TASK-ID>` — Create Pull Request
- done: `/jira-task done <TASK-ID>` — Task completion processing
─────────────────────────────────────────
```
