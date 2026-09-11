#!/usr/bin/env python3
"""Scenario tests for guard.py. Run: python3 .claude/hooks/guard_test.py

Every case below corresponds to something that either went wrong in practice
or was proven bypassable during review. Add a case before changing the guard.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GUARD = os.path.join(HERE, "guard.py")
REPO = os.path.dirname(os.path.dirname(HERE))


def scratch_repo(branch):
    """A throwaway git repo on a known branch.

    The guard's commit rule asks git which branch HEAD is on, so any test of it
    must control that. Using the real repository made the result depend on
    whatever branch the suite happened to run in — green locally on a task
    branch, red in CI where the runner checks out on main.
    """
    path = tempfile.mkdtemp(prefix="guard-test-")
    subprocess.run(["git", "init", "-q", "-b", branch, path], check=True,
                   capture_output=True)
    return path


ON_MAIN = scratch_repo("main")
ON_TASK = scratch_repo("task/001.1-example")

SUB = {"agent_type": "developer", "cwd": REPO}
MAIN = {"cwd": REPO}
BLOCK, ALLOW = 2, 0


def case(who, tool, tool_input):
    payload = dict(who)
    payload["tool_name"] = tool
    payload["tool_input"] = tool_input
    return payload


CASES = [
    # --- Bash bypass: the hole found on 2026-09-11 ---
    ("subagent redirects into .env", case(SUB, "Bash", {"command": "echo K=1 > .env"}), BLOCK),
    ("subagent sed -i on CI workflow", case(SUB, "Bash", {"command": "sed -i '' s/a/b/ .github/workflows/ci.yml"}), BLOCK),
    ("subagent cp over an agent def", case(SUB, "Bash", {"command": "cp /tmp/x.md .claude/agents/developer.md"}), BLOCK),
    ("subagent tee into .env.local", case(SUB, "Bash", {"command": "echo x | tee .env.local"}), BLOCK),
    ("orchestrator redirects into .env", case(MAIN, "Bash", {"command": "echo K=1 > .env"}), BLOCK),
    ("orchestrator cp into .claude", case(MAIN, "Bash", {"command": "cp /tmp/s.json .claude/settings.json"}), ALLOW),

    # --- main is reachable only through a merged PR ---
    ("push to main", case(SUB, "Bash", {"command": "git push origin main"}), BLOCK),
    ("push to master", case(MAIN, "Bash", {"command": "git push origin master"}), BLOCK),
    ("force push", case(SUB, "Bash", {"command": "git push --force origin task/x"}), BLOCK),
    ("gh pr merge", case(SUB, "Bash", {"command": "gh pr merge 7 --squash"}), BLOCK),
    ("reset --hard", case(SUB, "Bash", {"command": "git reset --hard HEAD~1"}), BLOCK),
    ("push a task branch", case(SUB, "Bash", {"command": "git push -u origin task/003.1-auth"}), ALLOW),

    # --- quoted text is data, not a command (false positives that blocked real work) ---
    ("commit message naming gh pr merge",
     case(MAIN, "Bash", {"command": 'git commit -m "blocked: gh pr merge is human-only"'}), ALLOW),
    ("commit message naming push to main",
     case(MAIN, "Bash", {"command": 'git commit -m "never git push origin main"'}), ALLOW),
    ("commit message naming reset --hard",
     case(MAIN, "Bash", {"command": "git commit -m 'avoid git reset --hard'"}), ALLOW),
    ("heredoc body mentioning .env",
     case(SUB, "Bash", {"command": "cat > doc.md << 'EOF'\nnever write to .env\nEOF"}), ALLOW),
    # Regression: quote-stripping used to run first and destroy the quoted
    # heredoc delimiter, leaving the body visible. A task file documenting
    # forbidden commands then blocked its own commit.
    ("quoted-delimiter heredoc naming forbidden commands",
     case(MAIN, "Bash", {"command": "cat > t.md << 'EOT'\nblocked: git push origin main\nalso: gh pr merge\nEOT\ngit add -A"}), ALLOW),
    ("two heredocs, second names a forbidden command",
     case(MAIN, "Bash", {"command": "cat > a.md << 'A'\nhi\nA\ncat > b.md << 'B'\ngit reset --hard\nB"}), ALLOW),
    ("real command after a heredoc is still caught",
     case(MAIN, "Bash", {"command": "cat > a.md << 'A'\nhi\nA\ngit push origin main"}), BLOCK),

    # --- ordinary work must not be blocked ---
    ("run the gates", case(SUB, "Bash", {"command": "npm run gates"}), ALLOW),
    ("create a task branch", case(SUB, "Bash", {"command": "git checkout -b task/003.1-auth"}), ALLOW),
    # Branch-dependent: run against throwaway repos so the result does not
    # depend on which branch the suite happens to execute in.
    ("subagent commits on a task branch",
     case({"agent_type": "developer", "cwd": ON_TASK}, "Bash", {"command": "git commit -m 'feat: x'"}), ALLOW),
    ("subagent commits while on main",
     case({"agent_type": "developer", "cwd": ON_MAIN}, "Bash", {"command": "git commit -m 'feat: x'"}), BLOCK),
    ("orchestrator commits while on main",
     case({"cwd": ON_MAIN}, "Bash", {"command": "git commit -m 'docs: x'"}), ALLOW),
    ("write a test file", case(SUB, "Bash", {"command": "echo x > poc/app/tests/new.test.ts"}), ALLOW),
    # Deliberately strict: a bare `.env` token is treated as the file even when
    # it was meant as a search string. Over-blocking on secrets is the safe
    # direction, and the deny message tells the agent to rephrase.
    ("grep for the literal string .env", case(SUB, "Bash", {"command": "grep -r .env docs/"}), BLOCK),
    ("grep for dotenv wording instead", case(SUB, "Bash", {"command": "grep -r dotenv docs/"}), ALLOW),

    # --- reading secrets is as damaging as writing them (gap found 2026-09-11) ---
    ("subagent cats a secrets file", case(SUB, "Bash", {"command": "cat .env"}), BLOCK),
    ("subagent greps a secrets file", case(SUB, "Bash", {"command": "grep KEY .env.production"}), BLOCK),
    ("orchestrator cats a secrets file", case(MAIN, "Bash", {"command": "cat .env"}), BLOCK),
    ("Read tool on a secrets file", case(SUB, "Read", {"file_path": "/r/.env"}), BLOCK),
    ("Read tool on ssh key", case(SUB, "Read", {"file_path": "/r/id_rsa"}), BLOCK),
    ("Read tool on ordinary source", case(SUB, "Read", {"file_path": REPO + "/poc/app/src/app.ts"}), ALLOW),

    # --- pipeline.config.json drives CI, so subagents may not edit it ---
    ("subagent edits pipeline config", case(SUB, "Edit", {"file_path": REPO + "/pipeline.config.json"}), BLOCK),
    ("subagent rewrites pipeline config via shell",
     case(SUB, "Bash", {"command": "echo '{}' > pipeline.config.json"}), BLOCK),
    ("orchestrator edits pipeline config", case(MAIN, "Edit", {"file_path": REPO + "/pipeline.config.json"}), ALLOW),

    # --- false positive that blocked read-only work ---
    ("read-only command ending in 2>/dev/null",
     case(SUB, "Bash", {"command": "ls .claude/hooks/guard.py 2>/dev/null"}), ALLOW),

    # --- file tools ---
    ("subagent edits an agent def", case(SUB, "Edit", {"file_path": REPO + "/.claude/agents/developer.md"}), BLOCK),
    ("orchestrator edits an agent def", case(MAIN, "Edit", {"file_path": REPO + "/.claude/agents/developer.md"}), ALLOW),
    ("orchestrator writes .env", case(MAIN, "Write", {"file_path": REPO + "/.env"}), BLOCK),
    ("subagent edits app source", case(SUB, "Edit", {"file_path": REPO + "/poc/app/src/app.ts"}), ALLOW),
    ("subagent writes a spec", case(SUB, "Write", {"file_path": REPO + "/specs/SPEC-004-x.md"}), ALLOW),
]


def run():
    failures = 0
    try:
        return check()
    finally:
        for path in (ON_MAIN, ON_TASK):
            shutil.rmtree(path, ignore_errors=True)


def check():
    failures = 0
    for name, payload, want in CASES:
        result = subprocess.run([sys.executable, GUARD], input=json.dumps(payload),
                                capture_output=True, text=True)
        ok = result.returncode == want
        failures += not ok
        print(f"{'PASS' if ok else 'FAIL'}  {name:38s} want={want} got={result.returncode}")
    print()
    if failures:
        print(f"{failures} of {len(CASES)} scenarios FAILED")
        return 1
    print(f"All {len(CASES)} scenarios passed.")
    return 0


if __name__ == "__main__":
    sys.exit(run())
