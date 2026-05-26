# Shared Context Update Pattern

Standard call to consistently update `completedSteps`/`status`/`<step>At`/`cachedIssue` in `.jira-context.json` with `jira-context-update.py`. The way LLM patches JSON inline can cause omission/overwrite accidents, so all step skills use this pattern.

## Call variable

- `TASK_ID` — Jira issue key, such as `MAE-123`.
- `STEP` — One of `start` / `approach` / `impl` / `test` / `review` / `merge` / `done`.
- `STATUS` — The actual status name freshly fetched from Jira (e.g. `"In Progress"`, `"In Review"`). If the step does not make a Jira transition (record-only), pass `"-"` — preserve the existing status.

## Call block

After resolving the absolute path of `JIRA_CTX_UPDATE_PY` to `skills/_shared/script-lookup.md`:

```bash
python3 "$JIRA_CTX_UPDATE_PY" "$TASK_ID" "$STEP" "$STATUS" \
    ".jira-context.json"
```

What the script handles:
- Add `STEP` to `completedSteps` (prevent duplication).
- Update top-level `status` + (if present) `cachedIssue.status` only when `STATUS != "-"`.
- `<STEP>At` UTC ISO 8601 (Z suffix) record.
- Update `cachedIssue.fetchedAt` (if cachedIssue exists).
- Automatic detection of aggregate(`tasks[]`) vs single-task format.

## Additional fields to be preserved after calling

The script only updates the above key. Fields that the skill needs to record separately (e.g. `startedAt` in start is recorded as `startAt`, or new file creation in fresh mode, etc.) are processed separately **before** this call, or with an additional patch after the call. For most steps, this call is sufficient.
