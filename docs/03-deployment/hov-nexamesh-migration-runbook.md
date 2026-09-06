# HOV to NexaMesh migration runbook

Status: preparation tooling only; no apply or cutover is implied by this document.

This runbook moves House of Veritas from the NeuralLiquid source boundary to
the isolated Celladore Systems NexaMesh boundary. It never repoints or migrates
the source Terraform state. Source retirement is explicitly excluded.

## Fixed boundaries

| Boundary | Tenant                                 | Subscription                           | Resource group    |
| -------- | -------------------------------------- | -------------------------------------- | ----------------- |
| Source   | `9530cd32-9e33-47f0-9247-ed964730b580` | `bb4e3882-2079-4bab-8974-611bc0b8bb58` | `nl-prod-hov-rg`  |
| Target   | `5384ef74-e517-4b22-9472-df990f61e8b5` | `8a5dc70a-bafa-4a04-a281-9b4862a70810` | `nex-prod-hov-rg` |

Every script under `scripts/migration/hov-nexamesh/` asserts the relevant
Azure account before doing work. Do not weaken these assertions. Use separate
PowerShell processes for source and target operations so a stale `az account
set` cannot silently cross the boundary.

## Private-network execution gate

The target PostgreSQL, Blob, Cosmos and Key Vault data planes are private-only.
The current operator workstation and GitHub-hosted runners cannot reach them.
Owner access to Azure control plane does not provide a network path and is not
evidence that a restore, secret seed or data-plane probe can run.

Before source backup, rehearsal restore or target secret/data work, provision a
bounded migration runner through a reviewed create-only target plan. The
approved design is an ephemeral target migration VM controlled through Azure
Managed Run Command with all of these controls:

- attached to a dedicated target migration subnet with no public IP or public
  ingress and with private DNS links for PostgreSQL, Blob, Cosmos and Key Vault;
- target-tenant managed identity with only the time-bounded roles needed for
  the selected step (for example, Key Vault Secrets Officer for seed, Storage
  Blob Data Contributor for import, and no subscription Owner role);
- PostgreSQL 16 `psql`, `pg_dump`, `pg_restore`; AzCopy; MongoDB Database Tools;
  Node 22; PowerShell 7; and this exact reviewed script commit;
- encrypted restricted artifact storage mounted or downloaded using managed
  identity, with no dump/archive copied to the operator workstation;
- command/output capture configured to exclude environment values, object
  names, row/document contents, tokens and connection strings;
- outbound access limited to required Azure control/data planes and approved
  external identity endpoints.

The source PostgreSQL firewall currently has only the Azure-services
`0.0.0.0` rule; the operator workstation timed out without executing a query.
Run source inventory/`pg_dump` on the migration VM. Deliver the source DSN and
any target database bootstrap credential only as Managed Run Command
`protectedParameters`. On Linux, Azure exposes both public and protected Run
Command parameters as process-environment values. Protected names must therefore
be the exact environment names the payload consumes, such as
`HOV_SOURCE_DATABASE_URL`; they are never PowerShell named arguments.

Invoke reviewed VM-side PowerShell payloads using
`Invoke-ProtectedMigrationRunCommand.ps1`. It proves the exact target context,
running Linux/no-public-IP VM, system-assigned identity, Ubuntu image reference,
current-boot tooling readiness marker, pinned tool versions and payload SHA-256.
ARM `source.script` is a deterministic Bash wrapper, not raw PowerShell. The
wrapper reconstructs the reviewed payload and a fixed PowerShell launcher under
a mode-700 temporary directory, verifies the payload SHA-256 again inside the
VM, and invokes `pwsh -NoLogo -NoProfile -NonInteractive`.

The launcher maps only validated, allowlisted public environment names into a
PowerShell splat without `eval` or generated expressions. Protected values stay
process-only environment values and are never splatted. Payload stdout/stderr
are captured only in the temporary directory and never returned by Managed Run
Command; the wrapper emits one fixed success/failure sentence, unsets protected
environment names, removes the payload, launcher and captures, and best-effort
removes only its own Azure-agent temporary wrapper. The values are not written
to Terraform/state, command arguments, evidence or response output:

