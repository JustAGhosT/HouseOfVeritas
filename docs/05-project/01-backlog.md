# House of Veritas - Implementation Backlog

> Prioritized backlog for full end-to-end implementation of the House of Veritas Digital Governance & Estate Management Platform

**Last Updated:** February 2026  
**Status:** Phase 4 Complete (Integration & Automation)  
**Next Phase:** Phase 4 - Production Deployment

---

## 📋 Backlog Overview

| Phase                                       | Status      | Duration  | Priority | Dependencies               |
| ------------------------------------------- | ----------- | --------- | -------- | -------------------------- |
| Phase 1: MVP Landing Page                   | ✅ Complete | 2 weeks   | P0       | None                       |
| Phase 2: Foundation & Infrastructure        | ✅ Complete | 3-4 weeks | P0       | Azure subscription, domain |
| Phase 3: Core Platform (DocuSeal + Baserow) | ✅ Complete | 4-6 weeks | P0       | Phase 2 complete           |
| Phase 4: Integration & Automation           | ✅ Complete | 3-4 weeks | P0       | Phase 3 complete           |
| Phase 5: User Experience & Polish           | ⏳ Planned  | 2-3 weeks | P1       | Phase 4 complete           |
| Phase 6: Testing & Validation               | ⏳ Planned  | 2-3 weeks | P0       | Phase 5 complete           |
| Phase 7: Training & Go-Live                 | ⏳ Planned  | 1-2 weeks | P0       | Phase 6 complete           |

**Total Estimated Duration:** 17-24 weeks (4-6 months)

---

## Phase 1: MVP Landing Page ✅ COMPLETE

### Epic 1.1: Landing Page Design & Development ✅

- [x] Transform Apex template to House of Veritas branding
- [x] Create HV logo and design system
- [x] Implement 8 feature module showcases
- [x] Build Hans' admin dashboard preview
- [x] Create role-based access control section
- [x] Add compliance & trust section
- [x] Implement grid pattern background

### Epic 1.2: Stubbed Backend APIs ✅

- [x] Create 10 Next.js API routes
- [x] Mock data for stats endpoint
- [x] Mock data for documents (8 governance docs)
- [x] Mock data for employees (4 users)
- [x] Mock data for expenses with categories
- [x] Mock data for contractors with milestones
- [x] Mock data for tasks and time tracking
- [x] Mock data for assets registry
- [x] Mock data for incidents
- [x] Mock data for vehicle logs

### Epic 1.3: Documentation ✅

- [x] Create comprehensive README
- [x] Record all 4 design documents in /docs
- [x] Add getting started guide
- [x] Document API endpoints
- [x] Create architecture diagrams

---

## Phase 2: Foundation & Infrastructure 🔄 READY TO START

**Priority:** P0 - Critical  
**Duration:** 3-4 weeks  
**Owner:** Technical Lead / DevOps

### Epic 2.1: Azure Account & Prerequisites

**Story Points:** 3  
**Priority:** P0

- [ ] **Story 2.1.1:** Set up Azure subscription
  - [ ] Create Azure account (if not exists)
  - [ ] Set up billing alerts (R800/month threshold)
  - [ ] Configure cost management
  - [ ] Set up Azure CLI locally
  - **Acceptance:** Azure account active, billing configured

- [ ] **Story 2.1.2:** Domain name acquisition
  - [ ] Purchase domain: nexamesh.ai (or .co.za)
  - [ ] Configure DNS provider
  - [ ] Set up DNS management access
  - **Acceptance:** Domain purchased, DNS accessible

- [ ] **Story 2.1.3:** GitHub repository setup
  - [ ] Create private GitHub repository
  - [ ] Set up branch protection rules (main branch)
  - [ ] Configure GitHub Actions secrets
  - [ ] Set up service principal for Azure
  - **Acceptance:** Repository secured, CI/CD ready

### Epic 2.2: Terraform Infrastructure Code

**Story Points:** 13  
**Priority:** P0

- [ ] **Story 2.2.1:** Terraform project structure
  - [ ] Create /terraform directory structure
  - [ ] Set up modules (network, compute, storage, security)
  - [ ] Configure backend state (Azure Blob)
  - [ ] Create variable files for environments
  - **Acceptance:** Terraform structure validated

- [ ] **Story 2.2.2:** Network infrastructure module
  - [ ] Define VNet (10.0.0.0/16)
  - [ ] Create subnets (Gateway, Container, Database)
  - [ ] Configure NSG rules
  - [ ] Set up route tables
  - **Acceptance:** `terraform plan` succeeds for network

