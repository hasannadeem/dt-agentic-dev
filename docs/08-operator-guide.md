# Operator Guide — Running the Agentic Pipeline

For developers cloning this repo to try the pipeline. You operate the gates; the agents do the work.

## Prerequisites

- **Claude Code** installed and logged in (CLI or VS Code extension) — macOS and Windows both work; on Windows, run inside **Git Bash or WSL** (the guardrail hooks use `python3` and shell scripts; native PowerShell is not yet verified — flag issues in feedback)
- **Node.js ≥ 20**, git, and a GitHub account with access to this repo
- Python 3 on PATH (used by the protected-file guardrail hook)

## Setup (5 minutes)

```sh
git clone https://github.com/hasannadeem/dt-agentic-dev.git
cd dt-agentic-dev/poc/app && npm ci && npm run gates   # should end green: lint, typecheck, tests
```

Open the repo root in Claude Code. The agent team (`.claude/agents/`), stage commands (`.claude/commands/`), and guardrails (`.claude/settings.json`) load automatically.

**Verify your setup** — all three should succeed:

```sh
cd poc/app && npm run gates      # lint + strict types + 100 tests
cd ../.. && node scripts/validate-artifacts.mjs   # spec/task conventions
ls .claude/agents .claude/commands                # 7 agents, 5 commands
```

If `npm run gates` fails intermittently rather than consistently, see *Known limitations* below — that is a known open issue, not something you broke.

## How you run the pipeline (modular stage commands)

Each stage is independently triggerable — you can run the whole chain or any single stage:

| Command | What it does | You do |
|---|---|---|
| `/pipeline-spec <requirement>` | Requirements-analyst drafts a spec with assumptions surfaced | **Read the spec; set Status → Approved** (or edit first). You own the acceptance criteria |
| `/pipeline-plan SPEC-nnn` | Planner breaks the approved spec into tasks | Spot-check the breakdown |
| `/pipeline-dev TASK-nnn.n` | Developer implements one task + tests on a branch, local gates green | Nothing |
| `/pipeline-review <branch>` | Adversarial review → fix loop → draft PR | **Final check: review the PR and merge it.** Agents cannot merge |
| `/pipeline-status` | Shows specs/tasks/branches/PRs and what's waiting on you | — |

The human touchpoints are exactly two: **approve the spec (acceptance criteria)** at the start, **merge the PR (final check)** at the end. Everything between auto-advances.

## Rules the pipeline enforces (you don't have to remember them)

- Agents cannot touch `.env*`, CI workflows, or `.claude/` — blocked by a deterministic hook, not a prompt
- Agents never push to `main` and never merge; PRs open as drafts
- Every PR must pass CI gates (lint, strict types, tests); agent retry loops cap at 2 attempts then escalate to you
- One task per branch, named `task/<specnnn>.<n>-<slug>`; conventions in [../CLAUDE.md](../CLAUDE.md)

## Known limitations — read before relying on this

Stated plainly, because you will hit these:

- **Windows is a supported target, not a verified one.** Nobody has run this pipeline on Windows yet. The guardrail hook shells out to `python3` and the helper scripts assume a POSIX shell, so Git Bash or WSL is required and native PowerShell is untested. If you are our first Windows operator, expect friction and file it.
- **Test-suite flake is reduced, not eliminated.** Perf loops now bind one server each, but ~70 single-shot `request(app)` sites still bind a fresh ephemeral port per call, which can collide with other local processes and return a response from the wrong server (an impossible status like `404` from a valid `POST`). Tracked as `tasks/TASK-000.3-suite-wide-server-reuse.md`. A re-run usually passes; that is the signature.
- **The artifact validator does not run in CI yet.** `scripts/validate-artifacts.mjs` works, but nothing invokes it automatically, so convention violations are only caught if you run it. Tracked as done-criterion 6 of `tasks/TASK-000.2-artifact-validator.md`.
- **The governance guard is weaker than the docs imply.** The shipped `.claude/settings.json` hook matches only `Edit|Write`. Agents that hold `Bash` — developer, qa-engineer, code-reviewer, security-auditor — can still reach protected paths through shell redirection. A hardened replacement exists and is pending install; until then, treat the rails as advisory for Bash-capable agents.
- **Governance failures have happened and were not caught by automation.** In one day: an agent committed to `main`, the orchestrator pushed it, and the orchestrator later committed code to `main` directly. Tests passed and CI was green through all three. What caught them was an agent comparing commit *contents* against commit *claims*. Do not assume green CI means the process was followed.

## Known sharp edges

- **Stacked PRs**: if tasks depend on each other, merge PRs **top-down starting from the one based on `main`**, and enable *Settings → Automatically delete head branches* so GitHub retargets the rest — otherwise child PRs merge into their parent branches instead of `main`.
- The POC app store is in-memory — restarting the server clears data (by design, see SPEC-001).

## Giving feedback

Open a GitHub issue labeled `pipeline-feedback` with: what you ran, what you expected, what happened, OS (Mac/Windows). Friction reports are the point of the handoff phase — file them liberally.