```powershell
pwsh scripts/migration/hov-nexamesh/Invoke-ProtectedMigrationRunCommand.ps1 `
  -VmName <nex-prod-hov-migration-vm> `
  -RunCommandName hov-migration-source-inventory `
  -ScriptPath <reviewed-vm-wrapper.ps1> `
  -ExpectedScriptSha256 <reviewed-wrapper-sha256> `
  -ExpectedCommonSha256 <reviewed-common-sha256> `
  -ExpectedImagePublisher Canonical `
  -ExpectedImageOffer ubuntu-24_04-lts `
  -ExpectedImageSku server `
  -ExpectedImageVersion latest `
  -ExpectedPowerShellVersion 7.6.5 `
  -ExpectedAzureCliVersion 2.89.1 `
  -ExpectedPostgresClientVersion 16.15 `
  -ExpectedNodeVersion v22.23.2 `
  -ExpectedAzCopyVersion 10.32.6 `
  -RequiredCommands mongodump,mongorestore,mongosh `
  -Parameters @{ Operation = 'SourceInventory' } `
  -ProtectedParameterBindings @{ HOV_SOURCE_DATABASE_URL = 'HOV_SOURCE_DATABASE_URL' } `
  -OutputPath "$evidence/source-inventory-run-command.json" `
  -Confirmation RUN-MIGRATION-COMMAND/<nex-prod-hov-migration-vm>/hov-migration-source-inventory
```

The reviewed payload may depend on its sibling `Common.ps1`; the runner verifies
the separately approved digest and stages that file beside the payload. Any
other dependencies must come from the exact reviewed repository artifact
already staged on the VM. The payload's `param()` names must exactly match
public `-Parameters` keys. It must read every secret from the corresponding
protected process-environment name.

Do not put a database administrator password, DSN, OIDC client secret or Cosmos
URI in Terraform variables/state, VM custom data, Run Command public
`parameters`, command text, output Blob, or GitHub secret interpolation. The VM
managed identity performs target Key Vault and Blob operations. A protected
bootstrap database credential is permitted only for the bounded PostgreSQL role
creation/restore step and is cleared immediately afterwards.

Run `Resolve-DnsName`/TCP checks from the runner and retain metadata proving all
target service hostnames resolve to RFC1918 addresses. Target scripts also
enforce this check and fail before touching a data plane when DNS/TCP is wrong.

A temporary public-access/firewall exception is an alternative only under a
separate exact Terraform plan, source/target-specific IP allowlist, explicit
security approval, short expiry, and a verified revert plan. This runbook does
not authorize that exception. Never silently fall back to public endpoints.

The operator workstation and GitHub-hosted runner may perform reviewed
control-plane inventory, build, plan and policy checks. They must not execute
target PostgreSQL restore/probes, Key Vault data-plane writes, Blob/Cosmos
imports, or private-endpoint validation.

## Secret and evidence handling

- Supply PostgreSQL values through process-only `HOV_SOURCE_PG*` or
  `HOV_TARGET_PG*` variables. Required suffixes are `PGHOST`, `PGDATABASE`,
  `PGUSER`, and `PGPASSWORD`; `PGPORT` defaults to `5432`. Connections require
  `PGSSLMODE=verify-full` and `PGSSLROOTCERT=system`, which uses the runner's
  pinned Ubuntu trust store. Custom trust roots are rejected until an immutable
  CA-bundle path and digest contract is separately approved. Never weaken
  certificate or hostname verification.
- Supply the source Cosmos Mongo URI through process-only
  `HOV_SOURCE_MONGODB_URI`. Never put it in a command transcript, `.env`,
  checked-in file, evidence manifest, or PR attachment.
- Load secret values from the approved secret broker into the current process.
  Clear them when the operator shell closes. Do not use shell history or
  command-line parameters for passwords.
- When PostgreSQL 16 client tools are unavailable, the read-only source
  footprint can use `HOV_SOURCE_DATABASE_URL` with the Node probe below. Full
  backup and restore still require PostgreSQL 16 `pg_dump`, `pg_restore`, and
  `psql` on the approved migration runner; the Node probe is not a backup.
- PostgreSQL dumps, Cosmos archives, and Blob exports contain production data.
  Keep them in encrypted, access-restricted migration storage. General evidence
  contains only metadata, counts, non-reversible digests, and artifact hashes.
- A Terraform JSON plan can contain sensitive values. Keep it restricted and
  publish only the policy report and independently recorded SHA-256.

## Phase 0: authority and stop conditions

Before any target mutation, record the approved Baton migration task, operator,
maintenance window, rollback owner, exact application commit, exact saved-plan
hashes, and the source-write-freeze decision.

Stop immediately if any of the following is true:

- Azure context differs from the fixed boundary above;
- a target plan contains a source tenant/subscription ID, an `nl-prod-*` target,
  an import, destroy, replacement, or cross-product role assignment;
- target PostgreSQL is not a new empty database for rehearsal/restore;
- the app would use a server-administrator DSN or a raw DSN instead of a Key
  Vault reference;
- target Key Vault references are unresolved, or target storage/database public
  access is enabled;
- OIDC registration, issuer, secret, callbacks, and post-logout URIs cannot be
  changed in one coordinated window;
- there is no legitimate admin and non-admin acceptance owner;
- source rollback cannot remain intact through the observation window.
- the approved target-VNet runner is absent, its private DNS/TCP proof fails, or
  a hosted/workstation process would execute a private data-plane operation.

## Phase 1: read-only source inventory

Use a new source-authenticated shell:

```powershell
az account set --subscription bb4e3882-2079-4bab-8974-611bc0b8bb58
$evidence = 'D:\restricted\hov-migration\inventory'
pwsh scripts/migration/hov-nexamesh/Get-SourceInventory.ps1 `
  -OutputDirectory $evidence

pwsh scripts/migration/hov-nexamesh/Get-AzureDataInventory.ps1 `
  -Boundary Source `
  -ResourceGroup nl-prod-hov-rg `
  -StorageAccountName nlprodhovst `
  -CosmosAccountName nlprodhovcosmos `
  -OutputPath "$evidence/source-blob-cosmos.json"

