# Healthcheck

Run a quick health check of the entire project. This is a fast, non-invasive scan.

## Instructions

1. Run `pnpm exec tsc --noEmit` — report error count
2. Run `pnpm run lint` — report error count
3. Run `pnpm test` — report pass/fail counts
4. Run `git status --porcelain | wc -l` — report uncommitted changes
5. Check if `.claude/state/orchestrator.json` exists; if so, read the `team_health` grades
6. Check if any `.claude/reports/` exist and their age

## Output

Write a brief health summary to stdout:

```text
TypeScript:    PASS / FAIL (N errors)
Lint:          PASS / FAIL (N errors)
Tests:         N passed, N failed
Git:           N uncommitted changes on branch X
Orchestrator:  Last run YYYY-MM-DD / Never
```

If any check fails, suggest the appropriate fix command.
