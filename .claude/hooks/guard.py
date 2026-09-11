#!/usr/bin/env python3
"""Governance guard for the agentic pipeline (see docs/04-governance.md).

Reads a Claude Code PreToolUse hook payload on stdin. Exit 2 = block.

Rules, deliberately different in scope:

  * Secrets (.env*, keys, certs) are never writable — by anyone, including the
    orchestrator. There is no legitimate agent reason to touch them.
  * Agent definitions, slash commands and CI workflows are not writable by
    SUBAGENTS (payload carries `agent_type`). The main session may edit them,
    so the lead can evolve the platform without hand-editing files.
  * Nothing reaches `main` except through a merged PR: pushes to main,
    force-pushes, `gh pr merge`, and destructive history rewrites are blocked
    for every actor, and subagents may not commit while HEAD is main.

Covers both direct file tools (Edit/Write/NotebookEdit) and Bash, because an
agent with Bash can otherwise redirect, sed, cp or mv straight past a
path-only check.

Project-specific paths can be overridden in `pipeline.config.json` so this
guard works unmodified in any repository.
"""
import fnmatch
import json
import os
import re
import subprocess
import sys

DEFAULT_SECRETS = [".env", ".env.*", "*.pem", "*.key", "*.p12", "*.pfx", "id_rsa*",
                   "credentials", ".npmrc", ".netrc"]
# pipeline.config.json belongs here: CI executes its values, so an agent able to
# edit it gains command execution in CI — which would defeat the rule that
# agents cannot touch CI at all.
DEFAULT_PLATFORM = [".claude/*", ".claude/**/*", ".github/workflows/*",
                    "pipeline.config.json"]

# Redirections that write nowhere meaningful. Counting these as writes made the
# guard block read-only commands that merely ended in `2>/dev/null`.
NOISE_REDIRECTS = re.compile(r"\d?>&?\d?\s*/dev/null|\d>&\d")

# Bash constructs that can write to a path without using a file tool.
WRITE_OPS = re.compile(
    r"(>>?|\|\s*tee\b|\bsed\b[^|;&]*-i|\bcp\b|\bmv\b|\bdd\b|\btruncate\b|"
    r"\brm\b|\bchmod\b|\btouch\b|\bln\b)"
)

# Reading a secret is as damaging as writing one: it lands in the agent's
# context, and from there in transcripts, logs and any output it produces.
READ_TOOLS = ("Read", "Grep")

FORBIDDEN_CMDS = [
    # The ref must be a whole argument. Matching `main` as a substring blocked
    # ordinary branch names — `task/000.8-main-access-rule`, `fix/domain-logic`,
    # `feature/mainframe` — because a hyphen counts as a word boundary. A guard
    # that blocks legitimate work teaches agents to route around it.
    (re.compile(r"\bgit\s+push\b(?![^;&|]*--dry-run)[^;&|]*(?:\s|:)(?:HEAD:)?(?:main|master)(?=\s|$)"),
     "nothing reaches the default branch except through a merged PR — push a task branch instead"),
    (re.compile(r"\bgit\s+push\b[^;&|]*(--force\b|--force-with-lease\b|\s-f\b)"),
     "force-push is forbidden"),
    (re.compile(r"\bgh\s+pr\s+merge\b"), "merging is a human-only action"),
    (re.compile(r"\bgit\s+reset\b[^;&|]*--hard\b"), "git reset --hard is destructive"),
    (re.compile(r"\bgit\s+branch\b[^;&|]*\s-D\b"), "force-deleting branches is destructive"),
]

COMMIT_CMD = re.compile(r"\bgit\s+(commit|merge|rebase)\b")

GOVERNANCE = (" See docs/04-governance.md. Report this to the orchestrator "
              "rather than working around it.")


def load_config(cwd):
    """Project overrides, if present. Absent or malformed config = defaults."""
    try:
        with open(os.path.join(cwd, "pipeline.config.json")) as fh:
            cfg = json.load(fh)
    except Exception:
        return DEFAULT_SECRETS, DEFAULT_PLATFORM
    guard = cfg.get("guard") or {}
    # Union, never replace. The config is itself a protected path, but treating
    # its lists as authoritative would still mean a weaker config anywhere —
    # a fresh install, a project that trimmed the defaults — silently lowers the
    # floor. Projects may add protections; they cannot remove them.
    secrets = set(DEFAULT_SECRETS) | set(guard.get("secretPaths") or [])
    platform = set(DEFAULT_PLATFORM) | set(guard.get("platformPaths") or [])
    return sorted(secrets), sorted(platform)


