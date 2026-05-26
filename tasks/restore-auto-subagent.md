# Auto mode sub-agent delegation restoration plan

- **Status**: Draft
- **Created**: 2026-04-29
- **Target**: `skills/jira-task-auto/SKILL.md`
- **Related commits**:
  - `dd69a67` (v0.9.0) sub-agent introduced
  - `d475773` (v0.17.1) sub-agent removal — **This work effectively reverts**
  - `ccdf3ee` (v0.17.19) review only sub-agent forced delegation partial restoration
  - `89f70c0` (v0.17.20) "Main context pollution hotfix" — Is this a side effect of the parent-direct call method?

## Background

In v0.9.0, each step of auto (start/plan/design/impl/test/review) was introduced to be executed as an independent sub-agent, but in v0.17.1, it was changed to a parent-direct call method under the diagnosis of "sub-agent base context double billing". This diagnosis omits the following two costs from measurement:

1. **Effect of prompt cache**: The sub-agent base context is the primary candidate for the 5-minute TTL cache. In 6-step sequential execution, the cache read price (approximately 1/10) from the second call. "Double billing" is the cost of one cache miss and is not cumulative.
2. **Parent context pollution cost**: In the parent-direct call method, the raw output (MCP response, Read·Grep results, code body) of each step of plan/design/impl/test/review is linearly accumulated in the parent context. In addition to the token accumulation cost, this causes *quality degradation* such as instruction drift / self-praise bias / planner-implementer bias — losses that are not converted into token costs.

In v0.17.19, the forced delegation of only the review to a sub-agent partially restored self-praise bias. The "main context corruption hotfix" in v0.17.20 is a signal that explicitly recognizes the side effects of the parent-direct call method.

## Goal

Restore v0.9.0's sub-agent delegation scheme to all six stages, but combining refinements learned from the v0.17.x cycle:

1. **All levels sub-agent delegation** — Isolate all 6 levels.
2. **Persona/Model Differentiation** — Assignment of models tailored to each stage's thinking type.
3. **Standardize return contracts** — sub-agent returns only *minimum summary* to parent. The body of the output is only in files and Jira.
4. **Clarification of mandatory review delegation policy** — Structurally blocks self-review of own code (v0.17.19 policy reaffirmed).
5. **Clarification of measurement guide** — To prevent regression, record the guideline "Distinguish between raw and cache-applied when measuring token cost" in the SKILL or task document.

## Changes

### 1. allowed-tools update

```yaml
allowed-tools:
  - Read
  - Edit
  - Agent
  - Skill # review Maintained only for autocorrect loop fallback (optional). Remove if possible.
```

Direct calls to `Skill` introduced in v0.17.1 have been removed in principle. However, in the review auto-correction loop, it is necessary to decide whether the `jira-task-test` / `jira-task-review` re-call path goes to sub-agent or skill — this plan **unifies re-calls to sub-agent** (isolation consistency). Therefore, `Skill` is finally removed.

### 2. Step 2 — Sub-agent call pattern

Delegate each step to the `Agent` tool. The call places the following standard contract:

**Input contract (parent → sub-agent)**:
- `description`: Short one line ("Jira-task <step> for <TASK-ID>")
- `subagent_type`:
  - review only `jira-integration:jira-reviewer` (already defined in v0.17.19)
  - The rest is `general-purpose` — SKILL for each step is called internally
- `prompt`: User intent + Jira context location + Instruction "Call the specified step SKILL as is, and return the result to the parent in the following format"
- `model`: Differential by stage (table below)

**Model differential (same policy extension as review opus fixation in commit `ccdf3ee`)**:

| steps | model | Reason |
|---|---|---|
| start | haiku | State transition + branch setup. Almost no judgment |
| plan | sonnet | Document synthesis + scope determination (opus also possible, cost trade-off) |
| design | opus | Decision·Architecture. Most thought-intensive |
| impl | sonnet | Code generation. Consume a large amount of tokens, opus is cost inefficient |
| test | sonnet | Run + organize results |
| review | opus | Block self-praise bias + thought-intensive (settled in v0.17.19) |

