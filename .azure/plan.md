# Azure Deployment Plan

> **Status:** Validated

Generated: 2026-07-17

---

## 1. Project Overview

**Goal:** Prepare Radar 6 monitoring for the Property Deal Radar MVP: ingestion health telemetry, zero-row/quarantine/source-shape alert rules, enable-flag governance for private MVP validation, and Docket-aligned evidence capture.

**Path:** Add Components

---

## 2. Requirements

| Attribute        | Value                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classification   | Production MVP, private/single-user validation                                                                                                                                                                                                                                                                               |
| Scale            | Small                                                                                                                                                                                                                                                                                                                        |
| Budget           | Cost-Optimized                                                                                                                                                                                                                                                                                                               |
| Subscription     | Existing HOV Azure subscription already used by Terraform                                                                                                                                                                                                                                                                    |
| Location         | southafricanorth                                                                                                                                                                                                                                                                                                             |
| Compliance       | MVP sign-off only for Jurie/private use; broader public usage requires renewed legal/compliance sign-off                                                                                                                                                                                                                     |
| Docket Alignment | `https://docket.phoenixvc.tech` is the canonical Docket host for operational evidence. Live discovery on 2026-07-18 found OpenAPI at `/openapi.json`, Swagger UI at `/docs`, and health at `/health`. There is no assumed separate `DOCKET_BASE_URL` or ticket API in HOV until an authenticated write contract is selected. |

---

## 3. Components Detected

| Component      | Type                         | Technology                    | Path                            |
| -------------- | ---------------------------- | ----------------------------- | ------------------------------- |
| web            | SSR Web App/API              | Next.js 16 / TypeScript       | `app/`, `lib/`                  |
| functions      | Scheduled worker             | Python Azure Functions        | `config/azure-functions/`       |
| infrastructure | IaC                          | Terraform                     | `terraform/`                    |
| monitoring     | Existing module              | Azure Monitor / Log Analytics | `terraform/modules/monitoring/` |
| docket         | External evidence/ops system | FastAPI / Uvicorn             | `https://docket.phoenixvc.tech` |

---

## 4. Recipe Selection

**Selected:** Terraform

**Rationale:** The repository already owns Azure production resources through Terraform modules and environment files. Radar 6 should extend the existing monitoring module rather than introduce a new deployment system.

---

## 5. Architecture

**Stack:** Serverless + App Service + Azure Monitor

### Service Mapping

| Component                  | Azure Service                       | SKU                              |
| -------------------------- | ----------------------------------- | -------------------------------- |
| DealRadarRefresh telemetry | Azure Functions logs / traces       | Existing Function App            |
| Radar API telemetry        | App Service logs / traces           | Existing Web App                 |
| Radar alert rules          | Azure Monitor scheduled query rules | Existing Log Analytics workspace |
| Alert delivery             | Azure Monitor action group          | Existing monitoring action group |
| MVP evidence record        | Docket action/operations surface    | Existing Docket host             |

### Supporting Services

| Service              | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| Log Analytics        | Centralized function/web logs queried by scheduled rules |
| Application Insights | Runtime telemetry source for traces and exceptions       |
| Key Vault            | Existing secret governance for runtime config            |
| Managed Identity     | Existing service-to-service auth posture                 |

### Docket Contract

Live Docket API discovery:

| Endpoint                                       | Purpose                  | Notes                                                                                |
| ---------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| `GET /health`                                  | Runtime health           | Public JSON: `{"status":"ok","backend":"table"}`                                     |
| `GET /openapi.json`                            | API contract             | Public OpenAPI document titled `Cost Centre Adoption API`                            |
| `GET /docs`                                    | Swagger UI               | Public API explorer                                                                  |
| `GET /action-log`                              | Unified action log       | Authenticated; candidate read path for Radar monitoring/enable evidence              |
| `GET /resource-actions/pending`                | Pending resource actions | Authenticated; candidate governance queue                                            |
| `POST /resource-actions/approve` and `/reject` | Decision recording       | Authenticated; only suitable if Radar enablement is represented as a resource action |
| `POST /api/azure-ops/workflows/run`            | Run predefined workflow  | Authenticated, dry-run default; do not call for Radar until a named workflow exists  |

