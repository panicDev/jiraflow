# Discover (requirements) Template reinforcement plan

- **Status**: Draft
- **Created**: 2026-04-29
- **Target**: `templates/requirements.template.md`, `skills/jira-task-discover/SKILL.md`
- **Related**: `tasks/improve-plan-template.md` (v0.18.0), `tasks/improve-design-template.md` (v0.19.0)

## Background

discover is the step in PDCA that creates **input for decision**. The decision itself takes place in the plan. Therefore, the responsibility of the discover template is to "arrange all the information necessary for the plan to make a decision."

In the previous evaluation, the requirements template was rated A-, with three recommended enhancements:

1. **Goals ↔ FR mapping table** — Compatible with plan's `Goal Coverage` table (v0.18.0). Only when it is specified which FR satisfies which goal can the plan determine the scope cut.
2. **Separation of 4 types of constraints** (technology/time/cost/regulation) — When the plan cuts the scope, you need to see which constraints are alive.
3. **Enforce NFR item specification** (prevent placeholder passage).

These three are the scope of this work.

## Goal

- The **Goals ↔ FR mapping** is explicitly revealed so that the trace marker of discover is not interrupted in the decision flow of the plan.
- Constraints and NFR are empty or block paths that pass through placeholders.

## Changes

### 1. New table ‘Goals ↔ FR mapping' created (required)

**Location**: Immediately after the Functional Requirements section.

**Purpose**: Compatible with plan's `Goal Coverage` table (v0.18.0). plan receives this mapping as input and determines "which goal will be satisfied in this cycle."

```markdown
## Goals ↔ FR Mapping

<!-- What Functional Requirements are satisfied for each goal in the Goals & Success Criteria.
     - One Goal can span multiple FRs (separated by commas).
     - If there is a Goal that is not mapped to any FR, it is upgraded to Open Questions ([P1] recommended).
     - If there is a FR that is not mapped to any goal, mark it as an Out of Scope candidate or derive an additional goal. -->

| Goal | Satisfied FR | Remarks |
|---|---|---|
| {Goal 1 — Include metrics} | FR-1, FR-3 | |
| {Goal 2} | FR-2 | |
```

**Verification**:
- At least one FR is mapped to every Goal or upgraded to Open Questions.
- All FRs contribute to a certain goal (otherwise, there is a possibility of synthesis error → reexamination).

### 2. Separate 4 types of `Constraints` section (required)

**Current**: Free statement with a bunch of "technology/time/cost/regulatory constraints".
**After change**: Explicitly separated into 4 sub-sections. A category that does not apply is a single line: `N/A — <reason>`.

```markdown
## Constraints

<!-- Forced separation of 4 types. A single line "N/A — Not Applicable" for an empty category.
     To see which constraints are kept alive when the plan decides on scope cuts. -->

### Technical
- {Technology stack, dependencies, compatibility, etc.}

### Schedule
- {Schedule/Deadline}

### Cost
- {Budget/Resources}

### Regulatory
- {Legal/Compliance/Security Policy}
```

### 3. Force specification of `Non-functional Requirements` for each item

**Present**: Free description. If `--lite`, `N/A — lite mode`.
**After changes**: Recommended category table format. Each category specifies a value or `N/A — <reason>`. Block passing placeholder("TBD").

```markdown
## Non-functional Requirements

<!-- Each item must be specified with a value or "N/A — <reason>". "TBD" placeholder is recommended to be upgraded to Open Questions.
     In --lite mode, this entire section is replaced with the single line "N/A — lite mode" (maintaining --lite consistency). -->

| Item | value | Remarks |
|---|---|---|
| Performance (response time/throughput) | {Value or N/A — <Reason>} | |
| Availability / SLA | {Value or N/A — <Reason>} | |
| Security (authentication/encryption) | {Value or N/A — <Reason>} | |
| Scalability (user/data scale) | {Value or N/A — <Reason>} | |
| Observability (logging/metrics) | {Value or N/A — <Reason>} | |
| Compatibility (Browser/OS/API) | {Value or N/A — <Reason>} | |
```

### 4. SKILL.md reinforcement

`skills/jira-task-discover/SKILL.md`:

- **Step 4 (Generate Requirements Document)** Add the following to the list of contents to be filled out:
  - `Goals ↔ FR mapping table` (Mapping derived immediately after synthesizing Functional Requirements)
  - `Constraints` 4 sub-section (Classifies Q3 answers into 4 types. Categories not specified in the answers are `N/A — Not applicable`).
  - `NFR` tabular format (categorizing Q4 answers into 6 categories).
- **Step 4.5 (Synthesis Confirm)**: Add ‘Goals ↔ FR Mapping Verification' to the confirm target — If there is an unmapped Goal, the user is warned and asked whether to upgrade to Open Questions.
- **Inline Fallback Template** (fallback structure at the bottom of SKILL) is also synchronized to the three changes above.

### 5. Migration·Compatibility

- The existing requirements.md (format before v0.18.0) is valid as is. plan SKILL already has a fallback that fills `Goal Coverage` with user answers if *there is* no new table.
- The design SKILL in v0.19.0 also does not directly depend on `requirements format change` (only consumes indirectly through plan).

Therefore, this change only applies to new outputs, and existing outputs are not affected.

## Final structure (after changes)

```
## Stakeholders
## Goals & Success Criteria
## Constraints (4 sub-sections separated)
## Non-functional Requirements (6 categories table)
## Codebase Context
## Functional Requirements
## Goals ↔ FR mapping (new, required)
## Edge Cases (Omitted when --lite, keep existing)
## Out of Scope (Omitted when --lite, maintain existing)
## Open Questions
## Proposed Issue Breakdown
```

## Scope of influence

- Modified `templates/requirements.template.md` body.
- `skills/jira-task-discover/SKILL.md` Step 4 / Step 4.5 / Inline Fallback reinforcement.
- `.claude-plugin/plugin.json` → `0.20.0` (template contract added, 1 new section + 2 forced formats).

## Non-target

- Restructuring of other sections of the requirements template (Stakeholders extension, etc. - except as this was part of the decision phase in the previous evaluation).
- Strengthening the format of the Goals themselves (already set as `<indicator name> · <current value> → <target value> · <measurement method>`).
- Improved discover's LLM synthesis algorithm.

## Verification criteria

1. **Mapping Verification**: Pick a random requirements.md → Are FRs mapped to all Goals? Can the plan transfer its mapping directly to the Goal Coverage table?
2. **Constraints separation verification**: Are all 4 sub-sections present? Are empty categories explicitly N/A or missing?
3. **NFR placeholder block**: Are all 6 categories values ​​or N/A? Are there any cases where ‘TBD' sneaks through?

## Resolved Decisions

- **Location**: Goals ↔ FR mapping immediately after Functional Requirements. Mapping becomes meaningful only after both Goals and FR are defined.
- **`--lite` mode consistency**: NFR has one line, `N/A — lite mode`, as before. Goals↔FR mapping is maintained even in `--lite` (since FR synthesis is active).
- **Version**: 0.20.0 (1 new section + 2 forced formats. Compatibility with existing output is not broken, but minor bump due to addition of new contract).
