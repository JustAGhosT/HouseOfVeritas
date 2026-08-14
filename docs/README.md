# Documentation Index

## 01-product/ -- Product and Design

| Document                                                                                                            | Description                                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [01-platform-specification.md](01-product/01-platform-specification.md)                                             | Platform vision, personas, core modules, success metrics                                                   |
| [02-functional-design.md](01-product/02-functional-design.md)                                                       | Functional requirements, workflows, user stories for all 8 modules                                         |
| [03-product-requirements.md](01-product/03-product-requirements.md)                                                 | Full PRD with implementation status across all phases                                                      |
| [04-renovation-studio-prd.md](01-product/04-renovation-studio-prd.md)                                               | Renovation Studio module PRD — collaborative planning, AI imaging, voting, costing                         |
| [05-estate-map-prd.md](01-product/05-estate-map-prd.md)                                                             | Estate Map & Spatial Overlay module PRD — interactive map, overlays, quick actions                         |
| [06-collaborative-kitchen-prd.md](01-product/06-collaborative-kitchen-prd.md)                                       | Collaborative Kitchen PRD — meal planner, pantry, shelf badges, allergy-safe AI recipes                    |
| [07-maintenance-smart-issue-prd.md](01-product/07-maintenance-smart-issue-prd.md)                                   | Maintenance & Smart Issue Reporting PRD — map-based reporting, triage, SLA, audit                          |
| [08-energy-sustainability-prd.md](01-product/08-energy-sustainability-prd.md)                                       | Energy, Water & Sustainability PRD — GreenPulse, nudges, challenges, utility tracking                      |
| [09-equipment-tool-loan-prd.md](01-product/09-equipment-tool-loan-prd.md)                                           | Equipment, Tool & Loan Library PRD — VeritasVault, scan checkout, gamification                             |
| [10-smart-cleaning-chore-prd.md](01-product/10-smart-cleaning-chore-prd.md)                                         | Smart Cleaning & Chore Scheduler PRD — Harmony, rotation, swap, hero projects                              |
| [11-gamification-kudos-prd.md](01-product/11-gamification-kudos-prd.md)                                             | Gamified Engagement & Recognition PRD — Kudos & Heroics Engine, points, badges                             |
| [12-document-compliance-prd.md](01-product/12-document-compliance-prd.md)                                           | Document Locker & Compliance Portal PRD — Compliance Vault, e-sign, audit                                  |
| [13-ai-suggestion-engine-prd.md](01-product/13-ai-suggestion-engine-prd.md)                                         | AI/Smart Suggestion Engine PRD — Insight & Nudge Engine, explainable AI                                    |
| [14-financial-expense-management-prd.md](01-product/14-financial-expense-management-prd.md)                         | Financial/Expense Management PRD — Finance & Shared Spend Engine, receipts, approvals, audit               |
| [15-health-safety-wellness-prd.md](01-product/15-health-safety-wellness-prd.md)                                     | Health, Safety & Wellness Logbook PRD — Safety Central, incident, audit, first-aider                       |
| [16-advanced-analytics-insight-prd.md](01-product/16-advanced-analytics-insight-prd.md)                             | Advanced Analytics & Insight Engine PRD — Insight Central, KPIs, dashboards, export                        |
| [17-integration-marketplace-connectors-prd.md](01-product/17-integration-marketplace-connectors-prd.md)             | Integration Marketplace & External Connectors PRD — Connect Hub, sync, audit, partner                      |
| [18-mobile-app-offline-prd.md](01-product/18-mobile-app-offline-prd.md)                                             | Mobile App & Offline Module Launch PRD — Mobile+ Anywhere, offline-first, queue, sync                      |
| [19-resident-profile-identity-prd.md](01-product/19-resident-profile-identity-prd.md)                               | Resident Profile & Identity Hub PRD — MyResidence Profile, SSO, skills, audit                              |
| [20-maintenance-asset-lifecycle-depreciation-prd.md](01-product/20-maintenance-asset-lifecycle-depreciation-prd.md) | Maintenance/Asset Lifecycle & Depreciation PRD — VeritasVault Asset 360, lifecycle, depreciation, audit    |
| [21-estate-marketplace-service-directory-prd.md](01-product/21-estate-marketplace-service-directory-prd.md)         | Estate Marketplace & Service Directory PRD — VeritasVault Connect & Offerings, marketplace, booking, audit |
| [22-multi-estate-portfolio-management-prd.md](01-product/22-multi-estate-portfolio-management-prd.md)               | Multi-Estate/Portfolio Management PRD — VeritasVault Portfolio Central, SSO, audit, export                 |
| [23-estate-survey-feedback-engine-prd.md](01-product/23-estate-survey-feedback-engine-prd.md)                       | Estate Survey & Feedback Engine PRD — VeritasVault Voice & Pulse, survey, feedback, analytics              |
| [24-long-term-capital-project-planner-prd.md](01-product/24-long-term-capital-project-planner-prd.md)               | Long-Term Capital Project Planner PRD — VeritasVault CapEx Roadmap, Gantt, budget, audit                   |