Radar 6 will align with Docket by documenting Radar enable/monitoring evidence in Docket-compatible terms and leaving a small adapter seam for the verified host. It will not invent or populate stale `DOCKET_BASE_URL` values, and it will not call destructive Docket resource-action endpoints in this PR.

---

## 6. Provisioning Limit Checklist

This slice adds lightweight Azure Monitor alert-rule definitions only. It does not add compute, networking, storage, databases, public IPs, or container capacity.

| Resource Type                            | Number to Deploy | Total After Deployment | Limit/Quota                                                | Notes                                                  |
| ---------------------------------------- | ---------------- | ---------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Microsoft.Insights/scheduledQueryRules   | 4                | Existing + 4           | Azure Monitor rule limit, no regional compute quota impact | Uses existing Log Analytics workspace and action group |
| Microsoft.Insights/actionGroups          | 0                | Existing               | No change                                                  | Reuse existing module action group                     |
| Microsoft.OperationalInsights/workspaces | 0                | Existing               | No change                                                  | Reuse existing workspace                               |

**Status:** All planned changes have no compute/network/storage quota impact.

---

## 7. Execution Checklist

### Phase 1: Planning

- [x] Analyze workspace
- [x] Gather requirements from current Radar MVP decision
- [x] Confirm subscription and location from existing production Terraform context
- [x] Prepare resource inventory
- [x] Confirm no compute/network/storage quota impact
- [x] Scan codebase
- [x] Select recipe
- [x] Plan architecture
- [x] User approved this plan with "lets go for 6"

### Phase 2: Execution

- [x] Add Radar ingestion telemetry contract
- [x] Add Radar monitoring Terraform variables/resources
- [x] Add enable-governance documentation/config checks aligned with Docket evidence/decision terminology
- [x] Add Docket host/API discovery notes and adapter guardrails without requiring runtime Docket writes
- [x] Add focused tests
- [x] Update plan status to "Ready for Validation"

### Phase 3: Validation

- [ ] Validate Terraform formatting/config
- [ ] Run relevant Python and TypeScript tests
- [ ] Run lint/build where affected

### Phase 4: Deployment

- [ ] Not in scope for this PR

---

## 8. Validation Proof

| Check   | Command Run | Result  | Timestamp |
| ------- | ----------- | ------- | --------- |
| Pending | Pending     | Pending | Pending   |

---

## 9. Files to Generate

| File                                                      | Purpose                                                             | Status   |
| --------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| `.azure/plan.md`                                          | Radar 6 Azure preparation plan                                      | Complete |
| `config/azure-functions/shared/radar_ingestion.py`        | Radar telemetry emission                                            | Planned  |
| `terraform/modules/monitoring/*`                          | Radar alert rules                                                   | Planned  |
| `terraform/environments/production/*`                     | Monitoring module wiring                                            | Planned  |
| `docs/03-deployment/08-property-deal-radar-monitoring.md` | Enablement/monitoring runbook updates                               | Added    |
| Docket alignment note/runbook section                     | Evidence and decision handoff via verified Docket host/API contract | Added    |

---

## 10. Next Steps

Current: execution after approval.

1. Inspect current function logging and Terraform monitoring module.
2. Add deterministic Radar telemetry events and scheduled query alert definitions.
3. Add Docket-aligned evidence/runbook notes using `https://docket.phoenixvc.tech` and the verified `/openapi.json` surface.
4. Validate locally without deployment.

---

## 11. Production Remediation: Web Telemetry, Project Persistence, Clean Defaults

> **Status:** Ready for Validation

Added: 2026-07-20

### Goal

Fix three production gaps verified after the OIDC Terraform apply:

- HOV web app has no Application Insights resource or App Insights app setting.
- Project APIs write to `data/projects.json` inside the deployed app package, so project creation is not durable in Azure App Service.
- Visible project/task defaults still include sample values even when `ALLOW_DEMO_DATA` is not enabled.

### Scope

