# Requirements: <Topic>

- **Slug**: <slug>
- **Mode**: <default | lite | from | lite+from>
- **Generated At**: <ISO8601 timestamp>
- **Source**: jira-task-discover

## Stakeholders

<Step 3 answer #1. Primary users/callers/stakeholders.>

## Goals & Success Criteria

<Step 3 answer #2. Measurable completion criteria. Use this format for each line:
`<metric name> · <current value> → <target value> · <measurement method>`>

- Response time · 800ms → 200ms · p95 latency monitoring
- Synthesis accuracy · 70% → 90% · manual review of 50 samples

## Constraints

<!-- Split Step 3 answer #3 into 4 categories. Empty categories must be one line: "N/A — not applicable".
     This shows which constraints still matter when the plan scopes work down. -->

### Technical
- <technology stack, dependencies, compatibility>

### Schedule
- <timeline/deadline>

### Cost
- <budget/resources>

### Regulatory
- <legal/compliance/security policy>

## Non-functional Requirements

<!-- Each item must be a value or "N/A — <reason>". Escalate "TBD" placeholders to Open Questions.
     In --lite mode, replace this whole section with one line: "N/A — lite mode". -->

| Item | Value | Notes |
|---|---|---|
| Performance (response time/throughput) | <value or N/A — reason> | |
| Availability / SLA | <value or N/A — reason> | |
| Security (authentication/encryption) | <value or N/A — reason> | |
| Scalability (users/data volume) | <value or N/A — reason> | |
| Observability (logging/metrics) | <value or N/A — reason> | |
| Compatibility (browser/OS/API) | <value or N/A — reason> | |

## Codebase Context

<Step 2 result. Per-file path + excerpt summary within 30 lines. If none, write "No relevant area found.">

## Functional Requirements

<Functional requirements synthesized from answers and context. Number each item. Add a trace marker to the end of each item.>

1. <Req-1> *(source: Q2, code: src/notify.ts:45-60)*
2. <Req-2> *(source: Q1)*
3. <Req-3> *(code: src/foo.ts:12-30)*
4. <Req-4> *(synthesized)*

## Goals ↔ FR Mapping

<!-- Which FR satisfies each Goal in Goals & Success Criteria.
     - One Goal may map to multiple FRs (comma-separated).
     - If a Goal maps to no FR, escalate to Open Questions ([P1]).
     - If an FR maps to no Goal, mark it as an Out of Scope candidate or derive an additional Goal.
     - Compatible with the plan Goal Coverage table (plan.template.md); the plan uses this mapping to decide scope. -->

| Goal | Satisfied by FR | Notes |
|---|---|---|
| <Goal 1 — include measurement criteria> | FR-1, FR-3 | |
| <Goal 2> | FR-2 | |

## Edge Cases

<!-- Omit this whole section in --lite mode. Add a trace marker to each item. -->

- <Edge case 1> *(synthesized)*
- <Edge case 2> *(code: src/notify.ts:80-95)*

## Out of Scope

<!-- Omit this whole section in --lite mode. Add a trace marker to each item. -->

- <Item 1> *(source: Q3)*
- <Item 2> *(synthesized)*

## Open Questions

<Items answered as TBD or blocked by insufficient answers. Prefix each item with a priority marker (P1: blocks next step / P2: needs confirmation / P3: informational). Use source: Q<N> to show which answer was insufficient. In --from mode, if imported content contradicts answers, escalate with [CONFLICT] prefix (see Step 3.5). [CONFLICT] items do not get priority markers or trace markers.>

- [P1] <Q1> *(source: Q4)*
- [P2] <Q2> *(synthesized)*
- [P3] <Q3> *(source: Q2)*
- [CONFLICT] Stakeholders: import="operators" vs answer="general users" — decide which is correct

## Proposed Issue Breakdown

<!-- Three breakdown levels (L1 Single / L2 Story+Subtasks / L3 Epic+Stories+Subtasks).
     Fill only the one that matches input size. Do not force a tree every time.
     See skills/jira-task-discover/refs/breakdown-level.md for level definitions, signal table, and templates. -->

<!-- L1 Single example:

- **Task**: <one-line summary>
  - Scope: <one-line changed files/modules>
  - Verification: <one-line measurable completion criteria>
-->

<!-- L2 Story+Subtasks example:

- **Story**: <story summary>
  - Sub-task 1: <sub-task summary>
  - Sub-task 2: <sub-task summary>
-->

<!-- L3 Epic+Stories+Subtasks example:

- **Epic**: <epic summary>
  - **Story 1**: <story summary>
    - Sub-task 1.1: <sub-task summary>
    - Sub-task 1.2: <sub-task summary>
  - **Story 2**: <story summary>
    - Sub-task 2.1: <sub-task summary>
-->

## Technical Approach Hint

<!-- Final section of the requirements document. Since plan/design are merged into approach, this is the first hint for implementation direction.
     Inputs: Codebase Context · Functional Requirements · Constraints.
     No code snippets — focus on decisions, approach options, and cautions.
     In --lite mode, keep this to 3-5 summary lines. -->

### Key Implementation Points
- <1-3 lines of modules/files likely touched to satisfy the FRs>

### Approach Options to Consider
- Option A: <approach name> — one-line pros / cons
- Option B: <approach name> — one-line pros / cons

### Cautions
- <risk/dependency/migration/rollback considerations>
