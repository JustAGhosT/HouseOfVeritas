# O6 restricted evidence store

## Status and authority

- Status: Terraform preparation only; disabled by default and not deployed
- Baton task: `6f42f193-9372-41d8-ae27-0ba2e32fbf7f`
- Azure context: subscription `bb4e3882-2079-4bab-8974-611bc0b8bb58`,
  South Africa North
- Application access: prohibited
- O5/O6 activation: prohibited until every human and operational gate below is
  satisfied

This runbook defines the technical O6 evidence boundary. It is not legal advice,
does not claim POPIA compliance, and does not authorize collection, PIRB
verification, outreach, payment, appointment, or Gate progression.

The existing shared account `nlprodhovst` is not the restricted store. Live
inspection on 2026-07-26 found public networking enabled, firewall default
`Allow`, blob public access allowed, and shared-key access allowed. It remains
untouched because it also serves general application and Terraform workloads.

## Prepared architecture

The opt-in `restricted-storage` Terraform module creates:

- a dedicated StorageV2 account with TLS 1.2, secure transfer, infrastructure
  encryption, public Blob access disabled, shared keys disabled, OAuth default,
  public networking disabled, and firewall default `Deny`;
- a private Blob container created through the ARM control plane, with public
  access set to `None` and encryption-scope overrides denied;
- a Blob private endpoint and `privatelink.blob.core.windows.net` DNS zone linked
  to the existing production VNet;
- account-scoped `Storage Blob Data Contributor` assignments only for approved
  Microsoft Entra object IDs supplied through private Terraform inputs;
- versioning, seven-day soft deletion, and creation-age lifecycle deletion for
  base blobs, versions, and snapshots; and
- a dedicated Log Analytics workspace receiving Blob read, write, delete, and
  metric diagnostics.

The module exports resource identifiers only. It exports no key, SAS token, or
connection string and grants no HOV web app or Function identity access.

## Activation record required outside Git and Baton

Before setting `enable_restricted_evidence_store = true`, the owner and privacy
reviewer must approve a private record containing:

1. responsible-party and Information Officer/delegated privacy-owner IDs;
2. independent privacy/legal reviewer ID;
3. research-owner ID;
4. named authorized-researcher IDs and Microsoft Entra object IDs;
5. correction/deletion-owner ID;
6. security-incident-owner ID and tested contact path;
7. exact purpose and permitted PIRB/candidate evidence fields;
8. approved retention and final-deletion deadline;
9. approved private access path, such as a managed device connected to the HOV
   VNet through an owner-approved VPN or controlled jump host;
10. provider/operator, location, MFA, access-review, breach, correction,
    deletion, and contract decisions; and
11. the reviewed Terraform plan, cost estimate, deployment owner, and rollback
    owner.

Do not put names, contact details, candidate mappings, credentials, consent,
contracts, payment information, raw notes, private endpoints, or access
instructions in Git, Baton, general chat, HOV production, logs, prompts, or model
training data. Non-secret Microsoft Entra object IDs still belong in untracked
Terraform inputs or approved secure automation because they identify authorized
people.

## Private Terraform inputs

The following is a shape example only. Populate it in an untracked tfvars file
or approved secure pipeline input after the activation record is approved:

```hcl
enable_restricted_evidence_store = true

restricted_evidence_researcher_object_ids = [
  "00000000-0000-4000-8000-000000000000",
]

restricted_evidence_retention_days       = 90
restricted_evidence_soft_delete_days     = 7
restricted_evidence_audit_retention_days = 180
```

The placeholder UUID is not an identity and must never be used for an apply.
Terraform fails enabled provisioning when no authorized researcher ID exists or
when soft deletion is not shorter than evidence retention.

## Access and MFA boundary

Azure Storage data access uses Microsoft Entra authorization only. MFA and
Conditional Access are tenant policies and therefore require live owner/privacy
proof; Terraform in this repository cannot truthfully assert that they are
enabled for a person.

An authorized researcher must access Blob data from the approved private-network
path and use `--auth-mode login` or an equivalent Entra-authenticated client.
Storage keys, account SAS, connection strings, local users, SFTP, anonymous
links, organization-wide links, and application proxying are prohibited.

After deployment but before collection, capture private evidence that:

