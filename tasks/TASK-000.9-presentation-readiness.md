# TASK-000.9: Make the team presentation material accurate

**Spec:** none (documentation and demo preparation — micro-spec below)
**Size:** S
**Depends on:** none
**Status:** In review
**Branch:** task/000.9-presentation-readiness

## Intent (micro-spec)

**Intent:** The whole team sees the platform for the first time on 2026-09-16 and starts using it. Verifying the repository against what they will read and watch found three problems: the onboarding and operator guides still describe the test flake as an open issue although TASK-000.3 fixed it; the operator guide lists five toolchains when the installer supports thirteen; and the demo runbook generates the auth spec live although SPEC-003 already exists, so the live run would create a duplicate SPEC-004 and the planning step would pick up the stale draft.

**Approach:** Correct the guides; regenerate SPEC-003 in place with the `[DECIDE]`/`[ASSUMED]` assumption format it predates, left at `Draft` so approving it stays the live human gate; rewrite the runbook's spec step to open that draft rather than generate one.

**Test:** No team-facing document claims the flake is open; exactly one auth spec exists, numbered 003, tagged, and in `Draft`; artifact validation and the guard suite pass.

## Done-criteria

1. `docs/12-team-onboarding.md` and `docs/08-operator-guide.md` no longer describe the flake as open.
2. The operator guide's toolchain list matches the installer.
3. `specs/SPEC-003-api-key-auth.md` uses `[DECIDE]`/`[ASSUMED]` tags, has a "Questions for the approver" list, and is `Draft`; no SPEC-004 exists.
4. `docs/09-demo-runbook.md` opens the existing draft instead of generating a spec live.
5. `node scripts/validate-artifacts.mjs` and `python3 .claude/hooks/guard_test.py` pass.

## Notes / escalations

This PR must be merged before the presentation, or the demo must run from this branch.
