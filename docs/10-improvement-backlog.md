# Improvement Backlog — Competitive & Platform Research

Research pass **2026-09-11** (two parallel tracks: competitive analysis of comparable agentic SDLC systems, and current Claude Code platform capabilities). Every item below is a concrete gap with a cost estimate. Full source lists are in the research transcripts; key citations inline.

**Headline verdict: our architecture is validated; our *enforcement* was weaker than we claimed.** Nothing in the research says we chose the wrong shape — the strongest external evidence actively supports our serial, gated design. What it does say is that the gap between "written in CLAUDE.md" and "mechanically enforced" is where agent pipelines fail in practice, and we had more of that gap than we thought.

## What the research validated

- **Our serial-by-default design is correct, and we should resist expanding parallelism.** Cognition's position paper ([*Don't Build Multi-Agents*](https://cognition.com/blog/dont-build-multi-agents)) argues for single-threaded linear agents as the default, because "actions carry implicit decisions, and conflicting decisions carry bad results." Anthropic's own data puts multi-agent token usage at ~15× chat. Our design — serial spec/architecture, parallel only for review lenses and planner-marked-independent tasks — is already the recommended answer.
- **Heavyweight spec frameworks are the failure mode we avoided.** Böckeler's hands-on comparison found Kiro turning a small bug fix into 4 user stories with 16 acceptance criteria, and concluded "I'd rather review code than all these markdown files" ([martinfowler.com](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)). Our tiered threshold (trivial → none, small → micro-spec, feature → one page) is the mitigation. **Adopt Spec Kit's *commands*, not its document sprawl.**
- **Validation beats retrieval.** A controlled study of context-grounding found validation-oriented hooks contributed +1.71% vs +0.57% for discovery/retrieval hooks ([arXiv 2604.05278](https://arxiv.org/html/2604.05278v1)) — i.e. checking work is worth ~3× indexing the codebase. This is why a RAG index is *not* on this list.

## What the research contradicted — and we fixed immediately

**🔴 Our guardrail hook had a Bash-shaped hole.** It matched only `Edit|Write`, but four agents hold `Bash`. `echo x > .env`, `sed -i .github/workflows/ci.yml`, and `cp evil.md .claude/agents/developer.md` all bypassed the governance gate that [04-governance.md](04-governance.md) calls mandatory. Fixed 2026-09-11 (`.claude/hooks/guard.py`, 22 scenario tests) — the guard now covers Bash, blocks pushes to main / force-push / `gh pr merge` / `reset --hard` regardless of tool, and distinguishes subagents (blocked from platform config) from the orchestrator (allowed, so the lead can evolve the platform).

This matters more than it sounds. The largest study available — **20,574 real developer-agent sessions, 16,118 validated misalignment episodes** ([arXiv 2605.29442](https://arxiv.org/html/2605.29442)) — found **instruction-following failure is the single largest root cause at 36.49%**, with constraint violations *worse in CLI sessions (49.49%) than IDE (32.26%)*, only **2.99% self-corrected**, and the trend getting *worse* over time as a share of failures. Prose rules in CLAUDE.md are a suggestion; hooks are a gate. Everything in P0 below follows from that finding.

## P0 — Reliability (before the demo)

| # | Item | Cost | Status |
|---|---|---|---|
| 1 | **Bash-aware governance guard** — close the bypass above | S | ✅ done |
| 2 | **De-flake the perf tests** — suite failed ~1 run in 5 via socket exhaustion; a red CI run on stage is the worst demo outcome | S | ✅ done (TASK-000.1) |
| 3 | **`disable-model-invocation` on all five pipeline commands** — every one has side effects (writes specs, creates branches, opens PRs). Without the flag, Claude may invoke a stage on its own; our governance says stage transitions are deliberate | S | pending |
| 4 | **`context: fork` + `agent:` on stage commands** — today the command body *asks* the orchestrator to run a subagent, which is a model judgment call. With these fields the command body **becomes** that subagent's prompt in its own tool set. Turns each stage from a request into a guarantee | S | pending |
| 5 | **`maxTurns` + `isolation: worktree` + `disallowedTools` on agents** — `maxTurns` bounds runaway cost and returns resumable partial output; worktree isolation is what makes our parallel-developer claim actually safe; `disallowedTools` applies *before* `tools`, so "the reviewer never edits code" holds even if someone widens its tool list later | S | pending |

## P1 — Quality (next two weeks)

| # | Item | Cost | Why |
|---|---|---|---|
| 6 | **Clarification loop** (`/pipeline-clarify`) | S | Spec Kit's `/speckit.clarify` isn't "list open questions" — it's a 9-category ambiguity scan, then **at most 5 questions, one at a time, each as a 2–5 option multiple-choice table**, written back into the spec atomically. Directly targets "misread developer intent" (26.95% of symptoms) and moves human effort from *reading prose* to *picking options*. Our `[DECIDE]`/`[ASSUMED]` tagging (added 2026-09-11) is step one of this |
| 7 | **Artifact validator in CI** | S | Our conventions — status line vocabulary, `SPEC-nnn-slug` naming, every task naming an **Approved** spec, branch and PR title patterns — are all mechanically checkable and currently checked by nobody. We claim "traceability by construction"; right now it's traceability by good manners. ~150 lines in the existing gate set |
| 8 | **`SubagentStop` completion gates** | S | Exit code 2 makes a subagent *keep working* instead of returning. Lets us mechanically assert what the Quality bar already demands — gates green, branch named correctly, diff contains a test, HEAD isn't main — instead of trusting a claim of success. Targets "inaccurate self-reporting" (22.58% of symptoms) |
| 9 | **`/pipeline-analyze` coverage gate** | S/M | We have *zero* gate between planner output and developer start — the plan is simply trusted, which is exactly where one agent's bad artifact becomes the next agent's trusted input. Spec Kit's `/analyze` does requirement→task coverage with severity-ranked findings; the coverage % drops straight into our metrics |
| 10 | **Agent run log in task files** | S | Our escalation rule ("max 2 attempts, then escalate with a summary of what failed and what was tried") has nowhere durable to put that summary. Append it to the task file |
| 11 | **`PostToolUseFailure` retry counter** | S | Makes the 2-attempt cap machine-enforced rather than remembered |

## P2 — Measurement (makes our claims falsifiable)

| # | Item | Cost | Why |
|---|---|---|---|
| 12 | **Per-agent cost telemetry** | S | Claude Code exports OTel metrics where `claude_code.cost.usage` carries **`agent.name`** and `query_source` (`main`/`subagent`). That turns our model-tiering claim from an assertion into a measurement — we currently assert Sonnet-for-volume/Opus-for-review saves money without per-agent data. Also `--output-format json` returns `total_cost_usd` per run, free to log |
| 13 | **Spend ceiling per run** | S/M | We have a retry ceiling but no spend ceiling. SWE-agent treats cost as the primary stop signal (default $3.00/instance) and found burning budget is itself a strong failure predictor: successful runs median **$1.21 / 12 steps** vs failures mean **$2.52 / 21 steps** |
| 14 | **Honest revision of our autonomy claim** | S | [02-architecture.md](02-architecture.md) claims "~80% reduction in human touch-time." That is currently an assertion. METR's RCT found experienced developers were **19% slower** with AI while *believing* they were 20% faster ([arXiv 2507.09089](https://arxiv.org/abs/2507.09089)), and METR abandoned the 2026 follow-up as an unreliable signal. Item 12 is how we replace belief with data — and the self-perception gap is a warning not to trust our own impressions |

## P3 — Later / deliberately deferred

- **Dynamic workflows** (JS scripts orchestrating subagents, schema-validated output with automatic retries, resumable runs, enforced determinism) are the most powerful new primitive available — but they explicitly **cannot pause for human input mid-run**, and human approval gates *are* our design. Right fit: inside a single stage (e.g. `/pipeline-review` fanning out one reviewer per changed file, then a cross-check agent). Not as the pipeline itself.
- **Agent teams** — experimental, disabled by default, and disqualified for us on three counts: they don't spawn at all under `-p` (so nothing built on them can run unattended), plan approval bypasses the human, and there's no session resumption. We pin `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "0"` so a developer's global setting can't silently turn ordinary delegation into team formation.
- **Spec delta lifecycle** (OpenSpec's ADDED/MODIFIED/REMOVED change proposals) — the real answer to spec drift, but a restructure of `specs/`. Revisit past ~10 specs.
- **RAG index over the codebase** — measured benefit small (+3% Pass@1) for +13 minutes on a 90-minute workflow. At POC scale, Glob/Grep suffices.
- **Cloud sandbox fleets, multi-repo orchestration, spec-as-source codegen** — solving problems we don't have.
- **Building our own control plane** — GitHub's Agent HQ is consolidating third-party agents into a neutral in-repo dispatcher. Our defensible value is the spec→task→gate discipline and governance model, not the dispatcher. Build the discipline; rent the dispatcher later.
