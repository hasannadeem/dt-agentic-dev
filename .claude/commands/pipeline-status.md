---
description: "Show pipeline state: specs, tasks, branches, open PRs, and what is waiting on a human"
---
Report the current pipeline state, concisely:
1. Specs in specs/ with their Status lines (flag any Draft awaiting approval)
2. Tasks in tasks/ with Status/Branch (flag any In review)
3. Local + remote task/* branches and open PRs (gh or the API via the origin remote)
4. End with exactly what is blocked on a human right now (approvals, merges) and what the next agent step would be.