- [ ] **Story 2.2.3:** Storage infrastructure module
  - [ ] Define Azure Blob Storage account
  - [ ] Configure lifecycle policies (hot/cool/archive)
  - [ ] Set up container for documents
  - [ ] Configure backup container
  - **Acceptance:** Storage module validated

- [ ] **Story 2.2.4:** Database infrastructure module
  - [ ] Define PostgreSQL Flexible Server
  - [ ] Configure firewall rules (private only)
  - [ ] Set up two databases (docuseal, baserow)
  - [ ] Configure backup policies
  - [ ] Set up Private Link
  - **Acceptance:** Database module validated

- [ ] **Story 2.2.5:** Security infrastructure module
  - [ ] Define Azure Key Vault
  - [ ] Configure RBAC policies
  - [ ] Set up managed identities
  - [ ] Create secrets (placeholders)
  - **Acceptance:** Key Vault accessible

- [ ] **Story 2.2.6:** Application Gateway module
  - [ ] Define Application Gateway v2
  - [ ] Configure WAF rules
  - [ ] Set up SSL certificate placeholder
  - [ ] Configure path-based routing
  - [ ] Set up health probes
  - **Acceptance:** Gateway configuration validated

### Epic 2.3: CI/CD Pipeline

**Story Points:** 8  
**Priority:** P0

- [ ] **Story 2.3.1:** GitHub Actions for Terraform Plan
  - [ ] Create workflow file (.github/workflows/terraform-plan.yml)
  - [ ] Configure PR trigger
  - [ ] Set up Azure authentication
  - [ ] Add plan comment to PR
  - **Acceptance:** Plan runs on PR creation

- [ ] **Story 2.3.2:** GitHub Actions for Terraform Apply
  - [ ] Create workflow file (.github/workflows/terraform-apply.yml)
  - [ ] Configure main branch trigger
  - [ ] Set up approval gates
  - [ ] Add deployment tagging
  - **Acceptance:** Apply runs on merge to main

- [ ] **Story 2.3.3:** Rollback procedure
  - [ ] Create rollback workflow
  - [ ] Document rollback process
  - [ ] Test rollback with dummy changes
  - **Acceptance:** Rollback procedure documented and tested

### Epic 2.4: Initial Infrastructure Deployment

**Story Points:** 5  
**Priority:** P0

- [ ] **Story 2.4.1:** Deploy networking and security
  - [ ] Run terraform apply for network module
  - [ ] Verify VNet and subnets created
  - [ ] Verify NSG rules applied
  - [ ] Verify Key Vault accessible
  - **Acceptance:** Network infrastructure live

- [ ] **Story 2.4.2:** Deploy storage and database
  - [ ] Run terraform apply for storage module
  - [ ] Run terraform apply for database module
  - [ ] Verify PostgreSQL accessible via private endpoint
  - [ ] Verify Blob Storage accessible
  - **Acceptance:** Data tier infrastructure live

- [ ] **Story 2.4.3:** Deploy Application Gateway
  - [ ] Run terraform apply for gateway module
  - [ ] Configure temporary self-signed certificate
  - [ ] Verify gateway health checks
  - **Acceptance:** Gateway accessible with public IP

### Epic 2.5: DNS & SSL Configuration

**Story Points:** 5  
**Priority:** P0

- [ ] **Story 2.5.1:** DNS configuration
  - [ ] If enabling the optional Application Gateway, coordinate replacement of the live `sign.nexamesh.ai` Container App CNAME with an A record
  - [ ] Create A records for ops.nexamesh.ai
  - [ ] Point to Application Gateway IP
  - [ ] Verify DNS propagation
  - **Acceptance:** DNS resolves correctly

- [ ] **Story 2.5.2:** SSL certificate setup
  - [ ] Install Certbot on management machine
  - [ ] Generate Let's Encrypt certificates
  - [ ] Upload certificates to Key Vault
  - [ ] Configure Application Gateway SSL
  - [ ] Set up auto-renewal (cron job or Azure Function)
  - **Acceptance:** HTTPS working, A+ SSL rating

---

## Phase 3: Core Platform (DocuSeal + Baserow) ✅ COMPLETE

**Priority:** P0 - Critical  
**Duration:** 4-6 weeks  
**Owner:** Backend Lead
**Status:** Configuration & setup documentation complete. Ready for production deployment.

### Epic 3.1: DocuSeal Deployment & Configuration ✅

**Story Points:** 13  
**Priority:** P0

- [x] **Story 3.1.1:** DocuSeal container configuration
  - [x] Create docker-compose.yml for DocuSeal
  - [x] Configure environment variables template
  - [x] Document volume mounts for persistence
  - [x] Create setup guide (/docs/04-configuration/01-docuseal-setup.md)
  - **Acceptance:** DocuSeal configuration ready for deployment

