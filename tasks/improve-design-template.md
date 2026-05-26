# Design Template Reinforcement Plan

> **DEPRECATED (2026-05-07, MAE-358)**: In Phase 2 (MAE-350), plan/design was integrated into `approach`, so this reinforcement plan lost its meaning. Key Decisions / Plan Inputs / Open Items gate requirements have been absorbed into `templates/approach.template.md`. Reserved for historical reference only.

- **Status**: Deprecated (was: Draft)
- **Created**: 2026-04-29
- **Target file**: `templates/design.template.md`, `skills/jira-task-design/SKILL.md` *(both removed in MAE-358)*
- **Related**: `tasks/improve-plan-template.md` (Previous work — Source Requirements / Open Items were added to plan in v0.18.0; deprecated with this work)

## Background

In the PDCA cycle, design is the step that decides "**How ​​to make it**". Currently, `design.template.md` has a well-established structure (Section contract, 6 types of Data Model classification, AC↔Test mapping), but **the basis for the decision is not recorded**:

1. **There is no `Key Decisions` section.** Alternatives, reasons for selection, and trade-offs are not recorded anywhere, so you lose the answer to "Why did you choose this method?" six months later. In previous evaluations, this was identified as the biggest flaw in the design template.
2. **It is disconnected from plan's Open Items.** In v0.18.0, plan can carry over the missing P1 Open Questions / [CONFLICT] / AC mapping to design as Open Items, but the design template and SKILL do not explicitly consume this.
3. **The Open Items section is optional.** There is no gate to force "0 open items remaining" when entering impl.
4. **There is no scale (S/M/L) in the Implementation Plan table.** The scale column was added to the plan's Task Breakdown in v0.18.0, but the design side is not aligned, so consistency is broken.
5. **Architecture section is too free.** Items to be decided (new/modified component, direction of dependency, external system boundary) are not specified.

## Goal

The design is connected to the plan through a two-way trace, and is reinforced by explicitly recording "how" decisions.

- **Two-way trace completion**: In the discover → plan → design chain, design explicitly consumes the Open Items of the plan.
- **Explicit recording of decisions**: Force decision log in ADR format with Key Decisions section.
- **impl entry gate**: Open Items must be "N/A — All resolved" or "Specify reason for carryover" to enter impl.

## Changes

### 1. New `Plan Inputs` section (required)

**Location**: After Overview (or just before Architecture).

**Purpose**: Design explicitly consumes the output of plan. Design is structurally enforced as the step of receiving the *decision* of the plan and converting it into *implementation method*.

```markdown
## Plan Inputs

- **Plan doc**: `docs/plan/<TASK-ID>.plan.md`
  (If plan is not performed: "N/A — plan omitted (Source: <Jira issue / direct discussion>)")

### Plan Open Items Processing

<!-- Receives the Open Items section of the plan as is, and records the processing results in design for each item. -->

| # | plan Open Item | Processing in design | Results |
|---|---|---|---|
| 1 | {Open Item of plan} | resolved / deferred / out-of-scope | {answer or reason} |

### AC ↔ Implementation Mapping

<!-- Which component/module of the design is the AC of the plan realized. Apart from the mapping of the Test Plan (AC↔U/E):
     This is "where is it implemented?" and the test plan is "where is it verified?" -->

| AC (plan) | Implementation location (design) |
|---|---|
| AC-1 | {component / module / file} |
```

### 2. New `Key Decisions` section (required)

**Location**: After Architecture, before Data Model.

**Purpose**: Mandatory recording of the basis for design decisions in ADR format. Only decisions about *how* to make it (scope decisions are in the plan).

```markdown
## Key Decisions

<!-- Decisions made by design about *how* to be implemented. Scope decisions are made by plan. It cannot be 0. -->

| # | decision | alternative | Reason for selection | Cost/Constraints |
|---|---|---|---|---|
| 1 | {what — e.g. "Validate OTP with asynchronous queue"} | {alternative — e.g. "synchronous call"} | {why} | {cost/constraint} |
```