## 02-architecture/ -- Technical Architecture

| Document                                                                                         | Description                                                                                      |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [01-technical-design.md](02-architecture/01-technical-design.md)                                 | System architecture, data models, API design, security model                                     |
| [02-naming-convention.md](02-architecture/02-naming-convention.md)                               | Azure resource naming convention (`{prefix}-{env}-{project}-{type}-{region}`)                    |
| [03-infrastructure.md](02-architecture/03-infrastructure.md)                                     | Terraform module map, Azure resource inventory, traffic flow, cost estimate                      |
| [04-api-versioning.md](02-architecture/04-api-versioning.md)                                     | API versioning strategy                                                                          |
| [05-persistence-strategy-adr.md](02-architecture/05-persistence-strategy-adr.md)                 | ADR: Persistence strategy, polyglot stores, weighted decision matrices                           |
| [06-access-control-adr.md](02-architecture/06-access-control-adr.md)                             | ADR: Access control model — roles, responsibilities, project membership, task visibility         |
| [07-ai-integration-adr.md](02-architecture/07-ai-integration-adr.md)                             | ADR: AI integration strategy — Azure Foundry, suggestion APIs, fallback behavior                 |
| [08-testing-strategy-adr.md](02-architecture/08-testing-strategy-adr.md)                         | ADR: Testing strategy — Vitest, Playwright, coverage targets, CI integration                     |
| [09-workflow-orchestration-adr.md](02-architecture/09-workflow-orchestration-adr.md)             | ADR: Workflow orchestration — Inngest, workflow layer, n8n roadmap, weighted decision matrix     |
| [10-workflow-specifications.md](02-architecture/10-workflow-specifications.md)                   | Full workflow catalog — employee, asset, incident, safety, payroll, n8n rules                    |
| [11-operations-swimlane-process-maps.md](02-architecture/11-operations-swimlane-process-maps.md) | Operations swimlane process maps — onboarding, daily ops, assets, incidents, financial workflows |

## 03-deployment/ -- Deployment and Operations

| Document                                                                                           | Description                                                                               |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [01-deployment-guide.md](03-deployment/01-deployment-guide.md)                                     | End-to-end Azure deployment: auth, Terraform, DNS, SSL, integrations, secrets             |
| [02-local-development.md](03-deployment/02-local-development.md)                                   | Docker Compose setup, prerequisites, local vs production comparison                       |
| [03-ci-cd-workflows.md](03-deployment/03-ci-cd-workflows.md)                                       | GitHub Actions workflows: plan, apply, deploy, destroy, checklist                         |
| [04-rollback-procedure.md](03-deployment/04-rollback-procedure.md)                                 | Rollback procedure for Next.js, Functions, Terraform, containers                          |
| [05-terraform-firewall-troubleshooting.md](03-deployment/05-terraform-firewall-troubleshooting.md) | Key Vault/Storage 403, container IP type, consumption budget, self-hosted runner          |
| [07-self-hosted-runner-setup.md](03-deployment/07-self-hosted-runner-setup.md)                     | _Historical:_ self-hosted runner setup (no longer in use — workflows use `ubuntu-latest`) |

