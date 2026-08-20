# House of Veritas — Technical Design Document

## Executive Summary

The House of Veritas Digital Governance Suite provides a robust, scalable platform for managing
legal, operational, and compliance documentation, coupled with workforce, asset, and incident
tracking. The system is architected around two core open-source components: **DocuSeal** (for
e-signature workflows) and **Baserow** (for relational data management), both deployed in Docker
containers on Azure Container Instances.

**Target Infrastructure:** Azure-hosted, Terraform-managed, <R950/month operating cost, supporting
up to 10 concurrent users, 100,000 documents, 99.9% uptime SLA.

---

## System Architecture Overview

### Three-Tier Architecture

1. **Presentation Tier:** Web browsers → Application Gateway (SSL, WAF)
2. **Application Tier:** DocuSeal + Baserow containers (private subnet)
3. **Data Tier:** PostgreSQL + Blob Storage (private subnet)

### Network Architecture

- **VNet:** 10.0.0.0/16
  - **Public Subnet (10.0.1.0/24):** Application Gateway only
  - **App Subnet (10.0.2.0/24):** DocuSeal + Baserow containers
  - **Data Subnet (10.0.3.0/24):** PostgreSQL + Blob Storage

- **NSGs:** Deny by default, minimal required traffic
- **Application Gateway:** Only public-facing endpoint (SSL, WAF, L7 firewall)
- **Private Endpoints:** PostgreSQL via Azure Private Link (no public access)

### Data Flow

```text
User Browser → Application Gateway (SSL/WAF)
              ↓
       DocuSeal/Baserow Containers
              ↓
    PostgreSQL (Private Link) + Blob Storage
              ↓
         Azure Key Vault (Secrets)
              ↓
    Azure Monitor/Log Analytics (Logging)
```

---

## Technology Stack

### Frontend

- **DocuSeal:** React, mobile-responsive, custom branding via CSS
- **Baserow:** Vue.js, mobile-responsive

### Backend

- **DocuSeal API:** Ruby on Rails, RESTful
- **Baserow API:** Django/Python, RESTful

### Database

- **PostgreSQL 14** (Azure Managed)
- Two databases: `docuseal_production` and `baserow_production`
- Shared server for cost optimization
- **PgBouncer** for connection pooling (up to 100 connections)

### Storage

- **Azure Blob Storage:** Documents, images, backups
- **Azure Files:** Container persistence
- **Lifecycle Rules:** Hot (90d) → Cool → Archive (1yr+)

### Orchestration

- **Azure Container Instances:** DocuSeal + Baserow (latest images)
- **Managed Identities:** For Key Vault access

### Infrastructure as Code

- **Terraform 1.5+** with Azure Provider
- **GitHub Actions** for CI/CD
- **State Backend:** Azure Blob Storage

### Security

- **Azure Key Vault:** Secret storage (DB passwords, API keys)
- **Application Gateway v2:** WAF enabled
- **TLS 1.2+:** All traffic encrypted
- **Network Isolation:** Private VNet, NSG rules

### Monitoring

- **Azure Monitor:** Infrastructure metrics
- **Log Analytics:** Centralized logging (90d retention)
- **(Optional) Application Insights:** User/endpoint monitoring

---

## Database Design

### Deployment

- **One Azure PostgreSQL Flexible Server**
- **Two Databases:**
  - `docuseal_production` (DocuSeal schema)
  - `baserow_production` (Baserow schema)

### DocuSeal Schema

- Managed entirely by DocuSeal
- Tables: users, documents, signature_flows, audit_logs
- **Not customized**

### Baserow Schema (8 Core Tables)

#### 1. Employees

| Field                 | Type          | Notes                     |
| --------------------- | ------------- | ------------------------- |
| ID                    | Auto          | Primary key               |
| Full Name             | Text          |                           |
| ID Number             | Text          | Unique                    |
| Role                  | Single Select | Owner, Employee, Resident |
| Employment Start Date | Date          |                           |
| Probation Status      | Single Select |                           |
| Contract Ref          | URL           | Link to DocuSeal          |
| Leave Balance         | Number        | Days                      |
| Email, Phone          | Text          |                           |
| Photo                 | File          |                           |

