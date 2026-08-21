# One-time GitHub Setup

The repo currently exists only locally. Three commands get it on GitHub (needed for the Week 3 PR deliverable and CI gates).

```sh
# 1. Install the GitHub CLI (not currently installed on this machine)
brew install gh

# 2. Authenticate (interactive — opens browser)
gh auth login

# 3. Create the repo and push (private; switch --private to --public if preferred,
#    or add --org <org-name> to create it in the company organization)
gh repo create agentic-software --private --source=. --push
```

After pushing, enable branch protection on `main` (required for the governance model in [04-governance.md](04-governance.md)):

```sh
gh api repos/{owner}/agentic-software/branches/main/protection -X PUT \
  -f 'required_pull_request_reviews[required_approving_review_count]=1' \
  -F 'enforce_admins=false' -F 'allow_force_pushes=false' -F 'allow_deletions=false' \
  -f 'required_status_checks[strict]=true' -f 'required_status_checks[contexts][]=ci'
```

(Or via web UI: Settings → Branches → Add rule for `main`: require PRs, require status checks, block force-pushes. The `ci` status check will exist once Week 3's GitHub Actions workflow lands.)

## Decision for Hasan/Hasnat

Personal repo vs company org: the plan assumes a personal private repo to start (zero friction), migrating to the org when other devs onboard (Week 7+). If org access is easy to get now, creating it there directly saves the migration — Tehreem and Yousaf could then watch progress natively.