_Note: 06 reserved for future deployment documentation._

## 04-configuration/ -- Application Configuration

| Document                                                              | Description                                                             |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [01-docuseal-setup.md](04-configuration/01-docuseal-setup.md)         | DocuSeal initial setup, SMTP, branding, templates, webhooks, API        |
| [02-baserow-setup.md](04-configuration/02-baserow-setup.md)           | Baserow database schema (8 tables), views per user, API configuration   |
| [03-azure-functions.md](04-configuration/03-azure-functions.md)       | Azure Functions: 8 functions for webhooks, scheduling, backups          |
| [04-document-templates.md](04-configuration/04-document-templates.md) | 19 governance document templates with fields and signing workflows      |
| [05-persistence-env.md](04-configuration/05-persistence-env.md)       | Persistence env vars: PostgreSQL, Redis, MongoDB, Baserow, file uploads |
| [06-integration-stubs.md](04-configuration/06-integration-stubs.md)   | Bank API and Insurance portal integration stubs, env vars, setup        |

## 05-project/ -- Project Management

| Document                                                                          | Description                                                                 |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [01-backlog.md](05-project/01-backlog.md)                                         | Implementation backlog with phases 1-7 and task tracking                    |
| [02-roadmap.md](05-project/02-roadmap.md)                                         | Future enhancements roadmap: mobile, analytics, AI, integrations            |
| [03-test-report.md](05-project/03-test-report.md)                                 | Phase 7 testing and UAT report                                              |
| [04-changelog.md](05-project/04-changelog.md)                                     | Version history and release notes                                           |
| [05-contributing.md](05-project/05-contributing.md)                               | Branch strategy, commit conventions, code style, PR process                 |
| [ai-integration-opportunities.md](05-project/ai-integration-opportunities.md)     | AI suggestion APIs, implemented features, configuration                     |
| [2026-08-01-investor-pitch-deck.md](05-project/2026-08-01-investor-pitch-deck.md) | Evidence-disciplined investor deck source and forward-looking pilot targets |
| [2026-08-01-investor-video-plan.md](05-project/2026-08-01-investor-video-plan.md) | Scene-by-scene investor film production, rights, and claims-safety plan     |
| [recipe-guidance-document-plan.md](05-project/recipe-guidance-document-plan.md)   | Section-by-section bilingual recipe guidance and Sluice-routed image plan   |
| [onboarding-flow.md](05-project/onboarding-flow.md)                               | User onboarding steps, invite flow, guided tour                             |
| [employees-vs-users.md](05-project/employees-vs-users.md)                         | Users (auth) vs Employees (Baserow), Team page consolidation                |

## specs/ -- Feature Specifications

Per-feature specs, compliance boundaries, and content rubrics.

| Document                                                                                                   | Description                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [knowledge-base-process-rubric.md](specs/knowledge-base-process-rubric.md)                                 | Which processes the knowledge base carries — publication safeguards, priority rubric, quality rubric |
| [property-deal-radar.md](specs/property-deal-radar.md)                                                     | Property Deal Radar feature spec (HOV public module)                                                 |
| [property-deal-radar-canonicalkey-spike.md](specs/property-deal-radar-canonicalkey-spike.md)               | `canonicalKey` dedupe spike findings (Radar 2)                                                       |
| [property-deal-radar-compliance.md](specs/property-deal-radar-compliance.md)                               | Compliance & attribution page content                                                                |
| [property-deal-radar-ingestion-compliance-spec.md](specs/property-deal-radar-ingestion-compliance-spec.md) | Ingestion robots.txt and rate-limit adherence spec                                                   |
| [property-deal-radar-killswitch-popia.md](specs/property-deal-radar-killswitch-popia.md)                   | Kill-switch (`RADAR_ENABLED`) and POPIA boundary note                                                |
| [property-deal-radar-legal-signoff.md](specs/property-deal-radar-legal-signoff.md)                         | Legal sign-off checklist and residual-risk memo                                                      |

## handoffs/ -- Session Handoffs

Dated session continuity notes (root cause, files changed, verification, next-owner steps).

