# TASK-000.4: Make the platform usable in any project

**Spec:** none (platform tooling — micro-spec below)
**Size:** L
**Depends on:** none
**Status:** In review
**Branch:** task/000.4-project-agnostic-platform

## Intent (micro-spec)

**Intent:** The pipeline was hardcoded to this repository. `CLAUDE.md`, the
developer and QA agent definitions, the dev stage command and the CI workflow
all named `poc/app` and the npm gate command literally. A developer adopting
this for a Python, Go or Rust project — or a Node project with a different
layout — had to hand-edit a dozen files and would miss some. That was the
single largest barrier to the platform being reusable, which is its purpose.

**Approach:** `pipeline.config.json` at the repo root is now the one place
project-specific facts live. Everything reads from it, with working defaults
when it is absent so nothing breaks. `scripts/init-pipeline.mjs` detects a
target project's language and generates the config.

**Test:** Installer exercised against five project shapes; guard and validator
verified running inside an installed target project, not just here.

## Done-criteria

1. `pipeline.config.json` exists, is documented, and is optional — every
   consumer falls back to current behaviour when it is missing or partial.
2. `scripts/validate-artifacts.mjs` reads artifact directories from it.
3. `.claude/hooks/guard.py` reads protected and platform paths from it.
4. Agent definitions and stage commands reference the configured gate command
   rather than a literal toolchain invocation.
5. `scripts/init-pipeline.mjs` installs the platform into a target project:
   detects language, writes a config, copies `.claude/`, `CLAUDE.md` and the
   templates, and refuses to clobber existing files.
6. CI runs the artifact validator and the guard scenarios (closes TASK-000.2
   done-criterion 6).
7. All existing gates stay green and the validator still passes on this repo.

## Notes / escalations

Raised after a fresh-clone audit: setup worked, but every pipeline instruction
a new developer would follow was specific to this repo's layout and toolchain.

**Two defects in the guard shipped earlier the same day were found and fixed
here — both by the guard blocking legitimate work during this task:**

1. It scanned the raw command string, so a *commit message mentioning* a
   forbidden command was blocked as though it were one.
2. The first fix blanked quoted regions before detecting heredocs, which
   destroyed quoted delimiters and left heredoc bodies visible. A task file
   documenting forbidden commands as examples therefore blocked its own commit.

`blank_heredocs()` now runs before quote stripping, and
`.claude/hooks/guard_test.py` covers both with regression cases. 29 scenarios,
run in CI.

**Verification performed:**
- Installer against five project shapes — Python, Go, Rust, Node (gate command
  composed from the scripts actually present) and a project with no recognised
  toolchain, which degrades to a clear "set this by hand" message rather than
  a wrong default.
- Re-running the installer on an already-installed project: 0 copied, 19
  skipped, existing config preserved.
- Guard suite (29/29) and the artifact validator both pass *inside* an
  installed Python project.
- This repository's own gates remain green: 100 tests.
