# Pipeline Metrics Log

One row per full pipeline run, per [05-metrics.md](05-metrics.md). Collected manually during the POC phase.

| Run | Spec | Dates | Tasks | Tests added | Dev gates first-pass | Review verdict rounds (per task) | Real defects caught by review | Human touches | Outcome |
|---|---|---|---|---|---|---|---|---|---|
| 1 | SPEC-001 task CRUD API | Aug 14 – Sep 2 | 3 | 45 (0→45) | 3/3 first attempt | 001.1: 2 (1 fix round) · 001.2: 1 (+2 notes applied) · 001.3: 1 (+1 note applied) | Vacuous test assertion (mutation-proven); non-JSON 413 error violating spec | 2 (spec approval, PR merges) + 1 unplanned (stacked-merge recovery) | Merged to main (PRs #1–#4) |
| 2 | SPEC-002 due dates + overdue | Sep 4 | 2 | 55 (45→100) | 2/2 first attempt | 002.1: 2 (1 fix round, MAJOR) · 002.2: 2 (1 fix round, HIGH) | Non-ISO date validation making "overdue" server-timezone-dependent; flaky perf seeding; 3 mutation-surviving test gaps | 1 so far (spec approval; merges pending) | PRs #5–#6 open, CI green on #5 |

## Observations after two runs

- **Repeatability: confirmed.** Second run completed the full loop with the same two human touchpoints and no process changes needed.
- **The review stage earns its premium tier**: in both runs it caught defects that passed all deterministic gates — including a timezone-dependence bug (run 2) that would have made the feature behave differently per deployment region, and reward-hacking-shaped test gaps proven by mutation testing.
- **Developer first-pass quality is high** (5/5 tasks passed local gates on first attempt) but review consistently finds one substantive issue per task — supporting the "cheap model writes, premium model reviews" routing thesis before we've even benchmarked budget models.
- **Speed**: run 2 went from approved spec to two reviewed, CI-green PRs in a single working session (~half a day wall-clock).
- Known infra note: pre-existing perf tests that seed via HTTP can flake under full-suite parallelism (socket pressure); run 2 fixed the pattern for the new endpoint via store injection — follow-up ticket to retrofit the SPEC-001 perf tests.