```

If the read-only operator workstation has Node 22 and the repository `pg`
package but no PostgreSQL client tools, capture the live source footprint with:

```powershell
node scripts/migration/hov-nexamesh/Get-SourcePostgresInventory.mjs `
  --expected-database houseofveritas `
  --expected-role houseofveritas `
  --output "$evidence/source-postgres-node-inventory.json"
```

This probe uses `HOV_SOURCE_DATABASE_URL` only from process environment and
records table owners/counts, indexes, extensions and the application DATE-parser
control without selecting row contents or emitting the DSN.

On the target-VNet migration VM, add
`--migration-runner-cross-boundary`. That mode asserts the VM's exact target
Azure context and the fixed source host
`nl-prod-shared-pg.postgres.database.azure.com`, database and role before it
queries. Capture the full checksum/owner measurement there as well:

```powershell
pwsh scripts/migration/hov-nexamesh/Measure-Postgres.ps1 `
  -Boundary Source `
  -ResourceGroup nex-prod-hov-rg `
  -ExpectedDatabase houseofveritas `
  -ExpectedRole houseofveritas `
  -OutputPath "$evidence/source-postgres-measurement.json" `
  -CrossBoundaryMigrationRunner
```

Use the same flags for `Backup-Postgres.ps1`. They do not authorize a different
host or bypass database identity checks. Do not add a workstation firewall rule
merely to make the original sample commands work.

Reconcile the inventory against live App Service setting **names** and runtime
behavior. Record whether PostgreSQL, Cosmos, Blob, Baserow, DocuSeal, Functions,
Radar, and external intelligence services are active. Resource existence alone
is not proof of use. `/api/health` alone is also insufficient because its
PostgreSQL `live` result is configuration-based; capture a real SQL control.

Inventory PostgreSQL schemas, table owners, extensions, indexes, row counts,
OIDC identity mappings, audit/uploads, and DATE columns. Do not export row
contents into general evidence. Confirm which Cosmos collections and Blob
containers are in migration scope before selecting export parameters.

## Phase 2: rehearsal backups and independent restore

Take a source-consistent rehearsal dump and selected data exports:

```powershell
$backup = 'D:\restricted\hov-migration\rehearsal'
pwsh scripts/migration/hov-nexamesh/Backup-Postgres.ps1 `
  -ResourceGroup nex-prod-hov-rg `
  -ExpectedDatabase houseofveritas `
  -ExpectedRole houseofveritas `
  -OutputDirectory $backup `
  -SnapshotKind Rehearsal `
  -CrossBoundaryMigrationRunner

pwsh scripts/migration/hov-nexamesh/Export-AzureData.ps1 `
  -StorageAccountName nlprodhovst `
  -BlobContainers documents,asset-uploads,backups `
  -CosmosAccountName nlprodhovcosmos `
  -MongoDatabases house_of_veritas `
  -OutputDirectory $backup `
  -Confirmation EXPORT-SOURCE-DATA-nl-prod-hov-rg

pwsh scripts/migration/hov-nexamesh/Test-DataExport.ps1 `
  -BlobExportDirectories <reviewed-export-directories> `
  -MongoArchivePaths <reviewed-archive-paths> `
  -OutputPath "$backup/export-verification.json"
