# HOV migration-runner teardown

This one-purpose Terraform root opens the existing target-only
`hov/prod/migration-runner.tfstate` and destroys only the temporary migration
runner resources represented by the checked-in `removed` blocks. It does not
manage the HOV application, durable network, PostgreSQL server, Key Vault,
storage, Cosmos DB, DNS, TLS, or any NeuralLiquid source resource.

Use only through `.github/workflows/hov-nexamesh-migration.yml` with root
`migration-runner-teardown`. The plan job converts the saved plan to JSON and
runs `Assert-RunnerTeardownPlan.ps1` against the exact eleven-address allowlist.
The sealed plan, manifest, and policy evidence must be reviewed before a
separate apply authorization.

Before apply, confirm all of the following:

- authentic HOV sign-in and logout acceptance is recorded;
- the target runtime database principal is healthy and usable;
- an authorized operator can establish a replacement PostgreSQL Entra
  administrator through the target ARM control plane if recovery is needed;
- the plan contains only the exact temporary runner deletes;
- the plan contains no source retirement or durable target-resource changes.

Never run `terraform destroy`, delete the target resource group, or repoint the
backend. Apply only the exact sealed `tfplan` artifact through the protected
workflow after separate approval.
