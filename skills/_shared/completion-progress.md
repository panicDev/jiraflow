# Completion Progress

Canonical pipeline step order:
`discover → create → init → start → approach → impl → test → review → merge → pr → done`

## Completion Block Template

Output after each step completes:

```
---
✅ **<Step Title> Complete** — <TASK-ID>

<step-specific bullets>
- Jira comment: skipped (disabled)

**Progress**: discover → create → init → start → approach → impl → test → review → merge → pr → done

**Next**: `/jira-task <nextstep> <TASK-ID>` — <description>
---
```

Bold the current step in the Progress line as `**stepname ✓**`. All other steps remain plain text.
