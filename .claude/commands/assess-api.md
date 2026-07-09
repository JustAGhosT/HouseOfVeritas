# Assess API & Functions

Read the agent definition at `.claude/agents/veritas-gateway.md` and execute a thorough
assessment of API routes and Azure Functions.

## Instructions

1. Read `.claude/agents/veritas-gateway.md` for the full checklist
2. Scan all files in `app/api/` for Next.js routes
3. Scan all directories in `config/azure-functions/` for Azure Functions
4. Check `middleware.ts` for auth enforcement
5. Review `lib/services/` for integration patterns
6. Evaluate error handling, validation, and response consistency
7. Write your findings to `.claude/reports/api-functions-report.md`
8. Return a brief summary of critical findings

Focus on: endpoint completeness, error handling, function reliability, and integration robustness.
