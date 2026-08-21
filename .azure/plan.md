# HOV to NexaMesh Azure Migration Plan

> **Status:** Ready for Validation

Generated: 2026-08-21

## 1. Project overview

**Goal:** Move House of Veritas from the NeuralLiquid-hosted source boundary into an independently operated NexaMesh production boundary without reusing or repointing source Terraform state.

**Path:** Modify and migrate an existing production Azure application.

**Source boundary:**

- Tenant: `9530cd32-9e33-47f0-9247-ed964730b580`
- Subscription: `Azure subscription 1` (`bb4e3882-2079-4bab-8974-611bc0b8bb58`)
- Resource group: `nl-prod-hov-rg`
- Region: `southafricanorth`
- Shared datastore dependency: `nl-prod-shared-pg` in `nl-prod-shared-rg`

**Target boundary:**

- Tenant: Celladore Systems (`5384ef74-e517-4b22-9472-df990f61e8b5`)
- Subscription: `nexamesh-sub` (`8a5dc70a-bafa-4a04-a281-9b4862a70810`)
- Resource group: `nex-prod-hov-rg`
- Region: `southafricanorth`
- Terraform backend: new target-only backend; never copied or migrated from `production-canonical.terraform.tfstate`

## 2. Requirements

| Attribute              | Value                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Classification         | Production, private-preview estate system                                                                                                                          |
| Scale                  | Small, with room to scale vertically                                                                                                                               |
| Budget                 | Balanced; retain modest runtime SKUs while adding independent restore and private-network controls                                                                 |
| Data residency         | South Africa geography; primary resources in `southafricanorth`                                                                                                    |
| Compliance posture     | POPIA-sensitive household, employee, identity, document, and estate data; controls support compliance but are not a legal-compliance claim                         |
| Availability           | Preserve current service while target is built and verified; no destructive source retirement in the target plan                                                   |
| Compatibility hostname | Preserve `hov.neuralliquid.ai` until target TLS, identity callbacks, data, runtime, and authentic acceptance pass                                                  |
| External services      | NeuralLiquid remains an external intelligence-services provider; NexaMesh shared Baserow/DocuSeal services remain external dependencies unless separately migrated |

## 3. Components detected

| Component                     | Type                                                     | Technology                            | Path or live resource                               |
| ----------------------------- | -------------------------------------------------------- | ------------------------------------- | --------------------------------------------------- |
| Web/API                       | SSR web application                                      | Next.js 16, Node.js 22, TypeScript    | `app/`, `lib/`; source `nl-prod-hov-app`            |
| Scheduled automation          | Worker code, not currently provisioned as a Function App | Python Azure Functions                | `config/azure-functions/`                           |
| Estate datastore              | Relational database                                      | PostgreSQL 16 on shared source server | `nl-prod-shared-pg/houseofveritas`                  |
| Kiosk datastore               | Document database                                        | Cosmos DB Mongo API                   | `nlprodhovcosmos`                                   |
| Object storage                | Blob storage                                             | Azure Storage                         | `nlprodhovst`                                       |
| Secrets and identity settings | Secret store                                             | Azure Key Vault                       | `nl-prod-hov-kv`                                    |
| Monitoring                    | APM                                                      | Application Insights                  | `nl-prod-hov-app-insights`                          |
| Infrastructure                | IaC                                                      | Terraform AzureRM/AzAPI               | `terraform/`                                        |
| Identity provider             | External relying-party registration                      | Mystira OIDC                          | `neuralliquid-hov-web`; coordinated external change |
| DNS                           | Compatibility routing                                    | Cloudflare-managed `neuralliquid.ai`  | `hov.neuralliquid.ai`; separate edge cutover        |

Azure Functions, Radar activation, Application Gateway, operational Baserow/DocuSeal containers, Document Intelligence, and restricted O6 evidence storage are excluded from the initial target because they are not active source-runtime requirements or remain separately approval-gated.

## 4. Recipe selection

**Selected:** Existing pure Terraform workflow, split into new target-only roots and state backends.

**Rationale:** The repository already uses Terraform, but its production root, backend, imports, identity defaults, and workflows are explicitly source-bound. Adding AZD or reconfiguring that state would create a second authority or risk cross-subscription mutation. The migration therefore uses fresh Terraform roots with provider assertions for the exact target tenant and subscription.

## 5. Architecture and sequencing

### 5.1 State boundaries

