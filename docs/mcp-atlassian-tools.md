# mcp-atlassian Jira Tools Reference

MCP Server: `atlassian` (package: [mcp-atlassian](https://github.com/sooperset/mcp-atlassian))
Run: `uvx mcp-atlassian`

## Environment variables

| variable | Required | Description |
|------|------|------|
| `JIRA_URL` | Yes | Jira Cloud URL (e.g. `https://company.atlassian.net`) |
| `JIRA_USERNAME` | Yes | Atlassian account email |
| `JIRA_API_TOKEN` | Yes | Atlassian API Token |
| `JIRA_PERSONAL_TOKEN` | Server/DC | PAT for Server/Data Center (replaces USERNAME+TOKEN) |

---

## Tools used in skills (allowed-tools prefix: `mcp__atlassian__`)

### Issue Views

| tools | Description | Main parameters |
|------|------|--------------|
| `jira_get_issue` | View issue details | `issue_key` |
| `jira_search` | Search issues with JQL | `jql`, `max_results` |
| `jira_get_all_projects` | Full Project List | - |
| `jira_get_project_issues` | Project issue inquiry | `project_key` |
| `jira_get_transitions` | View issue status transition list | `issue_key` |

### Create/Edit Issue

| tools | Description | Main parameters |
|------|------|--------------|
| `jira_create_issue` | Create new issue | `project_key`, `summary`, `issue_type`, `description` |
| `jira_update_issue` | Edit issue (person in charge, field, etc.) | `issue_key`, `fields` |
| `jira_delete_issue` | Delete issue | `issue_key` |
| `jira_batch_create_issues` | Bulk creation of issues | `issues` |
| `jira_transition_issue` | Toggle issue status | `issue_key`, `transition_id` |

### Comments

| tools | Description | Main parameters |
|------|------|--------------|
| `jira_add_comment` | Add comment to issue | `issue_key`, `comment` |

### Attachment

| tools | Description | Main parameters |
|------|------|--------------|
| `jira_download_attachments` | Download issue attachment file | `issue_key`, `target_dir` |

> **Note**: Attached file **upload** is not supported. Check Playwright screenshots, etc. directly locally.

### Sprint & Agile

| tools | Description | Main parameters |
|------|------|--------------|
| `jira_get_agile_boards` | Board list search | `project_key` (optional) |
| `jira_get_sprints_from_board` | Sprint Views on Board | `board_id`, `state` (active/closed/future) |
| `jira_get_sprint_issues` | Sprint issue inquiry | `sprint_id` |
| `jira_get_board_issues` | Board issue inquiry | `board_id` |
| `jira_create_sprint` | create sprint | `board_id`, `name`, `start_date`, `end_date` |
| `jira_update_sprint` | Sprint Fix | `sprint_id`, `state`, `name` |

### Issue link

| tools | Description | Main parameters |
|------|------|--------------|
| `jira_create_issue_link` | Create links between issues | `link_type`, `inward_issue`, `outward_issue` |
| `jira_remove_issue_link` | Remove issue link | `link_id` |
| `jira_link_to_epic` | Link issue to Epic | `issue_key`, `epic_key` |
| `jira_get_link_types` | Link type list query (return: `name`, `inward`, `outward`) | `name_filter` (optional) |

### User/Worklog

| tools | Description | Main parameters |
|------|------|--------------|
| `jira_get_user_profile` | User information inquiry (for authentication verification) | `account_id` (optional) |
| `jira_add_worklog` | Work time log | `issue_key`, `time_spent` |
| `jira_get_worklog` | Job log inquiry | `issue_key` |

### Development information (Cloud only)

| tools | Description | Main parameters |
|------|------|--------------|
| `jira_get_issue_development_info` | View linked PR/branch/commit | `issue_key` |
| `jira_get_issues_development_info` | Bulk development information inquiry | `issue_keys` |
| `jira_batch_get_changelogs` | Check issue change history | `issue_keys` |

### version/field

| tools | Description | Main parameters |
|------|------|--------------|
| `jira_get_project_versions` | Project version list | `project_key` |
| `jira_create_version` | Create version | `project_key`, `name` |
| `jira_batch_create_versions` | Bulk creation of versions | `versions` |
| `jira_search_fields` | Field Search | `query` |

---

## mcp-jira-cloud → mcp-atlassian Tool name change table

| mcp-jira-cloud | mcp-atlassian |
|---|---|
| `jira_search_issues` | `jira_search` |
| `jira_get_boards` | `jira_get_agile_boards` |
| `jira_get_sprints` | `jira_get_sprints_from_board` (requires boardId) |
| `jira_whoami` / `jira_auth_status` | `jira_get_user_profile` |
| `jira_upload_attachment` | ❌ Not supported |
| `jira_get_issue_comments` | ❌ Not supported (included in jira_get_issue response) |
| `jira_assign_issue` | `jira_update_issue` (fields.assignee) |
| other (`jira_get_issue`, `jira_add_comment`, `jira_transition_issue`, etc.) | Same |
