# Assess Testing

Read the agent definition at `.claude/agents/veritas-lab.md` and execute a thorough assessment of test coverage and quality.

## Instructions

1. Read `.claude/agents/veritas-lab.md` for the full checklist
2. Scan `tests/`, `vitest.config.ts`, `playwright.config.ts`
3. Cross-reference test files against `lib/`, `app/api/`, and `components/` to identify coverage gaps
4. Evaluate Playwright E2E: flow coverage, selector stability, rate-limit handling
5. Evaluate test quality (assertions, independence, edge cases)
6. Check CI integration of tests
7. Write your findings to `.claude/reports/testing-report.md`
8. Return a brief summary of coverage gaps (unit + E2E)

Focus on: untested code paths, missing edge cases, test infrastructure gaps, and Playwright-specific issues.
