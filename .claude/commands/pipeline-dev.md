---
description: "Pipeline stage 3: developer agent implements one task on its own branch"
argument-hint: <task id or path, e.g. TASK-001.2>
---
Run the developer subagent on task: $ARGUMENTS

Rules: branch per CLAUDE.md naming; if the task depends on an unmerged task branch, stack on that branch and say so; the project's gate command (`gates.command` in `pipeline.config.json`, run from `app.dir`) must be green before commit; max 2 fix attempts then escalate. After it finishes: report branch, commit, test count, and hand off to /pipeline-review.