- [x] **Story 3.1.2:** DocuSeal initial configuration documentation
  - [x] Document Hans admin account setup
  - [x] Document SMTP settings (SendGrid/Gmail)
  - [x] Document branding setup (logo, colors)
  - [x] Document signature workflows
  - **Acceptance:** Setup guide complete

- [x] **Story 3.1.3:** Document template list created
  - [x] List all 18+ governance documents with details
  - [x] Document template creation process
  - [x] Include signers and review cycles
  - [x] Create checklist for tracking (/docs/04-configuration/04-document-templates.md)
  - **Acceptance:** Template list complete

- [x] **Story 3.1.4:** DocuSeal API integration documentation
  - [x] Document API endpoints
  - [x] Create webhook handler Azure Function
  - [x] Document webhook configuration
  - **Acceptance:** API integration documented

### Epic 3.2: Baserow Deployment & Configuration ✅

**Story Points:** 13  
**Priority:** P0

- [x] **Story 3.2.1:** Baserow container configuration
  - [x] Create Terraform module for ACI (Baserow)
  - [x] Configure environment variables from Key Vault
  - [x] Set up PostgreSQL connection
  - [x] Deploy container
  - **Acceptance:** Baserow accessible at ops.nexamesh.ai

- [x] **Story 3.2.2:** Baserow initial configuration
  - [x] Create Hans admin account
  - [x] Create workspace: "House of Veritas Operations"
  - [x] Configure SMTP settings
  - [x] Set up user roles
  - **Acceptance:** Admin workspace configured

- [x] **Story 3.2.3:** Document Baserow database schema
  - [x] Document Employees table with all fields
  - [x] Document Assets table with all fields
  - [x] Document Tasks table with all fields
  - [x] Document Time Clock Entries table
  - [x] Document Incidents table with all fields
  - [x] Document Vehicle Logs table with all fields
  - [x] Document Expenses table with all fields
  - [x] Document Document Expiry table with all fields
  - **Acceptance:** All 8 tables documented (/docs/04-configuration/02-baserow-setup.md)

- [x] **Story 3.2.4:** Document relationships & formulas
  - [x] Document Employee links to Tasks, Assets, Incidents
  - [x] Document overtime calculation formulas
  - [x] Document distance calculation for vehicles
  - [x] Document all calculated fields
  - **Acceptance:** Relationships and formulas documented

- [x] **Story 3.2.5:** Document Baserow views configuration
  - [x] Document "My Tasks" view for Charl
  - [x] Document "My Tasks" view for Lucky
  - [x] Document "My Documents" view for Irma
  - [x] Document "Hans Overview" view (all data)
  - [x] Document filters and permissions per view
  - **Acceptance:** Role-based views documented

- [x] **Story 3.2.6:** Document Baserow API integration
  - [x] Document API endpoints for all tables
  - [x] Document authentication flow
  - **Acceptance:** API integration documented

### Epic 3.3: User Account Documentation ✅

**Story Points:** 5  
**Priority:** P0

- [x] **Story 3.3.1:** Document user account creation for DocuSeal
  - [x] Document Hans, Charl, Lucky, Irma account creation
  - **Acceptance:** User creation documented

- [x] **Story 3.3.2:** Document user account creation for Baserow
  - [x] Document account creation with roles
  - [x] Document permissions configuration
  - **Acceptance:** User creation documented

### Epic 3.4: Data Seeding Scripts ✅

**Story Points:** 8  
**Priority:** P1

- [x] **Story 3.4.1:** Create employee seed data
  - [x] Define Hans, Charl, Lucky, Irma records
  - **Acceptance:** Employee data ready (/config/scripts/seed-baserow.py)

- [x] **Story 3.4.2:** Create asset seed data
  - [x] Define workshop equipment (4 items)
  - [x] Define garden equipment (3 items)
  - [x] Define vehicles (Toyota Hilux)
  - [x] Define household items (2 items)
  - **Acceptance:** Asset data ready

- [x] **Story 3.4.3:** Create document expiry seed data
  - [x] Define all 18 governance documents
  - [x] Include review dates and alert schedules
  - **Acceptance:** Document expiry data ready

- [x] **Story 3.4.4:** Create sample tasks seed data
  - [x] Define 5 sample tasks with assignments
  - **Acceptance:** Task data ready

### Epic 3.5: Automation Scripts ✅

**Story Points:** 8  
**Priority:** P0