**Return contract (sub-agent → parent)**:

```
{
  step: <step name>,
  result: success | failed,
  artifactPath: <docs/.../<TASK-ID>.<type>.md etc> | null,
  jiraCommentPosted: yes | no,
  nextStepHint: <Optional, 1 line of next step advice that the sub-agent would like to convey to the parent>,
  failureReason: <only when result=failed, one line>
}
```

The parent only sees `result` and `failureReason`. The output body is not brought into the parent context (path tracing only).

### 3. Step 3 — Review Quality Gate (modification loop sub-agentization)

Existing v0.17.1 method: Parents directly edit review points with `Edit` → Recall test/review with `Skill`.

After change: **Modification is also delegated to sub-agent**. Parents only look at the *judgment results* of the review output and delegate the entire "re-test/re-review after reflecting the review's points" to the next sub-agent.

**Auto-correct loop (per round)**:

1. **Modify sub-agent call** (`general-purpose`, sonnet — same as impl):
   - prompt: "Read docs/review/<TASK-ID>.review.md and directly correct Critical/Warning and Gap Analysis unsatisfied items. The scope of correction is limited to review points. After completion, remove test/review from completedSteps in .jira-context.json."
2. **test sub-agent re-invocation**.
3. **review sub-agent recall** (`jira-integration:jira-reviewer`, opus).
4. If review is added to completedSteps, pass, otherwise go to next round.

**Up to 2 times**. Then discontinued + user reporting (keep current).

The parent context tracks only the review output path. I don't read the text.

### 4. Regression prevention guide (required)

Add the following block to the end of the SKILL body (or as separate docs):

```markdown
## Design Rationale: Sub-agent Delegation

**Why delegate to sub-agent**

1. **Context isolation** — Instruction drift occurs when step 6 raw output (MCP response, code body, navigation results) is accumulated in the parent.
2. **Persona Isolation** — If the instance where the plan was made is carried out as is, rationalization bias occurs. Reviewers have self-praise bias.
3. **Model differential** — Appropriate model can be assigned to each stage (sub-agent model override).

**Be careful when measuring token cost**

The sub-agent base context is the primary target of the prompt cache. Ignoring the cache hit rate in the measurement creates the illusion that the sub-agent appears "more expensive." When evaluating regression:

- Measured based on *billing token*, not raw token.
- Measured based on a *6-step full cycle* rather than a single step.
- Measure the *context cumulative cost* of parent-direct call mode together.

This guideline is intended to avoid repeating the token diagnosis error of v0.17.1 (context accumulation + missing cache effect).
```

## Non-target

- New definition of separate sub-agent other than jira-reviewer. In this work, the `general-purpose` + step-by-step SKILL call pattern is used. Later, specialized agents at each stage (e.g., revival of `jira-implementer` and `jira-planner`) will be separate tasks.
- Sub-agentization of merge / pr / done steps (outside of auto scope as of now).
- Model differential cost analysis. This plan only presents tables; actual measurements are a separate task.

## Verification criteria

1. **Isolation Verification**: After auto execution, the context usage of the parent session must remain at the single step amount + summary accumulation (all raw output is not accumulated).
2. **Persona verification**: The review step must not be run on the same instance that performed plan/impl (sub-agent separation = automatically guaranteed).
3. **Resumption Verification**: When automatically re-executing a task interrupted in the middle step, completedSteps-based skip works correctly even in sub-agent delegation mode.
4. **Regression Guide Visibility**: Design Rationale block is included in the SKILL body, so it can be immediately discovered later when someone tries to remove it by just looking at the token.

## Resolved Decisions

- **Re-invocation is also unified as a sub-agent** (Skill direct call fallback is not used) — Isolation consistency is prioritized.
- **review forces `jira-integration:jira-reviewer`** (v0.17.19 policy reconfirmed). The rest is `general-purpose` + step-by-step SKILL.
- **Model differential application**. Step by step table as above.
- **Return contract**: Sub-agent returns only path/result/summary, not the text.
- **Version**: 0.21.0 (auto operation mode change — minor bump).
