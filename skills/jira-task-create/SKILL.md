---
name: jira-task-create
description: "Interactively create a new Jira issue (and optional sub-tasks) from conversation context — gather details via dialog and create in Jira. Triggers: jira-task create, create task, new task, create issue."
user-invocable: false
argument-hint: "[initial hint / natural-language description]"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
  - mcp__atlassian__jira_get_user_profile
  - mcp__atlassian__jira_get_all_projects
  - mcp__atlassian__jira_search
  - mcp__atlassian__jira_get_issue
  - mcp__atlassian__jira_create_issue
  - mcp__atlassian__jira_create_issue_link
  - mcp__atlassian__jira_get_link_types
  - mcp__atlassian__jira_link_to_epic
---

# jira-task-create: Create New Jira Issue (with Sub-tasks & Dependencies)

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, issue summaries/descriptions, and summaries MUST be written in English. Keep issue keys, field names, JSON keys, code, commands, identifiers, branch names, and file paths exactly as-is.

**Important**: `Read skills/jira-task-create/refs/mcp-schema.md` — Be sure to familiarize yourself with the Jira API parameter rules, fallback strategy, and direction precautions before proceeding with Step 6.

## Overview

Steps to create a new Jira issue (before `init` in PDCA). After completion, join with `/jira-task init <parent-key>` or `start <key>`.