- [x] **Story 3.5.1:** Create DocuSeal webhook handler
  - [x] Azure Function to handle signature completion
  - [x] Update Baserow on document signing
  - **Acceptance:** Webhook handler ready (/config/scripts/azure-function-webhook.py)

- [x] **Story 3.5.2:** Create document expiry alert function
  - [x] Daily check for expiring documents
  - [x] Email notifications via SendGrid
  - [x] Admin summary report
  - **Acceptance:** Alert function ready (/config/scripts/document-expiry-alert.py)

### Epic 3.6: Local Development Environment ✅

**Story Points:** 5  
**Priority:** P1

- [x] **Story 3.6.1:** Create Docker Compose configuration
  - [x] PostgreSQL with multi-database support
  - [x] Redis for Baserow caching
  - [x] DocuSeal container
  - [x] Baserow container
  - [x] Nginx reverse proxy
  - **Acceptance:** docker-compose.yml ready

- [x] **Story 3.6.2:** Create environment configuration
  - [x] .env.template with all variables
  - [x] SSL certificate generator script
  - [x] Nginx configuration
  - **Acceptance:** Environment configuration ready

---

## Phase 4: Integration & Automation ✅ COMPLETE

**Priority:** P0 - Critical  
**Duration:** 3-4 weeks  
**Owner:** Backend Lead
**Status:** All Azure Functions created and ready for deployment

### Epic 4.1: DocuSeal ↔ Baserow Integration ✅ (Code Complete)

> **Note:** All code and configuration complete. Story 4.1.4 pending production deployment.

**Story Points:** 13  
**Priority:** P0

- [x] **Story 4.1.1:** Azure Function setup
  - [x] Create Azure Function App structure
  - [x] Configure Python runtime (requirements.txt)
  - [x] Set up deployment pipeline (GitHub Actions)
  - [x] Configure settings template (local.settings.json)
  - **Acceptance:** Function App structure ready at /config/azure-functions/

- [x] **Story 4.1.2:** Webhook receiver function
  - [x] Create HTTP trigger function (DocuSealWebhook)
  - [x] Parse DocuSeal webhook payload
  - [x] Validate webhook signature
  - [x] Log webhook events
  - **Acceptance:** Function code ready at /config/azure-functions/DocuSealWebhook/

- [x] **Story 4.1.3:** Baserow update function
  - [x] Create BaserowClient in shared utilities
  - [x] Update employee contract status on signature
  - [x] Update document expiry records
  - [x] Email notification on completion
  - **Acceptance:** Integration logic implemented

- [ ] **Story 4.1.4:** Register webhooks in DocuSeal
  - [ ] Configure webhook URL in DocuSeal (requires deployment)
  - [ ] Test with sample document
  - [ ] Verify end-to-end flow
  - **Acceptance:** Requires production deployment

### Epic 4.2: Document Expiry Automation ✅

**Story Points:** 8  
**Priority:** P0

- [x] **Story 4.2.1:** Daily expiry check function
  - [x] Create timer trigger function (daily 6am) - DocumentExpiryAlert
  - [x] Query Baserow for expiring documents
  - [x] Calculate days until expiry
  - [x] Determine alert level (URGENT/WARNING/NOTICE)
  - **Acceptance:** Function code ready

- [x] **Story 4.2.2:** Email notification function
  - [x] EmailClient in shared utilities
  - [x] Create email templates (60d, 30d, 7d alerts)
  - [x] Send emails to responsible parties
  - [x] Daily summary to admin
  - **Acceptance:** Email templates and client ready

- [x] **Story 4.2.3:** SMS notification function (optional)
  - [x] SMSClient in shared utilities (Twilio)
  - [x] SMS for urgent alerts (≤7 days)
  - [x] Send SMS to admin phone
  - **Acceptance:** SMS client ready (requires Twilio config)

### Epic 4.3: Task & Time Tracking Automation ✅

**Story Points:** 8  
**Priority:** P1

- [x] **Story 4.3.1:** Recurring task creation
  - [x] Create timer trigger function (weekly Monday 8am) - RecurringTasks
  - [x] Query Baserow for recurring task templates
  - [x] Create new task records (daily/weekly/monthly/quarterly)
  - [x] Assign to employees and notify
  - **Acceptance:** Function code ready

- [x] **Story 4.3.2:** Overtime calculation automation
  - [x] Create OvertimeCalculator function (Sunday 11pm)
  - [x] Query Time Clock Entries
  - [x] Calculate >45hrs/week per employee (BCEA compliant)
  - [x] Flag for approval, notify admin
  - **Acceptance:** Function code ready

