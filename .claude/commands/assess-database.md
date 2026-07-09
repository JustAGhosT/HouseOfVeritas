# Assess Database Layer

Read the agent definition at `.claude/agents/veritas-vault.md` and execute a thorough assessment of the data layer.

## Instructions

1. Read `.claude/agents/veritas-vault.md` for the full checklist
2. Scan `lib/services/baserow.ts`, `lib/services/docuseal.ts`, `lib/users.ts`, `lib/audit-log.ts`
3. Review `terraform/modules/database/` and `terraform/modules/storage/`
4. Check `config/azure-functions/backup-manager/` and `config/azure-functions/audit-log/` for backup and audit strategy
5. Review `docker-compose.yml` for data-layer container configuration
6. Evaluate data models, CRUD completeness, error handling, and integrity
7. Write your findings to `.claude/reports/database-report.md`
8. Return a brief summary of data layer gaps

Focus on: data model completeness, integration reliability, backup strategy, and security.