```

Execute these commands inside the VM wrapper. The source DSN arrives only as a
protected parameter. Capture table/object counts and SHA-256 before moving the
artifact into the restricted target Blob container with VM managed identity.
Never copy the dump/archive to the operator workstation.

First restore into a disposable target PostgreSQL 16 server, never production.
The database must be empty. Before restore, obtain a short-lived PostgreSQL
Microsoft Entra access token inside the migration VM and provide it only as the
protected `HOV_TARGET_PGPASSWORD` process value. Set `HOV_TARGET_PGUSER` to the
exact configured Entra administrator role and `HOV_TARGET_PGDATABASE=postgres`.
Do not create or store a server-password DSN.

Initialize the cluster roles from the `postgres` database before restore:

```powershell
pwsh scripts/migration/hov-nexamesh/Initialize-TargetPostgresRoles.ps1 `
  -TargetDatabase houseofveritas `
  -ExpectedEntraAdminRole <exact-temporary-entra-admin-role> `
  -AppServicePrincipalName <exact-target-app-service-principal-name> `
  -AppServicePrincipalObjectId <exact-target-app-service-object-id> `
  -OutputPath "$evidence/target-postgres-role-initialization.json" `
  -Confirmation INITIALIZE-POSTGRES-ROLES/houseofveritas/<exact-target-app-service-principal-name>
```

The script calls `pgaadauth_create_principal_with_oid` with object type
`service`, nonadmin/MFA-false flags only when the exact Entra role is absent. If
the PostgreSQL name already maps to a different object ID, type or admin posture,
it stops. It creates idempotent `NOLOGIN hov_owner`, grants the App Service role
membership required by the current application DDL model, revokes `PUBLIC`
database connect/schema create, and establishes existing/default table and
sequence privileges. It emits identifiers and grant status only, never the
access token. Rerun it after restore to normalize grants on restored objects;
the exact Entra mapping must remain unchanged.

Review the backup hash independently, set target PostgreSQL process variables on
the approved VNet migration runner, set `HOV_TARGET_PGDATABASE=houseofveritas`,
and run:

```powershell
az account set --subscription 8a5dc70a-bafa-4a04-a281-9b4862a70810
pwsh scripts/migration/hov-nexamesh/Restore-Postgres.ps1 `
  -ExpectedDatabase houseofveritas `
  -ExpectedConnectedRole <approved-restore-principal> `
  -RestoreOwnerRole hov_owner `
  -DumpPath <reviewed-dump-path> `
  -ExpectedSha256 <reviewed-sha256> `
  -Confirmation RESTORE-nex-prod-hov-rg/houseofveritas
```

Set `HOV_TARGET_NEGATIVE_PGDATABASE` to a database the runtime role must not
access. Then compare source and target measurements and run controls:

```powershell
pwsh scripts/migration/hov-nexamesh/Measure-Postgres.ps1 `
  -Boundary Target `
  -ResourceGroup nex-prod-hov-rg `
  -ExpectedDatabase houseofveritas `
  -ExpectedRole <exact-target-app-service-principal-name> `
  -OutputPath "$evidence/target-postgres-measurement.json"

pwsh scripts/migration/hov-nexamesh/Test-PostgresControls.ps1 `
  -ExpectedDatabase houseofveritas `
  -ExpectedRuntimeRole <exact-target-app-service-principal-name> `
  -ExpectedOwnerRole hov_owner `
  -OutputPath "$evidence/target-postgres-controls.json"
```

The rehearsal passes only when extensions, schemas, indexes, table counts,
content digests, owners and DATE fidelity match; `PUBLIC CONNECT` is revoked;
the runtime role is not superuser/CREATEDB/CREATEROLE/replication; cross-database
access fails; and the application DDL/write transaction succeeds and rolls back.
Also perform a separate Azure PITR restore into a new disposable server and
repeat the controls. A configured backup policy is not independent restore
proof.