#### 2. Assets

| Field          | Type          | Notes                               |
| -------------- | ------------- | ----------------------------------- |
| ID             | Auto          | Primary key                         |
| Asset ID       | Text          | Unique (e.g., WS-001)               |
| Type           | Single Select | Tool, Vehicle, Equipment, Household |
| Description    | Long Text     |                                     |
| Purchase Date  | Date          |                                     |
| Price          | Number        |                                     |
| Condition      | Single Select | Excellent, Good, Fair, Poor         |
| Location       | Single Select | Workshop, Garden, etc.              |
| Checked Out By | Link          | To Employees                        |
| Check Out Date | Date          |                                     |
| Photo          | File          |                                     |

#### 3. Tasks

| Field            | Type          | Notes                               |
| ---------------- | ------------- | ----------------------------------- |
| ID               | Auto          | Primary key                         |
| Title            | Text          |                                     |
| Description      | Long Text     |                                     |
| Assigned To      | Link          | To Employees                        |
| Due Date         | Date          |                                     |
| Priority         | Single Select | Low, Medium, High                   |
| Status           | Single Select | Not Started, In Progress, Completed |
| Time Spent       | Number        | Hours                               |
| Completion Notes | Long Text     |                                     |
| Related Asset    | Link          | To Assets                           |
| Project          | Text          |                                     |
| Created Date     | Date          |                                     |
| Completed Date   | Date          |                                     |

#### 4. Time Clock Entries

| Field           | Type          | Notes                       |
| --------------- | ------------- | --------------------------- |
| ID              | Auto          | Primary key                 |
| Employee        | Link          | To Employees                |
| Date            | Date          |                             |
| Clock In        | Time          |                             |
| Clock Out       | Time          |                             |
| Break Duration  | Number        | Minutes                     |
| Total Hours     | Formula       | Auto-calculated             |
| Overtime Hours  | Formula       | >9/day, >45/week (BCEA)     |
| Approval Status | Single Select | Pending, Approved, Rejected |
| Notes           | Text          |                             |

#### 5. Incidents

| Field               | Type          | Notes                                 |
| ------------------- | ------------- | ------------------------------------- |
| ID                  | Auto          | Primary key                           |
| Type                | Single Select | Safety, Equipment, Vehicle, Household |
| Date/Time           | Date + Time   |                                       |
| Location            | Text          |                                       |
| Reporter            | Link          | To Employees                          |
| Description         | Long Text     |                                       |
| Witnesses           | Text          |                                       |
| Severity            | Single Select | Low, Medium, High                     |
| Status              | Single Select | Pending, In Progress, Resolved        |
| Investigation Notes | Long Text     |                                       |
| Actions Taken       | Long Text     |                                       |
| Related Employee    | Link          | To Employees                          |
| Photo               | File          |                                       |

#### 6. Vehicle Logs

| Field              | Type     | Notes                                |
| ------------------ | -------- | ------------------------------------ |
| ID                 | Auto     | Primary key                          |
| Driver             | Link     | To Employees                         |
| Vehicle            | Link     | To Assets (filtered by type=Vehicle) |
| Date Out/In        | Date     |                                      |
| Odometer Start/End | Number   |                                      |
| Distance           | Formula  | End - Start                          |
| Fuel Added         | Number   | Liters                               |
| Fuel Cost          | Number   | Rand                                 |
| Child Passenger    | Checkbox | Compliance                           |
| Notes              | Text     |                                      |

#### 7. Expenses

| Field           | Type          | Notes                                        |
| --------------- | ------------- | -------------------------------------------- |
| ID              | Auto          | Primary key                                  |
| Requester       | Link          | To Employees                                 |
| Type            | Single Select | Request, Post-Hoc                            |
| Category        | Single Select | Materials, Labor, Fuel, etc. (10 categories) |
| Amount          | Number        |                                              |
| Vendor          | Text          |                                              |
| Date            | Date          |                                              |
| Approval Status | Single Select | Pending, Approved, Rejected, Post-Hoc        |
| Receipt         | File          |                                              |
| Project         | Text          |                                              |
| Milestone       | Text          | Deposit, Stage 1/2/3, Final                  |
| Notes           | Long Text     |                                              |
| Approver        | Link          | To Employees (Hans)                          |
| Approval Date   | Date          |                                              |