- [x] **Story 4.3.3:** Leave balance updates
  - [x] Create LeaveBalanceUpdate function (monthly 1st 7am)
  - [x] Calculate accrued leave (1.25 days/month)
  - [x] Update leave balance records
  - [x] Send notification to employees
  - **Acceptance:** Function code ready

### Epic 4.4: Financial Tracking Automation ✅

**Story Points:** 5  
**Priority:** P1

- [x] **Story 4.4.1:** Expense approval notifications
  - [x] Create ExpenseNotification function (HTTP webhook)
  - [x] Send notification to admin
  - [x] Include expense details
  - [x] Pending expense summary
  - **Acceptance:** Function code ready

- [x] **Story 4.4.2:** Budget vs Actual reporting
  - [x] Create BudgetReport function (monthly 5th 8am)
  - [x] Query Expenses table
  - [x] Calculate totals by category
  - [x] Generate text report (PDF optional)
  - [x] Email to admin
  - **Acceptance:** Function code ready

### Epic 4.5: Backup & Archive Automation ✅

**Story Points:** 5  
**Priority:** P0

- [x] **Story 4.5.1:** Weekly Baserow export
  - [x] Create BackupExport function (Sunday midnight)
  - [x] Export all 8 tables to CSV
  - [x] Upload to Blob Storage (backup container)
  - [x] Email backup report
  - **Acceptance:** Function code ready

- [ ] **Story 4.5.2:** Document archival
  - [ ] Create timer trigger for old documents
  - [ ] Move documents >90 days to cool storage
  - [ ] Move documents >1 year to archive storage
  - **Acceptance:** Deferred to Phase 5 (requires blob storage)

---

## Phase 5: User Experience & Polish ⏳ PLANNED

**Priority:** P1 - High  
**Duration:** 2-3 weeks  
**Owner:** Frontend Lead

### Epic 5.1: Custom Dashboard Development

**Story Points:** 13  
**Priority:** P1

- [ ] **Story 5.1.1:** Hans' admin dashboard
  - [ ] Replace landing page dashboard preview with real dashboard
  - [ ] Connect to live Baserow API
  - [ ] Display real-time stats (tasks, documents, budget)
  - [ ] Add contractor milestone tracker
  - [ ] Add document expiry panel
  - [ ] Make interactive and clickable
  - **Acceptance:** Hans has working admin dashboard

- [ ] **Story 5.1.2:** Charl's employee dashboard
  - [ ] Create "My Tasks Today" view
  - [ ] Connect to Baserow Tasks API
  - [ ] Add time logging interface
  - [ ] Add incident reporting form
  - [ ] Add asset check-in/out
  - **Acceptance:** Charl has personalized dashboard

- [ ] **Story 5.1.3:** Lucky's employee dashboard
  - [ ] Create mobile-friendly task list
  - [ ] Add expense submission form
  - [ ] Add vehicle log form
  - [ ] Add time clock-in/out
  - **Acceptance:** Lucky has mobile-friendly dashboard

- [ ] **Story 5.1.4:** Irma's resident dashboard
  - [ ] Create simplified household view
  - [ ] Add household task list
  - [ ] Add child-related incident form
  - [ ] Link to resident agreement
  - **Acceptance:** Irma has simple, focused dashboard

### Epic 5.2: Mobile Optimization

**Story Points:** 8  
**Priority:** P1

- [ ] **Story 5.2.1:** Responsive design audit
  - [ ] Test all pages on mobile (iOS/Android)
  - [ ] Fix layout issues
  - [ ] Optimize touch targets (44x44px minimum)
  - [ ] Test forms on mobile
  - **Acceptance:** All pages responsive on mobile

- [ ] **Story 5.2.2:** Mobile-specific features
  - [ ] Add camera integration for receipt upload
  - [ ] Add camera for incident photos
  - [ ] Add GPS location for incident reporting
  - [ ] Optimize image sizes for mobile upload
  - **Acceptance:** Mobile features working smoothly

### Epic 5.3: Accessibility Improvements

**Story Points:** 5  
**Priority:** P1

- [ ] **Story 5.3.1:** WCAG 2.1 AA compliance audit
  - [ ] Run accessibility scanner (axe, Lighthouse)
  - [ ] Fix color contrast issues
  - [ ] Add aria-labels to all interactive elements
  - [ ] Test with screen reader
  - **Acceptance:** WCAG 2.1 AA compliant

- [ ] **Story 5.3.2:** Keyboard navigation
  - [ ] Ensure all features keyboard-accessible
  - [ ] Add focus indicators
  - [ ] Test tab order
  - [ ] Add keyboard shortcuts for common actions
  - **Acceptance:** Full keyboard navigation working

