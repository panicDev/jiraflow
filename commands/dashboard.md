---
name: dashboard
description: Manage the Jira dashboard server — setup, start, stop, or check status. Use when user types /jira dashboard or /dashboard.
user-invocable: true
argument-hint: "[start|stop|status|setup]"
allowed-tools:
  - Bash
  - Skill
---

# /jira dashboard — Dashboard Management

This command delegates all work to the `jiraflow:jira-dashboard` Skill.

```
Skill({ skill: "jiraflow:jira-dashboard", args: "<ARGUMENTS>" })
```

Pass ARGUMENTS to the Skill verbatim.
