# Team Demo Runbook — Live Pipeline Run

**Audience:** full team · **Slot:** ~25–30 min + questions · **Goal:** show a requirement becoming merged, tested code with humans making exactly two decisions.

## Demo shape (the story in one line)

"I'm going to give the pipeline a feature request, approve its plan, and drink coffee while a team of AI agents builds, tests, and reviews it — then I'll merge the result."

## Pre-demo checklist (do the morning of)

1. `git checkout main && git pull` — clean tree, CI green on last commit
2. `cd poc/app && npm ci && npm run gates` — verify green locally
3. Open in split view: Claude Code, the GitHub PR page, and the timeline artifact
4. Have SPEC-002's requirement ready to paste (below)
5. **Fallback prepared** (see bottom) in case of live-demo gremlins

## The live flow (with talking points)

**1. Show the finished POC first (2 min)** — open the merged PRs (#1–#4) and `poc/app/tests/` (45 tests). Talking point: "This already happened once for real — today you'll watch it live."

**2. `/pipeline-spec` (5 min)** — paste the requirement:
> "Tasks support optional due dates; an endpoint returns overdue tasks sorted by how overdue they are."

While the agent works, show `.claude/agents/requirements-analyst.md` — "each agent is a small text file with a narrow job; anyone can read or improve them." When the spec lands, scroll the **Open questions & assumptions section first** — talking point: "the agent tells me what it guessed *before* I approve; I own the acceptance criteria, it owns the typing."

**3. Human gate #1 (1 min)** — flip `Draft → Approved` on screen. "That's decision one of two."

**4. `/pipeline-plan SPEC-002` (3 min)** — show the tasks with dependencies and criteria mapping.

**5. `/pipeline-dev TASK-002.1` (8 min, runs while you talk)** — this is the slot for the architecture slide/talk: 7 modular agents, deterministic CI gates ("quality is decided by machines, not AI opinion"), the 6 human approval points, the guardrail hook demo (`.claude/settings.json` — "agents physically cannot touch secrets or CI config"). Show `npm run gates` output when it finishes.

**6. `/pipeline-review task/002.1-...` (5 min)** — talking point while it runs: "the reviewer is adversarial — in the first real run it caught a test that could never fail by injecting bugs and proving the test stayed green." Show the verdict, then the draft PR appearing on GitHub with CI checks running.

**7. Human gate #2 (2 min)** — merge the PR on screen. "Decision two. Requirement to merged, tested code — my total involvement was reading one page and clicking merge."

**8. Close with the numbers (2 min)** — timeline artifact: 4 weeks in, POC done; next: hardening, then handoff so *you all* can run this; cost optimization last with real benchmarks. Mention the metrics we track (cycle time, first-pass gate rate, human touch-time, cost per feature).

## Expected questions & answers

- *"What if the agent writes bad code?"* — Three nets: adversarial review (has caught real bugs), deterministic CI gates, and the human merge. Bad code has to get through all three.
- *"Can it work on our existing messy projects?"* — Vibe-coded/no-docs codebases need the autonomous variant on the backlog: explore-by-testing first, spec retroactively. Post-v1.
- *"Windows?"* — Supported target (verification scheduled in the handoff phase); demo runs on Mac today.
- *"What does it cost?"* — Covered by our Claude subscription for interactive use; the dedicated benchmarking phase at the end gives real per-feature numbers rather than guesses.

## Fallback plan (if live run misbehaves)

The pipeline is real but live demos are live demos. If a stage stalls: narrate over the **already-completed SPEC-001 artifacts** — the spec with its surfaced assumptions, the task files, the review transcript summaries in the PR bodies (#1–#4 show the full story incl. review catches), and the green CI runs. Every claim in the demo is reproducible from the repo history even with zero live execution.
