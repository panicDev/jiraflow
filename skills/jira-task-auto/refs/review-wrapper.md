# Review Wrapper Design Basis

> Background explanation on the review stage wrapper design and scope shortfall branch of jira-task-auto SKILL.md.

## Reason for setting Wrapper subagent_type to `general-purpose`

If you set the review wrapper to `jiraflow:jira-reviewer`, two-level nesting with the inner reviewer occurs and it takes two booting times. The wrapper is set to `general-purpose` and the actual review is left to the inner `jira-reviewer` subagent that is launched within the `jira-task-review` skill.

Since the `Reviewer Independence Rule` within the `jira-task-review` skill is responsible for blocking the review's self-praise bias, there is no need to force the reviewer persona at the wrapper stage.

## Scope Shortfall branch basis

If the matchRate is low or the Critical is high, the scope itself is missing. fix sub-agent It is difficult to make up all the shortfall at once, and the fix loop fails equally and only wastes time. In these cases, the user must consciously decide to take further action.

thus:
- matchRate < 70% **OR** Critical ≥ 3 → Fix loop entry **Prohibited**, stop immediately (Scope Shortfall Bail).
- Others → Proceed with the existing Trivial Fix Path (up to 2 auto-correction loops).
- Signal extraction failure (parse error) → Enter fix loop with fail-safe.
