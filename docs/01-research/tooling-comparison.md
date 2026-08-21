# Tooling, Framework & Model Comparison

## 1. Agent runtime / orchestration layer

The core choice: what runs the orchestrator and the specialized agents.

| Option | What it is | Strengths | Weaknesses | Fit |
|---|---|---|---|---|
| **Claude Code (skills + subagents + hooks + workflows)** | Anthropic's agentic CLI/IDE harness. Subagents defined as markdown files with role prompts and tool restrictions; skills for reusable procedures; hooks for deterministic policy enforcement; built-in multi-agent workflow orchestration; headless/SDK mode for CI. | Zero build cost — orchestration, sandboxing, permissions, MCP, parallel subagents already exist. Matches the orchestrator-of-specialists design exactly. Already licensed. Agent definitions are plain markdown in-repo (versioned, reviewable). Confirmed against official docs 2026-08 — our subagent format matches current guidance exactly; graduation path to the Agent SDK reuses the same `.claude/` config unchanged. | Tied to Anthropic models for the harness itself (third-party models reachable via MCP/CLI bridges, not natively). Long-running server-side durability is limited — it's session-based. Peer-to-peer agent teams are still experimental (disabled by default) — pipeline stages must communicate through artifacts, not agent chatter. | **Chosen for Phases 1–3.** Fastest path to a working pipeline by weeks, not months. |
| **LangGraph** | Python graph-based agent framework; v1.0 since Oct 2025, durable execution (checkpointing, resumable runs), human-in-the-loop nodes. | Model-agnostic (OpenRouter trivial), production-proven (Uber runs code-migration tooling on it at 5,000-engineer scale; ~400 companies on the platform), good observability (LangSmith). | We build and maintain everything: sandboxing, permissions, tool integrations, the harness itself. Its proven SDLC use is bespoke tooling built by dedicated platform teams — a scale we're not at. | Not chosen now, but the most credible graduation path if we ever need multi-day pausable pipelines beyond what GitHub Actions + repo-state gives us. |
| **CrewAI / AutoGen** | Role-based multi-agent frameworks ("crew of agents with roles"). | Quick demos, role model matches our mental model. | **AutoGen: maintenance mode since Oct 2025** (Microsoft's successor is Microsoft Agent Framework; community fork AG2 unproven). CrewAI's commercial traction is business-process automation, not SDLC; ranks last on production reliability in 2026 comparisons. | Not chosen — validated harder than expected by the ecosystem's own trajectory. |
| **Temporal (custom workflow engine)** | Durable workflow engine; agents as activities. | Bulletproof retries/durability/audit; OpenAI Codex cloud and Replit Agent credibly run on it. | Its agentic users are vendors running agent *products* at massive scale — no credible reports of small teams running dev pipelines on it. Heavy infra for a problem we don't have. | Revisit at platform scale (Phase 5+), if ever. CI-triggered headless Claude Code runs cover durability needs until then. |

**Decision:** Claude Code as orchestrator + specialized subagents now; GitHub Actions provides the durable/scheduled execution shell (headless runs). Re-evaluate LangGraph only when we wire non-Anthropic executor models (Week 4) — and only for those executors, not as a replacement orchestrator.

## 2. Cost-effective executors: Hermes Agent, OpenClaw, OpenRouter models

The sponsor asked specifically about Hermes Agent and OpenClaw. Web research (2026-08-06, full evidence and sources in [validation-2026-08.md](validation-2026-08.md) §Track 3) settled the question harder than expected: **neither belongs in a pipeline with repo write access.**

- **OpenRouter** (solid, low-risk): a unified API over 300+ models with per-token pricing, provider routing, and one bill. Confirmed as the right procurement layer for budget models. Current best coding options: DeepSeek V4 Flash, Qwen3-Coder-Next, GLM 4.7 Flash, Kimi K2.7 Code — the best of these now match Claude Sonnet 4.6-class quality (78–81% SWE-bench Verified) at a fraction of the cost. One operational must: pin providers — the same model slug is served at different quantizations by different providers.
- **OpenClaw — rejected, no spike needed.** It is a *personal-assistant* harness (messaging-first, shell access), not a dev-pipeline executor, and its 2026 security record is disqualifying for corporate repo access: tens of thousands of publicly exposed instances leaking API keys, the Moltbook breach (770k+ agents), 800+ malicious marketplace skills found by Cisco, and prompt-injection CVE-2026-25253 (CVSS 8.8). Its own creator describes it as a hobby project requiring careful configuration to be secure. The public evidence already answers what a spike would ask.
- **Hermes Agent — rejected for now, re-evaluate at maturity.** Real and enormous (NousResearch/hermes-agent, ~226k stars, launched Feb 2026 — distinct from the Hermes model line), with better security hygiene than OpenClaw (sandbox backends, approval workflows, no public CVEs to date). But it is ~5 months old with weekly breaking v0.x releases, shares the personal-assistant design center (self-modifying skills are an injection-persistence vector), and carries unresolved plagiarism allegations about its core engine that maintainers edited out of a GitHub issue rather than answered — a trust problem for a tool that would hold repo credentials.
- **What replaces them for the Week 4 spike:** **OpenHands** (primary — 72% SWE-bench Verified, Docker-sandboxed, headless/CI mode, enterprise RBAC tier; needs hard budget caps on unattended runs) and **aider** (fallback — minimal git-native adapter; note its tagged releases stalled Aug 2025, a maintenance-risk flag). Roo Code was also evaluated and is dead (shut down May 2026).

**Position (updated):** route *individual well-specced tasks* to budget models via OpenRouter through OpenHands or a thin aider adapter, keep orchestration in Claude Code, and let deterministic gates catch quality misses. If Hermes Agent reaches 1.0-era stability and resolves its governance questions, it can be re-evaluated behind the same task interface; OpenClaw stays out.

## 3. CI/CD and deterministic quality gates

**GitHub Actions**, chosen without much contest (repo will live on GitHub; team knows it; agent-friendly via `gh` CLI).

The design principle: **gates are code, not model opinions.** A model reviewing model output can be lenient, inconsistent, or sycophantic; a failing test cannot. Validated as consensus 2026 practice — GitHub and Anthropic run this exact pattern on their own agent PRs (sources: [validation-2026-08.md](validation-2026-08.md) §Track 6). Gate stack per PR:

1. Lint + format (zero tolerance)
2. Type check (strict)
3. Unit/integration tests (must pass)
4. Coverage threshold on changed lines (start 80%, tune with data)
5. **Mutation testing on changed code (Stryker)** — added per research: coverage % is precisely the metric agents game with assertion-free tests; mutation score verifies the tests actually detect broken code. Reward hacking is documented in all frontier agents.
6. Dependency/security scan (CodeQL/Semgrep + `npm audit`, Renovate for updates) — treated as a floor, not a ceiling: LLM-output security pass rates are stalled ~56% industry-wide, so the security-auditor agent reviews input-handling/dependency changes from Week 3, not Week 5
7. Performance budget check (from Week 5–6, once the app runs): k6/autocannon smoke test on key endpoints with p95-latency and throughput thresholds — a perf regression fails the gate like a failing test. Deeper load testing waits for a staging environment (deployment phase)
8. Model-based review (premium-tier code-reviewer agent): hunts correctness bugs *and* checks spec-consistency — Anthropic's data shows this layer catches real pre-merge vulnerabilities with <1% false positives when findings are verified before posting. Advisory at first, blocking once calibrated

Process rules around the gates (adopted from GitHub's own agent-PR controls):
- Agent PRs open as drafts; Actions workflows require human approval to run (outside-contributor treatment)
- Approvals from whoever prompted/collaborated with the agent don't satisfy review requirements — no self-approval loops
- A PR that fails gates goes back to the developer agent automatically (bounded retries — see escalation rules in [model-routing-strategy.md](model-routing-strategy.md)); humans only see PRs that are already green.

## 4. MCP integrations, by phase

| Phase | Integration | Why |
|---|---|---|
| Now | `gh` CLI (not MCP — simpler and sufficient) | PRs, issues, CI status |
| POC (Wk 2–3) | Filesystem/git (built-in) | Everything the pipeline touches |
| QA (Wk 5+) | Playwright MCP | Browser-level QA agent testing the running app |
| Later | Sentry/monitoring MCP, Slack MCP | Production-issue → remediation-agent loop; notifications |

Rule: add an MCP server when a stage needs it, not preemptively — each server added is attack surface and context cost.