def blank_heredocs(cmd):
    """Blank every heredoc body, leaving the rest of the command intact.

    Must run BEFORE quote stripping: the delimiter is often quoted (<<'EOF'),
    and blanking quotes first destroys it, leaving the body visible. That bug
    let a task file's prose — which quoted forbidden commands as examples —
    block the commit that introduced it.
    """
    text = cmd
    pos = 0
    while True:
        m = re.compile(r"<<-?\s*['\"]?(\w+)['\"]?").search(text, pos)
        if not m:
            return text
        tail = text[m.end():]
        end = re.search(r"^\s*" + re.escape(m.group(1)) + r"\s*$", tail, re.M)
        stop = m.end() + (end.end() if end else len(tail))
        text = text[:m.end()] + " " * (stop - m.end()) + text[stop:]
        pos = stop


def strip_quoted(cmd):
    """Blank quoted regions and heredoc bodies so their contents are not
    mistaken for commands.

    Quoted text is data, not an instruction. Without this, a commit message
    that merely *mentions* a forbidden command is blocked as though it were
    one — a false positive that fires constantly in normal use, and which
    blocked this guard's own installation twice before it was fixed.
    """
    cmd = blank_heredocs(cmd)
    out, quote = [], None
    i = 0
    while i < len(cmd):
        ch = cmd[i]
        if quote:
            if ch == "\\" and quote == '"' and i + 1 < len(cmd):
                out.append("  ")
                i += 2
                continue
            out.append(" ")
            if ch == quote:
                quote = None
        elif ch in ("'", '"'):
            quote = ch
            out.append(" ")
        else:
            out.append(ch)
        i += 1
    return "".join(out)


def deny(msg):
    sys.stderr.write("Blocked: " + msg + GOVERNANCE)
    sys.exit(2)


def relative(path, cwd):
    if not path:
        return ""
    try:
        return os.path.relpath(path, cwd or ".") if path.startswith("/") else path
    except ValueError:
        return path


def matches(rel, patterns):
    # Strip a leading "./" prefix only — lstrip("./") would eat the leading dot
    # of ".env" and silently defeat every secrets rule.
    if rel.startswith("./"):
        rel = rel[2:]
    return any(fnmatch.fnmatch(rel, p) or fnmatch.fnmatch(os.path.basename(rel), p)
               for p in patterns)


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # Never break the session on a malformed payload.

    tool = payload.get("tool_name", "")
    tool_input = payload.get("tool_input") or {}
    cwd = payload.get("cwd") or "."
    is_subagent = bool(payload.get("agent_type"))
    secrets, platform = load_config(cwd)

    if tool in ("Edit", "Write", "NotebookEdit"):
        rel = relative(tool_input.get("file_path", ""), cwd)
        if not rel:
            sys.exit(0)
        if matches(rel, secrets):
            deny("secrets are never editable (%s)." % rel)
        if is_subagent and matches(rel, platform):
            deny("subagents cannot edit agent definitions, slash commands, CI "
                 "workflows or the pipeline config (%s)." % rel)
        sys.exit(0)

    if tool in READ_TOOLS:
        for key in ("file_path", "path", "pattern"):
            rel = relative(str(tool_input.get(key, "") or ""), cwd)
            if rel and matches(rel, secrets):
                deny("secrets are never readable (%s) — reading one puts it in "
                     "the transcript." % rel)
        sys.exit(0)

    if tool == "Bash":
        cmd = strip_quoted(tool_input.get("command", "") or "")

        # A subagent committing on main bypasses the PR gate just as surely as
        # pushing does — this is how TASK-000.1's first attempt landed on main.
        if is_subagent and COMMIT_CMD.search(cmd):
            try:
                # `branch --show-current` reports the branch even in a repo with
                # no commits yet, where `rev-parse HEAD` errors and would leave
                # this check silently open. It prints nothing on detached HEAD.
                branch = subprocess.run(
                    ["git", "-C", cwd, "branch", "--show-current"],
                    capture_output=True, text=True, timeout=5).stdout.strip()
            except Exception:
                branch = ""
            if branch in ("main", "master"):
                deny("you are on %s — create a task branch first; work reaches "
                     "main only through a human-merged PR." % branch)

        for pattern, why in FORBIDDEN_CMDS:
            if pattern.search(cmd):
                deny("%s." % why)

        tokens = re.findall(r"[\w./~@+-]+", cmd)

        # Secrets: any mention at all, read or write. `cat .env` is as damaging
        # as writing it — the contents land in the transcript either way. This
        # check used to sit inside the write-detection branch, which left every
        # read path open.
        for token in tokens:
            if matches(relative(token, cwd), secrets):
                deny("that command touches a secrets file (%s); secrets are "
                     "neither readable nor writable by agents." % token)

        # Platform config: only writes matter, so ignore redirects that go
        # nowhere (`2>/dev/null`) before deciding the command writes anything.
        if WRITE_OPS.search(NOISE_REDIRECTS.sub(" ", cmd)) and is_subagent:
            for token in tokens:
                if matches(relative(token, cwd), platform):
                    deny("that command can write to protected platform config "
                         "(%s)." % token)
        sys.exit(0)

    sys.exit(0)


if __name__ == "__main__":
    main()
