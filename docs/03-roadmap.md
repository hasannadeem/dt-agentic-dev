# Phased Implementation Roadmap

Sized for ~10 hrs/week of lead time. Each phase ends with something demonstrable — 70% working now beats 100% later.

## Week 1 — Foundation ✅ (this week)

- Repo initialized; full R&D documentation (charter, SDD evaluation, tooling comparison, model routing, architecture, governance, metrics)
- Agent team skeleton in `.claude/agents/`; repo conventions in `CLAUDE.md`; spec/task templates
- Standup infrastructure; GitHub setup guide
- **Demo:** this repo, reviewable by Hasan
- **Ask to Hasan:** ~$25–50 OpenRouter credit approved for Week 4 (see [01-research/model-routing-strategy.md](01-research/model-routing-strategy.md) §Costs)

## Week 2 — POC stage 1: requirement → spec → tasks

- Push repo to GitHub ([setup-github.md](setup-github.md))
- Scaffold the POC sample app shell (Node/TypeScript REST API — small, testable, CI-friendly)
- Run `requirements-analyst` and `planner` on 2–3 real sample requirements end-to-end; refine agent prompts against actual output
- Exercise the human spec-approval gate for real
- **Demo:** a raw requirement becoming an approved spec and a dependency-ordered task list, hands-off except approval

## Week 3 — POC stage 2: code → tests → PR

- `developer` agent implements tasks on branches (parallel where independent); `code-reviewer` reviews before push
- GitHub Actions gate stack live: lint, type-check, tests, coverage threshold, mutation testing (Stryker), security scan — with `PreToolUse` deny-hooks enforcing protected-file rules
- Security-auditor reviews any input-handling or dependency change from this week (pulled forward from Week 5 — LLM-code vulnerability rates justify it, see [01-research/validation-2026-08.md](01-research/validation-2026-08.md) §Track 6)
- Bounded retry loop as an automated stage: CI failure feeds back to the developer agent → fix → resubmit (ceiling: 2 attempts, then escalate)
- **Demo: the full POC — requirement → spec → tasks → code → tests → green PR, human touches only spec approval and merge.** This completes the sponsor's POC deliverable.

## Week 4 — Demo, measurement & cost routing

- Demo the full pipeline to Hasan; collect steering feedback
- Baseline metrics from Weeks 2–3 runs (cycle time, first-pass gate rate, cost per feature — [05-metrics.md](05-metrics.md))
- With OpenRouter credit: benchmark DeepSeek V4 Flash / Qwen3-Coder-Next / Kimi K2.7 Code (provider-pinned) on ~10 identical specced tasks vs the Claude baseline; spike **OpenHands** as the budget-executor harness (aider as fallback) — Hermes Agent and OpenClaw were ruled out by the security research, see [01-research/validation-2026-08.md](01-research/validation-2026-08.md) §Track 3
- Wire budget-model routing for the task types that pass the decision rule (eval gates first, then traffic — never the reverse)
- **Demo:** cost/quality comparison table with a routing recommendation backed by data

## Weeks 5–6 — Hardening & repeatability

- `security-auditor` and `qa-engineer` (Playwright MCP) join the pipeline; performance smoke tests (k6/autocannon) with p95-latency budgets become a CI gate
- Second full POC run on fresh requirements to prove repeatability; tune spec threshold and gate strictness with the data
- Escalation rules and audit logging exercised end-to-end
- **Demo:** the pipeline run twice, metrics dashboard of both runs

## Week 7+ — Scale-out (becomes the platform)

- Onboard 1–2 devs as pipeline operators; write the operator guide; lead shifts to assigning work
- Headless orchestration: GitHub Actions-triggered pipeline runs (issue label → pipeline)
- Deployment agent for a staging environment (human-approved deploys)
- Monitoring/remediation (`sre` agent) once something is deployed and emitting telemetry
- Candidate first real project: pick a small internal tool and build it through the pipeline

## Standing rules

- Every week ends with a Friday standup posted in the HQ channel
- Scope pressure resolves by cutting scope, not extending timelines — later weeks' items slip before earlier weeks' quality does
- Any phase can be re-planned after Week 4's demo; the sponsor steers