### Epic 5.4: Performance Optimization

**Story Points:** 5  
**Priority:** P2

- [ ] **Story 5.4.1:** Frontend optimization
  - [ ] Implement code splitting
  - [ ] Lazy load images
  - [ ] Optimize bundle size
  - [ ] Add service worker for offline support
  - **Acceptance:** Lighthouse score >90

- [ ] **Story 5.4.2:** API optimization
  - [ ] Implement caching for frequently accessed data
  - [ ] Optimize database queries
  - [ ] Add pagination for large lists
  - [ ] Implement rate limiting
  - **Acceptance:** API response time <500ms

---

## Phase 6: Testing & Validation ⏳ PLANNED

**Priority:** P0 - Critical  
**Duration:** 2-3 weeks  
**Owner:** QA Lead

### Epic 6.1: Functional Testing

**Story Points:** 13  
**Priority:** P0

- [ ] **Story 6.1.1:** Document management testing
  - [ ] Test document upload
  - [ ] Test signature workflow (all 4 users)
  - [ ] Test document versioning
  - [ ] Test audit trail generation
  - [ ] Test PDF export
  - **Acceptance:** All document features working

- [ ] **Story 6.1.2:** Employee registry testing
  - [ ] Test employee CRUD operations
  - [ ] Test leave balance calculations
  - [ ] Test contract status updates
  - [ ] Test probation tracking
  - **Acceptance:** All employee features working

- [ ] **Story 6.1.3:** Financial tracking testing
  - [ ] Test expense submission (post-hoc)
  - [ ] Test expense approval workflow
  - [ ] Test contractor milestone tracking
  - [ ] Test budget vs actual calculations
  - [ ] Test receipt upload
  - **Acceptance:** All financial features working

- [ ] **Story 6.1.4:** Time tracking testing
  - [ ] Test task-level time logging
  - [ ] Test clock-in/out workflow
  - [ ] Test overtime calculations
  - [ ] Test approval workflow
  - **Acceptance:** All time tracking features working

- [ ] **Story 6.1.5:** Asset & incident testing
  - [ ] Test asset check-in/out
  - [ ] Test maintenance scheduling
  - [ ] Test incident reporting
  - [ ] Test incident resolution workflow
  - **Acceptance:** Asset and incident features working

- [ ] **Story 6.1.6:** Vehicle logs testing
  - [ ] Test usage authorization
  - [ ] Test odometer tracking
  - [ ] Test fuel logging
  - [ ] Test child passenger compliance
  - **Acceptance:** Vehicle log features working

- [ ] **Story 6.1.7:** Compliance testing
  - [ ] Test document expiry alerts (60d/30d/7d)
  - [ ] Test email notifications
  - [ ] Test SMS notifications (if implemented)
  - [ ] Test auto-escalation
  - **Acceptance:** Compliance alerts working correctly

### Epic 6.2: Integration Testing

**Story Points:** 8  
**Priority:** P0

- [ ] **Story 6.2.1:** End-to-end workflow testing
  - [ ] Test: Document signature → Baserow update
  - [ ] Test: Expense submission → Approval → Budget update
  - [ ] Test: Clock-in → Overtime calculation → Alert
  - [ ] Test: Document expiry → Alert → Renewal
  - **Acceptance:** All integration flows working

- [ ] **Story 6.2.2:** API integration testing
  - [ ] Test DocuSeal API endpoints
  - [ ] Test Baserow API endpoints
  - [ ] Test Azure Functions triggers
  - [ ] Test webhook delivery
  - **Acceptance:** All API integrations stable

### Epic 6.3: Security Testing

**Story Points:** 8  
**Priority:** P0

- [ ] **Story 6.3.1:** Authentication & authorization testing
  - [ ] Test login/logout for all users
  - [ ] Test password reset
  - [ ] Test 2FA for Hans
  - [ ] Test role-based permissions
  - [ ] Attempt unauthorized access
  - **Acceptance:** Security controls working

- [ ] **Story 6.3.2:** Penetration testing
  - [ ] Hire external firm (R5,000-10,000)
  - [ ] Run OWASP Top 10 tests
  - [ ] Test injection vulnerabilities
  - [ ] Test XSS/CSRF protection
  - [ ] Fix all high/critical findings
  - **Acceptance:** Penetration test passed

- [ ] **Story 6.3.3:** Data encryption verification
  - [ ] Verify TLS 1.2+ in transit
  - [ ] Verify AES-256 at rest
  - [ ] Test Key Vault access
  - [ ] Verify secrets not in logs
  - **Acceptance:** Encryption verified

