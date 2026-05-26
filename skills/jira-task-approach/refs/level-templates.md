# Approach Output Templates (3 levels)

Use only the output block for the level selected in `jira-task-approach` Step 3.2. Ignore other levels.

See SKILL.md Step 0 for level selection. Length is intentionally constrained to reduce token cost; trim if output exceeds the target.

---

## L1 Single — 5-line summary

One task (single PR scope / changed files ≲ 5). End with exactly these 5 lines; one sentence per line.

```markdown
## Approach (L1 Single)

- **Change Area**: <one line of files/modules>
- **Key Decision**: <format: `Y instead of X — because Z`. Include rejected alternative in one line. If no real decision exists, "follow existing pattern" is enough.>
- **Verification**: <one line describing how completion criteria are measured>
- **Risk**: <one identified risk, or "None">
- **Rollback**: <one line on revert feasibility>
```

Do not create tables or diagrams for L1. Compress the requirements doc Technical Approach Hint into 1-2 sentences and distribute it across the fields above.

---

## L2 Story — one page

Multi-step work in one area (3-6 FRs / 4-10 changed files). Use the following 6 sections and keep the whole document within one page. Each section should be 5-10 lines.

```markdown
## Approach Summary (L2 Story)

<2-4 lines: what will be built and how. Equivalent length to plan Background + design Overview combined.>

## Architecture

<Identify one seam that is hard to change later — module dependency direction, data/transaction boundary, or external-system boundary. Free-form tree/text is fine. Use a diagram only when the flow is not clear in a table.>

## Implementation Plan

| # | File | Change Type | Size | Summary |
|---|------|---------|---|------|
| 1 | `{path}` | New/Modify/Delete | S/M/L | <1-2 lines> |

## Key Decisions

| # | Decision | Alternative | Rationale |
|---|---|---|---|
| 1 | <what> | <alt> | <why> |

Before writing, rule these **design dimensions** in or out. Include only dimensions this work touches (do not force empty rows):
data model/schema · transaction/atomicity boundary · interface/API contract · concurrency/idempotency/order · security/authorization boundary.
Each decision must trace back to an FR/AC or Risk; source-free decisions are fake. Include implementation decisions only. At least one row is required — "keep existing pattern" is acceptable when true.

## Test Plan

| # | Case | Verified AC |
|--|--|--|
| T1 | <scenario> | AC-1 |

Separate Unit/E2E only when useful. Include 3-5 core cases.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| <risk> | <impact> | <mitigation> |

If no risks were identified, write one line: `N/A — reviewed`.
```

Optional: `## Open Items` — carry forward unresolved P1/[CONFLICT] items. This gates impl entry.

Data model changes, security impact, or work requiring sequence diagrams may exceed L2; suggest escalating to L3.

---

## L3 Epic — child Story sequencing only

Work spanning multiple areas. **Detailed design belongs in each child Story approach**. This document contains only sequencing and dependencies.

```markdown
## Approach Summary (L3 Epic)

<2-3 lines: Epic goal + decomposition strategy summary.>

## Child Story Sequencing

| # | Story Key | Summary | Depends On | Parallelizable | Notes |
|---|---|---|---|---|------|
| 1 | <STORY-1> | <one-line summary> | - | Y | prerequisite work |
| 2 | <STORY-2> | <one-line summary> | STORY-1 | N | |
| 3 | <STORY-3> | <one-line summary> | - | Y | parallel with STORY-1 |

Child Story identification source: cachedIssue `subtasks` + `issuelinks` (`Blocks` / `is blocked by`).

## Cross-Story Concerns

<1-3 lines for cross-cutting concerns across Stories. If none, delete the whole section.
Examples: shared interface agreement, migration order, rollback strategy.>

## Risks (Epic-level)

| Risk | Impact | Mitigation |
|------|--------|------------|
| <epic-level risk> | <impact> | <mitigation> |

If no risks were identified, write one line: `N/A — reviewed`.
```

In L3, do not include per-file Implementation Plan, Key Decisions, or Test Plan in this document; each child Story approach owns those. Including them here duplicates child work and wastes tokens.

If child Stories are missing, carry them to `Open Items` and recommend creating child issues.
