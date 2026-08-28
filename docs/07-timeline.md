# Project Timeline & Module Plan

**Project:** Agentic Software-Development Platform · **Lead:** Hasnat Ahmed (part-time, ~10 hrs/week)
**Started:** week of Aug 3, 2026 · **Planned completion: Oct 16, 2026** · **Total duration: ~11 weeks (~110 hours)**
**Prepared:** Aug 21, 2026, for progress tracking (requested by Tehreem Raghib)

## Status at a glance

| Module | Dates | Status |
|---|---|---|
| M1 — Research & Foundation | Aug 3 – Aug 7 | ✅ Done |
| M2 — Validation & R&D Report | Aug 10 – Aug 14 | ✅ Done |
| M3 — Core POC Pipeline | Aug 17 – Aug 28 | 🔄 In progress |
| M4 — Cost Optimization (model routing) | Aug 31 – Sep 4 | Planned |
| M5 — Hardening (QA, security, performance) | Sep 7 – Sep 18 | Planned |
| M6 — Scale-out (team usage, deployment) | Sep 21 – Oct 2 | Planned |
| M7 — Monitoring & SRE agent | Oct 5 – Oct 16 | Planned |

## Major milestones

| Date | Milestone |
|---|---|
| Aug 14 ✅ | Complete R&D report delivered and reviewed with Hasan |
| **Aug 28** | **First fully agent-generated pull request** (POC deliverable complete: requirement → spec → tasks → code → tests → PR) |
| Sep 4 | Cost-routing decision backed by benchmark data (premium vs budget models) |
| Sep 18 | Pipeline proven repeatable (second full run, metrics for speed/quality/cost) |
| Oct 2 | Platform usable by other developers (operator guide, issue-triggered runs, staging deploys) |
| **Oct 16** | **Platform v1 complete** (monitoring/SRE agent live; full lifecycle covered) |

## Module details

### M1 — Research & Foundation ✅ (Aug 3–7, 10 hrs — done)
Project repo and structure; complete R&D documentation (spec-driven development evaluation, tools/framework comparison, model routing strategy, end-to-end architecture, governance and human approval points, success metrics); 7 specialized agents defined (requirements analyst, planner, architect, developer, code reviewer, QA engineer, security auditor).

### M2 — Validation & R&D Report ✅ (Aug 10–14, 10 hrs — done)
All research validated against current industry sources with citations; corrections applied (model pricing, executor framework decision — OpenHands selected over OpenClaw/Hermes after security assessment); consolidated R&D report compiled and reviewed with Hasan; POC app scaffolded (Node/TypeScript API with lint/type/test gates green); first live pipeline run — requirements-analyst agent produced SPEC-001 draft; agent guardrails enforced (protected files blocked); repo live on GitHub.

### M3 — Core POC Pipeline 🔄 (Aug 17–28, ~20 hrs)
| Task | ETA |
|---|---|
| Spec approval gate exercised (SPEC-001) + planner agent → 3-task breakdown | ✅ Aug 21 |
| GitHub Actions CI gates live (lint, types, tests on every PR) | ✅ Aug 21 |
| First task implemented by developer agent (20 unit tests, all gates passing) | ✅ Aug 21 |
| Remaining 2 tasks implemented by developer agent; code-reviewer agent reviewed all 3 (review caught 2 real issues, fixed and re-verified) | ✅ Aug 28 |
| **3 agent-generated PRs open (#1–#3), CI green, 45 tests** — POC deliverable complete | ✅ **Aug 28** |
| Human merge of the PR stack → SPEC-001 marked Implemented | pending lead |

### M4 — Cost Optimization (Aug 31 – Sep 4, ~10 hrs)
Benchmark budget models (DeepSeek, Qwen, Kimi via OpenRouter) against the Claude baseline on identical tasks; spike OpenHands as budget-model executor; wire routing for task types that pass the quality bar. *Depends on the small POC budget approval.*

### M5 — Hardening (Sep 7–18, ~20 hrs)
Security-auditor and QA-engineer agents join the pipeline; performance smoke tests with budgets become a CI gate; mutation testing on agent-written tests; second full pipeline run on fresh requirements to prove repeatability; metrics collected (cycle time, first-pass quality, cost per feature).

### M6 — Scale-out (Sep 21 – Oct 2, ~20 hrs)
Operator guide; 1–2 developers onboarded to use the pipeline; issue-triggered automatic pipeline runs (GitHub Actions); deployment agent for a staging environment with human-approved deploys.

### M7 — Monitoring & SRE (Oct 5–16, ~20 hrs)
Monitoring integration for the deployed app; SRE agent for diagnosis and pre-approved runbook remediation (restart/scale/rollback), everything else escalating to a human; final metrics report and platform v1 handover.

## Weekly schedule

| Week | Dates | Focus |
|---|---|---|
| 1 ✅ | Aug 3–7 | Foundation + R&D docs + agent definitions |
| 2 ✅ | Aug 10–14 | Validation research + R&D report + POC scaffold + first pipeline run |
| 3 ✅ | Aug 17–21 | GitHub setup, timeline, spec approved, planner + CI gates, first task implemented |
| 4 ✅ | Aug 24–28 | Developer + reviewer agents ran all 3 tasks; **first agent PRs open, CI green** — awaiting human merge |
| 5 | Aug 31–Sep 4 | Model benchmarking + cost routing |
| 6–7 | Sep 7–18 | Hardening + repeatability + metrics |
| 8–9 | Sep 21–Oct 2 | Team scale-out + staging deployments |
| 10–11 | Oct 5–16 | Monitoring + SRE agent + v1 handover |

## Assumptions & notes

- Dates assume ~10 hrs/week of availability. If a week's hours drop, dates shift accordingly — scope is cut before quality is (later modules slip first).
- M4 depends on the small POC budget (raised with Hasan); if approval moves, M4 swaps with M5 rather than blocking the timeline.
- M6–M7 assume a staging environment can be provisioned in company infrastructure; if not, M7 runs against a temporary environment.
- After v1 (Oct 16): the platform is applied to a first real internal project and improved iteratively — scoped separately once v1 lands.
