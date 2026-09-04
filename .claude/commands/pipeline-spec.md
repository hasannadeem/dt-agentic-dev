---
description: "Pipeline stage 1: turn a raw requirement into a spec draft for human approval"
argument-hint: <raw requirement text, or a path/reference to it>
---
Run the requirements-analyst subagent on this requirement: $ARGUMENTS

After it finishes: report the spec file path, list the open questions/assumptions it surfaced, and remind the human that the spec needs their approval (Status → Approved) before /pipeline-plan can run. Do not approve it yourself.
