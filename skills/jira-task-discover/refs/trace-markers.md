# Step 4: Trace Marker automatic granting rules

In order to make the source of LLM synthesis items post-verifiable, a source tag (trace marker) is automatically assigned to the end of each item in the **four types of synthesis sections**.

**Marker grant target (4 types of synthesis):**

| Target (marker given) | Non-target (no marker required as answer/meta is directly mapped) |
|----|----|
| Functional Requirements | Stakeholders (= `Q1`) |
| Edge Cases | Goals & Success Criteria (= `Q2`) |
| Out of Scope | Constraints (= `Q3`) |
| Open Questions | Non-functional Requirements (= `Q4`) |
| | Codebase Context (Step 2 Meta itself) |

For the 5 non-target types, no marker is required as the answer (`Q<N>`) or Step 2 meta is the source. Item-level markers are given only to the four target types (FR/Edge Cases/Out of Scope/Open Questions).

**Marker format standard (5 cases + `--from` variants):**

```
| case | Marker Format | When to use |
|--------|-------------|----------|
| Originated from 1 answer | *(source: Q<N>)* | Q<N> Derived directly from the answer |
| Answer comes from many | *(source: Q1, Q3)* | Comma separated, maximum 3. If there are more than 4, only the strongest one |
| Code originates from 1 place | *(code: <path>:<line-range>)* | Step 2 (file_path, line_range) derived directly from meta |
| Originated from Code Majority | *(code: src/a.ts:10-20, src/b.ts:5-15)* | Comma separated, maximum 2. If there are 3 or more, only the 1 most representative |
| Answer + code combination | *(source: Q<N>, code: <path>:<line>)* | Derived from both answers and code |
| Neither (LLM Composite) | *(synthesized)* | LLM self-synthesis with no direct basis anywhere in the answer/code |
```

**`--from` mode variant (1 case added):**

```
| case | Marker Format |
|--------|-------------|
| --from import text as is | *(source: from)* |
| --from import + augment answer | *(source: from, Q<N>)* |
| --from import + code enrichment | *(source: from, code: <path>:<line>)* |
| --from Additional composite items other than main text | default mode rules as is (Q<N> / code: / synthesized) |
```

**Principle of notation of multiple sources: Traceability takes precedence over readability.** However, if the marker becomes longer than the text, readability is impaired, so an upper limit of up to 3 sources and 2 codes is set. In case of excess, only the strongest/representative one is indicated.

**`*(synthesized)*` Usage Guide (Abuse Prevention):**

- **Conditions for use**: Use only for LLM self-synthesized items that have no direct basis anywhere in the `Q<N>` answer and no direct basis anywhere in the Step 2 code excerpt (`(file_path, line_range)`).
- **Recommended priority**: Trace `Q<N>` > trace `code:` > combine both > `synthesized` (avoid `synthesized` if possible).
- **Exception to the Open Questions section**: Open Questions are "pending decision" in nature, so `*(source: Q<N>)*` (which answer was lacking) is natural. Avoid using `*(synthesized)*`.
- **Edge Cases basic marker**: Edge Cases are mostly LLM synthesis, so `*(synthesized)*` or `*(code: ...)*` are common. Use `*(source: Q<N>)*` only when it is derived directly from a user answer (e.g., "What about concurrent calls?").

**`--lite` mode consistency:**

In `--lite`, the Edge Cases/Out of Scope section is omitted entirely, so the marker application target is naturally reduced, leaving only two sections **Functional Requirements + Open Questions**. The Q index range is also reduced to `Q1`~`Q3` (`Q4` NFR disabled). Other marker formats and `synthesized` guides are applied in the same way as the default.