Blob verification must compare source and target object counts, total bytes and
metadata digests. Cosmos verification must compare approved database/collection
sets plus document counts and application-level reads; never log document
contents. Keep source exports until the observation window and restore proof
both complete.

## Phase 3: target-only plan validation

Initialize only the new bootstrap, foundation-data, runtime, and edge roots.
Never use `terraform/environments/production/backend.hcl`, its state key, or its
imports. Save each binary plan, render its JSON in restricted storage, and run:

```powershell
terraform show -json <saved-plan> | Set-Content <restricted-plan.json>
pwsh scripts/migration/hov-nexamesh/Assert-TargetTerraformPlan.ps1 `
  -PlanJsonPath <restricted-plan.json> `
  -OutputPath "$evidence/<root>-plan-policy.json"
```

The plan must be create-only and assert the exact target tenant/subscription.
Review resource SKUs, `southafricanorth`, private endpoints/DNS, PostgreSQL 16,
14-day PITR/geo-backup, purge/deletion protection, target-only RBAC, managed
identity, and resolved Key Vault references. The HOV app must connect as the
exact Entra-mapped App Service PostgreSQL role, never the server administrator.
Validate target resource providers and quotas again immediately before apply.

Build an evidence manifest only from non-secret reports:

```powershell
pwsh scripts/migration/hov-nexamesh/New-EvidenceManifest.ps1 `
  -EvidenceRoot $evidence `
  -ArtifactPaths <reviewed-report-files> `
  -OutputPath "$evidence/manifest.json"
```

Do not add dumps, archives, `.tfstate`, `.tfvars`, credentials, or secret files
to the general manifest.

## Phase 4: provision and restore target without public cutover

Apply only exact saved plans through the approved target-only deployment
workflow, in this order: bootstrap, foundation-data, runtime. Recheck the saved
plan hash immediately before each apply. Do not apply the edge root yet.

Deploy the exact reviewed application build to the target
`azurewebsites.net` hostname. Keep public compatibility DNS on the source.
Resolve all Key Vault references and verify the new system-assigned identity has
only the approved Key Vault and Blob data-plane roles. Verify SQL and Cosmos
denials with the runtime identity/role, not an administrator.

Seed target Key Vault only from the approved VNet runner. The script sends the
secret in an in-memory HTTPS request to the private endpoint, clears its process
input, refreshes the App Service reference and verifies `Resolved` metadata
without reading the value:

```powershell
pwsh scripts/migration/hov-nexamesh/Set-TargetKeyVaultSecret.ps1 `
  -VaultName <nex-prod-hov-kv-name> `
  -SecretName mystira-oidc-client-secret `
  -SecretValueEnvironmentVariable HOV_TARGET_OIDC_CLIENT_SECRET `
  -WebAppName <nex-prod-hov-app-name> `
  -AppSettingName MYSTIRA_OIDC_CLIENT_SECRET `
  -Confirmation SEED-TARGET-SECRET/<nex-prod-hov-kv-name>/mystira-oidc-client-secret
```

The OIDC value must not be seeded until the coordinated Identity window in
Phase 7; database/runtime secrets may use the same mechanism earlier when their
separate approval is recorded. The app identity receives Secrets User only;
the migration runner's Secrets Officer assignment is time-bounded and removed
after verification.

Restore the rehearsed PostgreSQL dataset and selected Blob/Cosmos exports from
the approved VNet runner, never the workstation or hosted runner:

```powershell
pwsh scripts/migration/hov-nexamesh/Import-AzureData.ps1 `
  -StorageAccountName <target-storage-name> `
  -BlobMappings documents=<protected-documents-export>,asset-uploads=<protected-asset-export> `
  -CosmosAccountName <target-cosmos-name> `
  -MongoMappings house_of_veritas=<protected-cosmos-archive> `
  -Confirmation IMPORT-TARGET-DATA-nex-prod-hov-rg `
  -OutputPath "$evidence/target-data-import.json"