#### 8. Document Expiry

| Field             | Type          | Notes                              |
| ----------------- | ------------- | ---------------------------------- |
| ID                | Auto          | Primary key                        |
| Doc Name          | Text          |                                    |
| Type              | Single Select | Governance, HR, Safety, Operations |
| Party Responsible | Link          | To Employees                       |
| Last Review       | Date          |                                    |
| Next Review       | Date          |                                    |
| Renewal Cycle     | Text          | Annual, 3-year, etc.               |
| Alert Schedule    | Text          | 60d/30d/7d                         |
| Status            | Single Select | Active, Review Due, Overdue        |
| DocuSeal Ref      | URL           | Link to signed document            |

### Indexing Strategy

- **Primary keys** on all tables (auto-generated)
- **Foreign key indexes** for link fields (employee_id, asset_id, etc.)
- **Composite indexes** for frequent queries:
  - `(employee_id, date)` on Time Clock Entries
  - `(status, due_date)` on Tasks
  - `(next_review, status)` on Document Expiry

### Backup Strategy

- **Daily automated backups** (7-day retention)
- **Weekly CSV exports** to Blob Storage (long-term retention)
- **Point-in-time restore** capability
- **Geo-redundant storage** for disaster recovery

---

## API Architecture & Integration

### DocuSeal API

- **Base URL:** `https://sign.nexamesh.ai/api`
- **Authentication:** API key (stored in Key Vault)
- **Key Endpoints:**
  - `POST /api/templates` - Upload document template
  - `POST /api/submissions` - Create signature request
  - `GET /api/submissions/:id` - Check status
  - `POST /api/webhooks` - Register webhook

### Baserow API

- **Base URL:** `https://ops.nexamesh.ai/api`
- **Authentication:** Per-user API tokens (Key Vault)
- **Key Endpoints:**
  - `GET /api/database/tables/` - List tables
  - `POST /api/database/rows/table/:id/` - Create row
  - `GET /api/database/rows/table/:id/` - List rows
  - `PATCH /api/database/rows/table/:id/row/:row_id/` - Update row

### Webhook Integration

**DocuSeal → Baserow:**

- Trigger: Document signed
- Azure Function processes webhook
- Updates Baserow:
  - Employee contract status
  - Document expiry record
  - Audit log entry

### Scheduled Automation (Azure Functions)

- **Daily (6am):** Check document expiry, send alerts
- **Weekly (Monday 8am):** Recurring task creation, leave balance updates
- **Monthly (1st, 9am):** Generate compliance reports
- **Weekly (Sunday):** Backup export to Blob

### Notification Services

- **SMTP:** SendGrid or Gmail relay (Key Vault credentials)
- **SMS:** Twilio (optional, for urgent alerts)
- **Relay:** Azure Function or Baserow automation

---

## Authentication & Authorization

### Authentication (AuthN)

- **Method:** Local username/password (bcrypt hashed)
- **Sessions:** JWT tokens (8hr expiry, 24hr absolute)
- **Storage:** HTTP-only cookies
- **2FA:** Enabled for Hans (optional for others)

### Authorization (AuthZ)

**DocuSeal:**

- Role-based document visibility
- Users see only documents they must sign

**Baserow:**

- View-level permissions
- **Hans:** All data access
- **Employees:** Filtered views (own records only)
- **Custom views:** "My Tasks," "My Assets," "My Documents"

**External Access:**

- **Arbitrators/Witnesses:** Signed URLs (read-only, time-limited)
- **No login required** for specific document access

### Audit Logging

- All auth actions logged to Log Analytics
- 90-day retention + export for compliance
- Fields: user, action, timestamp, IP, result

---

## Network Architecture & Security

### VNet Configuration

```text
VNet: 10.0.0.0/16
├── Gateway Subnet (10.0.1.0/24) - Public IP, App Gateway
├── Container Subnet (10.0.2.0/24) - DocuSeal, Baserow
└── Database Subnet (10.0.3.0/24) - PostgreSQL, Blob
```

