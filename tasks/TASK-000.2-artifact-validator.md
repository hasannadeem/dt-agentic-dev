# TASK-000.2: Artifact validator for pipeline conventions

**Spec:** none (tooling — micro-spec below per the CLAUDE.md spec threshold)
**Size:** S
**Depends on:** none
**Status:** In review
**Branch:** task/000.2-artifact-validator

## Intent (micro-spec)

**Intent:** Our docs claim "traceability by construction", but every convention
that claim rests on — spec/task filenames, status vocabulary, tasks deriving
only from non-Draft specs, branch naming, no `Implemented` spec with open tasks
— is enforced by nobody. It is traceability by good manners.

**Approach:** A dependency-free Node script, `scripts/validate-artifacts.mjs`,
parsing `specs/` and `tasks/` and exiting non-zero on any violation. Wired into
CI alongside the app's gates.

**Test:** Passes against the current repo; fails when a convention is broken
(verified by mutating a status line and a filename).

## Done-criteria

1. Validates spec filenames, status vocabulary, and required sections.
2. Validates task filenames, status vocabulary, done-criteria section, branch naming.
3. Every task referencing a spec fails if that spec is missing or still `Draft`.
4. Fails if a spec marked `Implemented` has any task not `Done`.
5. Exits 0 on the current repo; exits 1 with a specific message per violation.
6. Runs in CI on every PR.

## Notes / escalations

Originally committed directly to `main` (`7b5ba8f`) in violation of the
branch/PR rule, reverted, and re-landed here through the normal gate. The
CI wiring in done-criterion 6 requires editing `.github/workflows/ci.yml`,
which the guard blocks for subagents — the human or orchestrator applies it.
