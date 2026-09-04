# Project Timeline & Module Plan

**Project:** Agentic Software-Development Platform · **Lead:** Hasnat Ahmed (part-time, ~10 hrs/week)
**Started:** week of Aug 3, 2026 · **Planned completion: Oct 23, 2026** · **Total duration: ~12 weeks (~115 hours)**
**Re-planned:** Sep 2, 2026, after sponsor review — modularity and team demo pulled forward, cost optimization deferred to the last step (sponsor decision); milestones sized to 1–2 week visible increments.

## Status at a glance

| Module | Dates | Status |
|---|---|---|
| M1 — Research & Foundation | Aug 3 – Aug 7 | ✅ Done |
| M2 — Validation & R&D Report | Aug 10 – Aug 14 | ✅ Done |
| M3 — Core POC Pipeline | Aug 17 – Sep 2 | ✅ Done — PRs merged, SPEC-001 Implemented |
| M4 — Modularity & Team Demo | Sep 1 – Sep 11 | 🔄 In progress |
| M5 — Hardening & Repeatability | Sep 14 – Sep 25 | Planned |
| M6 — Team Handoff & Cross-Platform | Sep 28 – Oct 9 | Planned |
| M7 — Cost Optimization (moved last, sponsor decision) | Oct 12 – Oct 23 | Planned |

## Major milestones

| Date | Milestone |
|---|---|
| Aug 14 ✅ | Complete R&D report delivered and reviewed with sponsor |
| Aug 28 ✅ | First fully agent-generated pull requests, CI green |
| Sep 2 ✅ | **POC complete end-to-end** — PRs human-merged, SPEC-001 Implemented (requirement → spec → tasks → code → tests → PR → merge) |
| **week of Sep 7** | **Full team demo** — live pipeline run, modular stage commands |
| Sep 25 | Pipeline hardened (security/perf/QA) and proven repeatable (second full run with metrics) |
| Oct 9 | Other developers using the pipeline on their own machines (Windows + Mac) |
| **Oct 23** | **Platform v1 complete** — including data-backed cost-routing decision |

## Module details

### M1 — Research & Foundation ✅ (Aug 3–7)
Repo, complete R&D documentation (spec-driven development evaluation, tooling comparison, model routing strategy, architecture, governance, metrics); 7 specialized agents defined.

### M2 — Validation & R&D Report ✅ (Aug 10–14)
All research validated against current sources with citations; OpenHands selected over OpenClaw/Hermes after security assessment; consolidated R&D report reviewed with sponsor; POC app scaffolded; first pipeline run produced SPEC-001; guardrails enforced; repo on GitHub.

### M3 — Core POC Pipeline ✅ (Aug 17 – Sep 2)
Spec approved (human gate) → planner → 3 tasks → developer agent implemented all with 45 tests → code-reviewer agent caught 2 real issues, fixed and re-verified → CI gates green → 4 PRs → human-merged Sep 2. SPEC-001 marked Implemented. The POC deliverable from the original brief is complete.

### M4 — Modularity & Team Demo 🔄 (Sep 1–11, ~15 hrs)
| Task | ETA |
|---|---|
| PR roll-up merged; spec/tasks bookkeeping closed | ✅ Sep 2 |
| Modular stage commands — each agent independently triggerable (`/pipeline-spec`, `/pipeline-plan`, `/pipeline-dev`, `/pipeline-review`, `/pipeline-status`) instead of raw prompts | Sep 5 |
| Demo runbook + refined requirements set for the next pipeline run | Sep 5 |
| **Full team demo: live run of a new requirement through the pipeline** | **week of Sep 7** |
| Human-in-the-loop refined per sponsor direction: humans own acceptance-criteria definition + final check; everything between runs on auto | Sep 11 |

### M5 — Hardening & Repeatability (Sep 14–25, ~20 hrs)
Security hardening (security-auditor in the loop), performance optimization (perf budgets as CI gate), QA hardening (qa-engineer black-box runs); second full pipeline run on a fresh requirement (SPEC-002 due dates) proving repeatability; metrics collected per feature.

### M6 — Team Handoff & Cross-Platform (Sep 28 – Oct 9, ~20 hrs)
Operator guide; developers clone the repo, run the pipeline themselves, and give feedback; **Windows + Mac support verified** (HubbleCap constraint); issue-triggered headless runs on GitHub Actions.

### M7 — Cost Optimization (Oct 12–23, ~20 hrs) — deliberately last, per sponsor decision Sep 2
Benchmark budget models (DeepSeek, Qwen, Kimi via OpenRouter) against the Claude baseline on identical, by-then-hardened tasks; OpenHands executor spike; wire routing for task types that pass the quality bar; final metrics report and v1 handover.

## Backlog (post-v1, noted from sponsor review)
- **Autonomous variant for vibe-coded apps**: pipeline mode for codebases with no docs/specs — agents derive behavior by exploratory testing first, then spec retroactively. Ties into the vibe-code-rescue service offering.
- Deployment agent + staging environment; monitoring/SRE agent once something is deployed.
- Case-study material: the per-feature metrics log doubles as before/after evidence for client-facing case studies.

## Weekly schedule

| Week | Dates | Focus |
|---|---|---|
| 1 ✅ | Aug 3–7 | Foundation + R&D docs + agent definitions |
| 2 ✅ | Aug 10–14 | Validation research + R&D report + POC scaffold + first pipeline run |
| 3 ✅ | Aug 17–21 | GitHub setup, timeline, spec approved, planner + CI gates, first task |
| 4 ✅ | Aug 24–28 | All 3 tasks through developer + reviewer agents; first agent PRs, CI green |
| 5 ✅ | Sep 1–4 | PRs merged (POC complete); re-plan per sponsor review; modular commands |
| 6 | Sep 7–11 | **Full team demo**; requirements refinement; HITL polish |
| 7–8 | Sep 14–25 | Security/perf/QA hardening + repeatability run |
| 9–10 | Sep 28–Oct 9 | Operator guide, dev handoff, Windows+Mac, issue-triggered runs |
| 11–12 | Oct 12–23 | Cost benchmarking + routing + v1 handover |

## Assumptions & notes

- Dates assume ~10 hrs/week; slips cut scope, not quality (later modules slip first).
- M7 needs the small OpenRouter credit; being last, there's no schedule dependency on its approval anymore.
- M6 assumes 1–2 devs get a few hours to try the pipeline; Windows verification needs one Windows machine.
- After v1: apply the pipeline to a first real internal project; scoped separately.
