# Self-Hosted Runner Setup (Historical)

> **Status: Historical — no longer in use as of 2026-05-14.**
> After the transfer to `neuralliquid/house-of-veritas`, all workflows run on `ubuntu-latest`.
> The `azure-vnet-ghost` runner was deregistered and the runner subnet allowlisting on
> Key Vault / Storage is being kept for now (re-evaluate when next touched).
> This page is retained for archaeology only.

This describes the previous architecture: the repo lived under the **JustAGhosT** account but used a self-hosted runner hosted in **phoenixvc** Azure infrastructure. This avoided Key Vault and Storage 403 errors that can occur when using GitHub-hosted runners (`ubuntu-latest`).

---

## Overview

| Component             | Location                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| HouseOfVeritas repo   | JustAGhosT (personal account)                                                                     |
| Runner infrastructure | phoenixvc org ([phoenixvc-actions-runner](https://github.com/phoenixvc/phoenixvc-actions-runner)) |
| Runner VM             | Azure VNet (runner subnet in HouseOfVeritas)                                                      |
| Runner type           | Persistent (`azure-vnet-ghost`)                                                                   |
| Terraform             | v1.14.5 pre-installed via HashiCorp APT repo                                                      |

The persistent runner is installed on the listener VM in phoenixvc-actions-runner and registered to the JustAGhosT account. It has VNet access to Key Vault and Storage via the runner subnet firewall rules.

---

## Prerequisites

Before setting up the persistent runner:

- [phoenixvc-actions-runner](https://github.com/phoenixvc/phoenixvc-actions-runner) Terraform applied (listener VM + VMSS exist)
- Runner subnet added to HouseOfVeritas Key Vault and Storage firewall rules
- SSH or Azure Bastion access to the listener VM

---

## Setting Up the Persistent Runner in JustAGhosT

This is a one-time setup. The runner runs on the phoenixvc listener VM but is registered to your JustAGhosT account.

### Step 1: Get listener VM access

From phoenixvc-actions-runner Terraform output:

```bash
cd phoenixvc-actions-runner/terraform
terraform output -raw listener_private_ip
```

Or from Azure Portal: find the listener VM in the runner resource group → Networking.

You need SSH access (Azure Bastion, VPN, or direct if the VM has a public IP).

### Step 2: Create the runner in JustAGhosT

**Where to find it:** "Actions" is not in your profile Settings. Use the **repository** Settings instead.

1. Go to **https://github.com/JustAGhosT/HouseOfVeritas** → **Settings** → **Actions** → **Runners**
2. Click **New self-hosted runner**
3. Select **Linux** and **x64**
4. Scroll to the **Configure** section (below the download commands)
5. Copy the **registration token** from the `config.sh` command line

The runner will be scoped to HouseOfVeritas only. (Personal accounts do not have account-level runners or repository access choices like organizations do.)

> **Note:** For a repo-scoped runner (HouseOfVeritas), set `GITHUB_REPO_URL` when running the install script in Step 3.

### Step 3: Install on the listener VM

SSH to the listener VM, then:

Run from the root of your workspace where the `phoenixvc-actions-runner/` repo is checked out:

```bash
# From your workstation: copy the install script to the VM
scp phoenixvc-actions-runner/scripts/install-persistent-runner.sh azureuser@<listener-ip>:~/

# SSH in
ssh azureuser@<listener-ip>

# On the listener VM: run with the token and repo URL from Step 2
# Security: use read -rs so the token is never stored in shell history.
read -rsp "Paste GitHub runner token (input hidden): " GITHUB_RUNNER_TOKEN && echo
export GITHUB_REPO_URL="https://github.com/JustAGhosT/HouseOfVeritas"
./install-persistent-runner.sh
```

The script downloads the runner, configures it for JustAGhosT, and installs it as a systemd service. The default runner name is `azure-vnet-ghost`.

### Step 4: Verify

1. **HouseOfVeritas** → **Settings** → **Actions** → **Runners**
2. You should see the runner with status **Idle** or **Active**
3. If the runner goes offline, on the listener VM: `sudo ./svc.sh status` in `/opt/gh-runner-justaghost`

---

## Repository Access

For repo-level runners (personal accounts), the runner is automatically scoped to HouseOfVeritas. No additional configuration needed.

---

## Workflow Configuration

Use the runner label in jobs that need Azure VNet access (Terraform, Key Vault, Storage):

```yaml
jobs:
  terraform-apply:
    runs-on: [self-hosted, azure-vnet-ghost]
    # ...
```

HouseOfVeritas workflows that use this runner:

- `terraform-apply.yml`
- `terraform-plan.yml`
- `terraform-destroy.yml`
- `deploy.yml` (deploy-infrastructure job)

### No deployer IP workarounds

When using the self-hosted runner, you do **not** need:

- `deployer_ip` or `ci_allowed_ip_ranges` Terraform variables
- `fetch-github-actions-ips.py` or ipify steps
- `ci_ranges.auto.tfvars`

The runner subnet is already in Key Vault and Storage `virtual_network_subnet_ids`.

---

## Troubleshooting

| Issue                            | Check                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `setup-terraform` AggregateError | Workflows use pre-installed Terraform on the runner VM (HashiCorp APT repo, v1.14.5). No download step. |
| Job stays queued                 | Runner offline? `sudo ./svc.sh status` in `/opt/gh-runner-justaghost` on listener VM                    |
| Runner not visible in repo       | HouseOfVeritas → Settings → Actions → Runners (repo Settings)                                           |
| 403 on Key Vault/Storage         | Runner subnet must be in HouseOfVeritas Key Vault and Storage firewall rules                            |
| Wrong runner label               | Use `[self-hosted, azure-vnet-ghost]` for JustAGhosT; `[azure-vnet]` is for phoenixvc org only          |
| Registration token expired       | Generate a new one: HouseOfVeritas → Settings → Actions → Runners → New self-hosted runner              |

---

## Reference

- [phoenixvc-actions-runner setup](https://github.com/phoenixvc/phoenixvc-actions-runner/blob/main/docs/setup.md)
- [05-terraform-firewall-troubleshooting.md](05-terraform-firewall-troubleshooting.md)