### NSG Rules

#### Gateway Subnet

- Allow: Inbound 443 (HTTPS) from Internet
- Allow: Outbound to Container Subnet

#### Container Subnet

- Allow: Inbound from Gateway only
- Allow: Outbound to Database Subnet, Key Vault, Internet (for updates)

#### Database Subnet

- Allow: Inbound from Container Subnet only
- Deny: All other traffic

### Application Gateway

The routing below is the optional full-stack design. Current low-usage production routes `sign.nexamesh.ai` directly to the separately deployed DocuSeal Azure Container App and does not deploy this gateway module.

- **Public IP:** Only entry point
- **SSL Termination:** TLS 1.2+
- **WAF:** OWASP Top 10 protection
- **Path-Based Routing:**
  - `sign.nexamesh.ai` → DocuSeal container
  - `ops.nexamesh.ai` → Baserow container
- **Health Probes:** 30s interval

### Private Endpoints

- **PostgreSQL:** Azure Private Link (non-routable from Internet)
- **Blob Storage:** Private endpoint (no public access)

---

## Data Security & Encryption

### Encryption at Rest

- **Azure Storage:** AES-256 (Azure-managed keys)
- **PostgreSQL:** AES-256 (Azure-managed keys)
- **Backups:** Encrypted

### Encryption in Transit

- **TLS 1.2+** required for all connections
- **Certificate:** Let's Encrypt (auto-renewed)

### Secret Management

- **Azure Key Vault:** All passwords, API keys, tokens
- **Access:** Managed identities only (containers, Azure Functions)
- **Rotation:**
  - DB passwords: 90 days
  - API tokens: 180 days
- **Audit:** All Key Vault access logged

### Data Masking

- **ID Numbers:** Masked for non-admin users (future phase)
- **Passwords:** Bcrypt hashed (never stored plain text)

---

## Disaster Recovery & Business Continuity

### Recovery Objectives

- **RTO:** 4 hours
- **RPO:** 24 hours

### DR Backup Strategy

1. **Database:**
   - Automated daily backups (Azure-managed)
   - 7-day retention
   - Geo-redundant storage
   - Point-in-time restore

2. **Blob Storage:**
   - Versioning enabled
   - 14-day soft delete
   - Weekly manual exports (CSV)
   - 4-week retention for exports

3. **Infrastructure:**
   - Terraform state versioned (30-day retention)
   - Git repo backed up (GitHub)

### Disaster Scenarios

#### Scenario 1: Corrupt Database

- Restore from latest automated backup
- Downtime: ~1 hour

#### Scenario 2: Container Failure

- Redeploy from Docker image
- Downtime: ~30 minutes

#### Scenario 3: Infrastructure Loss

- Terraform re-apply from Git
- Restore DB from backup
- Downtime: ~4 hours

#### Scenario 4: Region Outage

- Manual intervention required
- Documented runbook
- Potential for longer downtime

### Annual DR Drill

- Scheduled test of full recovery
- Documented in Doc 18 (Succession Protocol)
- Hans responsible for execution

---

## Monitoring & Observability

### Infrastructure Monitoring

- **Azure Monitor:** All resources (CPU, RAM, storage, network)
- **Alerts:**
  - CPU >80% for 5 minutes
  - Storage >90%
  - Unhealthy backend detected
  - Budget >80% (R800/month)

### Application Monitoring

- **Log Analytics:** Centralized logging (90d retention)
- **Custom Queries:** Failed logins, errors, slow queries
- **(Optional) Application Insights:** User journeys, performance

### Uptime Monitoring

- **External Service:** StatusCake or UptimeRobot
- **Check Frequency:** Every 5 minutes
- **Alert:** Email to Hans on downtime

### Dashboards

- **Azure Portal:** Custom dashboard with KPIs
- **Metrics:**
  - Uptime %
  - Average response time
  - Active users
  - Documents signed (weekly)
  - Tasks completed
  - Incidents reported
  - Budget spend

---

## CI/CD Pipeline Implementation

### Repository Structure

