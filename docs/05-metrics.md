# Success Metrics

The sponsor's priorities are speed, measurable quality, and cost — so every claim the platform makes must map to a number we actually collect. Collection is manual (a per-feature row in `docs/metrics-log.md`) during the POC, automated from GitHub/CI data in Phase 7+.

## Speed

| Metric | Definition | POC target | Platform target |
|---|---|---|---|
| Cycle time | Requirement accepted → PR merged | < 1 working day | < 4 hours for small features |
| Human touch-time per feature | Total minutes humans spend (approvals + reviews + fixes) | < 30 min | < 15 min |
| Pipeline wall-clock | Spec approval → green PR, hands-off | < 2 hours | < 1 hour |

## Quality

| Metric | Definition | POC target | Platform target |
|---|---|---|---|
| First-pass gate rate | % of agent PRs passing all CI gates without human code fixes | > 60% | > 85% |
| Review-cycle count | Agent review→fix loops before green | ≤ 2 avg | ≤ 1 avg |
| Escaped defects | Bugs found after merge, traced to agent-built features | Tracked (no target yet) | < 1 per 10 features |
| Mutation score on changed code | % of seeded mutants killed by the PR's tests (anti-gaming check on agent-written tests) | > 50% | > 70% on critical paths |
| Performance budget adherence | p95 latency / throughput within the spec's budget on gated endpoints (perf smoke suite, Week 5+) | Tracked | 100% within budget to merge |
| Spec-consistency | % merged PRs matching approved spec without scope drift | 100% (reviewer-checked) | 100% |

## Autonomy

| Metric | Definition | POC target | Platform target |
|---|---|---|---|
| Autonomy rate | % pipeline steps completed with zero human edits (approvals don't count as edits) | > 70% | > 90% |
| Human intervention count | Unplanned human interventions per feature (beyond the mandatory gates in [04-governance.md](04-governance.md)) | ≤ 2 | ≤ 0.5 |
| Escalation rate | % tasks escalating a model tier (per [01-research/model-routing-strategy.md](01-research/model-routing-strategy.md)) | Tracked | < 30% per task type — above that, the tier default is wrong |

## Cost

| Metric | Definition | POC target | Platform target |
|---|---|---|---|
| Inference cost per merged feature | All model spend attributable to the feature, retries included | < $10 | < $6 blended |
| Cost per merged feature vs all-premium baseline | Savings from routing | Measured Week 4 | ≥ 60% reduction |
| Waste rate | Spend on abandoned/reworked output ÷ total spend | Tracked | < 15% |

## The honest composite

The single number that decides whether this platform succeeds: **human hours per shipped feature, at equal-or-better defect rate.** Everything else is instrumentation for diagnosing that number. If Week 4's demo can't show it moving, the roadmap gets re-planned before more is built.