### Epic 6.4: Performance & Load Testing

**Story Points:** 5  
**Priority:** P1

- [ ] **Story 6.4.1:** Load testing
  - [ ] Simulate 10 concurrent users
  - [ ] Test response times under load
  - [ ] Identify bottlenecks
  - [ ] Optimize as needed
  - **Acceptance:** System stable under expected load

- [ ] **Story 6.4.2:** Stress testing
  - [ ] Test with 20+ concurrent users
  - [ ] Identify breaking point
  - [ ] Document scaling thresholds
  - **Acceptance:** Scaling limits documented

### Epic 6.5: Disaster Recovery Testing

**Story Points:** 5  
**Priority:** P0

- [ ] **Story 6.5.1:** Backup restoration test
  - [ ] Simulate database corruption
  - [ ] Restore from automated backup
  - [ ] Verify data integrity
  - [ ] Measure RTO (target: <4 hours)
  - **Acceptance:** Backup restoration successful

- [ ] **Story 6.5.2:** Full DR drill
  - [ ] Simulate complete infrastructure loss
  - [ ] Re-deploy via Terraform
  - [ ] Restore database from backup
  - [ ] Restore blob storage
  - [ ] Measure total recovery time
  - **Acceptance:** Full recovery successful within RTO

---

## Phase 7: Training & Go-Live ⏳ PLANNED

**Priority:** P0 - Critical  
**Duration:** 1-2 weeks  
**Owner:** Hans + Training Lead

### Epic 7.1: User Training

**Story Points:** 8  
**Priority:** P0

- [ ] **Story 7.1.1:** Create training materials
  - [ ] Record video tutorials (10-15 mins each)
    - [ ] Hans: Admin dashboard overview
    - [ ] Charl: Employee dashboard and tasks
    - [ ] Lucky: Mobile app usage
    - [ ] Irma: Resident features
  - [ ] Create user guides (PDF)
  - [ ] Create quick reference cards
  - **Acceptance:** Training materials ready

- [ ] **Story 7.1.2:** Conduct training sessions
  - [ ] Schedule 2-hour training session
  - [ ] Walk through each user's dashboard
  - [ ] Practice common workflows
  - [ ] Answer questions
  - [ ] Provide feedback forms
  - **Acceptance:** All 4 users trained

- [ ] **Story 7.1.3:** Create support documentation
  - [ ] Write FAQ document
  - [ ] Create troubleshooting guide
  - [ ] Document common issues
  - [ ] Set up support email
  - **Acceptance:** Support docs available

### Epic 7.2: User Acceptance Testing (UAT)

**Story Points:** 8  
**Priority:** P0

- [ ] **Story 7.2.1:** UAT with Hans
  - [ ] Test admin dashboard
  - [ ] Test approval workflows
  - [ ] Test financial tracking
  - [ ] Test compliance monitoring
  - [ ] Collect feedback
  - **Acceptance:** Hans signs off

- [ ] **Story 7.2.2:** UAT with Charl
  - [ ] Test task management
  - [ ] Test time logging
  - [ ] Test asset check-out
  - [ ] Test incident reporting
  - [ ] Collect feedback
  - **Acceptance:** Charl signs off

- [ ] **Story 7.2.3:** UAT with Lucky
  - [ ] Test mobile interface
  - [ ] Test expense submission
  - [ ] Test vehicle logs
  - [ ] Test time clock-in/out
  - [ ] Collect feedback
  - **Acceptance:** Lucky signs off

- [ ] **Story 7.2.4:** UAT with Irma
  - [ ] Test household tasks
  - [ ] Test resident agreement access
  - [ ] Test incident reporting
  - [ ] Collect feedback
  - **Acceptance:** Irma signs off

### Epic 7.3: Go-Live Preparation

**Story Points:** 5  
**Priority:** P0

- [ ] **Story 7.3.1:** Final data migration
  - [ ] Export all existing data
  - [ ] Clean and validate data
  - [ ] Import into production
  - [ ] Verify data integrity
  - **Acceptance:** All data migrated successfully

- [ ] **Story 7.3.2:** Go-live checklist
  - [ ] Verify all systems operational
  - [ ] Verify backups working
  - [ ] Verify monitoring active
  - [ ] Verify alerts configured
  - [ ] Schedule 24/7 on-call for first week
  - **Acceptance:** Go-live checklist complete

- [ ] **Story 7.3.3:** Communication plan
  - [ ] Announce go-live date to users
  - [ ] Send reminder emails
  - [ ] Provide support contact info
  - [ ] Set expectations for first week
  - **Acceptance:** Users notified and prepared

