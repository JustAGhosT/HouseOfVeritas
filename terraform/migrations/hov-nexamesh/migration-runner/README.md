# HOV private migration runner

This separate state creates a temporary Linux VM with no public IP in the HOV
migration subnet. It consumes only non-secret foundation outputs. A Standard
NAT Gateway supplies a stable egress IP for a separately approved, temporary
source PostgreSQL firewall rule; the VM itself has no inbound route.

Security properties:

- system-assigned managed identity;
- Trusted Launch with Secure Boot and vTPM;
- password login disabled and no private SSH material in Terraform;
- Premium managed OS disk encrypted at rest by Azure Storage Service Encryption;
- no inbound NSG rule and no public NIC address;
- Azure VM Agent enabled for Managed Run Command;
- deterministic cloud-init bootstrap for PowerShell, Azure CLI, PostgreSQL 16
  client tools, Node.js 22, AzCopy, MongoDB Database Tools, and mongosh;
- a pinned Custom Script extension that waits for cloud-init and reruns the
  non-secret tool/reboot readiness check before Terraform can complete;
- target-only `Storage Blob Data Contributor` and `Key Vault Secrets Officer`;
- temporary PostgreSQL Entra administrator assignment for scoped-role bootstrap;
- `prevent_destroy` on VM, NIC, NAT resources and admin assignment.

The SSH public key is non-secret and is break-glass metadata only; there is no
network path to SSH. Do not add a public IP, Bastion, inbound NSG rule, password,
DSN, database dump, connection key, or secret-bearing custom data/extension
setting to this root or its state. The checked-in cloud-init and extension
command contain software installation and verification logic only.

Cloud-init uses Ubuntu 24.04 (`noble`) repositories plus reviewed vendor
channels: Microsoft packages for PowerShell/Azure CLI/AzCopy, PGDG `noble-pgdg`
for PostgreSQL 16, MongoDB 8.0 for migration clients, and the official Node.js
release archive. PowerShell 7.6.5, Azure CLI 2.89.1, PostgreSQL client 16.15,
AzCopy 10.32.6, and Node.js 22.23.2 are exact-version checks; the Node.js Linux
x64 archive SHA-256 is verified before extraction. MongoDB migration clients
are constrained to the signed MongoDB 8.0 `noble` channel and their resolved
versions are captured by readiness evidence. Apt-installed migration packages
are held after installation so an unattended upgrade cannot change the runner's
toolchain during an approved migration window. Successful provisioning writes
non-secret version and boot evidence to
`/var/lib/hov-migration/tooling-ready.json`; the
`tooling_readiness_extension_id` output is not proof until its Azure provisioning
state is `Succeeded`. Any `/var/run/reboot-required` marker makes verification
fail instead of silently accepting a runner that still needs a reboot.

Migration commands must run through Azure Managed Run Command. Source and
target credentials are passed only as protected Run Command parameters and must
be cleared from process environments by the migration script. Scripts must not
echo parameters, row data, dumps, or connection strings. Artifacts go only to
the private target Blob account.

Linux Managed Run Command executes `source.script` with a POSIX shell. A raw
PowerShell file is therefore not a valid payload even though `pwsh` is installed.
`scripts/migration/hov-nexamesh/Invoke-ProtectedMigrationRunCommand.ps1` supplies
a reviewed LF-normalized Linux shell wrapper: it verifies and writes the
repository PowerShell payload, its sibling `Common.ps1` dependency, and its
launcher as mode-0600 files inside a mode-0700 temporary directory, then invokes:

```text
/usr/bin/pwsh -NoLogo -NoProfile -NonInteractive -File <temporary-script.ps1>
```

The wrapper traps exit, clears protected process-environment variables, removes
the temporary directory, forwards the PowerShell exit code, and suppresses
payload stdout/stderr. Before invoking the payload, it signs Azure CLI in with
the VM's system-assigned identity using an ephemeral configuration directory,
selects the already asserted target subscription, and removes the token cache
during cleanup. The generated PowerShell launcher scopes
`$ConfirmPreference` to `None` so a payload with `ConfirmImpact = "High"` cannot
trigger an impossible prompt under `-NonInteractive`; this also keeps payloads
without `SupportsShouldProcess` executable. The outer exact confirmation token
and `ShouldProcess` gate remain mandatory. Do not put protected parameter values
in `source.script`,
custom data, extension settings, Terraform variables, outputs, or state. The
launcher makes protected Run Command execution technically available; every
payload still needs separate source review, a pinned SHA-256, an exact command
approval, and evidence that records names and outcomes only.

Public payload parameters whose names end in `EnvironmentVariable` carry only
the name of a protected process-environment variable. The launcher requires
each referenced name to be a key supplied through `ProtectedParameterBindings`;
the corresponding secret value must never be supplied publicly.
Sensitive-looking parameters that contain non-secret resource names must be
explicitly listed in `PublicMetadataParameterNames`. The launcher accepts those
values only when they are at most 127 characters long, begin with a letter or
digit, and otherwise contain only letters, digits, dots, underscores, or
hyphens; all other sensitive-looking public parameters remain blocked.

The exact runner plan and exact protected command remain separate approval
gates. This state owns the runner identity as the temporary PostgreSQL Entra
administrator. Before teardown, use a separately reviewed change to establish
and test an approved durable operator/break-glass Entra administrator, or prove
that the runtime database principal remains usable and an approved recovery path
exists. Capture that evidence before deleting or replacing the temporary admin.
Only after restore proof, acceptance, admin handoff, and separate teardown
approval may a reviewed change deliberately remove `prevent_destroy`; do not
edit state or destroy the resource group.
