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

## Design

<!-- Architect agent fills this section only for design-significant specs; otherwise delete. -->

---
*Target one page, ceiling two. Tasks derived from this spec: `tasks/TASK-nnn.*`.*
