# Azure Deployment Plan

> **Status:** Ready for Validation

Generated: 2026-07-17

---

## 1. Project Overview

**Goal:** Prepare Radar 6 monitoring for the Property Deal Radar MVP: ingestion health telemetry, zero-row/quarantine/source-shape alert rules, enable-flag governance for private MVP validation, and Docket-aligned evidence capture.

**Path:** Add Components

---

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | Production MVP, private/single-user validation |
| Scale | Small |
| Budget | Cost-Optimized |
| Subscription | Existing HOV Azure subscription already used by Terraform |
| Location | southafricanorth |
| Compliance | MVP sign-off only for Jurie/private use; broader public usage requires renewed legal/compliance sign-off |
| Docket Alignment | `https://docket.phoenixvc.tech` is the canonical Docket host for operational evidence. Live discovery on 2026-07-18 found OpenAPI at `/openapi.json`, Swagger UI at `/docs`, and health at `/health`. There is no assumed separate `DOCKET_BASE_URL` or ticket API in HOV until an authenticated write contract is selected. |

---

## 3. Components Detected

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| web | SSR Web App/API | Next.js 16 / TypeScript | `app/`, `lib/` |
| functions | Scheduled worker | Python Azure Functions | `config/azure-functions/` |
| infrastructure | IaC | Terraform | `terraform/` |
| monitoring | Existing module | Azure Monitor / Log Analytics | `terraform/modules/monitoring/` |
| docket | External evidence/ops system | FastAPI / Uvicorn | `https://docket.phoenixvc.tech` |

---

## 4. Recipe Selection

**Selected:** Terraform

**Rationale:** The repository already owns Azure production resources through Terraform modules and environment files. Radar 6 should extend the existing monitoring module rather than introduce a new deployment system.

---

## 5. Architecture

**Stack:** Serverless + App Service + Azure Monitor

### Service Mapping

| Component | Azure Service | SKU |
|-----------|---------------|-----|
| DealRadarRefresh telemetry | Azure Functions logs / traces | Existing Function App |
| Radar API telemetry | App Service logs / traces | Existing Web App |
| Radar alert rules | Azure Monitor scheduled query rules | Existing Log Analytics workspace |
| Alert delivery | Azure Monitor action group | Existing monitoring action group |
| MVP evidence record | Docket action/operations surface | Existing Docket host |

### Supporting Services

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized function/web logs queried by scheduled rules |
| Application Insights | Runtime telemetry source for traces and exceptions |
| Key Vault | Existing secret governance for runtime config |
| Managed Identity | Existing service-to-service auth posture |

### Docket Contract

Live Docket API discovery:

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `GET /health` | Runtime health | Public JSON: `{"status":"ok","backend":"table"}` |
| `GET /openapi.json` | API contract | Public OpenAPI document titled `Cost Centre Adoption API` |
| `GET /docs` | Swagger UI | Public API explorer |
| `GET /action-log` | Unified action log | Authenticated; candidate read path for Radar monitoring/enable evidence |
| `GET /resource-actions/pending` | Pending resource actions | Authenticated; candidate governance queue |
| `POST /resource-actions/approve` and `/reject` | Decision recording | Authenticated; only suitable if Radar enablement is represented as a resource action |
| `POST /api/azure-ops/workflows/run` | Run predefined workflow | Authenticated, dry-run default; do not call for Radar until a named workflow exists |

Radar 6 will align with Docket by documenting Radar enable/monitoring evidence in Docket-compatible terms and leaving a small adapter seam for the verified host. It will not invent or populate stale `DOCKET_BASE_URL` values, and it will not call destructive Docket resource-action endpoints in this PR.

---

## 6. Provisioning Limit Checklist

This slice adds lightweight Azure Monitor alert-rule definitions only. It does not add compute, networking, storage, databases, public IPs, or container capacity.

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| Microsoft.Insights/scheduledQueryRules | 4 | Existing + 4 | Azure Monitor rule limit, no regional compute quota impact | Uses existing Log Analytics workspace and action group |
| Microsoft.Insights/actionGroups | 0 | Existing | No change | Reuse existing module action group |
| Microsoft.OperationalInsights/workspaces | 0 | Existing | No change | Reuse existing workspace |

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

| Check | Command Run | Result | Timestamp |
|-------|-------------|--------|-----------|
| Pending | Pending | Pending | Pending |

---

## 9. Files to Generate

| File | Purpose | Status |
|------|---------|--------|
| `.azure/plan.md` | Radar 6 Azure preparation plan | Complete |
| `config/azure-functions/shared/radar_ingestion.py` | Radar telemetry emission | Planned |
| `terraform/modules/monitoring/*` | Radar alert rules | Planned |
| `terraform/environments/production/*` | Monitoring module wiring | Planned |
| `docs/03-deployment/08-property-deal-radar-monitoring.md` | Enablement/monitoring runbook updates | Added |
| Docket alignment note/runbook section | Evidence and decision handoff via verified Docket host/API contract | Added |

---

## 10. Next Steps

Current: execution after approval.

1. Inspect current function logging and Terraform monitoring module.
2. Add deterministic Radar telemetry events and scheduled query alert definitions.
3. Add Docket-aligned evidence/runbook notes using `https://docket.phoenixvc.tech` and the verified `/openapi.json` surface.
4. Validate locally without deployment.