1. **Bootstrap:** `nex-prod-hov-tfstate-rg`, target-only StorageV2 account, private container, versioning and soft deletion. State key: `hov/prod/bootstrap.tfstate`.
2. **Foundation and data:** `nex-prod-hov-rg`, VNet, private DNS, storage, Key Vault, dedicated PostgreSQL 16 and Cosmos DB. State key: `hov/prod/foundation-data.tfstate`.
3. **Runtime:** Linux App Service plan/app, managed identity, RBAC/data-plane grants, App Insights and Log Analytics. State key: `hov/prod/runtime.tfstate`.
4. **Migration runner:** temporary no-public-IP Linux VM in a dedicated subnet, controlled through Azure Managed Run Command with protected parameters. State key: `hov/prod/migration-runner.tfstate`.
5. **Edge cutover:** custom hostname/TLS and coordinated OIDC/DNS updates. State key: `hov/prod/edge.tfstate`.
6. **Runner teardown and source retirement:** separate future plans only after migration evidence, the observation window and restore proof. They are absent from all initial target plans.

Each root must pin and assert:

- tenant `5384ef74-e517-4b22-9472-df990f61e8b5`;
- subscription `8a5dc70a-bafa-4a04-a281-9b4862a70810`;
- resource group prefix `nex-prod-hov`;
- region `southafricanorth`;
- no source subscription IDs, `nl-prod-*` target names, source imports, destroys, replacements, or cross-product role assignments.

### 5.2 Target service mapping

| Component           | Azure service                                          | Planned configuration                                                                                                                                                     |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web/API             | Linux App Service                                      | B1, Node.js 22, system-assigned identity, TLS 1.2+, FTPS disabled, VNet integration                                                                                       |
| Estate data         | PostgreSQL Flexible Server                             | PostgreSQL 16, `Standard_B2s`, 32 GiB, private delegated subnet, 14-day PITR, geo-backup, deletion protection                                                             |
| Database access     | PostgreSQL roles                                       | Separate server administrator, HOV schema owner, and least-privilege runtime role; application never uses server-admin DSN                                                |
| Kiosk data          | Cosmos DB Mongo API                                    | 400 RU/s, private endpoint, public access disabled; migrate only verified active collections                                                                              |
| Files               | StorageV2                                              | Standard ZRS where available, public blob access and shared-key runtime use disabled, private endpoint, versioning and soft delete                                        |
| Secrets             | Key Vault                                              | RBAC authorization, purge protection, private endpoint, target-tenant identities only, Key Vault references in App Service                                                |
| Monitoring          | Application Insights + Log Analytics                   | Workspace-based APM, target-specific role name, deployment and data-migration telemetry                                                                                   |
| Identity            | App managed identity + external OIDC registration      | Target-tenant principal with minimal Key Vault/Blob rights; issuer, registration, redirect URIs and secret rotated atomically                                             |
| Migration execution | Temporary Linux VM + Managed Run Command               | No public IP or inbound access; system identity has bounded HOV Blob/Key Vault rights; secrets enter only as protected parameters and are never stored in Terraform state |
| DNS/TLS             | App Service managed certificate plus Cloudflare record | Bind and validate target before changing `hov.neuralliquid.ai`; retain source rollback until observation completes                                                        |

### 5.3 Data migration

1. Inventory live PostgreSQL schemas, owners, extensions, tables, row counts, indexes and identity mappings without logging credentials or row contents.
2. Inventory Cosmos databases/collections and Blob containers/object counts; identify whether Baserow remains an active application dependency.
3. Take a source-consistent PostgreSQL backup and independent Blob/Cosmos export appropriate to each active dataset.
4. Execute private data-plane work from the temporary target migration runner. The source PostgreSQL firewall currently allows Azure-service traffic but rejected the operator workstation; source/target credentials are passed only as Managed Run Command protected parameters.
5. Restore PostgreSQL into a disposable target server first. Verify ownership, DATE fidelity, indexes, checksums/counts and application DDL using only the scoped runtime role.
6. Restore the approved target data, deploy runtime on the Azure hostname, and run positive and negative data-plane controls.
7. Establish a write freeze or deterministic delta-reconciliation window for final sync.
8. Preserve source database, runtime and DNS until target restart persistence, authentic acceptance and restore rehearsal pass. Teardown of the migration runner is a separate saved-plan action after its evidence is exported and temporary data is erased.

## 6. Provisioning limit checklist

Live checks were run on 2026-08-21 against `nexamesh-sub` in `southafricanorth`. Required providers are registered. The target currently has no resources in South Africa North.

