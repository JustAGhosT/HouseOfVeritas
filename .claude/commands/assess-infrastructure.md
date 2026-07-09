# Assess Infrastructure

Read the agent definition at `.claude/agents/veritas-foundation.md` and execute a thorough assessment of the Terraform infrastructure.

## Instructions

1. Read `.claude/agents/veritas-foundation.md` for the full checklist
2. Scan all files in `terraform/modules/` and `terraform/environments/`
3. Evaluate Terraform quality, security, HA, cost optimization, and monitoring
4. Check for `terraform fmt` compliance
5. Verify provider version pinning and state backend config
6. Write your findings to `.claude/reports/infrastructure-report.md`
7. Return a brief summary of critical findings

Focus on: security posture, resource configuration correctness, and cost efficiency.
