# Governance: Security, Permissions & Production-Risk Controls

Principle: **agents get the minimum capability their role needs, every consequential action has a deterministic control in front of it, and everything is auditable after the fact.** Autonomy is earned per capability, not granted wholesale.

## Mandatory human approval points

These are the *only* places a human must act per feature — and they are non-negotiable regardless of how good the agents get this year:

| # | Gate | Who | What they're approving |
|---|---|---|---|
| 1 | **Spec approval** | Lead (later: any senior dev) | "Is this the right thing to build?" — the highest-leverage 5 minutes in the pipeline |
| 2 | **Design approval** (only design-significant features) | Lead | Architecture decision records from the architect agent |
| 3 | **PR merge** | Lead / reviewer dev | Final judgment on green, agent-reviewed PRs. Agents can never merge |
| 4 | **Any deployment** (staging and prod, Phase 5+) | Lead | Every deploy, every environment, until a track record justifies auto-staging |
| 5 | **Spend above threshold** | Lead | Any single pipeline run projected > $10 inference; any new API budget → Hasan |
| 6 | **Production remediation beyond runbook** (Phase 7+) | On-call human | SRE agent may execute pre-approved runbook actions (restart, scale, rollback); anything else is diagnose-and-page |

Everything not listed is autonomous by default — that's the point of the platform.

## Permission model (technical enforcement)

- **Per-agent tool restrictions** in each subagent definition ([.claude/agents/](../.claude/agents/)): the requirements-analyst and planner get read + doc-write only; only the developer gets code-write; only the reviewer and auditors need diff access; nobody gets network write beyond `gh`.
- **Branch protection** on `main`: PRs only, required CI checks, no force-push, agents hold no merge rights. **Status: not yet verified on the live repository** — this is asserted here but has never been confirmed enabled, and an unverified control is not a control. The guard blocks agents from pushing to `main`, but only GitHub can stop a human or another tool. Enable and confirm it before any client work. Two rules adopted from GitHub's own agent-PR controls (verified 2026-08): approvals from users who collaborated with the agent on the change don't satisfy review requirements (no prompt-author self-approval), and agent pushes get outside-contributor treatment — CI workflows need a human "approve and run" click.
- **Sandboxed execution**: agents run under Claude Code's permission system (workspace-scoped writes, command allowlists). Deny-by-default for: deleting branches, editing CI workflow files, touching `.env`/secrets, any `curl`/network write outside `gh`.
- **Deterministic hooks, not prompt text, enforce policy**: CLAUDE.md instructions are advisory; Claude Code `PreToolUse` hooks are deterministic (official guidance, verified 2026-08). The protected-file rules above get enforced as deny-hooks (matching `Edit|Write` on CI workflows, `.claude/`, `.env*`) in Week 3, so an agent *cannot* violate them regardless of prompt state. `Stop` hooks additionally gate turn-completion on the local test run passing.
- **Secrets**: never in the repo. Enforced by `.gitignore`, a gitleaks history scan on every PR, and a guard that blocks agents from reading *or* writing secret paths — reading one is as damaging as writing it, since the contents land in the transcript. (Until 2026-09-11 this line claimed CI secret-scanning that did not exist; AI-assisted commits leak secrets at roughly twice the baseline rate, so the gap mattered.) Agents receive scoped tokens (fine-grained GitHub PAT per purpose), rotated on schedule. Agents never see deploy credentials — deployment runs in CI with GitHub-managed secrets after human approval.
- **Prompt-injection surface**: agents processing external content (issue text, dependency changelogs, web pages) treat it as data, not instructions; the reviewer agent and CI gates sit between any externally-influenced code and `main`.

## Production-risk controls (Phase 5+, designed now)

- Staging environment mandatory; prod deploys only from artifacts that passed staging
- Deploys are gradual/reversible by default (feature flags or canary; one-command rollback)
- SRE agent's autonomous action set is an explicit allowlist of runbook entries, each individually approved by a human once, versioned in-repo
- Kill switch: a single documented command/toggle stops all scheduled agent runs

## Audit trail

Git + GitHub *are* the audit log, by construction: every spec, task, commit, review comment, gate result, approval, and merge is timestamped and attributed.

**Known gap in attribution (2026-09-11).** This section previously claimed agent commits carry a "distinct author identity". They do not — every commit is authored by the lead, and only a `Co-Authored-By` trailer marks agent involvement. That is the same shape as the failure where an agent inherited an engineer's credentials and the audit log showed a person doing things the person never did. Until agents have their own machine identity, treat author fields as "who is accountable", not "who acted". Weekly metrics snapshots ([05-metrics.md](05-metrics.md)) go in-repo. Answering "who decided X and why" must never require an archaeology project — if it does, the trail has a gap to fix.

## Failure posture

Bounded retries with tier escalation everywhere (see [01-research/model-routing-strategy.md](01-research/model-routing-strategy.md)); every loop terminates at a human. An agent that is stuck, uncertain, or facing an undocumented risk stops and reports — in this pipeline, silent workarounds are defects, and stopping to ask is correct behavior.
