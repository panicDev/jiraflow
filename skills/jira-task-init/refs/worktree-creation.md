# Worktree Creation: Step 5 Detailed Procedure

Follow the procedure below for each selected task.

## Prepare directory

```bash
mkdir -p "$WORKTREE_BASE"
```

## Check for branch/Worktree existence

```bash
# 1. Check if there is already a branch
git branch --list "feature/<TASK-ID>"

# 2. Check if worktree already exists
git worktree list | grep "<TASK-ID>"
```

Branch processing:

- **Both branch and worktree already exist**: Mark "Already exists — skipped" and then move to the next task
- **Only branch exists (no worktree)**: Create worktree from an existing branch (without `-b` flag)
  ```bash
  git worktree add "$WORKTREE_BASE/<TASK-ID>" "feature/<TASK-ID>"
  ```
- **Neither**: Create new
  ```bash
  git worktree add -b "feature/<TASK-ID>" "$WORKTREE_BASE/<TASK-ID>" <base-branch>
  ```

## Worktree .gitignore sync

Immediately after creating a worktree, add the following items to `.gitignore` of the worktree if they do not exist
(The feature branch checks out `.gitignore` at the time of the base branch, so changes to the main repo may not be reflected):

```bash
WORKTREE_GITIGNORE="$WORKTREE_BASE/<TASK-ID>/.gitignore"
if ! grep -qF ".jira-context.json" "$WORKTREE_GITIGNORE" 2>/dev/null; then
  printf '\n# Jira integration (local dev context)\n.jira-context.json\nTASK-README.md\n' >> "$WORKTREE_GITIGNORE"
fi
```

Skip if it already exists.

## Worktree Path Rule

- Must be created in the **parent directory** of the original repo
- Never create inside the original repo
- Structure:
  ```
  workspace/
  ├── my-project/ # Original repo (main branch)
  └── my-project_worktree/ # Outside the original repo
      ├── PROJ-101/ # feature/PROJ-101 branch
      ├── PROJ-102/ # feature/PROJ-102 branch
      └── ...
  ```