| Area                 | Decision                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web telemetry        | Add Terraform-managed Application Insights for `nl-prod-hov-app` and wire `APPLICATIONINSIGHTS_CONNECTION_STRING` / role name into App Service settings. |
| Node instrumentation | Initialize Azure Monitor from `instrumentation.ts` when the connection string exists.                                                                    |
| Project persistence  | Use the existing production `AZURE_STORAGE_CONNECTION_STRING` to store project JSON in Blob Storage, with local file fallback for dev/tests.             |
| Dummy data           | Remove visible project/task seed defaults from production paths; keep explicit demo data behind `ALLOW_DEMO_DATA=true`.                                  |
| Deployment           | Prepare and validate in PR first; production apply/deploy remains a separate controlled action after merge.                                              |

### Validation

- Run `pnpm run lint`.
- Run focused API tests for projects/tasks.
- Run `pnpm run build`.
- Run `terraform fmt -recursive` and `terraform -chdir=terraform/environments/production validate`.

---

## 12. O6 restricted evidence store before live PIRB integration

> **Status:** Ready for Validation - deployment remains prohibited

Added: 2026-07-26

### 12.1 Project overview

**Goal:** Prepare, but do not deploy, a dedicated Azure Blob restricted store
for later O6-approved reviewer identity, credential, consent, contract, and
verification evidence. The store must remain disconnected from the HOV general
application datastore and unavailable until named human owners and authorized
researcher Microsoft Entra object IDs are supplied.

**Path:** Add components to the existing production Terraform stack (MODIFY).

**Non-goals:** Terraform apply, Azure resource creation, candidate collection,
PIRB registry calls, public access, shared-key access, application runtime
access, O5/O6 activation, or Gate progression.

### 12.2 Requirements

| Attribute           | Value                                                                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classification      | Production security/privacy prerequisite; no live data during preparation                                                                                                                           |
| Scale               | Small: one restricted container and a small named research group                                                                                                                                    |
| Budget              | Cost-optimized without weakening encryption, audit, deletion, or private networking                                                                                                                 |
| Subscription        | Confirmed: `Azure subscription 1` (`bb4e3882-2079-4bab-8974-611bc0b8bb58`)                                                                                                                          |
| Location            | Confirmed: `southafricanorth`, matching the canonical HOV stack                                                                                                                                     |
| Data residency      | South Africa North unless the privacy reviewer approves a different location                                                                                                                        |
| Compliance boundary | POPIA-oriented operating controls, not a claim of legal compliance                                                                                                                                  |
| Activation inputs   | Responsible-party ID, privacy-reviewer ID, research-owner ID, authorized-researcher Entra object IDs, deletion/correction-owner ID, incident-owner ID, retention deadline, and approved access path |

### 12.3 Components detected

| Component                  | Type                                 | Technology                                          | Path                                    |
| -------------------------- | ------------------------------------ | --------------------------------------------------- | --------------------------------------- |
| Web/API                    | SSR application                      | Next.js 16 / TypeScript                             | `app/`, `lib/`                          |
| Production infrastructure  | IaC                                  | Terraform / AzureRM 4.x                             | `terraform/environments/production/`    |
| Shared application storage | Existing Azure Blob module           | Terraform                                           | `terraform/modules/storage/`            |
| Restricted store           | New opt-in module                    | Azure Blob, Private Link, Entra RBAC, Azure Monitor | `terraform/modules/restricted-storage/` |
| Privacy operations         | Activation/deletion/incident runbook | Markdown                                            | `docs/03-deployment/`                   |

Live inspection found only `nlprodhovst` in the HOV resource group. It has
public networking enabled, firewall default `Allow`, blob public access
allowed, and shared-key access allowed, so it is not eligible for O6 restricted
evidence and will not be repurposed by this plan.

### 12.4 Recipe selection

**Selected:** Existing pure Terraform workflow.

**Rationale:** The repository already owns its production Azure topology through
Terraform modules and a remote AzureRM backend. Introducing AZD or an imperative
deployment path would create a second authority. This change adds one isolated,
disabled-by-default module to the existing stack.

### 12.5 Architecture

