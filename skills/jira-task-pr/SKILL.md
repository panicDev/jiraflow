---
name: jira-task-pr
description: "Create a pull request for a Jira task and link the Jira issue in the PR body without posting Jira comments. Triggers: jira-task pr, create PR, register PR."
user-invocable: false
argument-hint: "<TASK-ID>"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - mcp__atlassian__jira_get_issue
  - mcp__atlassian__jira_transition_issue
  - mcp__atlassian__jira_get_transitions
---

# jira-task-pr: Create Pull Request for Jira Task

**Language Rule**: All user-facing output, generated documents, Jira issue content, AskUserQuestion text/options, and summaries MUST be written in English. Keep code, commands, identifiers, branch names, issue keys, JSON keys, and file paths exactly as-is. If any legacy instruction/example below contains Korean, translate it to English at runtime; Korean text is not authoritative for output language.

## Prerequisites
- **Run from base branch**: Must be on base branch (develop/main/master), not the feature branch
- `/jira-task merge` must be completed first (the feature branch has been merged into the local base)
- `gh` CLI installed and authenticated (checked with `gh auth status`)
- Feature branch `feature/<TASK-ID>` must have a commit
- Must be pushed to Remote

## Workflow

### Step 1: Gather Context

1. Read active task information from `.jira-context.json`
2. **Cache-first**: Check `cachedIssue` in `.jira-context.json` (see CLAUDE.md "Issue Cache"). If it is a hit, the call is skipped and the cached description/issuetype is used to generate the PR body. If it is a miss, update the cache after calling `mcp__atlassian__jira_get_issue` (`fields="summary,status,description,issuetype,labels"`, `comment_limit=0` — only the items needed to generate the PR body).
3. **Jira Host URL Extraction**: Extracts the host portion from the `self` field of the `get-issue` response (e.g. `https://company.atlassian.net/rest/api/...`) and uses it to create a Jira issue link. Example: `https://company.atlassian.net/browse/<TASK-ID>`. If there is no fresh response due to a cache hit, extract it from the `JIRA_URL` environment variable or use `JIRA_URL` of `.mcp.json` as a fallback.
4. Check Base branch:
   ```bash
   git rev-parse --abbrev-ref HEAD # Check current branch
   ```

### Step 2: Verify Prerequisites

```bash
# check gh CLI
gh auth status

# Check commit
git log --oneline <base-branch>..feature/<TASK-ID>

# Check remote push status
git status -sb
```

If Push is not enabled:
```bash
git push -u origin feature/<TASK-ID>
```

### Step 3: Generate PR Content

Before creating a product, be sure to read `templates/pr-description.template.md` using the Read tool and follow the contract (required/optional classification, optional marker protocol).

**PR Title**: `<TASK-ID>: <Jira issue summary>`

**PR Body**: Fill in Jira issue information (description, type, priority, acceptance criteria), `git diff --stat`, and test report summary according to the section structure of the template.

### Step 4: Create PR

```bash
gh pr create \
  --title "<TASK-ID>: <summary>" \
  --body "<generated body>" \
  --base <base-branch> \
  --head feature/<TASK-ID>
```

Capture PR URL.

Optional options (confirmed to user):
- `--reviewer <reviewer>`: Designate reviewer
- `--label <label>` : Add label
- `--assignee @me`: Assignee
- `--draft`: Created with Draft PR

### Step 5: Skip Jira PR Comment

Jira ticket comments are disabled. Do not call `mcp__atlassian__jira_add_comment`. Include the Jira issue link in the PR body, but do not post the PR link back as a Jira comment.

### Step 6: Transition Issue (Optional)

After confirming with the user, change the issue status to "In Review":
```
First, look up the transition list with mcp__atlassian__jira_get_transitions and then
mcp__atlassian__jira_transition_issue with transitionId: <In Review transition ID>
```

**Important**: Do not pass a `comment` parameter to `jira_transition_issue`; Jira ticket comments are disabled.

### Step 7: Completion Summary

After adding `"pr"` to `completedSteps` in `.jira-context.json`, output summary of completion in the following format:

```
---
✅ **PR Created** — <TASK-ID>

- PR URL: <PR URL>
- Title: <TASK-ID>: <summary>
- Base: <base-branch> ← feature/<TASK-ID>
- Files: <count> changed
- Jira comment: skipped (disabled)

**Progress**: discover → create → init → start → approach → impl → test → review → merge → **pr ✓** → done

**Next**: after the PR is merged, run `/jira-task done <TASK-ID>` to complete the task
---
```