If there is less than one decision in the main text, one or two bullets may be substituted for the table, but the decision itself to "no change — maintain the existing pattern" must be recorded.

### 3. `Open Items` Optional → Required

**Current**: `<!-- optional: When there are pending items to be decided just before entering impl. -->`
**After changes**: Required. If not, just one line: `N/A — Solve all`.

**Rationale**: impl entry gate. All open items in the plan must be processed through design. Prevents unresolved items from hiding in your code.

### 4. Add `Size` column to `Implementation Plan` table

```markdown
| # | file | Change Type | scale | Summary |
|---|------|---------|---|------|
| 1 | `{path}` | New/Edit/Delete | S/M/L | {1-2 line summary} |
```

Consistency alignment with plan's Task Breakdown scale column. If the size of each file estimated by design is different from the plan estimate, it is carried over to Open Items.

### 5. Strengthening the `Architecture` section guide

Keep the existing free description, but specify the **minimum decision items** as a guide:

```markdown
## Architecture

<!-- Specify at least the following three ("N/A" if not applicable):
     1. Newly added component vs. modification of existing component
     2. Inter-module dependency direction
     3. Boundary with external system (in-process / sync API / async)
-->
```

The text format is free (diagram / tree / text). The only thing that is mandatory is that the answers to the three items above must be included somewhere.

### 6. Section contract renewal

```
Required: Plan Inputs (new), Architecture, Key Decisions (new), Data Model, Sequence Diagram,
      Implementation Plan, Error Handling, Security Checklist, Test Plan, Open Items (Upgraded)
Recommended: Overview
Optional: Out of Scope, Interfaces / Types, Notes
```

### 7. SKILL.md reinforcement

`skills/jira-task-design/SKILL.md`:

- **Step 1.5 New **: Read the plan document and extract the Open Items / Source Requirements / AC table. P1 If there are any unresolved items, resolve them in design or explicitly carry them over.
- **Step 3 writing guide added**: Writing instructions for each new/enhanced section. In particular, it is specified that Key Decisions cannot be 0 and that the Plan Open Items processing table must be filled in completely.

## Final structure (after changes)

```
## Overview (recommended)
## Plan Inputs (new, required)
## Architecture (required, strengthened guide)
## Key Decisions (new, required)
## Data Model (required)
## Sequence Diagram (required)
## Implementation Plan (required, add size column)
## Error Handling (Required)
## Security Checklist (Required)
## Test Plan (Required)
## Out of Scope (Optional)
## Open Items (upgraded to required)
## Notes (optional)
```

## Scope of influence

- `templates/design.template.md` main body.
- New `skills/jira-task-design/SKILL.md` Step 1.5 + Step 3 guide.
- `.claude-plugin/plugin.json` version → `0.18.1` (template contract changed, but patch because it is the same minor cycle as plan).
  - Inventory: Adding a contract is close to a minor change. 0.19.0 is more accurate. → **Decided to be 0.19.0**.

## Non-target

- Modify discover template (separate task: Add Goals↔FR mapping).
- Additional modifications to the plan template.
- Strengthening the automatic analysis logic at the design stage (e.g. automatically filling the codebase analysis results into Architecture).

## Verification criteria

1. **Trace verification**: Pick a random design.md → Are all open items in the plan included in the Plan Inputs > Plan Open Items processing table? Are all ACs in the plan in the AC↔Implementation mapping table?
2. **Decision Verification**: Can someone who reads the design answer "Why did you choose this implementation method and what did you reject?"
3. **impl gate verification**: Does impl start with an unresolved P1 item in Open Items? (Does SKILL warn you)

## Resolved Decisions

- **Plan Inputs Location**: Next to Overview / Just before Architecture. It is natural to specify the connection with the plan first before starting the design text.
- **Key Decisions Location**: After Architecture, before Data Model. In Architecture, the big picture is drawn, Key Decisions explain *why* the picture was drawn that way, and the Data Model follows as a result.
- **plan vs design decision boundary** (same as v0.18.0): plan is "*what / to what extent*", design is "*how*". Only the latter in Key Decisions.
- **Version**: 0.19.0 (template contract additional changes).
