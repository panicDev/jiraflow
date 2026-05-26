---
name: jira-task-discover
description: "Discover requirements from a free-form topic — search codebase, ask clarifying questions, write a structured requirements doc with issue-breakdown proposal. Triggers: discover, jira-task discover, requirements analysis."
user-invocable: false
argument-hint: "<natural-language topic> [--lite] [--from <file-path>]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

# jira-task-discover: Requirements Discovery from a Topic

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Overview

`jira-task-discover` takes an ambiguous natural language topic as input and creates an explicit requirements analysis document through code base exploration and user questions. The output of this skill becomes the input to the next step, `jira-task-create`(`--from-requirements`).

**Input (3 types):**
- Positional argument: Natural language subject (required). Example: `"User Notification System"`
- `--lite`: Reduces questions to 3 and output document to one page
- `--from <file path>`: Import the existing requirements document and use it as a base

**Output (1 type):**
- `docs/requirements/<TOPIC-SLUG>.requirements.md` — Requirements analysis document (with issue decomposition suggestion section at the end)

**Non-goals:**
- Do not create Jira issues/comments/attachments (limited to local document level)
- Do not read/write `.jira-context.json`
- Do not automatically manage index files (`docs/requirements/INDEX.md`, etc.)
- Do not create `templates/requirements.template.md` (if absent, terminates with error)

## Input Model

```
$ARGUMENTS = <Natural language topic> [--lite] [--from <file path>]
```

**Parsing Rules:**
- Treat the first positional argument (a quoted string or concatenation of non-flag tokens) as **natural language subject**
- `--lite`: The argument can be placed anywhere. No value (boolean flag)
- `--from <file path>`: Use the token following `--from` as the file path. Both absolute and relative paths are allowed
- If the natural language topic is empty, Step 0 asks the user for input
- `--lite` and `--from` can be used simultaneously (combined effect: narrowing down questions + importing existing documents)

## Workflow

### Step 0: Parse Arguments

1. Tokenize `$ARGUMENTS`.
2. Store the existence of the `--lite` token in boolean `lite`.
3. Extract the `--from <path>` pattern and save it in `fromPath`. Error if the token following `--from` is empty or another flag.
4. Combine the remaining tokens with a space and use them as `topic` (natural language topic).
5. If `topic` is empty:
   - One short answer question with `AskUserQuestion`: "What topic should I create a request for? (Enter in one sentence)"
   - If the answer is empty, it ends (an error message is output)
6. Verify file existence if `fromPath` is specified:
   - File missing: Error message + exit (1-time notification, no automatic retry)
   - File exceeds 1MB: Confirm whether to proceed with `AskUserQuestion`
   - Empty file: After outputting a warning, fallback to default mode (only natural language topics used)

### Step 1: Slug Generation & Confirm

1. Convert `topic` to one English kebab-case slug.
   - Korean/non-ASCII topic: Summarize and translate the meaning into English and convert it into kebab-case
   - Allowed characters: only `[a-z0-9-]`. Remove or convert spaces, special characters, and uppercase letters
   - Length limit: cut to 60 characters or less
2. Check whether `docs/requirements/<slug>.requirements.md` exists:
   - If it exists, give a suffix in the form of `<slug>-2`, `<slug>-3`... (or confirm to the user whether to overwrite)
3. Confirm slug once with `AskUserQuestion`:
   - Option A: "Use" (proceed with suggested slug)
   - Option B: "Edit" → User directly enters slug (short answer). Only `[a-z0-9-]` is allowed as input value. If empty, force the default of option A
4. Use the confirmed slug in the next step.

### Step 2: Codebase Context Collection

1. Extract 3-5 keywords from `topic`.
   - Prioritize nouns and function words. If the subject is in Korean, the English counterpart is included
   - Example: "User notification system" → `["notification", "alert", "user", "push", "email"]`
2. Use `Glob`/`Grep` by keyword to find related files.
   - `Glob`: File name matching (e.g. `**/*notification*`)
   - `Grep`: Body matching (ignoring case)
3. The results are combined into **top 10 files**, and only **up to 30 lines per file** are extracted.
4. **Result meta preservation format**: Each excerpt is preserved in the form of a `(file_path, line_range)` tuple. This meta is quoted verbatim in the `code:` part of the Step 4 marker.
   - line_range notation: `<path>:<start>-<end>` (e.g. `src/notify.ts:45-60`). If single line, `<path>:<line>` (e.g. `src/notify.ts:45`)
   - `Glob` results are per-file, so line_range uses subsequent `Grep` matching lines or excerpt ranges
   - **Exclusion of sensitive files**: `.env*`, `.claude/settings.local.json`, `node_modules/`, files containing credentials/tokens are excluded from excerpts/meta (the output document can be sent as a Jira attachment)
5. Fallback if there are 0 results: Use the directory tree of the repo root (depth 2) as context, and record "Automatic search of related areas failed" in the document.
6. If `--from <path>` is specified, the contents of the file are included in the context (it becomes the base body of Step 4).

### Step 3: Iterative Interview

