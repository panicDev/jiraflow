# Issue Key Mode: Step 1-B Detailed Procedure

After extracting the issue key in Step 0, follow this procedure.

## 1-B-1. Parent issue inquiry

```
Use mcp__atlassian__jira_get_issue with issue_key: <ISSUE-KEY>
  fields="summary,status,issuetype,priority"
  comment_limit=0
```

Check the issue type and summary and display it to the user.

## 1-B-2. Subtask query

```
Use mcp__atlassian__jira_search with JQL:
  parent = <ISSUE-KEY> AND status NOT IN (Done, Closed) ORDER BY priority DESC, created ASC
  fields="summary,status,priority,issuetype,assignee"
  limit=50
```

**If JIRA_DEFAULT_PROJECT is set, project conditions are included in the form `project = <JIRA_DEFAULT_PROJECT> AND parent = <ISSUE-KEY> AND ...`.**

If there are no subtasks, notify the user and terminate.

## 1-B-3. Dependency analysis and selection of tasks that can be undertaken

Analyze issue links for each subtask:

- View detailed information (including issuelinks) of each subtask with `mcp__atlassian__jira_get_issue`
  - **Context optimization**: `fields="summary,status,priority,issuetype,issuelinks"`, `comment_limit=0` (This call must include issuelinks in fields as it is the key)
- If the linked issue in the `is blocked by` (inward) relationship is in **Incomplete** (status other than Done/Closed), the task is classified as **blocked**
- Only tasks that have no blockers or have completed all blockers are selected as **can be started**

Display results to user:

```
📋 <ISSUE-KEY>: <Parent Issue Summary>

<M> subtasks can be started out of <total N>:

| # | Key | Summary | Priority | Status | Blocked By |
|---|-----|---------|----------|--------|------------|
| 1 | PROJ-201 | Login API implementation | High | To Do | - |
| 2 | PROJ-202 | Writing UI components | High | To Do | - |
| - | PROJ-203 | Integration Testing | Medium | To Do | PROJ-201, PROJ-202 (Incomplete) |
```

If no work can be undertaken, notify the user and exit.
Pass the list of tasks that can be undertaken to Step 2. → Proceed to Step 2.