### Epic 7.4: Go-Live & Stabilization

**Story Points:** 3  
**Priority:** P0

- [ ] **Story 7.4.1:** Go-live day
  - [ ] Monitor system closely (24hr watch)
  - [ ] Respond to user issues immediately
  - [ ] Log all issues and feedback
  - [ ] Conduct end-of-day review
  - **Acceptance:** First day successful, no critical issues

- [ ] **Story 7.4.2:** First week stabilization
  - [ ] Daily check-ins with users
  - [ ] Fix any issues found
  - [ ] Optimize based on usage patterns
  - [ ] Adjust alerts as needed
  - **Acceptance:** Week 1 complete, system stable

- [ ] **Story 7.4.3:** 30-day review
  - [ ] Collect user feedback
  - [ ] Review success metrics
  - [ ] Identify improvements
  - [ ] Plan future enhancements
  - [ ] Celebrate success!
  - **Acceptance:** 30-day review complete

---

## Ongoing Maintenance (Post Go-Live)

### Epic M.1: Daily Operations

- [ ] Check alerts and logs
- [ ] Verify backups completed
- [ ] Monitor system health
- [ ] Respond to user support requests

### Epic M.2: Weekly Operations

- [ ] Review spending (budget check)
- [ ] Review uptime metrics
- [ ] Review incident logs
- [ ] Check for failed automation jobs

### Epic M.3: Monthly Operations

- [ ] Patch Docker images (DocuSeal, Baserow)
- [ ] Update Terraform providers/modules
- [ ] Test all core workflows post-upgrade
- [ ] Verify all backup exports
- [ ] Review security logs
- [ ] Generate monthly report for Hans

### Epic M.4: Quarterly Operations

- [ ] Rotate secrets (DB passwords, API tokens)
- [ ] Clean up old users/access logs
- [ ] Update SSL certificates
- [ ] Run Docker security scan
- [ ] Azure Security Center review
- [ ] Dependency audit (npm, pip)
- [ ] Review cost optimization opportunities

### Epic M.5: Annual Operations

- [ ] Full disaster recovery test
- [ ] Complete security audit (IAM, NSGs, code, users)
- [ ] Review performance/cost/budget
- [ ] Refactor Terraform code for best practices
- [ ] External penetration test
- [ ] Annual compliance review
- [ ] Strategic planning for next year

---

## Priority Legend

- **P0 - Critical:** Must have for go-live, system won't work without it
- **P1 - High:** Important for usability and user experience
- **P2 - Medium:** Nice to have, improves experience
- **P3 - Low:** Future enhancement, not critical

---

## Story Points Guide

- **1-2:** Simple task, <4 hours
- **3-5:** Medium task, 4-8 hours
- **8:** Complex task, 1-2 days
- **13:** Very complex, 2-3 days
- **21+:** Epic-level work, needs breakdown

---

## Dependencies & Risks

### Critical Dependencies

1. **Azure subscription approval** - Required for Phase 2 start
2. **Domain purchase** - Required for DNS/SSL setup
3. **User availability** - Required for UAT and training
4. **Budget approval** - Required for infrastructure costs

### Key Risks

1. **Cost overrun** - Mitigate with daily monitoring and R800 alert
2. **Data migration issues** - Mitigate with thorough testing in Phase 6
3. **User adoption resistance** - Mitigate with comprehensive training
4. **Security vulnerabilities** - Mitigate with penetration testing
5. **Integration complexity** - Mitigate with thorough Phase 4 testing

---

## Success Criteria

### Phase Completion Criteria

- All stories in phase marked complete
- All acceptance criteria met
- Phase review conducted
- Stakeholder sign-off obtained

### Project Completion Criteria

- All 4 users actively using system daily
- 100% of governance documents digitized
- Zero critical bugs in production
- 99.9% uptime achieved
- Hans' admin time reduced to ≤5 hours/week
- All compliance metrics met

---

## Next Actions

1. **Immediate (Week 1):**
   - Obtain Azure subscription approval
   - Purchase domain name
   - Set up GitHub repository

2. **Short-term (Weeks 2-4):**
   - Complete Terraform infrastructure code
   - Set up CI/CD pipeline
   - Deploy initial infrastructure

3. **Medium-term (Months 2-3):**
   - Deploy DocuSeal and Baserow
   - Configure integrations and automation
   - Begin user testing

4. **Long-term (Months 4-6):**
   - Complete testing and validation
   - Conduct user training
   - Go live and stabilize

---

**Last Updated:** February 2026  
**Document Owner:** Project Manager  
**Review Frequency:** Weekly during active development
