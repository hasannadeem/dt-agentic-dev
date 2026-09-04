---
description: "Pipeline stage 2: break an APPROVED spec into dependency-ordered tasks"
argument-hint: <spec id or path, e.g. SPEC-001>
---
Run the planner subagent on spec: $ARGUMENTS

The planner must verify the spec's Status is Approved and refuse otherwise. After it finishes: list the created task files with sizes and dependencies, state which tasks are independent, and name the first task ready for /pipeline-dev.
