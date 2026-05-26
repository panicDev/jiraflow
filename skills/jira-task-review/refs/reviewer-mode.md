# Reviewer Mode Branching + Mode A Subagent Prompt

> In jira-task-review SKILL.md Step 2, branch based on whether the call prompt contains the `[review-self-mode]` marker.

## Reviewer Independence Rule (Required)

Core code review work (Gap Analysis + Lint & Format + Code Quality Review) must run in an environment **separate from the context that performed plan/design/impl** to prevent self-praise and blind spots.

Two ways to satisfy isolation, selected automatically by call context:

### Mode A: Subagent Delegation (manual call)

**Condition**: the call prompt does **not** contain `[review-self-mode]` (for example, the user runs `/jira-task review <TASK-ID>` directly from the main session).

**Behavior**: in Step 2, launch the `jira-reviewer` subagent with the `Agent` tool and delegate review work. The main session handles local persistence and attachments from Step 4 onward. Jira comments remain disabled.

**Model requirement**: specify `model: "opus"` when calling the subagent.

### Mode B: Self-Mode (already called from an isolated wrapper)

**Condition**: the call prompt contains `[review-self-mode]` (for example, `jira-task-auto` calls this Skill from an isolated wrapper sub-agent for the review step). In this case, the wrapper sub-agent is already a fresh context separate from plan/design/impl, so no additional nesting is needed.

**Behavior**: **skip** the Step 2 `Agent` tool call. The wrapper agent directly performs review work (gap analysis + lint + code quality + compile findings). Output structure is identical to the Mode A subagent return.

**Constraint**: sub-agents usually cannot call another `Agent`. Without forced self-mode, this fails. If `[review-self-mode]` is missing and the `Agent` tool is unavailable, stop with an error immediately. Do not fall back to direct review in the main session.

## Mode A — Subagent Call (delegate)

**Must call with the `Agent` tool using `subagent_type: "jira-reviewer"` and `model: "opus"`**. The main session must not directly perform steps 1-4; this blocks self-praise bias.

If the `Agent` tool is unavailable (for example in a sub-agent context), stop with an error and tell the caller the `[review-self-mode]` marker is missing. Do not fall back to direct review in the main session.

Pass this context explicitly in the call prompt:

```
TASK-ID: <TASK-ID>
Base branch: <base-branch>
Feature branch: feature/<TASK-ID>
Repo root: <absolute REPO_ROOT path>

## Task
Perform these 4 tasks in order and return structured results:

1. **Gap Analysis**: if `docs/design/<TASK-ID>.design.md` exists, check each Implementation Plan item against actual code using Glob/Grep and calculate match rate. If no design doc exists, skip.

2. **Lint & Format Check**: run lint/format for these changed-file extensions:
   - Node.js (when package.json exists): .js/.ts/.jsx/.tsx/.mjs/.cjs → npx eslint, npx prettier --check
   - Python (when pyproject.toml/setup.py/requirements.txt exists): .py → ruff check / ruff format --check, or flake8
   - Java/Kotlin (when pom.xml/build.gradle exists): .java/.kt/.kts → checkstyle
   Target only changed files, skip missing tools, prefer existing project config. Do not stop review on lint failures; include them as information.

3. **Code Quality Review**: read changed files and review security vulnerabilities (injection/XSS/hardcoded credentials), missing error handling, naming consistency, and unnecessary complexity.

4. **Compile Findings**: classify as Critical / Warning / Info and include file:line references.

## Output Format (required)
- Result: one of Approve / Request Changes / Needs Discussion
- Reviewed file count, commit count
- Gap Analysis: match rate + unimplemented items
- Lint & Format: per-tool table (target file count / result / key issues)
- Code Quality Findings: Critical / Warnings / Info categories
- Positive Notes: specific positives

When writing the artifact, Read `templates/review.template.md` and follow its contract (required/optional sections and optional marker convention).
```

**Forbidden**:
- Main session running lint directly with Bash without an `Agent` call
- Main session reading changed files and evaluating code quality without an `Agent` call
- Omitting the `model` parameter for the subagent; it must be `"opus"`