| Resource type                               |      Deploy |         Total after | Limit or availability                                                                     | Evidence                                                                       |
| ------------------------------------------- | ----------: | ------------------: | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Resource groups                             |           2 | 4 subscription-wide | 980 per subscription                                                                      | Target currently has 2 RGs; Azure Resource Manager service limit               |
| `Microsoft.Storage/storageAccounts`         |           2 |          2 regional | 250; usage 0                                                                              | Live `az quota show/usage show`                                                |
| `Microsoft.Network/virtualNetworks`         |           1 |          1 regional | 1,000; usage 0                                                                            | Live `az quota show/usage show`                                                |
| `Microsoft.Network/networkSecurityGroups`   |           4 |          4 regional | 5,000; usage 0                                                                            | Live `az quota show/usage show`                                                |
| `Microsoft.Network/privateEndpoints`        |           3 |          3 regional | 65,536; usage 0                                                                           | Live `az quota show/usage show`                                                |
| `Microsoft.Web/serverFarms`                 |           1 |          1 regional | B1 Linux available                                                                        | Live `az appservice list-locations` returned South Africa North                |
| `Microsoft.Web/sites`                       |           1 |          1 regional | Available with selected plan                                                              | Same live App Service availability query                                       |
| `Microsoft.DBforPostgreSQL/flexibleServers` |           1 |          1 regional | PostgreSQL 16 and `Standard_B2s` available                                                | Live `az postgres flexible-server list-skus`; zone HA and geo-backup supported |
| `Microsoft.DocumentDB/databaseAccounts`     |           1 |          1 regional | Region available; default account limit 50                                                | Live `az cosmosdb locations list`; Microsoft service limit                     |
| `Microsoft.KeyVault/vaults`                 |           1 |          1 regional | Region available                                                                          | Live provider-location query returned true                                     |
| `Microsoft.Insights/components`             |           1 |          1 regional | Region available                                                                          | Live provider-location query returned true                                     |
| `Microsoft.OperationalInsights/workspaces`  |           1 |          1 regional | Region available                                                                          | Provider registered; no target regional usage                                  |
| `Microsoft.Compute/virtualMachines`         | 1 temporary |          1 regional | `Standard_B2s` listed in South Africa North; regional usage API returned no quota records | Live `az vm list-sizes`; exact plan remains gated on successful allocation     |
| Private DNS zones and links                 |           4 | 4 subscription-wide | Control-plane service limits; no regional capacity allocation                             | Required for PostgreSQL, Blob, Key Vault and Cosmos private endpoints          |

**Capacity status:** All planned resource families and selected SKUs are available with ample quota in South Africa North.