**Required**: Read `skills/jira-task-discover/refs/iterative-interview.md` and perform the main text (R0 advance notice + round loop + termination condition + forced coverage round) as is.

Summary:
- **R0 (prior notice)**: Print 1 paragraph of the category to be covered and then enter the loop. `--lite` excludes the NFR category from guidance.
- **Round Loop**: 1 question for 1 category with `AskUserQuestion` each round. Answers are accumulated in `bucket[Q1..Q4]`. **Index system (Q1=stakeholders, Q2=success criteria, Q3=constraints, Q4=NFR) is the same as before** — Compatible with Step 4 trace marker rules.
- **End conditions**: `MIN_ROUNDS=4`, `MAX_ROUNDS=10`, `CONFIRM_AT=6` (confirm once to continue at the end of round 6). If there is a category where coverage is not met, one additional round is mandatory.
- **`--from` mode**: After filling the dictionary by category in the import body, add only the missing items. Cooperation with Step 3.5 (`refs/conflict-detection.md`) remains as before.

The `bucket` object is passed to Step 4. Items to which the user answers "Other → (empty)" are saved as `TBD` and promoted to Step 4 Open Questions.

### Step 3.5: Conflict Detection (--from mode only)

**Required**: Enter only in `--from` mode. Read `skills/jira-task-discover/refs/conflict-detection.md` and execute the text as is.

Entry conditions: Entry if the `--from` flag is present and the import file is not empty. All other modes are pass (no-op).
Escalation format: `[CONFLICT] <category>: import="<source>" vs answer="<answer>" — need to decide which is correct`
Cooperation with Step 4: Elevated `[CONFLICT]` items are automatically included in Step 4's Open Questions (listed after the TBD item).

### Step 4: Generate Requirements Document

Creates `docs/requirements/<slug>.requirements.md`.

**Select template:**
Read `templates/requirements.template.md` and use it as a base. If the file does not exist, it immediately exits with an error and guides you through "Plugin asset corruption — git restore templates/requirements.template.md".