Core:
- **Context Priority**: Minimize questions if there is enough information in the conversation, place `AskUserQuestion` questions if there is not enough
- **Automatic subtask judgment**: Determine whether the skill needs to be decomposed → Draft proposal → User confirmation
- **Dependencies**: `Blocks` issue links between subtasks (parallel if none, compatible with `jira-task-init`'s inception analysis)
- **Epic Link**: A parent issue can be linked to an existing epic

## Prerequisites

- Jira MCP server (`atlassian`) connected — If not connected, `/jira setup` prompts and exits
- If there is a `JIRA_DEFAULT_PROJECT` environment variable, it is used as a project key. If not, the user is asked in Step 2.

## Workflow

### Step 0: Parse Argument & Check Connection

1. Extract the token from `$ARGUMENTS`.
   - Recognize the `--from-requirements <path>` token first (regardless of location, only allowed once).
     - If a token is found, set `importMode = true`, `importPath = <path>`.
     - If `<path>` is missing or the next token is another flag/option, it is treated as **E1** (path missing).
   - The remaining text is preserved as a natural language hint (`topic`) (even if empty is OK).
2. **Argument conflict handling**: If `importMode = true` and a natural language hint exist at the same time, **import takes precedence**.
   - Natural language hints are only used as additional context in the Epic description.
   - Automatic subtask decomposition (Step 3/4) never works in import mode (reversion is prohibited).
3. Verify Jira MCP connection: call `mcp__atlassian__jira_get_user_profile`. If it fails, you will be prompted to "run /jira setup first" and then exit.

The `importMode` flag is a branching point in the flow of subsequent steps. If `importMode = true`, go through Step 1.5, skip Steps 1 to 4, and go straight to Step 5.

**`--from-requirements` argument format:**
- Format: `/jira-task create --from-requirements <path>`
- `<path>`: Relative or absolute path to the requirements document (e.g. `docs/requirements/sample.requirements.md`)
- Relative paths are interpreted based on the work tree/repo root.

### Step 1.5: Parse Requirements Document (★ import mode only)

**Execution Conditions**: `importMode = true`. If `importMode = false`, skip this step and move to Step 1.

**Required**: `Read skills/jira-task-create/refs/from-requirements-mode.md` — Check the entire file verification·section extraction·tree parsing·ImportPayload configuration·Tree→Issue Mapping table in this file.

If parsing is successful, jump to Step 5 (Final Preview). Skip steps 1 to 4.

### Step 1: Assess Context Sufficiency

> **In import mode, skip this step and go straight to Step 5.**

Evaluate whether the current **dialogue context + initial hint** can be combined to fill in the required information below:

**Required Information:**
- [ ] **Project key** — Can you check it in the `JIRA_DEFAULT_PROJECT` environment variable or in the dialog?
- [ ] **Summary (Title)** — Can it be clearly inferred?
- [ ] **Description (What/Why)** — Are the background, purpose, and scope specific?
- [ ] **Issue type** — Is it clear among Task/Story/Bug/Epic? (Default value Task possible)
- [ ] **Priority** — Specified or reasonably applicable default value (`Medium`)?

**Judgment criteria:**
- **Two or more pieces of required information are lacking** or the description is at a one-line summary level → Proceed to **Step 2**
- Most of the required information is met → Go straight to **Step 3** and simply check only what is missing

### Step 2: Gather Missing Info via AskUserQuestion (Conditional)

> **Skip this step in import mode.**

**Phase A — Key information on top issues** (`AskUserQuestion` once, multiple questions placed)

Optionally include only what is missing:
1. **Summary**: One-line issue title
2. **Issue Type**: `Task` / `Story` / `Bug` / `Epic` (Basic recommendation: Function→Story, Single→Task, Bug→Bug)
3. **Priority**: `Highest` / `High` / `Medium` / `Low` / `Lowest` (Default: `Medium`)
4. **Project Key** (only when there is no `JIRA_DEFAULT_PROJECT`): Select from the `jira_get_all_projects` list

**Phase B — Reinforcement of explanation** (If explanation is still insufficient after answering A)

With `AskUserQuestion`, ask only the necessary questions among background, AC hint, technology access, and exclusion range.

**Phase C — Optional Information** (After A/B is completed)

Questions about whether to connect to Epic, to place Labels, Components, and Assignee.

**Epic Selection Subflow** (when user "Selects an existing Epic"):
1. JQL: `project = <PROJECT_KEY> AND issuetype = Epic AND status != Done ORDER BY created DESC` (limit=10)
2. Show top 10 tables and then select epic key with `AskUserQuestion`

### Step 3: Decide Sub-task Split (automatic skill judgment)

> **In import mode, skip this step and go straight to Step 5.**

Based on the collected information, **the skill directly** determines whether a subtask is necessary.

| Subtask required | No subtask required |
|---|---|
| Edit multiple layers simultaneously | Modifying a single file/function |
| Sequential steps are clearly separated | Bug fix (single cause) |
| 3 or more independently verifiable units | Small refactoring / documentation updates |

After sharing the judgment results transparently with the user, proceed to Step 4 or Step 5.

### Step 4: Propose Sub-task Breakdown (if breakdown is necessary)

> **In import mode, skip this step and go straight to Step 5.**

Show draft table (# / Summary / Type / Priority / Depends on / Parallel?).

**Design convention:**
- If `Depends on` is empty, `Parallel ✓`
- Dependencies are stored as **`Blocks` issue links** (`init <parent-key>` is used for initiator analysis)

**User confirmation (`AskUserQuestion`):** `Proceed as is` / `Request for modification` / `As a single issue without subtask` / `Cancel`

### Step 5: Final Preview

Summarize the entire plan one more time just before creation.

**Default mode:**

```
📦 Issues to be created

## Parent Issue
- Project / Summary / Type / Priority / Epic Link / Labels / Components / Assignee
- Description: (Summary 3 to 5 lines)

## Sub-tasks (N) / Issue Links (M)
```

**Import mode (`--from-requirements`):**

**Right before** the preview output, all node summaries are inspected for redundancy in batch JQL. When matching, a `## Duplicate Warning` block is included.

Specify `breakdownLevel`(`L1` | `L2` | `L3`) as one line at the top of the Preview.

```
📦 Issues to be created (import)

Source: docs/requirements/<slug>.requirements.md
Breakdown Level: <L1 Single | L2 Story-only | L3 Epic+Stories+Subtasks>

# L1: ## Task (single item)
# L2: ## Story / ## Sub-tasks (M) / ## Issue Links (K)
# L3: ## Epic / ## Stories (N) / ## Sub-tasks (M) / ## Issue Links (K)
```

**Final Confirmation (`AskUserQuestion`):** `Creation Progress` / `Edit` / `Cancel`

### Step 6: Create in Jira

> Call sequence by mode:
> - **default**: 6-1 (Parent) → 6-2 (Epic connection verification) → 6-3 (Subtask loop) → 6-4 (Link) → 6-5 (Verification)
> - **import L1 Single**: 6-1 (Task single) → 6-5 (Verification). 6-1b/6-3/6-4 skip.
> - **import L2 Story-only**: 6-1b (1 Story, no parent) → 6-3 (Subtask loop) → 6-4 (link) → 6-5 (verification). 6-1/6-2 skip (no Epic creation/connection).
> - **import L3 Tree**: 6-1 (Epic creation) → 6-2 **skip** → 6-1b (Story loop) → 6-3 (Subtask loop) → 6-4 (Link) → 6-5 (Verification).

**6-1. Create parent issue (call from default or import L1/L3)**

`additional_fields` serializes to a **JSON string**. Assemble priority/labels/epic_key into a dict and then use `json.dumps()`. The default value of priority is `Medium` (same as the extraction rule in `from-requirements-mode.md` Step 1.5-5).

Fallback rules have different trigger cases for each calling mode — the Tree→Issue Mapping table in `from-requirements-mode.md` is the single truth. This section contains only a summary:

- **default / import L1**: Try Task or Story types. Story failure → `Task` (default mode is + `parent=Epic-KEY` if epic-link, L1 has no parent).
- **import L3 Epic creation**: Epic type failure → `Task` + label `epic-substitute`.
- **Subtask type failure**: `Task` + `parent=Story-KEY` (area 6-3 — not subject to this section).
- **import L2 Story creation**: Responsible for 6-1b, not this section (parent omitted due to absence of Epic).

Notify the user immediately when a fallback is used.

**6-1b. Story creation loop (★ import mode only)**

- **L3 Tree**: Set `parent = epic.created_key` for each Story. Fallback: `Story` fails → `Task` + `parent=Epic-KEY`.
- **L2 Story-only**: Only one Story is created. `parent` is not set (no Epic). Fallback: `Story` fails → `Task` (no parent).

Immediately after creation, `(story.index → ​​story.created_key)` is accumulated.

**6-2. Epic connection verification (default mode only)**

Re-query with `jira_get_issue` → If epic link is not set, `jira_link_to_epic` fallback → If this also fails, continue after warning.

**6-3. Subtask creation (sequential loop)**

Individual calls to `jira_create_issue` on each subtask. In import mode, PARENT_KEY = `created_key` of the corresponding Story.

**6-4. Create dependency link**

Check the "Blocks" type name with `jira_get_link_types(name_filter="block")` and call `jira_create_issue_link`.

Direction: "A blocks B" → `outward_issue_key=A`, `inward_issue_key=B`.

**Conversion of `(blocks: <ref>)` in Import mode: `<N>` → Story key, `<N>.<M>` → Subtask key. In case of violation of E7, skip the link + warning.

**6-5. Verification of results**

Re-view all issues with `jira_get_issue` (`fields="summary,issuetype,priority,parent,labels,issuelinks,status"`, `comment_limit=0`). Warn in case of mismatch.

### Step 7: Post Creation Comment (Optional)

Post a summary comment on the top issue (number of subtasks, number of links, number of possible parallels, Next guidance). Comments omitted for subtasks.

### Step 8: Completion Summary

```
─────────────────────────────────────────
✅ Create Complete

**Parent Issue**: <JIRA_URL>/browse/PROJ-NEW — <summary>  [Type, Priority]
**Sub-tasks** (N): Each issue key + summary + parallel/block display
**Links Registration**: M Blocks links

**Next Steps:**
- `/jira-task init PROJ-NEW` — Subtask-based branch setup
- or `/jira-task start PROJ-NEW` — Start working on the parent issue immediately
─────────────────────────────────────────
```

Do not touch `.jira-context.json` (the new issue is not yet an active task).

## Error Handling

**Common**: MCP connection failure → Step 0 ends + `/jira setup` guidance. `jira_create_issue` failure → Task fallback if type does not exist, token expiration notification in case of authentication error, original message displayed in case of field error. Some subtasks fail → keep success, display list of failures, confirm retry (no automatic rollback).

| # | Scenario | processing |
|---|---------|------|
| E1 | Missing `--from-requirements` path | Request route with `AskUserQuestion` |
| E2 | Specified path file absence | error + exit |
| E3 | empty file | error + exit |
| E4 | Absence of `Proposed Issue Breakdown` section | Natural language mode fallback suggestion (`AskUserQuestion`) |
| E5 | 0 tree nodes | Request reinforcement input or exit |
| E6 | There is only Story without Epic | **Proceed with L2 Story-only** (No automatic Epic creation) |
| E7 | See sibling et al. `(blocks: ...)` | Skip the link + warning |
| E8 | Same summary issue exists | `## Duplicate Warning` in Preview + proceed/cancel confirm |
| E9 | Epic/Story type inactive | Task + parent or + label `epic-substitute` fallback, notify immediately |
| E10 | Mixed tree indentation | Warning + Proceed based on first child (end if not possible) |
| E11 | Failed to identify root node token (neither `Task`/`Story`/`Epic`) | Natural language mode fallback suggestion (`AskUserQuestion`) |

**Non-goals**: Create worktree/branch, modify `.jira-context.json`, perform implementation/test/review, fix existing issues.
