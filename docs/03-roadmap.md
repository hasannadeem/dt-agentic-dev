# Phased Implementation Roadmap

Sized for ~10 hrs/week of lead time. Each phase ends with something demonstrable — 70% working now beats 100% later.

> **Re-planned 2026-09-02 after sponsor review.** Direction changes: (1) milestones sized to 1–2 week visible increments; (2) **cost optimization moved to the last step** — refine requirements and harden the pipeline first; (3) agents must be **modular and independently triggerable** (stage commands, not raw prompts); (4) human-in-the-loop concentrated at **acceptance-criteria definition and final check**, everything between on auto; (5) **Windows + Mac support** required (team runs both); (6) full **team demo** in the week of Sep 7. Calendar mapping lives in [07-timeline.md](07-timeline.md).

## Phases 1–3 ✅ (Aug 3 – Sep 2) — R&D, validation, working POC

Complete. R&D docs + validation with citations; 7-agent team defined; POC ran end-to-end on a real requirement: agent-written spec → human approval → planner → developer (45 tests) → adversarial review (caught 2 real issues) → CI gates → PRs → human merge. SPEC-001 `Implemented`. Details: [07-timeline.md](07-timeline.md) M1–M3.

## Phase 4 (Sep 1–11) — Modularity & team demo

- Modular stage commands so each agent is independently triggerable: `/pipeline-spec <requirement>`, `/pipeline-plan <spec>`, `/pipeline-dev <task>`, `/pipeline-review <branch>`, `/pipeline-status`
- Refine the requirements set for the next pipeline runs (sponsor ask) — sharper acceptance criteria, performance budgets in specs
- Demo runbook ([09-demo-runbook.md](09-demo-runbook.md)); **live team demo week of Sep 7**: fresh requirement in, PR out
- HITL model documented as: humans own acceptance-criteria definition + final check; agent steps auto-advance between those gates

## Phase 5 (Sep 14–25) — Security, performance & QA hardening + repeatability

- security-auditor and qa-engineer join every run; perf budgets enforced as a CI gate; mutation testing on agent tests
- Second full pipeline run (SPEC-002, due dates) proves repeatability; metrics logged per [05-metrics.md](05-metrics.md)

## Phase 6 (Sep 28 – Oct 9) — Team handoff & cross-platform

- Operator guide ([08-operator-guide.md](08-operator-guide.md)); 1–2 devs clone, run the pipeline themselves, file feedback
- **Windows + Mac verified** (hooks/scripts portable); issue-triggered headless runs via GitHub Actions

## Phase 7 (Oct 12–23) — Cost optimization (deliberately last, sponsor decision)

- Benchmark DeepSeek / Qwen / Kimi (provider-pinned via OpenRouter) vs Claude baseline on hardened tasks; OpenHands executor spike (Hermes/OpenClaw ruled out — [01-research/validation-2026-08.md](01-research/validation-2026-08.md) §Track 3)
- Wire routing for task types that pass the decision rule (eval gates first, then traffic); final metrics report; v1 handover

## Backlog (post-v1)

- Autonomous variant for vibe-coded apps: no docs → agents derive behavior via exploratory testing, spec retroactively, then pipeline as normal
- Deployment agent + staging; monitoring/SRE agent once something is deployed
- First real internal project through the pipeline

## Standing rules

- Every week ends with a Friday standup posted in the HQ channel
- Scope pressure resolves by cutting scope, not extending timelines — later weeks' items slip before earlier weeks' quality does
- Sponsor steers at each demo checkpoint
