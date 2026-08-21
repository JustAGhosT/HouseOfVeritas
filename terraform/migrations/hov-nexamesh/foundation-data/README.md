# HOV NexaMesh foundation and data

This root is create-only infrastructure for the approved Celladore Systems
tenant, `nexamesh-sub`, `nex-prod-hov-rg`, and `southafricanorth`. It has no
imports and must never share or migrate an existing Terraform state.

## Preconditions

- The bootstrap root is applied and its local state has been migrated.
- The operator uses Azure AD backend authentication and has Blob data access.
- The separate migration-runner root has a reviewed exact plan.
- The exact plan contains creates only and passes the migration policy checks.

Initialize with a temporary copy of `backend.hcl.example`; do not commit local
backend files, state, plans, credentials, connection strings, or role secrets.

## Secret-free data bootstrap interface

PostgreSQL uses Entra-only authentication. This root creates no password,
administrator assignment, application role, owner role, or runtime DSN. The
separate migration-runner root assigns its temporary VM identity as the initial
Entra administrator. The current application's static password DSN is not
compatible with this root. Deployment must stop until the runtime uses
managed-identity token acquisition and the audited bootstrap creates distinct
Entra schema-owner and least-privilege runtime roles for the target App Service
identity.

The private data plane is intentionally inaccessible from a developer machine.
This root provisions `nex-prod-hov-migration-snet` with no inbound access. A
separate state creates the temporary private Linux VM, system identity and
target-only data-plane roles. Managed Run Command protected parameters are the
only permitted secret injection path. Foundation apply is not approval to run
the migration; execution remains gated on exact commands, evidence and teardown
plan.

Cosmos resources are created through the ARM control plane so account keys are
not returned into Terraform state. A separate audited step must retrieve only
the required target connection material and write it directly to
`cosmos-mongo-connection-string` in the target Key Vault.

The runtime root consumes only non-secret remote-state outputs. PostgreSQL uses
managed identity and Entra tokens rather than a stored DSN. Cosmos connection
material is written directly to the named Key Vault secret. No runtime secret
value may pass through Terraform outputs or remote state.
