# SPEC-nnn: <Feature title>

**Status:** Draft <!-- Draft | Approved | Implemented | Superseded — only a human sets Approved -->
**Requirement source:** <who asked / link>
**Date:** <YYYY-MM-DD>

## Open questions & assumptions

<!-- Deliberately first: the approver reads the doubts before the plan.
     Every item is tagged so the approver knows what actually needs their judgment:
       [DECIDE]  — needs a human decision: changes the shape of the feature, is
                   expensive to reverse, encodes a product/business/security
                   trade-off, or depends on context not derivable from the repo.
                   Max five per spec; more than that means the feature is too big.
       [ASSUMED] — a convention filled in sensibly; a reviewer would shrug and agree. -->
- **[DECIDE] Q:** <the genuinely consequential open question>
  **Recommended:** <the analyst's proposed answer and why>
- **[ASSUMED] Q:** <a gap filled by convention>
  **A:** <what was assumed, and the pattern or precedent it follows>

## Problem

<2–4 sentences: what user/business problem this solves and why now.>

## Scope

**In:**
- <capability 1>

**Out (explicitly not doing):**
- <deferred or excluded item, so nobody builds it by accident>

## Acceptance criteria

<!-- Objectively checkable. QA tests these verbatim; planner maps every one to a task.
     Include performance budgets where relevant (e.g. "p95 latency < 200ms at 50 rps on POST /tasks"). -->
1. <Given/when/then or equivalent testable statement>
2. …

## Verification that CI cannot perform

<!-- Delete this section for Tier-1 (fully CI-verifiable) projects.

     Required whenever the project's `verification.tier` in pipeline.config.json
     is "emulator" or "device" — mobile apps, kiosk/COSU behaviour, embedded
     firmware, hardware integrations. List exactly what a human must check, on
     what hardware, and what the pass condition is. An agent cannot close these,
     and the reviewer will not approve a spec that needs them but omits them. -->

| # | What must be verified | Where | Pass condition |
|---|---|---|---|
| M1 | <e.g. app relaunches into lock task mode after forced reboot> | <provisioned device owner, Pixel 6a / Android 14> | <returns to kiosk screen within 30s, no system UI reachable> |

## Design

<!-- Architect agent fills this section only for design-significant specs; otherwise delete. -->

---
*Target one page, ceiling two. Tasks derived from this spec: `tasks/TASK-nnn.*`.*
