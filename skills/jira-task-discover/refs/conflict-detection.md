# Step 3.5: Conflict Detection (--from mode only)

In `--from` mode, contradictions between the import body and Step 3 answers are automatically detected and promoted to `[CONFLICT]` format in the Open Questions section. This is to wait for the user's decision rather than arbitrarily selecting one of the two options, and prevents incorrect information from being transmitted to the subsequent `jira-task-create`.

#### Entry conditions

| Conditions | Enter Step 3.5 |
|------|-------------|
| `--from` mode + import file not empty | **Entry** (normal case) |
| `--from` mode + import file is empty file (fallback to default mode in Step 0) | Passed (Already nullifying the `--from` effect in Step 0) |
| default mode (no `--from`) | passed (no import body to compare) |
| `--lite` mode only (no `--from`) | passed (no import body to compare) |
| `--lite + --from` mode | **Entry** (Q4 inactive → NFR category is automatically excluded, only the remaining 3 categories are compared) |

If not entered, this step is skipped entirely (no-op). No separate guidance message.

#### Compare to: 4 categories

| Category | Source | Conflict recognition case |
|---------|------|--------------------|
| Stakeholders (Q1) | Step 3 Answer No. 1 | User group names/scopes are clearly different (e.g. "Administrators" vs "General Users") |
| Goals & Success Criteria (Q2) | Step 3 Answer No. 2 | Conflicting metrics (e.g. "throughput 1k/s" vs "throughput 10,000/s"; "response 200ms" vs "response 1s") |
| Constraints (Q3) | Step 3 Answer #3 | A new constraint that was not present in import appears as an answer; The answer explicitly negates the existing constraints on import |
| Non-functional Requirements (Q4) | Step 3 Answer No. 4 | Performance/Security/Accessibility/Observability items explicitly conflict |

The comparison target at this stage is limited to the four categories above. The four types of Step 4 synthesis (FR/Edge Cases/Out of Scope/Open Questions) are not subject to comparison at this stage (they are synthesized later than Step 3.5 and are a separate responsibility).

#### Prose comparison heuristic

- Elevate **only when the conclusion is explicitly different**. Compare by keyword or semantic unit (comparison of semantic units relies on LLM reasoning).
- **Simple additional information (non-contradictory addition) is not a conflict.** Even if new information that was not included in the import is added to the answer, it will not be upgraded unless it negates the existing information (preventing false positives).
- **Multilingual mixed (import Korean vs. answer English or vice versa)**: Delegates comparison of semantic units of LLM.
- **False positive due to typing mistake**: Outside the scope of this issue. User can edit in Step 4.5 confirmation gate.
- **Internal contradiction in the import text itself**: Outside the scope of this issue. The quality of the import itself is assumed.

#### Elevated Format Standard

```
- [CONFLICT] <category>: import="<original>" vs answer="<answer>" — Need to decide which one is correct
```

Principle:
- `<category>`: One of 4 types (`Stakeholders` / `Goals` / `Constraints` / `NFR`). Abbreviations are allowed if the full name is long (e.g. `NFR`, `Goals`, etc.)
- `<original>` / `<response>`: One-line summary. A short quotation that makes sense when the original text is long. No line breaks/italics/bolds within quotation marks (readability)
- The last Korean phrase ("Need to decide which is correct") is fixed — specifies that it awaits user decision
- **Sensitive information redact**: If the `<source>`/`<reply>` quote contains credentials, tokens, or PII, it will be masked (replaced with `***` or a one-line summary).

Example:

```
- [CONFLICT] Stakeholders: import="Administrator" vs answer="Normal User" — Need to decide which one is correct
- [CONFLICT] Constraints: import="Response time within 200ms" vs answer="Response time within 1 second" — Need to decide which is correct
```

If there are multiple conflicts in one category, each is upgraded to a separate item (multiple conflicts are allowed, no grouping in the same category).

#### Mutual exclusivity with Trace marker

- The `[CONFLICT]` upgrade item **does not attach the trace marker (`*(source: Q<N>)*`, `*(synthesized)*`, etc.) of Step 4 — the `[CONFLICT]` prefix itself serves as a source indication.
- When comparing markers already attached to the import body (`*(source: from)*`, etc.), the marker is ignored and only the body is compared. Markers are not moved to upgrade items.

#### `--lite + --from` consistency

`--lite` mode disables Q4 (NFR), so when `--lite + --from` is used simultaneously, the NFR category is automatically excluded from the comparison in this step. The remaining 3 categories (Stakeholders/Goals/Constraints) are compared normally.

#### Collaboration with Step 4

The `[CONFLICT]` item upgraded in Step 3.5 is automatically included in the Open Questions section of Step 4 (listed together with existing TBD items, order: TBD items first → conflict items next).

#### Collaboration with Step 4.5

If more than one conflict is detected, the "Conflict Detection Results" section is displayed **before** the summary of the synthesis results in Step 4.5 Confirm Gate. For detailed display rules, refer to the text of Step 4.5.