**What you need to fill in the document:**
- Topic, Slug, Mode (default/lite/from), Generated At
- Stakeholders (Step 3 Answer No. 1)
- Goals & Success Criteria (Step 3 Answer No. 2)
- Constraints (Classify Step 3 answer number 3 into **Technical / Schedule / Cost / Regulatory 4 sub-section**. Categories not specified in the answer should be stated in one line as `N/A — Not applicable' — do not omit.)
- Non-functional Requirements (Step 3 Answer number 4 organized into **6 category table**: Performance / Availability / Security / Scalability / Observability / Compatibility. Each item has a value or `N/A — <reason>`. Do not use `TBD` — if not known, upgrade to Open Questions. When `--lite`, replace this entire section with a single line `N/A — lite mode`.)
- Codebase Context (Step 2 result: file path + excerpt summary)
- Functional Requirements (LLM synthesized from Step 3 answers and codebase context)
- **Goals ↔ FR Mapping** (Derived immediately after combining Functional Requirements. Tabular format `| Goal | Satisfied FR | Remarks |`. The rule is that at least one FR is mapped to every Goal. Goals that are not mapped are promoted to Open Questions as `[P1]`. FRs that are not mapped are Out of Scope candidates or Goal missing signals.)
- Edge Cases (omitted when `--lite`)
- Out of Scope (omitted when `--lite`)
- Open Questions (collection of items marked as TBD + `[CONFLICT]` items upgraded in Step 3.5 + automatically including missing Goals↔FR mapping items. Order: TBD items first → missing mapping → conflict items)
- Technical Approach Hint (Section at the end of the requirements document. As the plan/design stage disappears and is integrated into the approach, the first hint of the implementation direction is placed here. LLM synthesizes Codebase Context · Functional Requirements · Constraints as input, and code snippets are prohibited — Focuses on decision-making/access options/cautions. 3-5 line summary when using `--lite`. For detailed writing guide, refer to the template guide comment.)

If `--from <path>` is specified: Reinforce and reorganize the above section based on the body of `<path>` (overwrite

**`--lite` mode length rules:** Maximum 5 lines per section. The "Edge Cases" and "Out of Scope" sections are omitted. Keep it to one page.

#### Trace Marker automatic granting rules

**Required**: Read `skills/jira-task-discover/refs/trace-markers.md` to check marker format, grant target, and `synthesized` guide.

Summary: 4 types of synthesis (FR / Edge Cases / Out of Scope / Open Questions) A source marker is given at the end of each item. Marker is not required for non-targets (Stakeholders, Goals, Constraints, NFR, Codebase Context).

**File writing time — Important:** The composite output of Step 4 is **stored only as an object in memory**. The actual writing of the `docs/requirements/<slug>.requirements.md` file is delayed until **after Step 4.5 confirm passes**. When re-synthesizing, the Step 2 and Step 3 caches are reused and only Step 4 synthesis is re-executed.

### Step 4.5: Synthesis Confirm

**Required**: Read `skills/jira-task-discover/refs/synthesis-confirm.md` and execute the text as is.

Step 4 This is a single confirm gate where the composite output (FR / Edge Cases / Out of Scope / Open Questions) is verified by the user.
Branch: `proceed` → Enter Step 5 + Write file. `revise` → resynthesis (up to 3 times). `cancel` → Normal shutdown after disposing of memory.

### Step 5: Issue Breakdown + Technical Approach Hint Section

**Entry conditions:** Step 4.5 Receives the synthesis result that has passed confirm (`proceed`) + the confirmed decomposition level as input and executes this step. Fill out the **last two sections** (Proposed Issue Breakdown, Technical Approach Hint) of the document created in Step 4. **Do not create Jira issues — only write to the document.**

**Required**: Read `skills/jira-task-discover/refs/breakdown-level.md` to check the 3 level definitions, signal table, and output template. No definitions are inlined in this SKILL.md.

There are three levels of decomposition (L1 Single / L2 Story+Subtasks / L3 Epic+Stories+Subtasks). LLM looks at the synthesis results and recommends one, and that recommendation is exposed to the **Step 4.5 synthesis-confirm gate and verified by the user** (no separate confirm gate - convergence gate integrated).

#### Step 5 Procedure

1. Select one level confirmed in Step 4.5 from the output template of `breakdown-level.md` and fill in the `Proposed Issue Breakdown` section.
2. Fill out the `Technical Approach Hint` section — LLM is synthesized with Codebase Context · Functional Requirements · Constraints as input. No code snippets. Topics: Key implementation points / Access options to review / Points of caution. If `--lite`, 3-5 line summary.
3. Step 6 Next guidance branches out recommended commands according to the confirmation level (L1: `/jira-task create <hint>`, L2/L3: `/jira-task create --from-requirements ...`).

### Step 6: Completion Summary

Prints a completion summary in the following format (same pattern as other jira-task-* skills):

```
---
✅ **Discovery Complete** — <TOPIC>

- Create requirements document: `docs/requirements/<slug>.requirements.md`
- Mode: default | lite | from | lite+from
- Codebase context: <N excerpt files> (or "Relevant areas not found")
- Issue decomposition suggestion: <L1: "1 single task" / L2: "Story 1 + Subtask N" / L3: "Epic 1 + Story N + Subtask M">

**Progress**: **discover ✓** → create → init → start → approach → impl → test → review → merge → pr → done

**Next** (Output 1 line according to the decomposition level confirmed in Step 5):
- L1 Single: `/jira-task create <one-line hint>` — Register one Jira task referring to the analysis document (import parser has not yet received Single)
- L2 Story+Subtasks / L3 Epic+Stories+Subtasks: `/jira-task create --from-requirements docs/requirements/<slug>.requirements.md` — Register Jira issues in bulk with this analysis document
---
```

Do not touch `.jira-context.json`.

## Error Handling

| Scenario | Processing Strategy |
|---------|----------|
| Missing natural language topic | In Step 0, request input with `AskUserQuestion`. Ends when answers are empty |
| `--from` file not present | Print an error message with the path and exit (no automatic retry) |
| `--from` file is empty | After outputting a warning, proceed to default mode (based on natural language topic) |
| `--from` file exceeds 1 MB | Confirm whether to proceed with `AskUserQuestion` |
| slug confirm reject | Users are allowed to enter directly once. If it is empty, the default slug is forced to be used |
| Slug duplicates (same file exists) | `<slug>-2`, `<slug>-3` Confirm whether to automatically grant or overwrite |
| 0 keyword extraction results | Fallback to repo root's directory tree (depth 2), specify "Automatically explore related areas failed" in context section |
| 0 Glob/Grep results | Proceed after recording "Relevant area not found" in the context section (no blocking) |
| User responds "Other → (empty)" to all answers | Record the item as `TBD` in the document and proceed |
| Navigation results are context flooded | Enforced upper limit of 10 files/30 lines per file. Cut off when exceeding |
| Absence of template file (`templates/requirements.template.md`) | Immediately exits with error. "Plugin asset corruption — git restore templates/requirements.template.md" instructions |
| Simultaneous use of `--lite` and `--from` | Apply both effects (3 or less questions + import base) |
| Dangerous characters in slugs (`/`, `..`, space, Hangul) | kebab-case force. Only letters/numbers/hyphens are allowed. Request direct user input when conversion fails |
| Exceeding resynthesis limit (`RESYNTHESIS_LIMIT=3`) in Step 4.5 | After removing the `revise` option, force confirmation to `proceed`/`cancel` in the second quarter. The user is prompted with the following message: "You have reached your resynthesis limit (3). We recommend that you continue or cancel." Information |
| Step 4.5 Select `cancel` | Discard in-memory composite output. No cleanup required as the file system has not yet been written to. Print one line of the Korean shutdown message ("Creation of requirements document has been cancelled.") and then exit normally |

## Non-goals

- Jira issue creation/comment/attachment — `discover` is limited to the local document level. Issue registration is the responsibility of `jira-task-create`
- Read/Write `.jira-context.json` — This skill does not depend on the Jira context and does not update it
- Create `templates/requirements.template.md` file — This skill only consumes templates
- Automatic management of index files (`docs/requirements/INDEX.md`, etc.)
- External API/network call (other than LLM inference)
