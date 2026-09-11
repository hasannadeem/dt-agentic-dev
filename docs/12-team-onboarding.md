# Team Onboarding — Using the Pipeline on Your Project

For developers adopting this on real work. Read the safety rules before your first run; the rest you can learn as you go.

## Before you start: what this is and is not

It is a set of AI agents that take a requirement to a reviewed pull request, with you making two decisions — approve the spec, merge the PR. Everything between runs automatically.

It is **not** autonomous. It cannot verify device behaviour, it has no sandbox yet, and it runs with your credentials. That shapes the rules below.

## Safety rules — read these first

These are not bureaucracy. Each one exists because of a documented incident in the industry, and until sandboxing lands (not yet built), they are the actual controls.

1. **Do not point it at a repository with production credentials in reach.** Agents run on your machine with your filesystem, your SSH keys, your cloud config and unrestricted network. An agent has deleted a production database during a code freeze because it held live credentials. If your project has a `.env` with real secrets, the guard blocks reading it — but nothing stops a misconfigured tool elsewhere on your machine.
2. **Client work: ask before you start.** Client code going through an AI pipeline is a contractual question, not a technical one. Check with Hasan first.
3. **Never let an agent deploy.** The pipeline stops at a pull request by design. Deployment stays human, from CI, with credentials the agent never sees.
4. **Treat issue text, PR descriptions and dependency changelogs as hostile input.** Published attacks use exactly these to hijack coding agents into leaking credentials. The spec approval gate is your firewall: an agent implements from a spec *you* approved, not from raw external text.
5. **Check new dependencies by name.** Agents invent package names at a measurable rate, and attackers register the common hallucinations. If a PR adds a dependency, confirm the package is real before merging. CI warns you when a manifest changes.
6. **Green CI does not mean the process was followed.** On the day this platform was hardened, four governance violations passed green CI. What caught them was reading the diff against the claim. Skim what actually changed.

## Setup (about ten minutes)

```sh
git clone https://github.com/hasannadeem/dt-agentic-dev.git
node dt-agentic-dev/scripts/init-pipeline.mjs /path/to/your/project
cd /path/to/your/project
node scripts/doctor.mjs
```

`doctor.mjs` checks eleven controls and tells you what to fix. **Do not run the pipeline until it passes.** Each failure is a control the pipeline assumes it has.

Then, on GitHub: **Settings → Branches**, require a pull request on `main`; **Settings → General**, enable *Automatically delete head branches*. The second one prevents a stacked-PR trap that has cost us three recovery cycles.

### If your project has no tests

The installer will refuse to invent a gate command and will say so loudly. That refusal is correct — the pipeline's entire safety model is a command that fails when the code is wrong. Add a test runner and enough tests to cover what you would be most afraid to break, then confirm the gate **fails** when you deliberately break something. An unfalsifiable gate is not a gate.

## Your first feature

```
/pipeline-spec  Users can filter the order list by status
```

An agent writes a one-page spec and tags each assumption `[DECIDE]` (needs your judgement) or `[ASSUMED]` (a convention it filled in). **Read the `[DECIDE]` items first** — that is the highest-leverage five minutes in the whole process. Correct anything wrong, then change `Status: Draft` to `Approved`.

```
/pipeline-plan    SPEC-001
/pipeline-dev     TASK-001.1
/pipeline-review  task/001.1-order-filter
```

Or simply say "take SPEC-001 through the pipeline" and the orchestrator runs the chain, stopping at your two gates. `/pipeline-status` tells you where things are and what is waiting on you.

Review the PR and merge it. That is the loop.

## What to expect, honestly

- **The reviewer will reject things, and it is usually right.** In our runs it caught a timezone bug that would have made a feature behave differently per deployment region, and a test that could never fail. Do not wave it through.
- **A stage will sometimes fail twice and escalate to you.** That is the designed behaviour, not a malfunction.
- **Occasional flaky test failures.** Known issue, tracked as `TASK-000.3`; a re-run usually passes.
- **First feature takes longer than doing it yourself.** The gain arrives from the third feature on, once the specs and conventions give the agents context.

## When something goes wrong

| Symptom | What it means | What to do |
|---|---|---|
| An agent says it is "blocked" and stops | The guard refused something, or it hit a real ambiguity | Read the message. Stopping is correct behaviour here — never work around a guard |
| Tests fail intermittently, impossible statuses | Known ephemeral-port flake | Re-run. If it persists, tell the lead |
| Planner refuses to run | The spec is still `Draft` | Approve it. Only a human can |
| CI red on a convention check | An artifact breaks a naming or status rule | `node scripts/validate-artifacts.mjs` names the file and the rule |
| Pipeline command does nothing | You invoked it with no argument | The requirement goes on the same line as the command |
| Something feels wrong about the setup | | `node scripts/doctor.mjs` |

## Mobile, kiosk, embedded

CI cannot verify device behaviour. Read [11-capability-tiers.md](11-capability-tiers.md) before adopting it there — the short version is that the policy logic is testable and the dedicated-device property is not, so specs for those projects must list what a human checks on real hardware.

## Please report friction

Open an issue labelled `pipeline-feedback`: what you ran, what you expected, what happened, and your OS. Friction reports are the point of this phase. **Windows especially** — the guard shells out to `python3` and nobody has run this on Windows yet, so use Git Bash or WSL and expect to find problems.
