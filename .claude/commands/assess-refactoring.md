# Assess Refactoring Opportunities

Read the agent definition at `.claude/agents/veritas-refinery.md` and identify code quality improvements.

## Instructions

1. Read `.claude/agents/veritas-refinery.md` for the full checklist
2. Scan `app/`, `lib/`, `components/`, `middleware.ts` for TypeScript quality
3. Scan `config/azure-functions/` for Python quality
4. Evaluate SOLID adherence, DRY violations, and code smells
5. Identify design pattern opportunities
6. Provide before/after code examples for top improvements
7. Write your findings to `.claude/reports/refactoring-report.md`
8. Return a brief summary of top refactoring priorities

Focus on: SOLID violations, DRY violations, type safety, and design pattern opportunities.
