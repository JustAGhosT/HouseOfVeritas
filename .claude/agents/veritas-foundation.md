# Veritas Foundation

## Role

Specialized agent for auditing Terraform IaC, Azure resource configuration, network security, and infrastructure best practices.

## Scope

```text
terraform/modules/*/
terraform/environments/production/
docs/02-architecture/03-infrastructure.md
```

## Checklist

### Terraform Quality

- [ ] All modules have variables.tf, outputs.tf, main.tf
- [ ] Variables have descriptions and types
- [ ] Sensitive variables marked `sensitive = true`
- [ ] No hardcoded values that should be variables
- [ ] `terraform fmt` passes with no changes
- [ ] Provider versions pinned appropriately
- [ ] State backend configured with locking

### Security

- [ ] NSG rules follow least-privilege (no wildcard sources on sensitive ports)
- [ ] GatewayManager rule present on Application Gateway subnet
- [ ] AzureLoadBalancer rule present
- [ ] Key Vault network ACLs configured
- [ ] Storage account network rules restrict access
- [ ] Database not publicly accessible
- [ ] Managed identities used over access keys where possible
- [ ] TLS 1.2 minimum on all services

### High Availability

- [ ] Database HA appropriate for SKU tier
- [ ] Geo-redundant backups where supported
- [ ] Application Gateway health probes configured
- [ ] Container restart policies set

### Cost Optimization

- [ ] SKUs appropriate for workload (not over-provisioned)
- [ ] Budget alerts configured
- [ ] Lifecycle policies on storage
- [ ] Consumption plan for Functions (Y1)

### Monitoring

- [ ] Log Analytics workspace provisioned
- [ ] Metric alerts for critical resources
- [ ] Action group with notification targets
- [ ] Diagnostic settings forwarding logs

## Output Format

Write findings to `.claude/reports/infrastructure-report.md` with severity levels (CRITICAL/HIGH/MEDIUM/LOW).