| Document                                                                                                                        | Description                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [2026-07-11-mystira-oidc-prod-login-fix.md](handoffs/2026-07-11-mystira-oidc-prod-login-fix.md)                                 | Production login `/api/auth/error` fix — Mystira OIDC app settings + AUTH_TRUST_HOST             |
| [2026-07-20-prod-telemetry-project-store.md](handoffs/2026-07-20-prod-telemetry-project-store.md)                               | Production telemetry and project datastore remediation handoff                                   |
| [2026-07-22-project-datastore-ai-hardening.md](handoffs/2026-07-22-project-datastore-ai-hardening.md)                           | Project datastore API and AI project suggestion hardening closeout                               |
| [2026-07-27-gate0-production-auth-probes-prepared.md](handoffs/2026-07-27-gate0-production-auth-probes-prepared.md)             | Secure operator boundary for legitimate production Gate 0 acceptance probes                      |
| [2026-07-28-recipe-guidance-phase1-contracts.md](handoffs/2026-07-28-recipe-guidance-phase1-contracts.md)                       | Recipe guidance Phase 1 typed document and media contracts                                       |
| [2026-07-29-recipe-guidance-persistence.md](handoffs/2026-07-29-recipe-guidance-persistence.md)                                 | Dedicated recipe guidance repository and safe migration boundary                                 |
| [2026-07-29-recipe-guidance-builder-api.md](handoffs/2026-07-29-recipe-guidance-builder-api.md)                                 | Deterministic recipe draft builder and bounded preview/read APIs                                 |
| [2026-07-29-recipe-guidance-authoring-api.md](handoffs/2026-07-29-recipe-guidance-authoring-api.md)                             | Explicit recipe draft creation and optimistic reviewed-section updates                           |
| [2026-07-29-recipe-guidance-lifecycle.md](handoffs/2026-07-29-recipe-guidance-lifecycle.md)                                     | Review transitions, readiness evidence, publication, and immutable archival                      |
| [2026-07-31-recipe-guidance-ui.md](handoffs/2026-07-31-recipe-guidance-ui.md)                                                   | Hans review workspace and Irma mobile published-guidance reader                                  |
| [2026-07-31-recipe-guidance-media-intake.md](handoffs/2026-07-31-recipe-guidance-media-intake.md)                               | Authenticated recipe media intake and deterministic section planning                             |
| [2026-07-31-recipe-guidance-brief-approval.md](handoffs/2026-07-31-recipe-guidance-brief-approval.md)                           | Human image-brief review and disabled provider-neutral request contract                          |
| [2026-07-31-sluice-image-generation-capability.md](handoffs/2026-07-31-sluice-image-generation-capability.md)                   | Sluice image-generation capability audit and fail-closed go/no-go decision                       |
| [2026-07-28-user-selectable-themes.md](handoffs/2026-07-28-user-selectable-themes.md)                                           | User-selectable workspace themes implementation, review, and merge handoff                       |
| [2026-08-02-hov-native-auth-domain.md](handoffs/2026-08-02-hov-native-auth-domain.md)                                           | Hosting Mystira Identity authorization on the HOV domain                                         |
| [2026-08-03-hov-mystira-oidc-secret-drift.md](handoffs/2026-08-03-hov-mystira-oidc-secret-drift.md)                             | Production OIDC client-secret drift repair and deployment reconciliation guard                   |
| [2026-08-06-governance-503-observability-evidence-gates.md](handoffs/2026-08-06-governance-503-observability-evidence-gates.md) | Gate governance 500→503 fix, Azure Monitor log bridge, and the blocked evidence gates            |
| [2026-08-07-knowledge-publication-safeguards.md](handoffs/2026-08-07-knowledge-publication-safeguards.md)                       | Knowledge-base publication safeguards — rubric, admin control plane, enforcement at load and use |
| [2026-08-14-recipe-bolognese-go-live.md](handoffs/2026-08-14-recipe-bolognese-go-live.md)                                       | Household catalog recipes (bolognese, skillet, rice pot, bakes, pasta, rice bowls)                |