```text
/terraform       - Infrastructure as Code
  /modules       - Reusable Terraform modules
  /environments  - Prod environment config
/docs            - Documentation
/scripts         - Utility scripts
/.github
  /workflows     - GitHub Actions
```

### GitHub Actions Workflows

#### 1. Terraform Plan (on PR)

```yaml
- Checkout code
- Setup Terraform
- terraform init
- terraform validate
- terraform plan -out=tfplan
- Comment plan on PR
- Upload plan artifact
```

#### 2. Terraform Apply (on merge to main)

```yaml
- Checkout code
- Setup Terraform
- Download plan artifact
- terraform apply tfplan
- Tag deployment (date + commit)
- Send success notification
```

#### 3. Rollback (manual trigger)

```yaml
- Git revert to previous commit
- Auto-apply previous Terraform state
```

### Secrets Management

- **GitHub Secrets:**
  - AZURE_CREDENTIALS (Service Principal)
  - TF_STATE_STORAGE_ACCOUNT
  - TF_STATE_CONTAINER
  - TF_STATE_KEY

### Testing

- **Static:** `terraform validate`, `terraform fmt -check`
- **Functional:** Manual smoke tests post-deployment
- **Security:** Monthly Terraform scan for misconfigurations

---

## Performance Optimization

### Database Performance

- **PgBouncer:** Connection pooling (max 100)
- **Timeouts:** 30s query timeout
- **Slow Query Logging:** Queries >2s logged
- **Indexes:** See Database Design section

### Application Performance

- **Container Sizing:** 2 vCPU, 4GB RAM (right-sized)
- **Static Assets:** Cached at Application Gateway
- **Browser Caching:** 7 days for CSS/JS/images
- **Compression:** Gzip enabled for all text content

### Storage Performance

- **Blob Lifecycle:**
  - Hot: Last 90 days
  - Cool: 90 days - 1 year
  - Archive: >1 year
- **CDN:** Not required for <10 users

### Background Jobs

- **Off-Peak Scheduling:** Reports, backups run overnight
- **Async Processing:** Heavy tasks queued (Azure Functions)

### Monthly Performance Review

- Check slow queries
- Adjust indexes if needed
- Review container resource usage
- Optimize blob storage tiers

---

## Security Hardening

### Network Security

- All private except gateway
- NSG deny by default
- No direct DB access from Internet
- Private endpoints for all PaaS services

### Identity & Access Management

- **Managed Identities:** Containers access Key Vault
- **RBAC:** Hans-only access to Key Vault, Azure Portal
- **(Future) Azure AD SSO:** Planned for Phase 2

### Application Security

- **Password Policy:** 12+ chars, 90-day expiry, no reuse
- **2FA:** Enabled for Hans (mandatory)
- **Session Management:**
  - JWT expiry: 8 hours
  - Absolute timeout: 24 hours
- **CSRF Protection:** Enabled
- **Input Validation:** Server-side (ORM prevents SQL injection)
- **XSS Protection:** React/Vue auto-escape

### Data Security

- Encryption at rest and in transit
- No secrets in code (Key Vault only)
- PII masked for non-admins
- All sensitive access logged

### Compliance

- **BCEA:** Labor law compliance
- **POPIA:** Data protection standards
- **ECT Act:** E-signature legality

### Vulnerability Management

- **Monthly:** Docker image updates
- **Monthly:** `docker scan` for vulnerabilities
- **Quarterly:** Azure Security Center review
- **Quarterly:** Dependency audit (npm, pip)
- **Annually:** Penetration test (R5,000-10,000)

### Incident Response

- **Playbook:** Documented procedures
- **Incident Commander:** Hans
- **Post-Mortem:** Within 48 hours
- **RCA:** Root cause analysis, remediation plan

### Security Reviews

- **Quarterly:** Log review, access audit
- **Annually:** Full architecture review

---

## Cost Management & Optimization

### Monthly Baseline: R950

| Service                    | Cost |
| -------------------------- | ---- |
| PostgreSQL Flexible Server | R400 |
| Container Instances (2x)   | R300 |
| Blob Storage               | R50  |
| Application Gateway        | R150 |
| Key Vault + NAT Gateway    | R50  |

### Variable Costs

