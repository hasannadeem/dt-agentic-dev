# Model-Routing Strategy

Route every pipeline task to the cheapest model tier that can pass the quality gates on the first attempt. Premium models are reserved for judgment-heavy work; budget models handle well-specified execution. The spec stage ([spec-driven-development.md](spec-driven-development.md)) is what makes this safe — tightly-scoped tasks are the ones cheap models do well.

## Tiers

Prices verified 2026-08-06 against Anthropic pricing docs and OpenRouter model pages (sources in [validation-2026-08.md](validation-2026-08.md) §Track 4).

| Tier | Models | Cost (per M tokens, in/out) | Character |
|---|---|---|---|
| **Premium** | Claude Opus 5 ($5/$25); Fable 5 ($10/$50) as ultra option | $5–10 / $25–50 | Deep reasoning, judgment, security sensitivity. Opus 5: 96–97% SWE-bench Verified |
| **Mid** | Claude Sonnet 5 | $3 / $15 ($2/$10 intro until 2026-08-31) | Strong coding, reliable tool use — the workhorse. 85.2% SWE-bench Verified |
| **Budget** | DeepSeek V4 Flash ($0.09/$0.18), Qwen3-Coder-Next ($0.12/$0.80), GLM 4.7 Flash ($0.06/$0.40), Kimi K2.7 Code ($0.70/$3.50) via OpenRouter | $0.06–0.70 / $0.18–3.50 | 78–81% SWE-bench Verified — at/above Claude Sonnet 4.6 level; weak mainly on ambiguity and the hardest agentic work |

Notes that change the math:
- Budget models are no longer just "competent at well-scoped tasks" — the best now match Sonnet-4.6-class quality at 1/10th–1/80th the output price. The premium gap that remains is on the hardest agentic work.
- Kimi K3 ($2.90/$14) moved to Sonnet-class pricing — it is not a budget option; K2.7 Code is Kimi's budget coding model.
- Anthropic levers: batch API = 50% off (batched Sonnet 5 ≈ $1.50/$7.50 — overlaps the budget tier for non-latency-sensitive stages); prompt-cache reads = 0.1× input.
- **Pin OpenRouter providers.** The same model slug is served by different providers at different quantizations (FP8/FP4) with no quality filter — unpinned routing means benchmark results won't reproduce. Use provider allowlists/quantization filters in the adapter.

## Routing table

| Pipeline task | Tier | Rationale |
|---|---|---|
| Requirements analysis, spec writing | **Mid** | Needs judgment and good questions, but not the deepest tier; human approves the output anyway |
| Architecture & design decisions | **Premium** | Wrong architecture is the most expensive mistake in the pipeline; small token volume, huge leverage |
| Task breakdown / planning | **Mid** | Structured decomposition of an approved spec |
| Feature implementation (well-specced) | **Mid** now → **Budget** after Week 4 benchmarking | The core cost lever; gates catch quality misses |
| Boilerplate, scaffolding, test scaffolds, doc drafts, commit messages | **Budget** | High volume, low judgment |
| Code review | **Premium** | The last line of defense before human review; must catch what cheaper tiers miss. Never the same model/tier that wrote the code |
| Security review | **Premium** | Asymmetric downside |
| QA test authoring | **Mid** | Needs to reason about edge cases |
| CI failure triage, log summarization | **Budget** | Summarization-shaped work |
| Escalations / stuck tasks | **Premium** | By definition the hard cases |

## Escalation rule (the safety valve)

A task attempted by a budget model that **fails quality gates twice escalates one tier automatically**; a mid-tier failure after two attempts escalates to premium; a premium failure after two attempts escalates to a human. Retries carry the failure context forward. This bounds the worst case: a cheap model can waste at most two gate-runs before a stronger model takes over — and gate-runs are nearly free, while unbounded retry loops are not.

Corollary metric: if a task type escalates >30% of the time, its default tier is wrong — promote it permanently ([../05-metrics.md](../05-metrics.md)).

**Eval before traffic — the rule the industry learned the hard way.** Published routing experience (40–85% cost reductions, sources in [validation-2026-08.md](validation-2026-08.md) §Track 4) consistently reports one failure mode: silent quality regression discovered days later via bug reports. The fix is sequencing: build the eval harness (our CI gates + a small benchmark task set) *first*, measure the budget model against it, and only then shift that task type's traffic. Week 4 follows this order.

## Cost model

**Per-feature estimate (target state, post-routing):** spec (~$0.50, mid) + planning (~$0.30, mid) + implementation (~$0.20–1.50, budget/mid mix — budget outputs now cost $0.18–3.50/M) + review (~$1–2, premium at $25/M out) + QA/fix cycles (~$1) ≈ **$3–5 per small-to-medium feature**, versus roughly $10–20 running everything on premium (Opus 5 is $5/$25, cheaper than our original estimate assumed). Published routing results (40–85% savings at held quality) suggest the target is realistic — Week 4 measures it on our own tasks.

**POC costs (Weeks 2–4):** interactive pipeline development is covered by the existing Claude Code subscription. One correction from research (2026-08): **headless Claude Code runs in GitHub Actions / Agent SDK are metered per-token separately from subscriptions** (since June 2026) — so Week 3's CI-triggered runs are a small real cost (est. $5–20 for the POC's volume), and cost metering per pipeline run becomes an explicit design requirement, not an afterthought. **Budget request for Hasan: ~$25–50 OpenRouter credit** for Week 4 benchmarking of DeepSeek V4 Flash / Qwen3-Coder-Next / Kimi K2.7 Code against the Claude baseline, plus the small CI metering above. Nothing else is needed for the POC.

**Scaled operating estimate (later, for planning only):** a team pushing ~40 agent-built features/month ≈ $120–240/month in inference at the blended rate above, plus CI minutes. Trivially cheap next to developer time — which is the real argument: the pipeline's ROI is human hours saved, and inference cost optimization is a second-order win. We still do it because at higher scale (hundreds of features, monitoring agents running 24/7) the blended rate compounds.

## What Week 4 must measure (before trusting budget models)

Per model, on ~10 identical specced tasks: first-pass gate success rate, escalation rate, wall-clock time, cost per merged task. Candidates: DeepSeek V4 Flash, Qwen3-Coder-Next, Kimi K2.7 Code (provider-pinned via OpenRouter), plus batched Sonnet 5 as the incumbent-cheap option. Decision rule: a budget model earns implementation-tier default only if its escalation-adjusted cost (including retries and escalation runs) beats mid-tier cost AND its post-gate defect rate is no worse. Executor harness for budget models: OpenHands or a thin aider adapter — not Hermes Agent or OpenClaw (see [tooling-comparison.md](tooling-comparison.md) §2).
