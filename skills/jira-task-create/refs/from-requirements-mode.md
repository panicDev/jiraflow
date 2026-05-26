# Step 1.5: Parse Requirements Document (★ import mode only)

**Entry condition**: `importMode = true` (determined in Step 0).
**Return Point**: When parsing is successful, jump to Step 5 (Final Preview). Skip steps 1 to 4.

In import mode, this step replaces the automatic decomposition judgment (Step 3/4). The tree is confirmed here.

## Step 1.5-1. File Verification

1. Open the `importPath` file with the `Read` tool.
   - Absent file → Ends after processing **E2**.
   - File size exceeds 1MB → Warning + proceed with `AskUserQuestion` to confirm (consistent with discover pattern).
2. The body is an empty string or contains only spaces → **E3** ends after processing.

## Step 1.5-2. Extract `Proposed Issue Breakdown` section

1. Exactly find the `## Proposed Issue Breakdown` heading in the text (exact case matching).
2. If there is no heading → **E4** processing (natural language mode fallback suggestion and user confirmation).
3. After finding the heading, cut the text up to the next `## ` heading or just before EOF into the section body.

## Step 1.5-3. Root node detection → decomposition level branching

Look at the token of the **first meaningful bullet line** in the section body (ignoring the bullet symbols `-`/`*`, after trimming the spaces):

| first child token | Decomposition level | Subsequent parser |
|---|---|---|
| `**task**:` or `task:` | **L1 Single** | Step 1.5-4A |
| `**Story**:` or `Story:` (without Epic node) | **L2 Story-only** | Step 1.5-4B |
| `**Epic**:` or `Epic:` | **L3 Tree** | Step 1.5-4C |

Identification failure → **E11** (User confirms after natural language fallback suggestion).

Save the confirmed level as the `breakdownLevel` meta (`"L1"` | `"L2"` | `"L3"`).

## Step 1.5-4A. L1 Single Parsing

L1 output template (discover `breakdown-level.md`):

```markdown
- **Task**: <one line summary>
  - Scope: <change file/module one line>
  - Verification: <One line of measurable completion criteria>
```

Rule:
- Only one `**Operation**:` line is allowed. If there are two or more cases, request reinforcement input or terminate **according to E5** (L1 assumes only one case).
- Child lines (`range:`, `verification:`) are optional — if found, they are merged into the description body.
- No dependencies/links. Ignore the blocks notation (L1 has no siblings).

`ImportPayload`(L1):
- `breakdownLevel: "L1"`
- `single: { summary, description? }` — `description?` is the body of the child line with line breaks.
- `epic`/`stories[]`/`links[]` are all empty.

## Step 1.5-4B. L2 Story-only parsing

L2 output template:

```markdown
- **Story**: <Story one-line summary>
  - Sub-task 1: <Subtask summary>
  - Sub-task 2: <Subtask summary>
```

Rule:
- 1 Story node. If there are two or more cases, **E5**.
- Only children of Story are recognized as Sub-tasks (`Sub-task <N>:` or `Subtask <N>:`). The L2 standard is a single index (`1`,`2`,...), but dot indexes (`1.1`,`1.2`,...) that users mimic the L3 template are also tolerated — there is only one Story, so there is no semantic conflict.
- Indentation/bullet rules are the same as 1.5-4C (2/4-space, `-`/`*` mixed use allowed).
- The notation `(blocks: <N>)` only allows references to sibling Subtask indexes of the same Story. Violation is **E7** (skip + warning).

`ImportPayload`(L2):
- `breakdownLevel: "L2"`
- `epic: null`
- `stories[]`: 1 — `{index: 1, summary, description?, subtasks[]}`
- `links[]`: Only sibling references under the same Story.

**Caution**: This level **does not** automatically generate an Epic. (Removal of old E6 fallback — see Scope Decision #3)

## Step 1.5-4C. L3 Tree parsing (existing operation)

L3 output template (standard):

```markdown
- **Epic**: <Epic 1-line summary>
  - **Story 1**: <Story Summary>
    - Sub-task 1.1: <Subtask summary>
    - Sub-task 1.2: <Subtask summary> (blocks: 1.1)
  - **Story 2**: <Story Summary>
    - Sub-task 2.1: <Subtask summary>
```

**Parsing Rules:**

- **Indentation**: Both 2-space or 4-space are allowed. When mixed within the same document, the indentation width of the first child is used as the standard, and if a line that differs from that appears, a warning is issued (**E10**). If parsing itself is not possible, it terminates.
- **Bullet symbol**: Both `-` or `*` are allowed. Mixed use within the same document is allowed.
- **Node identification**:
  - Starts with `**Epic**:` or `Epic:` → **Epic node** (tree root, exactly 1 L3)
  - `**Story <N>**:` or `Story <N>:` → **Story node**
  - `Sub-task <N>.<M>:` or `Subtask <N>.<M>:` → **Subtask node**
  - Ignore lines that do not match (consider them comments), but leave one line in the debug log.
- **Parent Mapping**:
  - Epic 0 cannot occur in L3 (already branched in Step 1.5-3). When it occurs, it is considered a parser fault.
  - Story `<N>`'s parent is Epic.
  - The parent of Subtask `<N>.<M>` is Story `<N>`.
- **`(blocks: <ref>)` notation**:
  - Location: End of Story or Subtask line.
  - Reference format: `<N>` (Story index under the same Epic) or `<N>.<M>` (Subtask index under the same Story).
  - Only sibling references under the same parent are allowed. Subtask references from other stories are processed as **E7** (skip only one link + warning).
  - Multiple references: `(blocks: 1.1, 1.2)` format allowed.

`ImportPayload`(L3):
- `breakdownLevel: "L3"`
- `epic: { summary, description?, ... }` — 1 node
- `stories[]`/`links[]` — As before

## Step 1.5-5. ImportPayload Common Structure

```
ImportPayload {
  breakdownLevel: "L1" | "L2" | "L3",
  single?: { summary, description? }, // L1 only
  epic?: { summary, description?, priority?, labels? }, // L3 only (L2 is null)
  stories[]?: [{ index, summary, description?, priority?, labels?, subtasks[] }], // L2/L3
  links[]?: [{ outwardRef, inwardRef }] // L2/L3 (sibling reference)
}
```

> **priority/labels extraction rule**: There is no priority/labels notation syntax in the standard tree format. Therefore, `priority`/`labels` are always treated as empty optional fields, and **if there is no notation in the tree, priority always uses `Medium`** (fallback to `or "Medium"` in Step 6). labels are automatically populated only on fallback (e.g. `epic-substitute`).

## Tree → Issue Mapping

| level | tree node | Jira issue_type | parent field | Fallback |
|---|-----------|----------------|------------|------|
| L1 | work | `Task` | (none) | In case of failure, report it as is |
| L2 | Story | `Story` | (none) | On failure, `Task` |
| L2 | Sub-task | `Subtask` | Story-KEY | On failure, `Task` + parent=Story-KEY |
| L3 | Epic | `Epic` | (none) | On failure, `Task` + label `epic-substitute` |
| L3 | Story | `Story` | Epic-KEY | On failure, `Task` + parent=Epic-KEY |
| L3 | Sub-task | `Subtask` | Story-KEY | On failure, `Task` + parent=Story-KEY |

**Dependency Expression:**
- `(blocks: ...)` notation → `link_type = "Blocks"` (search the actual name with `jira_get_link_types`).
- "A blocks B" → `outward_issue_key = A, inward_issue_key = B`.
- Tree index → ​​actual key mapping table is accumulated immediately after node creation in Step 6 (`draft_index → ​​created_key`).
