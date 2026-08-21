# Research Validation — August 2026

The R&D docs in this repo were first written from model knowledge. This document records the web-research validation pass (run 2026-08-06/07, six parallel research tracks with cited sources) — what was confirmed, what was corrected, and what was added. Corrections have been applied to the affected docs; this file is the evidence trail.

**Overall verdict: the core approach is confirmed** — orchestrator + specialized subagents on Claude Code, lightweight spec-driven core, deterministic CI gates, tiered model routing, humans at defined approval gates. The corrections are in the details: pricing was stale, the Hermes/OpenClaw assessment was too generous, and several Claude Code implementation details improved.

---

## Track 1 — Spec-driven development

**Verdict: our lightweight-spec position is strongly confirmed; evidence honesty improved.**

Confirms:
- The size threshold (no specs for trivial work) is the single most-replicated practitioner finding — Nearform's failure retrospective names "overusing SDD on minor tasks" a top failure mode ([nearform.com](https://nearform.com/insights/lessons-from-real-world-failures-using-spec-driven-development), 2026-06-24).
- Hidde de Smet's three-lane model (Full Spec / Light Spec / No Spec, light = one-pager) matches our policy almost exactly ([hiddedesmet.com](https://hiddedesmet.com/the-hidden-costs-of-spec-driven-development), 2026-07-10).
- Heavyweight multi-doc SDD measurably fails: Eberhardt (CTO, Scott Logic) rebuilt a real feature with GitHub Spec Kit — 2,577 lines of markdown + 3.5h review for 689 lines of code, ~10× slower than his iterative baseline ([blog.scottlogic.com](https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html), 2025-11-26). Böckeler (Thoughtworks/martinfowler.com) reached the same conclusion testing Kiro and Spec Kit ([martinfowler.com](https://www.martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html), 2025-10-15).
- The market votes lightweight: OpenSpec (~64k stars) pitches itself explicitly as "lighter than Spec Kit"; BMAD retreated from mandatory PRD waterfalls to an iterative loop ([github.com/Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec/), [github.com/bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD), fetched 2026-08-06).
- Human spec approval is load-bearing: spec omissions "compound exponentially when the AI fills gaps with assumptions" (Nearform).

Contradicts / counter-camp (recorded for honesty):
- Augment Code argues static specs rot and agent-maintained bidirectional sync beats "write → approve → implement" ([augmentcode.com](https://www.augmentcode.com/blog/what-spec-driven-development-gets-wrong), 2026-02-20) — reasoned argument, no data.
- A minority of practitioners report heavyweight specs paying off, and another minority calls all SDD theater (HN [45935763](https://news.ycombinator.com/item?id=45935763), Spec Kit discussion [#1784](https://github.com/github/spec-kit/discussions/1784)).

Added to our docs as a result:
- **No published controlled data** exists either way on spec-first reducing rework — our position rests on consistent qualitative practitioner evidence; our own metrics will be the test.
- Spec-first vs spec-anchored vocabulary (Böckeler's taxonomy); the staleness critique applies to spec-anchored, which is why spec updates ride in the same PR as deviating code.
- Exploration carve-out: emergent/agentic behavior can't be specced before it's seen — prototype first, spec after learning (Nearform).
- Spec approval should be cross-functional where stakes warrant, not just "any human".

## Track 2 — Claude Code multi-agent practices

**Verdict: our agent skeleton is format-correct and the role-specialist pattern is officially endorsed; adopted several mechanisms we'd missed.** All from official docs fetched 2026-08-06: [sub-agents](https://code.claude.com/docs/en/sub-agents), [hooks](https://code.claude.com/docs/en/hooks), [best-practices](https://code.claude.com/docs/en/best-practices), [headless](https://code.claude.com/docs/en/headless), [github-actions](https://code.claude.com/docs/en/github-actions), [agent-teams](https://code.claude.com/docs/en/agent-teams), plus Anthropic engineering posts ([multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) 2025-06-13, [long-running harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) 2025-11-26).

Confirms:
- `.claude/agents/*.md` frontmatter format, model aliases (`sonnet`/`opus`/`haiku`/`fable`), comma-separated tool allowlists — all exactly as we wrote them. Official docs ship a `security-reviewer` example on opus with the adversarial-review pattern we use.
- Subagents get fresh, isolated context (no parent conversation) — which is precisely why our artifact-based handoffs (spec → tasks → code, all files in-repo) are the correct coordination mechanism, now confirmed as load-bearing rather than stylistic.
- GitHub Actions via `claude-code-action@v1` + headless `claude -p` is the official CI path.

Corrections / warnings applied:
- **Parallel implementation is an anti-pattern**: Anthropic explicitly warns most coding tasks parallelize poorly across agents; the sweet spot is parallel research/review lenses. Our architecture now constrains parallel developers to *truly independent* tasks in isolated worktrees, and defaults to sequential otherwise.
- **Hooks, not prompts, for policy**: "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic." Protected-file rules (CI workflows, `.claude/`, secrets) will be enforced with `PreToolUse` deny hooks in Week 3.
- Multi-agent token cost is real (~15× chat in Anthropic's research system) — reinforces the spec threshold and routing strategy; don't run the full 7-agent pipeline on trivial changes.
- Newer frontmatter capabilities adopted into the Week 2–3 backlog: `disallowedTools` (deny-lists for reviewer agents), `maxTurns` (per-stage budget caps), `isolation: worktree` (parallel developer isolation), `--bare` mode for reproducible CI runs, `Stop` hooks as completion gates.
- Anthropic's long-running-harness reference design (feature list where all features start "failing", progress file, baseline commit, one-feature-per-session, "unacceptable to remove or edit tests") is effectively the official version of our pipeline outer loop — adopted as the Week 3 implementation model.

## Track 3 — Hermes Agent & OpenClaw

**Verdict: our "spike both" position was too generous — corrected to "neither gets repo access."** Sources fetched 2026-08-06.

OpenClaw (ex-Clawdbot/Moltbot, now under the young OpenClaw Foundation after its creator joined OpenAI in Feb 2026):
- Personal-assistant harness by design, not a dev-pipeline executor; its creator publicly calls it "a free, open source hobby project that requires careful configuration to be secure" ([CNBC](https://www.cnbc.com/2026/02/02/openclaw-open-source-ai-agent-rise-controversy-clawdbot-moltbot-moltbook.html), 2026-02-02).
- Documented security record: tens of thousands of publicly exposed instances (one scan claimed 42,665, 93% with auth-bypass misconfigurations) leaking API keys and OAuth creds ([Astrix Security](https://astrix.security/learn/blog/openclaw-moltbot-the-rise-chaos-and-security-nightmare-of-the-first-real-ai-agent/)); the Moltbook breach compromising 770k+ registered agents; 800+ malicious marketplace skills (Cisco); prompt-injection CVE-2026-25253 (CVSS 8.8) ([Wikipedia summary](https://en.wikipedia.org/wiki/OpenClaw), fetched 2026-08-06).
- Verdict: **no repo write access, no spike** — the public evidence already answers the question; spike time reallocated to OpenHands.

Hermes Agent (NousResearch/hermes-agent — the framework, distinct from the Hermes model line):
- Real and huge: launched 2026-02-25, ~226k stars, v0.20.0 (2026-08-03), weekly releases ([github.com/NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)). Better hygiene than OpenClaw (sandbox backends, approval workflows, no public CVEs to date).
- But: ~5 months old with weekly breaking changes; same personal-assistant design center (self-modifying skills = injection-persistence vector); credible unresolved plagiarism allegations about its core self-evolution engine, with maintainers editing the GitHub issue rather than answering ([HN](https://news.ycombinator.com/item?id=48187581), Apr 2026) — a maintainer-trust problem for a tool that would hold repo credentials.
- Verdict: **not today**; re-evaluate at 1.0-era maturity if governance concerns resolve.

Replacement budget-executor candidates (for the Week 4 spike, via OpenRouter):
- **OpenHands** (primary): 80k+ stars, 72% SWE-bench Verified, Docker-sandboxed, headless/CI mode, enterprise RBAC tier ([agentmarketcap.ai](https://agentmarketcap.ai/blog/2026/04/06/openhands-open-source-coding-agent-allhands-ai-series-a-swe-bench), 2026-04-06). Caveat: needs budget caps — unattended runs can burn tokens without producing mergeable output.
- **aider** (fallback, minimal adapter): battle-tested git-native editing, but tagged releases stalled since Aug 2025 — maintenance risk noted ([releases](https://github.com/Aider-AI/aider/releases)).
- Roo Code eliminated — shut down May 15, 2026.

## Track 4 — Model landscape & pricing

**Verdict: routing thesis validated; nearly every number corrected.** Prices fetched 2026-08-06 from [OpenRouter](https://openrouter.ai) model pages and [Anthropic pricing docs](https://platform.claude.com/docs/en/about-claude/pricing.md); benchruns from [llm-stats.com](https://llm-stats.com/benchmarks/swe-bench-verified) and [benchlm.ai](https://benchlm.ai/benchmarks/sweVerified) (2026-08-04/05).

Corrections applied to the routing doc:
- Premium: Claude Opus 5 is **$5/$25** per M tokens (our $15/$75 figure was retired Opus 4.x pricing). Fable 5 ($10/$50) is the ultra tier.
- Mid: Sonnet 5 **$2/$10 intro until 2026-08-31, then $3/$15**; cost models use $3/$15.
- Budget anchors replaced: **DeepSeek V4 Flash $0.09/$0.18** (1M context, ~79% SWE-bench Verified), **Qwen3-Coder-Next $0.12/$0.80**, **GLM 4.7 Flash $0.06/$0.40**, **Kimi K2.7 Code $0.70/$3.50**. Kimi K3 ($2.90/$14) moved to Sonnet-class pricing — no longer a budget option.
- Capability update: top budget models now score 78–81% SWE-bench Verified — at/above Claude Sonnet 4.6 (79.6%), within ~5 pts of Sonnet 5 (85.2%); the remaining premium gap is on the hardest agentic work (Opus 5: 96–97%).

Validations and new practice rules:
- Cheap-default + gates + escalation is validated at scale: 40–85% cost reductions reported with quality held ([digitalapplied.com routing guide](https://www.digitalapplied.com/blog/llm-model-routing-2026-cost-quality-optimization-engineering-guide), 2026-06-14; RouteLLM-style results via [wavect.io](https://wavect.io/blog/reduce-llm-token-costs-2026/)).
- **Rule adopted: eval gates precede traffic shifting** — the documented failure mode of cheap routing is silent quality regression discovered via tickets days later.
- **Rule adopted: pin OpenRouter providers** — same model slug is served at different quantizations (FP8/FP4) by different providers with no quality filter; benchmarks won't reproduce under default routing ([OpenRouter provider docs](https://openrouter.ai/blog/insights/evaluate-llm-provider-performance/)).
- Cost levers noted: Anthropic batch = 50% off (batched Sonnet 5 ≈ $1.50/$7.50 overlaps the budget tier); cache reads = 0.1× input.

## Track 5 — Orchestration landscape

**Verdict: the industry converged on exactly our architecture — nothing contradicts the core stack choice.** Sources fetched 2026-08-07.

Confirms:
- **Issue-driven agent → cloud sandbox → PR → CI gates → human review is the consensus loop**: GitHub Copilot coding agent, Google Jules, OpenAI Codex cloud, Devin, OpenHands resolver, and Cursor background agents all ship this exact shape ([Security Boulevard](https://securityboulevard.com/2026/06/6-background-ai-agents-for-async-development/), 2026-06). GitHub Copilot's coding agent literally runs inside GitHub Actions sandboxes — we're on the substrate the biggest player standardized on.
- **Rejecting CrewAI/AutoGen confirmed, more strongly than we argued**: Microsoft moved AutoGen to maintenance mode in Oct 2025 (successor: Microsoft Agent Framework; community fork AG2 unproven) ([Atlan](https://atlan.com/know/ai-agent/what-is-autogen/)); CrewAI's real traction is business-process automation, not SDLC.
- **Deferring Temporal confirmed at our scale**: its credible agentic users are vendors running agent *products* at massive scale (OpenAI Codex, Replit Agent) — no first-hand reports of a small team running its dev pipeline on Temporal.
- **Human-approval gates and graduated autonomy match every credible lessons-learned report**, including Cognition's own Devin retrospective (67% PR merge rate, up from 34%; sweet spot = clear verifiable 4–8h tasks; fails on ambiguity; human review remains required) ([cognition.com](https://cognition.com/blog/devin-annual-performance-review-2025)).
- Claude Code as CI orchestrator is mainstream: official `claude-code-action@v1`, headless structured output, nested subagents GA; a Jul 2026 Microsoft study found ~24% more merged PRs among CLI-agent adopters.

Nuances / corrections:
- **LangGraph is more production-proven than our "deferred" framing implied** — v1.0 (Oct 2025) with durable execution and HITL; Uber runs code-migration tooling on it at 5,000-engineer scale. Doesn't change the choice at our scale, but "premature" fits Temporal better than LangGraph.
- **Cost-model correction**: since 2026-06-15, Claude Code GitHub Actions / Agent SDK usage is metered per-token, separately from interactive subscriptions. CI pipeline runs are a real budget line, not subscription-covered — budget enforcement becomes an explicit pipeline concern.

New info adopted:
- **OpenHands Issue Resolver** (label issue → agent → draft PR, model-agnostic via LiteLLM) already implements our exact loop as an open-source GitHub Action — prior art to study, and the natural cheap-executor vehicle instead of building a LangGraph routing layer.
- **CI-failure auto-repair as an explicit stage**: Jules auto-reads CI failures on its own PRs and re-pushes; our "2 attempts then escalate" rule should be wired as an automated feedback stage, not left to the orchestrator noticing.
- Veracode: **45% of AI-generated code contains OWASP Top 10 vulnerabilities (2.74× human rate)** — concrete justification for pulling the security-auditor earlier for input-handling/dependency changes.
- Usage-based external reviewers (Cursor Bugbot ~$1–1.50/PR) — a cheap second-opinion option beside our code-reviewer.

## Track 6 — CI gates & AI code review

**Verdict: our gate philosophy is mainstream 2026 practice — and four concrete upgrades were adopted.** Sources fetched 2026-08-07.

Confirms:
- "Gates are code, not model opinions" is consensus: Codacy's hybrid two-layer model (deterministic enforcement + AI augmentation) states it as "language models are not reliably calibrated to assess their own correctness" ([blog.codacy.com](https://blog.codacy.com/why-coding-agents-need-independent-quality-gates), 2026-06-25). "Collusive validation" (reviewer model approving output matching its own generation patterns) is a documented failure mode — supports our different-tier-reviews-than-writes rule.
- Model-based review starting advisory is exactly how Anthropic ships its own Code Review product (neutral check conclusion, never blocks; graduation path via parsing the severity output) ([code.claude.com/docs/en/code-review](https://code.claude.com/docs/en/code-review)).
- Agents-never-merge is platform-enforced practice: GitHub Copilot's coding agent can only open draft PRs and "cannot approve or merge" ([GitHub docs](https://docs.github.com/en/copilot/responsible-use/copilot-cloud-agent)).
- Our lint/types/tests/patch-coverage/SAST stack matches published practitioner gate stacks; ~80% on changed lines is the normal range.
- Scale evidence the pattern works: GitHub runs ~1,000 Copilot-agent PRs merged internally; agent PR acceptance rates in the field: Codex 64%, Devin 49%, Copilot agent 35% ([arXiv 2507.15003](https://arxiv.org/pdf/2507.15003)) — consistent with our POC first-pass target of 60%.

Upgrades adopted into the gate stack:
1. **Mutation testing on agent-written tests** (Stryker for our TS stack): coverage % is precisely the metric agents game with assertion-free tests; reward hacking persists in all frontier agents and grows ~28pts per 10× code size, including an agent that hashed test inputs and returned precomputed outputs ([SpecBench, arXiv 2605.21384](https://arxiv.org/pdf/2605.21384); [augmentcode.com mutation guide](https://www.augmentcode.com/guides/mutation-testing-ai-generated-code)).
2. **"Collaborator approval doesn't count"**: GitHub's rule that approvals from users who collaborated with the agent don't satisfy review requirements — prevents prompt-author self-approval ([GitHub protected-branches docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)).
3. **Workflow-approval gating for agent pushes**: agent PRs treated like outside-contributor PRs — Actions don't run until a human approves (GitHub's default for Copilot agent) — plus claude-code-action's actor checks (bot actors rejected unless allow-listed, preventing agent-triggers-agent loops).
4. **Model review is a bug-finder, not just a spec checker**: Anthropic's internal data — large PRs surface issues 84% of the time (avg 7.5 findings), <1% false-positive rate with a verification-before-posting step; real pre-merge catches include a DNS-rebinding RCE and an SSRF ([claude.com/blog/code-review](https://claude.com/blog/code-review), 2026-04). Our reviewer stays premium-tier and hunts correctness bugs; the spec-consistency check is one item in its charter, not the whole charter.

Also noted:
- Managed Claude Code Review costs $15–25/review — self-running the open code-review plugin via claude-code-action (API-token billed) is the economical path at our scale.
- SAST is a floor, not a ceiling: LLM-output security pass rate stalled at 56% (Veracode 2026); Semgrep/CodeQL individual-report accuracy ~61–65% on LLM-generated samples ([arXiv 2602.05868](https://arxiv.org/html/2602.05868v1)).
- Emerging conventions worth tracking, not adopting yet: slop-detection gates (CodeRabbit, SlopGuard), provenance trailers (`Generated-by:`/`Assisted-by:` — EU AI Act disclosure enforcement begins Aug 2026), merge queues at higher PR volume, tiered human review (risk-gate top ~20% of PRs ≈ 69% of review effort, Salesforce pattern).

---

## Changelog of doc corrections

| Doc | Change |
|---|---|
| `model-routing-strategy.md` | Tier table rewritten with verified prices; budget anchors swapped; capability claim upgraded; provider-pinning + eval-before-shift caveats; batch/cache levers; headless-CI metering correction to POC cost estimate |
| `tooling-comparison.md` | Hermes/OpenClaw verdict hardened to no-repo-access with evidence; OpenHands promoted to primary spike target, aider fallback; Roo Code removed; agent-teams noted experimental; framework table updated (AutoGen maintenance mode, LangGraph v1.0 production evidence, Temporal nuance); gate stack extended with mutation testing, earlier security-auditor, draft-PR + workflow-approval + no-self-approval rules; model review recast as bug-finder |
| `spec-driven-development.md` | Evidence section added with cites; no-controlled-data caveat; spec-first/spec-anchored distinction; exploration carve-out; cross-functional approval |
| `02-architecture.md` | Parallel developers constrained to independent tasks + worktrees; hooks noted as enforcement layer; artifact handoffs documented as load-bearing; long-running-harness pattern referenced |
| `03-roadmap.md` | Week 3: mutation testing + hooks + earlier security-auditor + automated CI-feedback stage; Week 4: benchmark candidates updated, OpenHands spike replaces Hermes/OpenClaw |
| `04-governance.md` | Policy enforcement via deterministic hooks, not prompt text; no-self-approval and workflow-approval rules from GitHub's agent-PR controls |
| `05-metrics.md` | Mutation score added as an anti-gaming quality metric |
