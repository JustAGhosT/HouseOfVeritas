# Fix

Read the orchestrator summary or a specific agent report, then fix the highest-priority issues.

## Instructions

1. Read `.claude/reports/orchestrator-summary.md`
2. If it doesn't exist, run `assess-all` first
3. Identify the top P0 items from the "Critical Findings" section
4. Fix them one at a time, starting with the quickest wins
5. After each fix, run relevant checks (tsc, lint, test)
6. Mark fixed items in the report
7. Update `.claude/state/orchestrator.json` with new metrics

## Priority Order

1. Security vulnerabilities (JWT, auth, password leaks)
2. Data integrity issues (floating-point money, in-memory stores)
3. Build/CI failures (ignoreBuildErrors, package-manager mismatch)
4. Missing auth checks on routes
5. Dead code and console.log replacement

## Constraints

- Fix at most 5 P0 items per session to keep changes reviewable
- Run `pnpm test` after each fix to verify no regressions
- Commit after each logical group of fixes
