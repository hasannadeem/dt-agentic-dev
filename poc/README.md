# POC — Sample App Built by the Agent Pipeline

This directory hosts the proof-of-concept: a small **Node/TypeScript REST API** (a task-tracker service — fittingly meta, and small enough to stay out of the way of what's actually being tested: the pipeline).

The app itself is deliberately boring. The POC's real deliverable is the *pipeline run*:

```
raw requirement → requirements-analyst → spec (human approves)
              → planner → tasks → developer(s) → code + tests on branches
              → code-reviewer → CI gates → green PR (human merges)
```

## Build plan (from docs/03-roadmap.md)

- **Week 2:** app shell scaffolded here (`poc/app/`); requirement → spec → tasks exercised on 2–3 sample requirements with the human approval gate.
- **Week 3:** developer + reviewer agents produce the implementation on branches; GitHub Actions gate stack (lint, type-check, tests, coverage, security scan) goes live; first fully agent-generated PR.

## Sample requirements queue (inputs for Week 2)

1. "Users can create, list, complete, and delete tasks via a JSON API, with input validation and meaningful error responses."
2. "Tasks support due dates; an endpoint returns overdue tasks sorted by how overdue they are."
3. "Add simple API-key authentication; unauthenticated requests are rejected with a proper error."

Each becomes a `SPEC-00x` through the pipeline. Requirement 3 is deliberately security-adjacent to exercise the architect and (later) security-auditor paths.

## Success = the metrics, not the app

Every run logs a row against the POC targets in [docs/05-metrics.md](../docs/05-metrics.md): cycle time, first-pass gate rate, human touch-time, cost. The app could be flawless and the POC still fail if humans had to intervene constantly — and vice versa.
