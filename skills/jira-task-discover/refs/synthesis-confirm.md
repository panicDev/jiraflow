# Step 4.5: Synthesis Confirm

**All — Display Conflict Detection results:** If there is more than one `[CONFLICT]` item detected in Step 3.5, the "Conflict Detection Results" section is displayed **first** before the summary of the composite results. The display format is a bullet list of upgraded `[CONFLICT]` items, and when there are more than 4 items, it is abbreviated as "Top 3 + N other items" (same as summary display rules). The user reviews this section and makes a `proceed`/`revise`/`cancel` decision. If conflict is 0, this section is not displayed.

The composite output (Functional Requirements / Edge Cases / Out of Scope / Open Questions) created by Step 4 in memory is verified once by the user. It is a single confirm gate to block quality degradation due to LLM hallucination, random decomposition interruption, and contradictory input.

#### Summary Display Rules

- Each confirm target section is summarized in **3 lines or less** (minimizing user friction in simple input).
- If there are more than 4 items, abbreviate them in the form **Top 3 + "N other items"**.
- The display order is always: Functional Requirements → Edge Cases → Out of Scope → Open Questions (only sections created in that mode).
- **Recommended decomposition level indication (required)**: Add 1 line at the end in the format "Recommended decomposition level: L1 Single | L2 Story+Subtasks | L3 Epic+Stories+Subtasks (1 line of reason)." Recommended calculations follow the signal table in `refs/breakdown-level.md`. When `proceed` is selected, the recommended level is confirmed and delivered to Step 5. If you want a different level, specify it as a free input in `revise` (e.g. "Change to L3 Tree") — The synthesis in Step 4 is not re-executed, only the level is updated.

#### Confirm target mapping by mode

| mode | confirm target section |
|------|------------------|
| default | Functional Requirements / Edge Cases / Out of Scope / Open Questions |
| `--lite` | Functional Requirements / Open Questions (Edge Cases·Out of Scope are not created in lite, so are automatically excluded) |
| `--from` | Same as default — However, it is indicated with a single line of information indicating that it is a "part synthesized and reinforced on the import base" (actual marker application is delegated to Trace Marker MAE-169) |

Even in `--lite` mode, Functional Requirements and Open Questions are maintained as confirmation targets — these are the two sections with the highest risk of hallucination, preventing lite gate from being rendered meaningless.

#### Goals ↔ FR mapping verification (required)

Automatically verifies the Goals ↔ FR mapping of the composite output *before* the confirm mark:

- **Unmapped Goals**: Are all Goals mapped to at least 1 FR? Goals without mapping are automatically upgraded to Open Questions with `[P1]` priority (sort order: TBD → missing mapping → CONFLICT).
- **Orphan FR**: Are there any FRs that do not contribute to any Goal? If present, 1 line of warning above the confirm mark: "⚠️ FR-N is not mapped to any Goal. It may be an Out of Scope candidate or a Missing Goal."

This verification is also an additional gate that catches hallucinated FRs (can be identified if the LLM produces FRs that are unrelated to the goal).

#### AskUserQuestion call (pseudocode)

```
AskUserQuestion(
  question: "Please review the synthesis results. What should I do?",
  options: [
    { id: "proceed", label: "Proceed as is", default: true },
    { id: "revise", label: "Revision Request" },
    { id: "cancel", label: "Cancel" }
  ],
  context: "<Summary of each section within 3 lines according to summary display rules>"
)
```

Labels exposed to users are fixed in Korean ("Proceed as is" / "Request for modification" / "Cancel"). Internal identifiers use `proceed` / `revise` / `cancel`.

#### Branch Handling Procedure

**proceed**
1. Write the output of Step 4 as a file in `docs/requirements/<slug>.requirements.md` (no partial results have been written to the file system up to this point).
2. Enter Step 5 (Issue Breakdown Section).

**revise (revision request)**
1. Receive one line of free input: "Which item in which section and how would I edit it?"
2. If the input is an empty string or only blank spaces, the process returns to the confirm stage as is the previous synthesis result (Resynthesis
3. Increment the resynthesis counter (`resynthesisCount`).
4. Step 2 (code base context)·Step 3 (question answer) cache is reused, and only the composite part of Step 4 is re-executed, reflecting user modification requests.
5. Re-enter Step 4.5 with the updated synthesis output.
6. If the resynthesis result is **completely identical** to the previous result, one line of "no change" notification is displayed to the user and the counter continues to increment (avoiding infinite loop).

**cancel**
1. Discard the composite output in memory (simply leaving it as a Garbage Collection target is sufficient).
2. Since the file system has not been written yet, separate cleanup is not necessary.
3. Print a one-line Korean exit message: "Requirements document creation has been cancelled."
4. Normal termination without abnormal termination code.

#### Infinite loop prevention guard

- Maximum number of resynthesis `RESYNTHESIS_LIMIT = 3` (user friction vs accuracy balance).
- When `resynthesisCount` reaches `RESYNTHESIS_LIMIT`, in the next confirm, the `revise` option is **removed** and abbreviated as `proceed` / `cancel` 2nd quarter.
- Notifies the user, "You have reached your resynthesis limit (3 times). We recommend that you continue or cancel." Prints one line of guidance.

#### Non-interactive environment safeguards

This skill is always called within the user session with `user-invocable: false`, but as a safety measure, if there is no `AskUserQuestion` response, the default `proceed` is applied.

#### Functional Requirements 0 warnings

If there are zero synthesized Functional Requirements (e.g. the extreme case where all answers are "Other → Empty"), add one warning line above the summary display:

> "⚠️No composited items. If you proceed as is, an empty document will be created."

This warning does not change the default of `proceed` (leaving it to the user to decide).
