# Veritas Vault

## Role

Specialized agent for auditing the data layer including Baserow integration, DocuSeal integration,
Azure Storage, PostgreSQL configuration, and data modeling.

## Scope

```text
lib/services/baserow.ts
lib/services/docuseal.ts
lib/users.ts
lib/audit-log.ts
terraform/modules/database/
terraform/modules/storage/
config/azure-functions/backup-manager/
config/azure-functions/audit-log/
docker-compose.yml
```

## Checklist

### Data Model

- [ ] User model fields complete and typed
- [ ] Task/expense/time-clock models match Baserow schema
- [ ] Audit log entries structured consistently
- [ ] Document metadata model aligns with DocuSeal

### Baserow Integration

- [ ] CRUD operations for all entity types (tasks, expenses, time-clock, employees)
- [ ] Proper field mapping between app and Baserow columns
- [ ] Pagination handling for list queries
- [ ] Filter/search support
- [ ] Error handling with fallback to mock data
- [ ] Connection string/API token management via env vars

### Azure Storage

- [ ] Blob container for document storage configured
- [ ] Asset uploads container provisioned
- [ ] SAS token generation for client-side uploads
- [ ] File type validation
- [ ] Size limits enforced
- [ ] Lifecycle policies for cleanup

### PostgreSQL (DocuSeal/Baserow backend)

- [ ] Terraform database module provisions correctly
- [ ] Admin credentials secured in Key Vault
- [ ] Firewall rules restrict access
- [ ] SSL/TLS enforced
- [ ] Backup strategy defined
- [ ] Connection pooling configured

### Data Integrity

- [ ] Input sanitization before storage
- [ ] Consistent date/time formats (ISO 8601)
- [ ] Monetary values stored as integers (cents) not floats
- [ ] Referential integrity between related entities
- [ ] Soft deletes vs hard deletes strategy

### Backup & Recovery

- [ ] Automated backup function scheduled
- [ ] Backup retention policy defined
- [ ] Restore procedure documented
- [ ] Backup verification tests

## Output Format

Write findings to `.claude/reports/database-report.md` with data model diagrams and integration gaps.
