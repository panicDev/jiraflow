# Plan Template Reinforcement Plan

> **DEPRECATED (2026-05-07, MAE-358)**: In Phase 2 (MAE-350), plan/design was integrated into `approach`, so this reinforcement plan lost its meaning. Requirements for explicit recording of decisions and two-way traces have been absorbed into `templates/approach.template.md`. Reserved for historical reference only.

- **Status**: Deprecated (was: Draft)
- **Created**: 2026-04-29
- **Target file**: `templates/plan.template.md` *(removed in MAE-358)*
- **Related templates**: `templates/requirements.template.md`, `templates/design.template.md` *(design.template.md also removed in MAE-358)*

## Background

In the PDCA cycle, **plan is the step of "determining the scope"**. discover creates input for decisions (requirements document), design determines the implementation method, and plan determines **what to do and how far** in between.

The current `plan.template.md` is structurally clean, but has the following flaws:

1. Connection with **discover output is 0**. Since the trace marker, P1 Open Questions, and [CONFLICT] items in the requirements document are not explicitly consumed in the plan, it is not possible to trace back to "what requirements of discover does this plan meet" even after the plan is finished.
2. **There is no reason or return point for Out of Scope.** The key decision of the plan, "Why was this removed?" is not recorded.
3. **AC is not mapped to discover Goal and In Scope.** Missing verification is not possible.
4. **Task Breakdown has no dependency, scale, or priority.** There is no room for critical path and renegotiation.
5. **There is no section to record the decisions themselves.** The *basis* for the decisions made by the plan, such as scope cuts, approach selection, and trade-offs, disappears.
6. **There is no Open Items section.** When discover's P1 Open Questions are not solved by plan and are transferred to design, there is no place for them.

## Goal

Reinforce the plan template to satisfy both of the following simultaneously:

- **Two-way trace**: Request for discover (Goals/FR/Open Questions/CONFLICT) → Decision on plan → Implementation of design. Trackable in any direction.
- **Explicit record of decisions**: What was chosen, why was chosen, and what was postponed.

## Changes

### 1. New `Source Requirements` section (required)

**Position**: After Background, before Scope.

**Purpose**: Allows plan to explicitly consume discover output.

```markdown
## Source Requirements

- **Requirements doc**: `docs/requirements/<slug>.requirements.md`
  (If you did not go through the discover step, "N/A — discover omitted, source: <Jira issue / minutes / etc>")
- **Resolved Open Questions** (P1/P2 items in discover):
  | # | Priority | Question | Answer (decision in plan) |
  |---|---|---|---|
  | Q4 | P1 | {discover's question} | {answer in plan} |
- **Resolved [CONFLICT]s**:
  | Item | import value | answer value | Select | Reason |
- **Goal Coverage**:
  | Discover Goal | Satisfied with this plan (Y/N/Partial) | Remarks |
```

**Validation**: All P1 Open Questions must be answered or explicitly carried over to the design (see Open Items section).

### 2. Strengthening the Scope section (required)

**Change Out of Scope to tabular format**:

```markdown
### Out of Scope

| Item | Reason | Scheduled to return |
|---|---|---|
| {item} | {Why was it removed} | {next cycle / permanent exclusion / TBD} |
```

**Add source trace to In Scope** (optional but recommended):

```markdown
### In Scope

- {item} *(source: requirements FR-2)*
```

### 3. Add `Acceptance Criteria` mapping table (required)

Add a mapping table below the existing AC body:

```markdown
### AC ↔ Goal/Scope Mapping

| AC | Discover Goal | In Scope item |
|---|---|---|
| AC-1 | Goal 1 | item-A |
```

This table verifies (a) whether AC covers the discover goal, and (b) whether the In Scope item is verified by AC — two-way missingness.

### 4. New `Scope Decisions` section (required)

**Location**: Next to Acceptance Criteria.

**Purpose**: To record the *basis* for the decisions made by plan. Scope cuts, approach selection, schedule/resource trade-offs.

```markdown
## Scope Decisions

| # | decision | alternative | Reason for selection | Impact |
|---|---|---|---|---|
| 1 | {what was decided} | {what else was considered} | {why this} | {scope/timeline/risk} |
```

If there is less than one decision in the text, 1-2 bullets can be substituted instead of tables. There cannot be zero decisions (if there are, record the "no change — keep doing it the way it is" decision itself).

### 5. `Task Breakdown` table column expansion (required)

```markdown
| # | Task | depend | Size (S/M/L) | priority (required/nice) | Verification |
|---|------|---|---|---|---|
```

- **Depends**: on another task number or external system.
- **Scale**: S (<half day) / M (half day - 2 days) / L (2 days+). Not an exact estimate, but to see the **possibility of renegotiation**.
- **Priority**: Required / nice-to-have. If you're short on time, show how far you can cut.

### 6. New `Open Items` section (required)

**Location**: Next to Scope Decisions.

```markdown
## Open Items

- {item — reason + who/when will solve it}
- (if none) "N/A — All resolved"
```

Same role as Open Items in design. A gate that closes the plan.

### 7. `Risks` from optional → required

If blank, a single line "N/A — No risks identified (review completed)" instead of a table. Just missing a section is prohibited.

## Final structure (after changes)

```
## Background (required)
## Source Requirements (new, required)
## Scope (Required, Out of Scope table format change)
## Acceptance Criteria (required, add mapping table)
## Scope Decisions (new, required)
## Task Breakdown (required, column expansion)
## Risks (upgraded to required)
## Open Items (new, required)
## Edge Cases (optional, maintained)
```

## Scope of influence

- Modification of `templates/plan.template.md` body.
- `skills/jira-task-plan/SKILL.md` — Reinforced instructions to fill in new sections. In particular, the Source Requirements section should add a step to read the discover output.
- `skills/jira-task-design/SKILL.md` — Reinforced to refer to the plan's Source Requirements / Open Items / AC mapping table at the design stage (complete with two-way trace).
- `templates/design.template.md` — Reconsider whether design's AC mapping table is compatible with plan's mapping table.

## Non-target (not covered in this work)

- Modify discover template (requirements.template.md). Separated into separate tasks.
- Added `Key Decisions` section to design template. Separated into separate tasks.
- Automation of the plan stage (logic for LLM to automatically fill Source Requirements, etc.). Template maintenance comes first, and automation is the next step.

## Verification criteria

Whether this reinforcement was successful is judged by the following three criteria:

1. **Trace verification**: Pick a random plan.md → Can all ACs in that plan be traced back to discover Goal? Are all In Scopes verified by AC?
2. **Decision Verification**: Can someone who reads the plan answer "Why did you leave out X and why did you choose method Y?"
3. **Renegotiation Verification**: When the time is halved, can you look at the plan and decide "where to cut?"

## Resolved Decisions

- **Legacy case where discovery was not performed**: In the Source Requirements section, indicate `Requirements doc: N/A — discover omitted (Source: <Jira issue / meeting minutes / etc>)`, and place an optional sub-section `Inline Requirements` below it. Write your Goals/Resolved Questions directly there. There is no trace marker, but a trace of the decision remains.
- **plan Scope Decisions vs design Key Decisions boundary**: plan = "*what / to what extent*" (scope decisions). design = "*how* to make it" (decide how to implement it). Example: "Include OTP authentication in this cycle" = plan, "Where will OTP be verified synchronously/asynchronously" = design. Put this principle in a comment (Section contract) at the top of the plan template.
