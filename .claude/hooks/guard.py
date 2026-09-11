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

DEFAULT_SECRETS = [".env", ".env.*", "*.pem", "*.key", "*.p12", "*.pfx", "id_rsa*"]
DEFAULT_PLATFORM = [".claude/*", ".claude/**/*", ".github/workflows/*"]

# Bash constructs that can write to a path without using a file tool.
WRITE_OPS = re.compile(
    r"(>>?|\|\s*tee\b|\bsed\b[^|;&]*-i|\bcp\b|\bmv\b|\bdd\b|\btruncate\b|"
    r"\brm\b|\bchmod\b|\btouch\b|\bln\b)"
)

FORBIDDEN_CMDS = [
    (re.compile(r"\bgit\s+push\b(?![^;&|]*--dry-run)[^;&|]*\b(origin\s+)?(HEAD:)?(main|master)\b"),
     "nothing reaches main except through a merged PR — push a branch instead"),
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
    secrets = guard.get("secretPaths") or DEFAULT_SECRETS
    platform = guard.get("platformPaths") or DEFAULT_PLATFORM
    return list(secrets), list(platform)


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
            deny("subagents cannot edit agent definitions, slash commands or CI "
                 "workflows (%s)." % rel)
        sys.exit(0)

    if tool == "Bash":
        cmd = strip_quoted(tool_input.get("command", "") or "")

        # A subagent committing on main bypasses the PR gate just as surely as
        # pushing does — this is how TASK-000.1's first attempt landed on main.
        if is_subagent and COMMIT_CMD.search(cmd):
            try:
                branch = subprocess.run(
                    ["git", "-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"],
                    capture_output=True, text=True, timeout=5).stdout.strip()
            except Exception:
                branch = ""
            if branch in ("main", "master"):
                deny("you are on %s — create a task branch first; work reaches "
                     "main only through a human-merged PR." % branch)

        for pattern, why in FORBIDDEN_CMDS:
            if pattern.search(cmd):
                deny("%s." % why)

        if WRITE_OPS.search(cmd):
            # Only inspect paths when the command can actually write.
            for token in re.findall(r"[\w./~@+-]+", cmd):
                rel = relative(token, cwd)
                if matches(rel, secrets):
                    deny("that command can write to a secrets file (%s)." % token)
                if is_subagent and matches(rel, platform):
                    deny("that command can write to protected platform config "
                         "(%s)." % token)
        sys.exit(0)

    sys.exit(0)


if __name__ == "__main__":
    main()
