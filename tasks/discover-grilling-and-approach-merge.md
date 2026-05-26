# Discover advancement + plan/design → approach integration plan

- **Status**: Draft
- **Created**: 2026-05-06
- **Target Skills**: `jira-task-discover`, `jira-task-create`, (Phase 2) `jira-task-plan`, `jira-task-design`, new `jira-task-approach`
- **Origin**: User conversation — Matt Pocock's `context-mode:grill-me` concept absorbed into discover, direction of integrating plan/design according to decomposition level

## Background

Two issues were identified in the current workflow `discover → create → init → start → plan → design → impl → ...`:

1. **Discover interview is shallow** — 4 batches ended with 1 question, failing to pursue vague requests to the end. As a result, plan/design spends time reinterpreting requirements
2. **Plan and design are rituals in small tasks** — Both deliverables are enforced even for one-line bug fixes. Essential information amount overlap (both are different aspects of "how to proceed/implement")

Solution Direction:
- Strengthen discover through repeated interviews (grill method) and determine the level of work decomposition
- Include a *Technical Approach* section in the discover output to suffice as input for subsequent steps
- Integrate plan + design into the first stage of `approach`, and differentiate the amount according to the level of decomposition

## Decision (confirmed)

1. **Interview Policy**
   - min 4 / max 10 rounds. At the end of round 6, "Shall we proceed further?" confirm
   - R0 (assumption dump) **Previously** Category advance notice 1 paragraph output
   - Category: ① Stakeholders ② Success criteria ③ Constraints ④ Non-functional requirements (`--lite` excludes ④)
2. **3 types of breakdown levels**: `Single` / `Story+Subtasks` / `Epic+Stories+Subtasks`
   - LLM proposed as a signal (number of functional areas, module area, stakeholder diversity, multi-level completion criteria)
   - In the convergence gate, "Agree sufficient + decomposition level [X]?" Consolidated into single confirm
   - **Principle**: Force prohibition of Epic-Story-Task trees. Smallest suitable format for job size
3. **discover's technical hint**: Covers the approach (not just red flags, but outlines implementation strategies)
4. **plan + design integration**: 1 new `approach` step. Different amount of content by level (Single 5 lines / Story 1 page / Epic uses child Story sequencing)
5. **Parser 3-level support**: `/jira-task create --from-requirements` accepts Single·Story·Tree

## Phase 1 — discover advancement + create parser expansion

**Goal**: Complete the movement independently. Plan/design maintains the existing format, so the risk of regression is low.

### change file

- `skills/jira-task-discover/SKILL.md`
  - Step 3 Text replacement: Repeat interview (R0 assumption dump → Rn follow-up). Add category advance notice paragraph
  - Step 5 branch expansion: Single / Story / Tree 3-level. Integrate level confirmation into convergence gate
  - No grill related flag in Input Model (default operation)
  - New section between Steps 4 and 5: **Technical Approach Hint** (Approach outline for each decomposition unit — Phase 2 input)
- `skills/jira-task-discover/refs/iterative-interview.md` (new)
  - Loop body, category coverage check, round upper limit/confirm time
- `skills/jira-task-discover/refs/breakdown-level.md` (New)
  - 3-level signal table + 3 types of output templates
- `skills/jira-task-create/refs/from-requirements-mode.md`
  - Allow Epic optional (Receive Story-only tree as is, remove automatic Epic creation)
  - Added single format parsing (current E4 natural language fallback → regular parsing)
- `skills/jira-task-create/SKILL.md`
  - When creating an issue, record the `breakdownLevel` field in `.jira-context.json` (Phase 2 input)
- `templates/requirements.template.md`
  - Level 3 spot in the disassembly section. New Technical Approach Hint section
- `.claude-plugin/plugin.json`
  - version bump

### Verification Checklist

- [ ] Runs 4~10 rounds with default discover, prints 1 paragraph of category notice
- [ ] `--lite` maintains max 10, but omits NFR category
- [ ] Confirmation prompt appears at the end of round 6
- [ ] Step 3.5 conflict detection operates as is in `--from` mode
- [ ] Determined as one of the 3 levels in Step 5, user can change
- [ ] Technical Approach Hint section exists at the end of the requirements document
- [ ] `/jira-task create --from-requirements` Single file → Create only one task
- [ ] `/jira-task create --from-requirements` Story-only → Create Story+Subtasks without forcing Epic
- [ ] `/jira-task create --from-requirements` Tree → Maintain existing behavior (no regression)
- [ ] Check `breakdownLevel` record in `.jira-context.json`