- public network access is disabled and the private endpoint is approved;
- the Blob hostname resolves to the private endpoint from the approved device;
- an approved researcher can list the empty container with Entra authentication;
- a non-authorized user is denied;
- shared-key authorization is rejected;
- the diagnostic setting reports Blob read/write/delete categories as enabled;
- the Log Analytics workspace receives a synthetic access event; and
- HOV production cannot read or write the container.

## Data minimization and layout

Use pseudonymous candidate IDs in filenames and working records. Keep the
candidate-to-identity mapping separate from evaluation material. Store only the
minimum approved evidence needed for the declared purpose.

Suggested logical prefixes are `identity-map/`, `credentials/`, `consent/`,
`contracts/`, `trial-evidence/`, and `deletion-receipts/`. Prefixes do not create
authorization boundaries; every authorized researcher can access the account.
If duties require different access, create separate containers/accounts and
roles in a reviewed follow-up rather than relying on naming conventions.

## Retention, correction, and deletion

The default lifecycle deletes base blobs, versions, and snapshots 90 days after
creation. Creation age is intentional: editing an item must not silently extend
its retention. The privacy reviewer must approve any different period before
activation.

Soft deletion provides a seven-day accidental-deletion recovery window. A
correction/deletion request therefore has two dates:

1. logical deletion initiated by the deletion owner; and
2. final non-recoverability after the soft-delete period expires.

The approved participant notice and deadline must reflect that recovery window.
Do not disable soft deletion or purge evidence ad hoc. For an urgent legal or
security requirement, stop processing and obtain the named privacy/incident
owner's documented decision.

For every correction or deletion, privately record the candidate ID, affected
evidence references, request/decision timestamps, action owner, versions and
snapshots addressed, expected final-deletion date, verification result, and
incident escalation if the action fails. Baton and Git may receive only a
minimized non-sensitive completion reference.

## Access review and offboarding

- Review the Entra object-ID set before deployment, before each trial, monthly
  while evidence exists, and immediately when a role changes.
- Remove access before announcing offboarding completion.
- Confirm the removed identity is denied from the approved private path.
- Review Azure Activity Log and Blob diagnostic events for unexpected access,
  role assignment, network, retention, or diagnostic changes.
- Keep Terraform state, plan output, and CI logs free of restricted content.

## Incident path

On suspected unauthorized access, disclosure, loss, unsafe processing, or
diagnostic failure:

1. stop collection, PIRB verification, sharing, and all non-essential access;
2. preserve audit logs and relevant resource-change evidence without copying
   restricted content into general systems;
3. notify the named incident owner and privacy reviewer through the tested
   private contact route;
4. remove or narrow access only under the incident owner's authority;
5. assess operator, data-subject, insurer, contractual, and Information
   Regulator notification duties; and
6. record a minimized incident reference and explicit restart decision.

O5, O6, and Gate progression remain inactive until the incident is contained
and the named human owner records restart authority.

## Deployment gate

Repository merge is not deployment approval. A later deployment must use the
`azure-deploy` workflow and stop before `terraform apply` until the user has
approved:

- the exact plan showing one restricted account, container, private endpoint,
  DNS zone/link, audit workspace/diagnostics, lifecycle policy, and intended
  role assignments;
- the global storage-account name recheck and cost estimate;
- the private access path and MFA/Conditional Access evidence plan;
- the human accountability record and retention/deletion wording; and
- the post-deploy empty-store, deny-path, logging, and deletion tests.

No real candidate or household evidence may be used for deployment verification.

## Repository validation

Preparation must pass:

```text
terraform fmt -recursive -check
terraform -chdir=terraform/environments/production init -backend=false
terraform -chdir=terraform/environments/production validate
pnpm exec vitest run tests/lib/restricted-storage-terraform-contract.test.ts
pnpm run lint
```

Validation is configuration proof only. It does not prove Azure deployment,
private DNS resolution, MFA, access denial, diagnostics delivery, or deletion.

The 2026-07-26 preparation validation passed Terraform formatting and
validation, the four focused contract tests, lint, and the disabled/enabled
plan-shape checks. The enabled synthetic plan proposed nine module resources,
no deletes, and one unrelated pre-existing VNet normalization. The full test
suite passed 398 tests and retained two pre-existing Windows CRLF failures in
`tests/lib/deployment-workflow-contract.test.ts`. No plan was applied.