```

The import refuses non-empty target Blob containers and non-empty selected
Cosmos collections, uses managed-identity Blob access, suppresses object/document
names, and never drops existing target data. Afterwards rerun
`Get-AzureDataInventory.ps1 -Boundary Target`, compare counts/bytes/digests and
run application-level SQL, Blob and Cosmos reads. Control-plane resource health
is not data validation. Do not admit user traffic yet.

If the selected Cosmos Mongo tooling cannot authenticate with the approved
target identity while local-key auth is disabled, stop. A bootstrap URI may be
passed only as a protected Run Command parameter under a separately reviewed,
time-bounded authentication design whose final plan restores the approved
no-local-auth posture. Do not enable a public endpoint or permanent account key
ad hoc to make `mongorestore` succeed.

After import and checksum/count verification, remove VM-local dump/archive
copies with `Remove-MigrationArtifact.ps1`, using their previously recorded
SHA-256 and exact filename confirmation. This is logical deletion only. The
managed disk remains protected and the VM remains available for rollback and
restore proof through the observation window.

## Phase 5: write freeze and final delta

Choose and record one strategy before the maintenance window:

1. **Full final snapshot:** place all source writers in an explicit maintenance
   mode, stop schedulers/webhooks, prove no writes, take a new `Final` PostgreSQL
   dump plus Blob/Cosmos exports, restore to newly emptied target datastores, and
   compare final measurements.
2. **Deterministic delta:** use a separately reviewed, idempotent change log or
   provider-supported replication. Record the exact high-water mark, replay the
   delta once, prove zero unapplied changes, then disable source writers.

Timestamp alone is not a safe delta key. Do not improvise dual-write during the
window. Record UTC freeze start/end, disabled writers, final artifact hashes,
source/target counts and digests, and the owner who confirms zero source writes.

If any final comparison fails, restore source writers and stop. Do not continue
to identity or DNS.

## Phase 6: target Azure-host acceptance

Before a custom hostname, verify on the exact target Azure hostname:

- exact deployed commit and healthy runtime;
- PostgreSQL, Blob and Cosmos positive controls plus intended denials;
- estate/user/OIDC mappings and least-privilege roles;
- a synthetic durable write that survives an App Service restart;
- target-specific telemetry and absence of source resource calls.

The restart probe runs on the approved VNet runner, is deliberately mutating,
and requires an exact confirmation:

```powershell
pwsh scripts/migration/hov-nexamesh/Test-TargetRestartPersistence.ps1 `
  -WebAppName <nex-prod-hov-app-name> `
  -ExpectedDatabase houseofveritas `
  -ExpectedRuntimeRole <exact-target-app-service-principal-name> `
  -ExpectedCommit <40-character-commit> `
  -Confirmation RESTART-PERSISTENCE-nex-prod-hov-rg/<nex-prod-hov-app-name> `
  -OutputPath "$evidence/restart-persistence.json"
```

This probe writes one synthetic UUID marker, restarts only the asserted target
web app, verifies the exact build and SQL marker, and removes the marker. It is
not authentic user acceptance.

## Phase 7: atomic OIDC coordination

Treat OIDC as one coordinated change across HOV and Mystira Identity:

1. Register `neuralliquid-hov-web` on the approved production issuer with the
   target canonical callback and post-logout URIs while retaining the
   compatibility-host URIs.
2. Issue a new client secret and place it directly in target Key Vault; never
   expose it to Terraform output, logs, or App Service plaintext settings.
3. Confirm the target App Service managed identity resolves the Key Vault
   reference.
4. Generate a new sealed `runtime` plan with
   `identity_cutover_approved=true` and the reviewed canonical identity values.
   The workflow supplies non-secret defaults and accepts `HOV_MYSTIRA_*` /
   `HOV_AUTH_URL` environment overrides only for an explicitly reviewed
   rotation. Reject the plan unless the only mutation is an in-place update of
   `azurerm_linux_web_app.runtime`, then bind approval to its exact artifact
   hash.
5. Apply that exact runtime plan while changing issuer, client
   registration/secret reference, authorization endpoint,
   end-session endpoint, `AUTH_URL`, callbacks and post-logout allowlists in the
   same maintenance window.
   The target runtime must set
   `MYSTIRA_OIDC_AUTHORIZATION_ENDPOINT=https://login.hov.nexamesh.ai/connect/authorize`
   and
   `MYSTIRA_OIDC_END_SESSION_ENDPOINT=https://login.hov.nexamesh.ai/connect/endsession`;
   the canonical issuer remains `https://identity.mystira.app/`.
6. Verify discovery/JWKS/token issuer, PKCE/state, login and logout before
   removing any old redirect URI or secret.

Changing the issuer or secret alone is prohibited. Both `login.hov.nexamesh.ai`
and the rollback-only `login.hov.neuralliquid.ai` belong to the Identity side
and must not be rebound to HOV infrastructure. Keep the legacy hostname
available through authentic HOV login and logout acceptance and the complete
Gate 0 observation window. Retire it only in the separately approved source-
retirement step after rollback is no longer required.

