# Iterative Interview Loop

The text of the repeated interview in `jira-task-discover` Step 3. Read SKILL.md Step 3 and execute as is.

## Category definition

Answers are always classified into one of the four categories (Q-bucket) below. Regardless of the round number, answers in the same category are accumulated in the same bucket, and the Step 4 trace marker uses the `Q1` to `Q4` index as is.

| index | Category | --lite |
|--------|---------|--------|
| Q1 | Stakeholders | Included |
| Q2 | Success Criteria | Included |
| Q3 | pharmaceutical | Included |
| Q4 | Non-Functional Requirements (NFR) | **Exclude** |

`activeCategories` set:
- default mode: `{Q1, Q2, Q3, Q4}`
- `--lite` mode: `{Q1, Q2, Q3}`

## R0: Category advance notice

Print 1 paragraph to the user just before entering the loop (not a question, one-way guidance):

```
From now on, we will ask for your requirements in rounds. The categories we will cover are:

- Stakeholder (Q1): Who uses it
- Success Criteria (Q2): What must be met to be considered complete
- Constraints (Q3): Technology/Time/Cost/Regulatory Limitations
- Non-functional requirements (Q4): Performance, security, accessibility, observability, etc. ← Excluded in --lite mode

Minimum of 4 rounds / maximum of 10 rounds. At the end of round 6, you will be asked whether you want to continue.
```

In `--lite` mode, remove the NFR line from the above paragraph and print it. Other phrases are the same.

## Round Loop

State variables:
- `roundCount` — Number of rounds played (integer, initial 0)
- `bucket: {Q1: [...], Q2: [...], Q3: [...], Q4: [...]}` — Cumulative array of answers by category
- `MIN_ROUNDS = 4`
- `MAX_ROUNDS = 10`
- `CONFIRM_AT = 6`

### 1st round unit procedure

1. **Select the next category**
   - `bucket[Q]` first selects `activeCategories` members among empty categories (coverage priority).
   - Once everything is filled out, select the category that needs the most in-depth reinforcement based on LLM judgment (e.g., answers are shorter or more ambiguous).
2. **Create 1 question**
   - 2-4 multiple choice options that fit the category + 1 question accompanied by "Other → Free input" and 1 call to `AskUserQuestion`.
   - Questions are narrowed to reflect new context (previous answers) in each round — no repetition of the same question.
3. **Save Answer**
   - Append the answer to `bucket[Q<N>]`. "Other → (empty)" responses are stored as `TBD` tokens (subject to Step 4 Open Questions upgrade).
4. **`roundCount += 1`**
5. **Termination Decision** (See "Termination Conditions" section below)

### End condition

After each round, decisions are made in the following order:

1. **`roundCount < MIN_ROUNDS`** → Proceed to the next round unconditionally. Do not ask for confirmation.
2. **`roundCount === CONFIRM_AT` (6)** → Confirm once with `AskUserQuestion`:
   - Option A: "Continue" → Proceed to next round
   - Option B: "Finish" → Jump to coverage check (#3 below)
   - If the response is "Other → (empty)", default = "Finish"
3. **Coverage Check**:
   - Among `activeCategories`, `bucket[Q]` collects empty categories (`uncovered`).
   - If `uncovered` is empty → Loop ends and enters Step 4.
   - If not empty → select 1 category from `uncovered` and proceed with **forced 1st round** (within `MAX_ROUNDS` limit). This forced round does not ask for user confirmation. Reinforce only one category with one mandatory round — Do not ask about all unmet categories at once.
4. **`roundCount >= MAX_ROUNDS`** → Force quit. The unmet category is upgraded to ‘[P1] category <name> answer missing' in Step 4 Open Questions.
5. If none of the above apply → proceed to the next round.

### `--from` mode correction

If there is a body imported with `--from <path>`, before starting the loop, extract category-specific information from the import body and pre-fill `bucket[Q<N>]` with `*(source: from)*` markers. Categories that are already populated are considered covered in the coverage check — the loop asks only the missing categories or does additional rounds to augment depth. The same applies to `MIN_ROUNDS`.

For specific rules such as promotion format, refer to `refs/conflict-detection.md` (Read in Step 3.5). This file is only responsible for the interview loop.

## Output

At the end of the loop, pass the `bucket` object to Step 4. The synthesis in Step 4 is compatible with the existing table (Q1-Q4 mapping) — since the index system does not change, the trace marker rules also operate without modification.
