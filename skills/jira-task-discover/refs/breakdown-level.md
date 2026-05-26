# Breakdown Level Decision (Step 5 Supplementary Material)

LLM determines the decomposition format according to the input scale. **Do not always force a tree** — Single is the answer for small tasks.

## 3 level definition

| level | form | Applicable conditions (sensory criteria) |
|---|---|---|
| **L1 Single** | 1 task (Epic/Story omitted) | Single PR scope / Single bug fix / Change file ≲ 5 / 1-2 FR |
| **L2 Story+Subtasks** | Story 1 + Sub-task N | Multi-step work in one area / 3-6 FRs / A scale that can be completed by one person in 1 week / When a separate Epic is excessive |
| **L3 Epic+Stories+Subtasks** | Epic + Story N + Sub-task M | Parallel work in multiple areas / FR 7+ / Many Goals / "Introduction/Establishment/Renewal" sentiment / Expect multiple PRs |

## Recommended signal table

Just before `Step 4.5 synthesis-confirm`, LLM recommends one level as input of the synthesis output. Rather than adding up scores based on signal dominance, **determined by 1-2 dominant signals**. If ambiguous, L2 default.

| signal | L1 | L2 | L3 |
|---|---|---|---|
| FR count | 1-2 | 3-6 | 7+ |
| Number of Goals | 1 | 1-2 | 3+ |
| Codebase Context Area | 1-3 files | 4-10 files | area majority |
| Change Area Diversity | Single module | Within one area | Multiple Areas |
| Topic Words | "fix", "single", "bug" | "Extend", "Add" | "Introduction", "Establishment", "Renewal" |
| Dependency/Parallelism | Single PR | sequential | Parallel PR possible |

## Output Template

Fill in the `Proposed Issue Breakdown` section with the confirmed levels.

### L1 Single

```markdown
## Proposed Issue Breakdown

One PR coverage in a single task. Register as a single task instead of an Epic/Story tree.

- **Task**: <one line summary>
  - Scope: <change file/module one line>
  - Verification: <One line of measurable completion criteria>
```

### L2 Story+Subtasks

```markdown
## Proposed Issue Breakdown

Multi-step work in one area. Register 1 Story and N Sub-tasks without Epic.

- **Story**: <Story one-line summary>
  - Sub-task 1: <Subtask summary>
  - Sub-task 2: <Subtask summary>
  - Sub-task 3: <Subtask summary>
```

### L3 Epic+Stories+Subtasks

```markdown
## Proposed Issue Breakdown

Working across multiple domains. Register as Epic + Story + Sub-task tree.

- **Epic**: <Epic 1-line summary>
  - **Story 1**: <Story Summary>
    - Sub-task 1.1: <Subtask summary>
    - Sub-task 1.2: <Subtask summary>
  - **Story 2**: <Story Summary>
    - Sub-task 2.1: <Subtask summary>
```

Common Rules:
- Each item is a one-line summary of a noun phrase or verb phrase
- Dependency estimation is optional. If it can be specified, write it as `(blocks: ...)`, etc.
- L2/L3 tree output can be registered in bulk with `/jira-task create --from-requirements <path>`. L1 registers a single item with `/jira-task create <natural language hint>` (import parser does not support single)

## Change user

The recommended level is displayed with the synthesis result in `Step 4.5 synthesis-confirm`, and the user can specify a different level with `revise`. Free input example: "Change to L3 Tree" / "Single is enough".

## Call flow in Step 5

1. If the `synthesis-confirm` proceed passes, the recommendation level enters a confirmed state.
2. Select one confirmation level from the output templates in this file and fill it in at the end of the document.
3. The `Technical Approach Hint` section is always filled regardless of the decomposition level (section at the end of the requirements document).
