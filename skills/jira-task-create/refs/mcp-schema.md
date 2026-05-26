# mcp-atlassian Schema Notes (IMPORTANT — Avoid past failures)

**Be sure to follow the rules below. No guessing.**

## `jira_create_issue` parameters
| parameters | Type | Required | Remarks |
|---|---|---|---|
| `project_key` | str | Yes | Project key (e.g. `PROJ`) |
| `summary` | str | Yes | Issue Title |
| `issue_type` | str | Yes | One of `Task`, `Story`, `Bug`, `Epic`, or `Subtask` (subtask is `Subtask`, no hyphen) |
| `description` | str | No | **Markdown format** (server converts to Jira format) |
| `assignee` | str | No | **top-level only**. email / display name / accountId available. If you put it in `additional_fields` it will be **silently ignored** |
| `components` | str | No | **CSV string** (e.g. `"Frontend,API"`). Not a list |
| `additional_fields` | **str (JSON string)** | No | **passed as a JSON.dumped string**, not a dict |

## `additional_fields` Allowed keys in JSON string
```json
{
  "priority": {"name": "High"},
  "labels": ["frontend", "urgent"],
  "parent": "PROJ-123",
  "epic_link": "EPIC-123",
  "fixVersions": [{"id": "10020"}],
  "customfield_10010": "value"
}
```

Key Note:
- `priority` is a **`{"name": "..."}` object**. Do not just enter strings.
- `parent` is a **bare string key** (`"PROJ-123"`). Do not wrap it in the form `{"key": "PROJ-123"}` — the server wraps it internally.
- `parent` **can be used for all issue_types** — It operates as a parent-link not only for subtasks but also for general tasks.
- Epic connection alias: `epicKey`, `epic_link`, `epicLink`, `epic link` are all allowed. **In Cloud team-managed projects, it automatically falls back to `parent`**, so you can connect to Epic with just `{"parent": "EPIC-123"}`.
- **Caution on disabling Story·Epic type**: Some projects disable Story type or process Epic type (especially company-managed migration environment). In case of failure, it is processed according to the mapping fallback rule of this skill (`Story → Task + parent`, `Epic → Task + label epic-substitute`).
- **Unknown keys only issue a warning and are quietly skipped** — Beware of typos.

## Subtask creation pattern
```json
{
  "project_key": "PROJ",
  "summary": "Login API Implementation",
  "issue_type": "Subtask",
  "description": "...",
  "additional_fields": "{\"parent\":\"PROJ-100\",\"priority\":{\"name\":\"High\"}}"
}
```
- If `issue_type` is set to `"Subtask"` and there is no `parent`, the server throws `ValueError`.
- The project may have disabled the Subtask type → In case of failure, fallback to `issue_type: "Task"` + `{"parent": "..."}` (parent link to regular Task).

## `jira_create_issue_link` Direction (very important)
- The `link_type` parameter is the **`name`** field of the link type (e.g. `"Blocks"`) — it should not contain **directional statements such as `"is blocked by"`.
- In case "A blocks B" (= B is blocked by A):
  - `link_type = "Blocks"`
  - `inward_issue_key = "B"` (issue reading "is blocked by" page)
  - `outward_issue_key = "A"` (issue reading "blocks" page)
- To avoid confusion: `inward` refers to the **blocked** side, and `outward` refers to the **blocking** side.
- Be sure to check the correct `name` with `jira_get_link_types` before use (some instances are custom).

## `jira_link_to_epic`
- Parameters: `issue_key`, `epic_key` (both strings).
- `ValueError` if target is not **actual Epic type**.
- Internally tries 4 strategies sequentially (parent field → discovered customfield → hardcoded customfield list → Relates-to link fallback).
- Used as a fallback only when inline processing fails with `{"parent": "EPIC-KEY"}` in `additional_fields` of `jira_create_issue`.

## `jira_batch_create_issues` — **USE PROHIBITED**
It is not used in this skill. Reason:
- The schema is different because there is no `additional_fields` wrapper (`components` is also changed to a list).
- epic_link alias not processed.
- Subtask parent not verified.
- **Errors in API responses are logged only and are not propagated to the caller**, making partial failures silent.
- Instead, call **`jira_create_issue` in a loop** and verify the results of each call.