Region evidence: [Azure regions list](https://learn.microsoft.com/azure/reliability/regions-list), [Azure PostgreSQL availability](https://learn.microsoft.com/azure/postgresql/overview), and live subscription/SKU/quota queries recorded above.

## 7. Execution checklist

### Phase 1 - planning

- [x] Reverify PRs #199, #201 and #202, current checks and review threads.
- [x] Confirm source and target tenant/subscription/resource-group boundaries.
- [x] Select `southafricanorth` for South African data residency.
- [x] Register required target resource providers.
- [x] Validate service/SKU availability and regional quotas.
- [x] Scan application, Terraform, data, identity, DNS and workflow coupling.
- [x] Select fresh target-only Terraform roots and state boundaries.
- [x] User approved this exact plan and rollback boundary on 2026-08-21; Codex using the current authenticated Azure Owner session is the deployment operator.

### Phase 2 - preparation

- [x] Create target-only backend/bootstrap Terraform.
- [x] Create foundation/data, runtime and edge roots with target assertions.
- [x] Create the temporary private migration-runner root and a separately gated teardown path.
- [x] Remove source imports and source defaults from every target root.
- [x] Add scoped PostgreSQL owner/runtime role creation and Key Vault reference wiring.
- [x] Add migration inventory, backup, restore, checksum and rollback scripts that never print secrets.
- [x] Add target-only GitHub environment/OIDC workflow; disable pre-plan secret mutation.
- [x] Add exact-plan policy tests rejecting source IDs/imports/destroys/replacements.
- [x] Write and review migration/cutover/rollback runbook.
- [x] Set plan status to `Ready for Validation` only after all preparation is complete.

### Phase 3 - validation

- [x] Invoke `azure-validate` for repository readiness and target-boundary checks.
- [ ] Run Terraform formatting, initialization against the new backend, validation and create-only plan.
- [ ] Confirm exact plan contains no source imports, changes, destroys or replacements.
- [x] Build, lint and test the application and migration tooling.
- [ ] Rehearse independent restore into disposable target infrastructure.
- [ ] Record commands, plan hashes, artifact hashes, row/object counts and rollback proof in Section 8.
- [ ] Set status to `Validated` only after every gate passes.

### Phase 4 - deployment

- [ ] Invoke `azure-deploy`; do not run ad-hoc `terraform apply`.
- [ ] Provision bootstrap, foundation/data, runtime and the temporary migration runner in order.
- [ ] Deploy exact application build to target Azure hostname without DNS cutover.
- [ ] Restore and validate data, managed identity and service data-plane denials.
- [ ] Coordinate OIDC registration, secret, issuer and callback changes atomically.
- [ ] Bind hostname/TLS, then change DNS only after target acceptance.
- [ ] Verify authenticated admin and non-admin flows, durable writes across restart, real SQL positive control, Blob/Cosmos access and observability.
- [ ] Observe target before separately planning source retirement.

## 8. Validation proof

Repository validation is complete, but infrastructure plan and restore evidence remain pending while status is `Ready for Validation`. Do not change status to `Validated` until exact saved-plan hashes and restore-rehearsal results are recorded.

| Check                                            | Command or artifact                                                                   | Result                                                     | Timestamp  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------- |
| Frozen dependency install                        | `pnpm install --frozen-lockfile`                                                      | Passed                                                     | 2026-08-21 |
| Application lint                                 | `pnpm run lint`                                                                       | Passed                                                     | 2026-08-21 |
| TypeScript                                       | `pnpm exec tsc --noEmit`                                                              | Passed                                                     | 2026-08-21 |
| Application tests                                | `pnpm test`                                                                           | 121 files passed, 1 skipped; 1,135 tests passed, 5 skipped | 2026-08-21 |
| Application build                                | `pnpm run build`                                                                      | Passed; 137 pages generated                                | 2026-08-21 |
| Terraform formatting                             | `terraform fmt -check -recursive terraform/migrations/hov-nexamesh`                   | Passed                                                     | 2026-08-21 |
| Terraform static validation                      | `terraform validate -no-color` in all five migration roots                            | Passed                                                     | 2026-08-21 |
| Workflow validation                              | `actionlint .github/workflows/hov-nexamesh-migration.yml`                             | Passed                                                     | 2026-08-21 |
| Migration script parsing                         | PowerShell AST for all `.ps1`; `node --check` for `.mjs`; embedded Bash syntax checks | Passed                                                     | 2026-08-21 |
| Whitespace integrity                             | `git diff --check`                                                                    | Passed                                                     | 2026-08-21 |
| Exact infrastructure plans and restore rehearsal | Saved plans, hashes and disposable restore evidence                                   | Pending                                                    | 2026-08-21 |

## 9. Files to generate

| File or directory                                      | Purpose                                                                | Status   |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | -------- |
| `.azure/plan.md`                                       | Current migration authority and gate record                            | Complete |
| `terraform/migrations/hov-nexamesh/bootstrap/`         | Target-only state backend                                              | Complete |
| `terraform/migrations/hov-nexamesh/foundation-data/`   | Target network, secrets and datastores                                 | Complete |
| `terraform/migrations/hov-nexamesh/runtime/`           | Target App Service, identity and telemetry                             | Complete |
| `terraform/migrations/hov-nexamesh/migration-runner/`  | Temporary private execution environment for data and secret operations | Complete |
| `terraform/migrations/hov-nexamesh/edge/`              | Hostname/TLS/DNS/OIDC cutover                                          | Complete |
| `scripts/migration/hov-nexamesh/`                      | Inventory, backup, restore and verification tooling                    | Complete |
| `docs/03-deployment/hov-nexamesh-migration-runbook.md` | Operator sequencing, rollback and evidence                             | Complete |
| `.github/workflows/hov-nexamesh-migration.yml`         | Target-only plan/apply workflow with environment approval              | Complete |

## 10. Approval boundary

The user approved this exact written plan on 2026-08-21 and designated Codex using the current authenticated Azure Owner session as deployment operator. Approval authorizes preparation and validation, followed by deployment only through the exact saved-plan gate in this document. It does not authorize source deletion; source retirement remains a later exact-plan decision after the observation window.

## 11. Next steps

1. Review and land the isolated target Terraform roots, application support and migration tooling.
2. Generate and review create-only exact plans from the merged commit.
3. Bind production authorization to the saved plan hashes and execute through `azure-deploy`.