| Component                     | Azure service / SKU                                           | Planned control                                                                                            |
| ----------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Restricted evidence account   | StorageV2 Standard LRS                                        | HTTPS/TLS 1.2, infrastructure encryption, blob public access disabled, shared keys disabled, OAuth default |
| Restricted evidence container | Private Blob container                                        | No anonymous or organization-wide access; no application connection string                                 |
| Network boundary              | Private Endpoint in existing private-endpoint subnet          | Public network access disabled; Blob private DNS linked to the existing VNet                               |
| Human access                  | Azure RBAC                                                    | `Storage Blob Data Contributor` only for explicitly supplied authorized-researcher Entra object IDs        |
| Retention                     | Blob lifecycle plus versioning and short soft-delete recovery | Owner-approved bounded retention; deletion remains possible and auditable                                  |
| Audit                         | Azure Monitor diagnostic setting                              | Blob read, write, delete, and all-metrics events sent to a dedicated low-volume Log Analytics workspace    |
| Evidence reference            | HOV governance datastore                                      | Pseudonymous candidate ID and minimized evidence reference only; no restricted record content              |

The module will be gated by `enable_restricted_evidence_store = false` by
default. Enabling it without authorized researcher object IDs or a valid bounded
retention period must fail Terraform validation/preconditions. No HOV App
Service or Function managed identity receives data-plane access.

### 12.6 Provisioning limit checklist

Capacity was checked against the detected subscription and proposed region on
2026-07-26. No cells are pending.

