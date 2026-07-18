# Self-Hosted Runner Setup (Historical)

> Status: Historical. The `azure-vnet-ghost` runner was deregistered after the transfer to `neuralliquid/house-of-veritas`, and current workflows run on GitHub-hosted `ubuntu-latest` runners.
>
> The dedicated HOV runner subnet and `runner_subnet_id` Terraform output were removed in 2026-05. Do not use this page as current setup guidance.

This page is retained only to explain the previous architecture.

## Previous Architecture

| Component             | Previous location                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| HouseOfVeritas repo   | JustAGhosT personal account                                                                          |
| Runner infrastructure | phoenixvc org ([phoenixvc-actions-runner](https://github.com/phoenixvc/phoenixvc-actions-runner))    |
| Runner VM             | Azure VNet runner subnet in HouseOfVeritas                                                           |
| Runner type           | Persistent repo-scoped runner named `azure-vnet-ghost`                                               |
| Terraform             | Pre-installed on the listener VM                                                                     |

The old runner avoided Key Vault and Storage firewall failures by running inside an allowlisted VNet subnet. That subnet is no longer part of the HOV Terraform contract.

## Current Guidance

Use GitHub-hosted runners and the firewall pattern documented in [05-terraform-firewall-troubleshooting.md](05-terraform-firewall-troubleshooting.md):

- Key Vault allows the container subnet plus Azure-internal fallback CIDR rules.
- Storage allows the container/database subnets plus the current deployer IP when needed.
- No workflow should use `runs-on: [self-hosted, azure-vnet-ghost]`.
- No module should expect `runner_subnet_id`.

## If Self-Hosting Returns

A future self-hosted runner should be designed as new infrastructure. Place it in an existing allowed subnet, or add a newly declared subnet and intentionally wire that subnet into Key Vault and Storage firewall rules. Reintroducing a runner subnet requires a fresh Terraform design and import/apply plan; do not revive the old `runner_subnet_id` output.

## Historical Troubleshooting Clues

| Symptom                   | Historical cause                                               | Current action                                       |
| ------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| Job stays queued          | `azure-vnet-ghost` was offline or deregistered                 | Remove self-hosted labels; use `ubuntu-latest`       |
| 403 on Key Vault/Storage  | Runner network was not in firewall rules                       | Check deployer IP and current firewall docs          |
| Wrong runner label        | Mixed JustAGhosT and phoenixvc runner labels                   | Do not use old labels                                |
| Missing runner subnet     | Dedicated runner subnet removed from HOV Terraform             | Use current subnet/IP firewall pattern               |

## References

- [05-terraform-firewall-troubleshooting.md](05-terraform-firewall-troubleshooting.md)
- Historical phoenixvc runner repo: `phoenixvc-actions-runner`