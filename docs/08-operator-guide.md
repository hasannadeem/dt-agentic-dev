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

## Known sharp edges

- **Stacked PRs**: if tasks depend on each other, merge PRs **top-down starting from the one based on `main`**, and enable *Settings → Automatically delete head branches* so GitHub retargets the rest — otherwise child PRs merge into their parent branches instead of `main`.
- The POC app store is in-memory — restarting the server clears data (by design, see SPEC-001).

## Giving feedback

Open a GitHub issue labeled `pipeline-feedback` with: what you ran, what you expected, what happened, OS (Mac/Windows). Friction reports are the point of the handoff phase — file them liberally.