## Phase 8: TLS, DNS and authentic Gate 0

Decide and approve the canonical hostname. Resolve ownership of
`sign.nexamesh.ai` and `ops.nexamesh.ai`; do not enable the old coupled DNS
module or replace their records as a side effect.

Order is mandatory:

1. Add App Service hostname-verification records.
2. Lower TTL in advance and capture the exact source CNAME/TLS rollback state.
3. Record explicit approval for a maximum ten-minute TLS interruption window,
   name the rollback operator, and continuously monitor the public CNAME plus
   both the source and target Azure hostnames. This edge root supports only the
   App Service managed-certificate path.
4. In the approved maintenance window, change only the HOV CNAME and point it
   directly at the target App Service in Cloudflare DNS-only mode with CNAME
   flattening disabled. Start the approved interruption timer at this mutation.
   Verify from independent public resolvers that the answer exposes the target
   `azurewebsites.net` CNAME directly before applying the edge plan, and retain
   DNS-only/unflattened mode for managed-certificate renewal.
5. Apply the exact sealed edge plan to bind the hostname, issue the managed
   certificate and enable SNI.
6. Verify HTTPS, certificate chain, exact build, OIDC callbacks and logout, then
   complete authentic Gate 0. If certificate issuance or acceptance fails, or
   the approved interruption deadline is reached, restore the captured source
   CNAME immediately and verify source TLS before ending the incident watch.
7. Verify public resolution from independent resolvers and the target runtime.

Run authentic Gate 0 with legitimate short-lived admin and non-admin sessions:

```powershell
pwsh scripts/run-post-deploy-gate0.ps1
```

Require admin success plus employee/operator denial behavior, real login/logout,
correct role/dashboard mapping, a durable estate write/read across reload, and
no source data-plane calls. CI, health, synthetic sessions, and the restart
probe do not substitute for this evidence. Do not use `-GovernanceWrite` unless
the separate real governance-record mutation is explicitly approved.

## Rollback

Rollback triggers include failed final reconciliation, unresolved Key Vault
references, SQL/Cosmos/Blob control failure, identity callback or role failure,
TLS/DNS error, authentic Gate 0 failure, source calls from target, or material
telemetry regression.

Rollback order:

1. Stop target writers and capture the target high-water mark and diagnostics.
2. Route the compatibility hostname back to the unchanged source and verify its
   existing TLS binding.
3. Restore the prior OIDC issuer/secret/reference and callback set atomically;
   do not remove target registration evidence yet.
4. Re-enable source schedulers/webhooks/writers.
5. Reconcile any target-only writes back to source through an explicitly
   reviewed data procedure. Never silently discard them.
6. Verify source exact build, database positive control, legitimate login and
   role behavior.

Do not destroy target resources during rollback. Preserve evidence and restored
data for investigation.

## Observation and completion boundary

Observe the target for an owner-approved period covering scheduled jobs,
backups, token refresh/logout, restart, database connection pressure, Blob and
Cosmos operations, alerts, and at least one independently successful restore.
Keep source runtime, data and rollback routing intact throughout.

After the observation window and a second independent restore proof, create a
separate target-only exact plan to remove the migration VM, NIC and managed
disk and revoke its time-bounded role assignments. Validate it with an explicit
address allowlist:

```powershell
pwsh scripts/migration/hov-nexamesh/Assert-RunnerTeardownPlan.ps1 `
  -PlanJsonPath <restricted-runner-teardown-plan.json> `
  -AllowedResourceAddressesCsv <comma-separated-exact-runner-addresses> `
  -OutputPath "$evidence/runner-teardown-plan-policy.json"
```

This is the sole plan-policy exception to the normal no-destroy rule and it
permits delete-only changes for every—and only—the enumerated target runner
resource address. Runner teardown is not source retirement and must not be
bundled with any source resource deletion.

Migration completion requires signed evidence for exact plans/builds, final
counts/digests, restore proof, managed-identity and denial controls, TLS/DNS,
atomic OIDC, authentic Gate 0 and the observation window.

Source DNS records, resource groups, databases, roles, secrets, state, app and
storage retirement are **not part of this runbook**. They require a new
inventory, a new exact destroy/retention plan, separate authorization, and a
separate Baton task after the observation window.