## Phase 2 — plan + design → approach integration

**Goal**: Reduce workflow steps (13 → 12), eliminate duplication of deliverables. System wide change.

### change file

- `skills/jira-task-approach/SKILL.md` (New)
  - level-aware Length: Single 5 lines / Story 1 page / Epic only child Story sequencing
  - `.jira-context.json.breakdownLevel` first, if not, fallback inference from Jira issuetype
  - Complies with Cache-First Fetch pattern
- `skills/jira-task-approach/refs/level-templates.md` (new)
  - Level 3 output template
- `templates/approach.template.md` (new)
- Remove `skills/jira-task-plan/`, `skills/jira-task-design/`
- Remove `templates/plan.template.md`, `templates/design.template.md`
- `commands/jira-task.md`
  - action routing: `plan`/`design` → alias processing with `approach` and output deprecation information once
  - Update all argument-hint, action list, auto sequence description, and report workflow steps
- `hooks/scripts/phase-gate.config.json`
  - `plan`/`design` stage removed, `approach` stage 1 established
  - `approach.requires = ["start"]`, `impl.requires = ["approach"]`
  - artifacts glob: `docs/approach/{TASK_ID}.approach.md`
- `hooks/scripts/phase-gate.scenarios.test.js`, `phase-gate.test.js`
  - Scenario update
- `hooks/scripts/dashboard-ingest.sh`, `dashboard-ingest.test.sh`
  - Step label update
- `scripts/dashboard/` (UI)
  - Updated stage column/badge notation
- `skills/jira-task-auto/SKILL.md`
  - Sequence `start → plan → design → impl` → `start → approach → impl`
- `skills/jira-task-report/SKILL.md`
  - Update workflow step labels
- `scripts/jira-context-update.py`
  - Effective step whitelist: Remove `plan`/`design`, add `approach`
  - Migration logic that considers `plan`+`design` completed traces of existing tasks as satisfying `approach` (one-shot)
- Batch update of Completion Summary `Progress` line of all skills (`discover → create → init → start → approach → impl → test → review → merge → pr → done`)
- `CLAUDE.md` Repository Layout section, update list of valid steps
- Update `README.md` user document
- `.claude-plugin/plugin.json` version bump

### Migration

- Protection of existing in-flight tasks:
  - If both `plan`+`design` are present in `.jira-context.json.completedSteps`, `approach` is considered satisfied
  - If `docs/plan/<TASK>.plan.md` or `docs/design/<TASK>.design.md` exists, phase-gate passes `approach`
- Deprecation Windows: During the 1 minor version, `/jira-task plan`·`/jira-task design` is routed to approach and a guidance message is output. Remove after

### Verification Checklist

- [ ] Approach skill is calculated normally at all 3 levels
- [ ] Impl entry allowed when phase-gate meets approach in absence of plan/design
- [ ] Tasks with traces of existing plan/design are recognized as meeting the approach
- [ ] auto sequence operates as a new step
- [ ] Show new step labels in dashboard
- [ ] report is output in new step order
- [ ] When calling `/jira-task plan TASK-123`, route to approach + deprecation message

## Ground for phase division

- Operation completed with only Phase 1 — plan/design maintains existing flow. Independent verification possible
- Phase 2 is system wide, including phase-gate, routing, and dashboard. Difficult to track regression if grouped all at once
- By using Phase 1, it is possible to measure whether the Technical Approach Hint section is actually sufficient as an approach input. If it is insufficient, Phase 2 design will be different

## Open Questions

- When is the user confirmation point in the approach skill? (Once after full synthesis vs. immediately after level decision + twice after synthesis)
- Interaction matrix definition is required when both `--lite`/`--from`/(Phase 2) approaches are used simultaneously
- Phase 2 deprecation window length (is 1 minor sufficient, can it be removed immediately?)
- Existing `tasks/improve-plan-template.md`·`tasks/improve-design-template.md` will be discarded in Phase 2 — Separate cleanup required