- **SMS (Twilio):** Pay-per-use
- **Application Insights:** Optional
- **SSL Certificates:** Free (Let's Encrypt)

### Annual Costs

- **Domain:** R150/year

### Optimization Strategies

1. **Scale on Demand:**
   - Only increase DB/container resources when needed
   - Start small, monitor, adjust

2. **Storage Lifecycle:**
   - Auto-move to cool/archive
   - Delete old logs/exports

3. **Log Retention:**
   - 90 days in Log Analytics
   - Export and delete older logs

4. **Alerts:**
   - Budget alert at R800 (>80%)
   - Monthly spending review

5. **Reserved Instances:**
   - Not cost-effective at this scale
   - Revisit if usage increases

### Cost Tracking

- **Azure Cost Management:** Weekly review
- **Tag Resources:** "project:houseofveritas"
- **Budget:** R1,000/month hard limit

---

## Deployment Procedure

### Prerequisites

1. Azure subscription
2. Azure CLI installed
3. Terraform 1.5+ installed
4. GitHub account with repo
5. Domain name registered
6. SSH key generated

### Step-by-Step Deployment

#### Step 1: Create Service Principal

```bash
az ad sp create-for-rbac --name "terraform-houseofveritas" \
  --role="Contributor" \
  --scopes="/subscriptions/{subscription-id}"
```

#### Step 2: Set up GitHub Secrets

- AZURE_CREDENTIALS
- TF_STATE_STORAGE_ACCOUNT
- TF_STATE_CONTAINER
- TF_STATE_KEY

#### Step 3: Initialize Terraform Backend

```bash
cd terraform
terraform init \
  -backend-config="storage_account_name={account}" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=houseofveritas.tfstate"
```

#### Step 4: Deploy Infrastructure

```bash
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

#### Step 5: Configure DNS

- Create A records for `sign.nexamesh.ai` and `ops.nexamesh.ai`
- Point to Application Gateway public IP

#### Step 6: Generate SSL Certificates

- Use Let's Encrypt (Certbot)
- Upload to Key Vault
- Configure in Application Gateway

#### Step 7: Set up Applications

- Create admin accounts (Hans)
- Configure SMTP (SendGrid)
- Upload document templates
- Seed Baserow with initial data (employees, assets)

#### Step 8: Configure Automation

- Register webhooks (DocuSeal → Azure Function)
- Set up scheduled jobs (Azure Functions)
- Test notifications (email, SMS)

#### Step 9: Onboard Users

- Create accounts for Charl, Lucky, Irma
- Assign roles and permissions
- Conduct training session

#### Step 10: Go Live

- Monitor for 24-48 hours
- Verify all workflows
- Collect user feedback

---

## Maintenance Procedures

### Daily

- Check alerts/logs
- Verify backups completed

### Weekly

- Review spend, uptime, incident logs
- Check for failed jobs

### Monthly

- Patch Docker images (DocuSeal, Baserow)
- Update Terraform providers/modules
- Test all core flows post-upgrade
- Verify backup exports
- Review security logs

### Quarterly

- Rotate secrets (DB passwords, API tokens)
- Clean up old users/access logs
- Update SSL certificates
- Run `docker scan` + Azure Security Center review
- Dependency audit (npm, pip)

### Annually

- Full DR test (simulate failover)
- Security audit (IAM, NSGs, code, users)
- Review performance/cost/budget
- Refactor Terraform code for best practices
- Penetration test (external firm)

---

## Troubleshooting Guide

### Common Issues

#### Issue: DocuSeal/Baserow Container Down

- Check: Container running in Azure Portal
- Check: Container logs (`az container logs`)
- Check: Application Gateway health probes
- Check: DNS record pointing to correct IP

#### Issue: Database Connection Error

- Check: PostgreSQL up in Azure Portal
- Check: NSG rules (Container → Database subnet)
- Check: Connection string in Key Vault
- Check: Not over connection limit (PgBouncer)

#### Issue: SSL Certificate Error

- Check: Certificate expiry in Key Vault
- Check: Application Gateway SSL settings
- Check: Browser/user seeing correct domain

#### Issue: Terraform Lock Error

- Check: Blob lease status
- Break lease: `az storage blob lease break`

#### Issue: Cost Overrun

- Review: Azure Cost Management
- Identify: Largest cost contributors
- Action: Deprovision unused resources, optimize storage tiers

#### Issue: Webhooks Not Working

- Check: Azure Function status and logs
- Check: Webhook registration in DocuSeal
- Check: Network path (Container → Function)

---

## Scaling Strategy

### Vertical Scaling (Scale Up)

- **Trigger:** DB CPU >80% sustained, or query response time >5s
- **Action:** Upgrade DB tier, increase container CPU/RAM

### Horizontal Scaling (Scale Out)

- **Trigger:** >10 concurrent users
- **Action:**
  - Deploy multiple container instances
  - Configure load balancing
  - Implement session management (Redis/sticky sessions)

### Storage Scaling

- **Trigger:** Storage >80% full
- **Action:**
  - Enable CDN for static assets
  - Implement caching layer (Redis)
  - Archive old data to cold storage

### Geographic Scaling

- **Trigger:** Global users, >99.99% uptime requirement
- **Action:**
  - Multi-region deployment
  - Traffic Manager
  - Geo-redundant database

### Scaling Review

- **Alerts:** Set for all critical resource limits
- **Quarterly Review:** Assess growth trends
- **Proactive Planning:** Scale before limits reached

---

## Future Enhancements Roadmap

### Phase 2 (6-12 months)

- **Payroll/Accounting Integration:** Sync time/expense to QuickBooks/Xero (2-4 weeks dev)
- **Biometric Time Clock:** Fingerprint device → Azure Function → Baserow (low capex, quick integration)
- **Mobile Apps:** React Native/Flutter, offline-first, API-based (uses same backend)

### Phase 3 (12-24 months)

- **Vehicle GPS Tracking:** Traccar or 3rd-party GPS → Azure Function → Baserow
- **Predictive Maintenance (AI):** Analyze asset usage/failures, predict maintenance needs (2-4 weeks initial, ongoing ML cost)
- **Multi-Property:** Add property dimension to all tables/views, reporting per property

### Long-Term

- **Migration to AKS:** For >50 users, better orchestration
- **Cosmos DB:** For >100k documents, global distribution
- **CDN + Redis:** For improved performance at scale

---

## Appendix - Technical Reference

### Terraform Commands

```bash
terraform init
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
terraform output
```

### Azure CLI Commands

```bash
# Login
az login
az account set --subscription <id>

# Resources
az resource list --resource-group rg-houseofveritas \
  --output table

# Container logs
az container logs --resource-group rg-houseofveritas \
  --name aci-docuseal

# Database query
az postgres flexible-server execute \
  --name pg-houseofveritas \
  --admin-user <user> \
  --admin-password <pass> \
  --database-name docuseal_production \
  --querytext 'SELECT COUNT(*) FROM users'

# Blob upload
az storage blob upload \
  --account-name sthouseofveritas \
  --container-name documents \
  --file <local-file> \
  --name <blob-name>
```

### API Endpoints

#### DocuSeal

- `GET /api/templates`
- `POST /api/submissions`
- `GET /api/submissions/<id>`

#### Baserow

- `GET /api/database/tables/`
- `POST /api/database/rows/table/<table-id>/`

### Key Vault Commands

```bash
# List secrets
az keyvault secret list --vault-name kv-houseofveritas

# Set secret
az keyvault secret set \
  --vault-name kv-houseofveritas \
  --name <secret-name> \
  --value <secret-value>
```

### Database Connection Strings

```text
postgresql://username:password@hostname:5432/database?sslmode=require
```

---

## Summary

This Technical Design Document provides a complete, production-ready architecture for House of Veritas on Azure. The platform is designed to be:

- **Secure:** Network isolation, encryption, RBAC, audit trails
- **Reliable:** 99.9% uptime, automated backups, DR procedures
- **Cost-Effective:** <R950/month operating cost
- **Scalable:** Can grow from 4 to 50+ users with minimal changes to architecture
- **Maintainable:** Terraform-managed, clear procedures, comprehensive monitoring

The design aligns with all four specification documents and provides a solid foundation for the
House of Veritas Digital Governance Suite.
