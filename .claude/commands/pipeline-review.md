---
description: "Pipeline stage 4: adversarial code review of a task branch, then PR prep"
argument-hint: <branch name, e.g. task/001.2-create-list-endpoints>
---
Run the code-reviewer subagent on branch: $ARGUMENTS (diff against its base branch; verify against the task file and spec).

If CHANGES REQUESTED: send findings back to the developer subagent on the same branch (max 2 rounds), then re-review. On APPROVE: push the branch, open a draft PR per CLAUDE.md conventions (title [SPEC-nnn] ..., body with spec/task links + test evidence + review verdict), and report the PR URL. Merging stays human-only.