| Resource type                                 | Number to deploy               | Total after deployment             | Limit/quota                                    | Evidence                                                                                                   |
| --------------------------------------------- | ------------------------------ | ---------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Microsoft.Storage/storageAccounts`           | 1                              | 16                                 | 250 per region                                 | `az quota list` and `az quota usage list` for Microsoft.Storage in South Africa North: usage 15, limit 250 |
| `Microsoft.Network/privateEndpoints`          | 1                              | 2                                  | 65,536 regional quota                          | `az quota list` and `az quota usage list` for Microsoft.Network: usage 1, limit 65,536                     |
| `Microsoft.Network/privateDnsZones`           | 1                              | 2 in HOV RG                        | Service limit, no regional capacity allocation | Live lookup found one HOV private DNS zone; the Blob zone is a lightweight control-plane resource          |
| `Microsoft.OperationalInsights/workspaces`    | 1                              | 1 in HOV RG                        | Service limit, no compute quota allocation     | Live lookup found zero HOV Log Analytics workspaces                                                        |
| Blob container, diagnostic setting, VNet link | 1 each                         | 1 each for this module             | Child/control-plane resources                  | No independent regional compute quota                                                                      |
| Blob data-contributor role assignments        | One per supplied researcher ID | Determined by approved named users | Azure RBAC assignment service limit            | Empty until the owner supplies non-secret Entra object IDs                                                 |

**Capacity status:** All quota-governed resources are comfortably within limits.
The storage account name `nlprodhovrestricted` was available when checked on
2026-07-26; availability must be rechecked immediately before any apply.

### 12.7 Execution checklist

#### Phase 1 - planning

- [x] Analyze existing Azure/Terraform workspace in MODIFY mode.
- [x] Gather requirements from the merged O6 and PIRB provider-boundary docs.
- [x] Scan live Azure storage, networking, DNS, and Log Analytics state.
- [x] Select the existing Terraform recipe.
- [x] Plan the isolated restricted-store architecture.
- [x] Validate proposed-region storage and private-endpoint capacity.
- [x] User confirms subscription `bb4e3882-2079-4bab-8974-611bc0b8bb58`.
- [x] User confirms location `southafricanorth`.
- [x] User approves this plan with `proceed` on 2026-07-26.

#### Phase 2 - execution after approval

- [x] Load Azure Storage and monitoring implementation references.
- [x] Add `terraform/modules/restricted-storage/{main,variables,outputs}.tf`.
- [x] Wire disabled-by-default production variables, module, outputs, and example values.
- [x] Add deterministic Terraform contract tests/policy checks where supported.
- [x] Add the O6 restricted-store activation, access-review, correction/deletion, and incident runbook.
- [x] Keep human role IDs and live values out of Git and Baton.
- [x] Set this plan status to `Ready for Validation` before invoking `azure-validate`.

#### Phase 3 - validation

- [x] Invoke `azure-validate` after preparation status is `Ready for Validation`.
- [x] Run `terraform fmt -recursive -check`.
- [x] Run Terraform initialization/validation without applying changes.
- [x] Prove disabled-default plan shape has no new resources.
- [x] Prove enabled fixture fails without named researchers and bounded retention.
- [x] Run repository lint/tests required by touched files.
- [x] Record validation proof in this plan and the O6 runbook.

#### Phase 4 - deployment

- [ ] Out of scope for this plan and PR.
- [ ] Requires a separate user-approved `azure-deploy` workflow after privacy,
      owner, identity, access-path, cost, and Terraform plan review.

### 12.8 Files to generate

| File                                                    | Purpose                                                                         | Status   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| `.azure/plan.md`                                        | Current preparation authority and approval gate                                 | Complete |
| `terraform/modules/restricted-storage/main.tf`          | Fail-closed storage, network, retention, RBAC, and diagnostics                  | Complete |
| `terraform/modules/restricted-storage/variables.tf`     | Typed activation, identity, retention, network, and tag inputs                  | Complete |
| `terraform/modules/restricted-storage/outputs.tf`       | Non-secret resource IDs/endpoints only                                          | Complete |
| `terraform/modules/restricted-storage/versions.tf`      | Explicit AzureRM and AzAPI provider sources                                     | Complete |
| `terraform/environments/production/main.tf`             | Opt-in module wiring                                                            | Complete |
| `terraform/environments/production/variables.tf`        | Disabled-by-default production inputs                                           | Complete |
| `terraform/environments/production/outputs.tf`          | Optional non-sensitive outputs                                                  | Complete |
| `terraform/environments/production/*.tfvars.example`    | Safe placeholder examples only                                                  | Complete |
| `docs/03-deployment/09-o6-restricted-evidence-store.md` | Human activation, access, retention, deletion, correction, and incident runbook | Complete |

### 12.9 Approval boundary

Approval of this preparation plan authorizes repository changes and validation
only. It does not authorize Terraform apply, Azure RBAC changes, candidate data,
PIRB calls, reviewer outreach, O5/O6 activation, or Gate progression.

### 12.10 Research summary

- AzureRM 4.x supports the required account controls: public networking and
  nested public access disabled, shared keys disabled, OAuth as the default,
  and infrastructure encryption enabled.
- AzureRM normally uses Storage data-plane authorization to provision a Blob
  container. The restricted container will instead use the AzAPI ARM
  control-plane resource so deployment never needs a shared key and does not
  require changing the existing provider's storage authentication behavior.
- The container ARM contract supports explicit `publicAccess = "None"` and
  encryption-scope override denial.
- RBAC assignments will use the built-in `Storage Blob Data Contributor` role
  at the restricted account scope only. Application identities are not inputs.
- Blob diagnostics will use explicit `StorageRead`, `StorageWrite`, and
  `StorageDelete` categories plus `AllMetrics`, sent to the module's dedicated
  Log Analytics workspace.
- Lifecycle deletion will use days since creation, including base blobs,
  versions, and snapshots, so modification cannot silently extend retention.

### 12.11 Validation evidence

Validated on 2026-07-26 without applying or changing any Azure resource:

- `terraform init -backend=false -upgrade`: passed; locked AzAPI `2.11.0`.
- `terraform init -reconfigure -backend-config=backend.hcl`: passed for
  read-only production-state plan inspection.
- `terraform fmt -recursive -check`: passed.
- `terraform validate`: passed without warnings.
- Disabled-default plan: `0` restricted-store resource changes. The broader
  production baseline was `0 to add, 9 to change, 0 to destroy`; those
  unrelated in-place changes must be reconciled before any future apply.
- Enabled synthetic targeted plan: `9 to add, 1 to change, 0 to destroy`; the
  single VNet change is an existing provider/state normalization outside this
  module, so the saved plan is evidence only and must not be applied.
- Empty researcher set: plan rejected with the named-researcher precondition.
- Retention and soft-delete both set to 30 days: plan rejected because soft
  delete must be shorter than evidence retention.
- Restricted-storage contract test: `4 passed`.
- `pnpm run lint`: passed.
- Focused Prettier check: passed.
- Full `pnpm test`: `398 passed`, with two pre-existing Windows CRLF failures
  in `tests/lib/deployment-workflow-contract.test.ts`; this change does not
  touch deployment workflows or that test.
