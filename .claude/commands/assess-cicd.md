# Assess CI/CD

Read the agent definition at `.claude/agents/veritas-pipeline.md` and execute a thorough assessment of the CI/CD pipeline.

## Instructions

1. Read `.claude/agents/veritas-pipeline.md` for the full checklist
2. Scan all files in `.github/workflows/`
3. Check `.env.example` for documented secrets
4. Review deployment docs in `docs/03-deployment/`
5. Evaluate each checklist item as PASS, WARN, or FAIL
6. Write your findings to `.claude/reports/cicd-report.md`
7. Return a brief summary of critical findings

Focus on: workflow correctness, secret hygiene, deployment safety, and pipeline efficiency.
