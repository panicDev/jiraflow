# Shared: Transition Verify (Fresh Fetch SSOT)

A common procedure to confirm the actual status immediately after Jira transition in `jira-local-merge`/`jira-task-done`, etc.

## When to Read

Applies once immediately after calling `mcp__atlassian__jira_transition_issue` and immediately before updating `.jira-context.json`.

## Jira Comment Policy

Never pass a `comment` parameter to `mcp__atlassian__jira_transition_issue`. Jira ticket comments are disabled for this plugin, so do not call `mcp__atlassian__jira_add_comment` as a follow-up either.

## Fresh Fetch Procedure

After transition, immediately call `mcp__atlassian__jira_get_issue` to secure the actual status name on the Jira side.

```
mcp__atlassian__jira_get_issue(
  issue_key=<TASK-ID>,
  fields="status",
  comment_limit=0,
)
```

The `status.name` of this fetch result is the **sole source of truth (SSOT)**. Pass it as is as the `<final-jira-status>` argument in the next step.

## `<final-jira-status>` decision rule

- **Do not use the transition attempt value as is.** Depending on the workflow settings, the attempt value and result status name may be different.
  - Example: "In Review" → "Under review", "Done" → "Completed"
- The resulting status is determined only by the fresh fetch above.
- `cachedIssue.status` / `cachedIssue.fetchedAt` updates also use the same value/timestamp (`new Date().toISOString()` UTC `Z` format).

## Fetch failure policy

If Fetch fails (network/auth, etc.):

- Notifies the user of fetch failure.
- `cachedIssue` updates are **skipped** — do not cover stale states with false updates (dashboard collector corrects in next cycle).
- Updates that do not depend on fetch, such as `completedSteps` / `<step>At`, can proceed as is.
