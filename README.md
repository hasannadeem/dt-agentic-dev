# Agentic Software-Development Platform (R&D)

An R&D project to build a highly autonomous, agentic software-development setup: AI agents run most of the software lifecycle — requirements, planning, architecture, development, code review, QA, security, deployment, and monitoring — while humans act as the judgment, governance, and exception layer.

**Sponsor:** Hasan Nadeem · **Lead:** Hasnat Ahmed · **Tracking:** Tehreem Raghib (weekly Friday standups)

## Guiding priorities (in order)

1. **Fastest possible execution and implementation**
2. **High and measurable quality**
3. **AI cost optimization** without compromising 1 and 2

Approach: a practical 70% implementation delivered quickly and improved iteratively — not a theoretically perfect system delivered months from now.

## Repository layout

| Path | Purpose |
|---|---|
| [docs/06-rd-report.md](docs/06-rd-report.md) | **Consolidated R&D report — start here** (the sponsor-facing summary of everything below) |
| [docs/07-timeline.md](docs/07-timeline.md) | Project timeline: modules, ETAs, milestones, weekly schedule |
| [docs/08-operator-guide.md](docs/08-operator-guide.md) | How any developer clones and runs the pipeline (Mac/Windows) |
| [docs/metrics-log.md](docs/metrics-log.md) | Per-run pipeline metrics (speed, quality, review catches) |
| [docs/10-improvement-backlog.md](docs/10-improvement-backlog.md) | Competitive/platform research → prioritized improvement backlog |
| [docs/09-demo-runbook.md](docs/09-demo-runbook.md) | Live team-demo script with fallback plan |
| [.claude/commands/](.claude/commands/) | Modular stage commands: /pipeline-spec → plan → dev → review, /pipeline-status |
| [docs/00-charter.md](docs/00-charter.md) | Project charter: goals, stakeholders, working model |
| [docs/01-research/](docs/01-research/) | R&D findings: spec-driven development evaluation, tooling comparison, model-routing strategy |
| [docs/02-architecture.md](docs/02-architecture.md) | Proposed end-to-end architecture |
| [docs/03-roadmap.md](docs/03-roadmap.md) | Phased implementation roadmap (~10 hrs/week) |
| [docs/04-governance.md](docs/04-governance.md) | Security, permissions, human approval points |
| [docs/05-metrics.md](docs/05-metrics.md) | Success metrics: speed, quality, autonomy, cost |
| [docs/setup-github.md](docs/setup-github.md) | One-time GitHub setup steps |
| [.claude/agents/](.claude/agents/) | Specialized subagent definitions (the agent team) |
| [CLAUDE.md](CLAUDE.md) | Conventions every agent follows in this repo |
| [specs/](specs/) | Feature specifications (the contract between pipeline stages) |
| [tasks/](tasks/) | Task breakdowns derived from specs |
| [poc/](poc/) | The POC sample application built by the agent pipeline |

## Current status

**Week 1 — Foundation.** Repo initialized, full R&D documentation written, agent team skeleton defined, and the approach validated against current industry sources with corrections applied ([docs/01-research/validation-2026-08.md](docs/01-research/validation-2026-08.md)). Next: POC stage 1 (requirement → spec → tasks) — see [docs/03-roadmap.md](docs/03-roadmap.md).

## How the pipeline works (target state)

```
requirement ──▶ requirements-analyst ──▶ spec (human approves) ──▶ planner ──▶ tasks
tasks ──▶ developer(s) ──▶ code + tests on branch ──▶ code-reviewer ──▶ CI quality gates ──▶ PR (human merges)
```

Deterministic quality gates (lint, types, tests, coverage, security scan) sit between stages — gates are code, not model opinions. Humans approve at exactly the points listed in [docs/04-governance.md](docs/04-governance.md).
