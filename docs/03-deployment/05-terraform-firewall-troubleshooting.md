# Terraform Firewall Troubleshooting

## TL;DR - Key Vault 403 / Storage 403

If Terraform fails with `Client address is not authorized` or `403 AuthorizationFailure`, the runner network is not allowed by the resource firewall during state refresh.

Current production posture:

1. Workflows run on GitHub-hosted `ubuntu-latest` runners.
2. Key Vault allows the container subnet plus Azure-internal runner CIDR fallback `172.128.0.0/9`.
3. Storage allows the container/database subnets plus `deployer_ip` when a workflow passes the current runner IP.
4. The dedicated self-hosted runner subnet was removed in 2026-05 and should not be referenced by HOV Terraform.

## Error: ForbiddenByFirewall / AuthorizationFailure

When Terraform runs in GitHub Actions, you may see:

```text
Error: making Read request on Azure KeyVault Secret: StatusCode=403
Message="Client address is not authorized and caller is not a trusted service."
Client address: 135.232.177.170
code="ForbiddenByFirewall"
```

And for Storage:

```text
Error: retrieving Container: unexpected status 403
AuthorizationFailure: This request is not authorized to perform this operation.
```

## Root Cause

Key Vault and Storage Account use `default_action = "Deny"` with `ip_rules` and `virtual_network_subnet_ids`. Terraform refreshes state before it can apply changes, so the refresh fails if the current runner network is not already allowed.

## Current Setup

Terraform does not manage a dedicated runner subnet anymore.

- Key Vault `virtual_network_subnet_ids`: container subnet.
- Key Vault `ip_rules`: `deployer_ip` plus `172.128.0.0/9` Azure-internal fallback.
- Storage `virtual_network_subnet_ids`: container subnet and database subnet.
- Storage `ip_rules`: `deployer_ip` only.

For GitHub-hosted runs, make sure the workflow discovers the current runner public IP and passes it as `deployer_ip` when Storage needs data-plane access.

## Brownfield Bootstrap

If both Key Vault and Storage are locked out before Terraform can refresh:

1. Azure Portal -> Key Vault `nl-prod-hov-kv` -> Networking -> temporarily allow access from all networks.
2. Azure Portal -> Storage Account `nlprodhovst` -> Networking -> temporarily allow access from all networks.
3. Run the Terraform workflow or a controlled manual Terraform plan/apply.
4. Confirm the intended subnet/IP firewall rules are present.
5. Restore `default_action = "Deny"` where required.

## Alternative: Self-Hosted Runner in Azure VNet

A future self-hosted runner can still be used, but it should run in an existing allowed subnet such as the container subnet, or in a newly declared subnet that is deliberately added back to the Key Vault and Storage firewalls. Do not depend on `runner_subnet_id`; that Terraform output no longer exists.

## Other Terraform Errors

**InvalidIpAddressTypeForNetworkProfile:** Container groups using `subnet_ids` (VNet) must set `ip_address_type = "Private"`. Public IPs are not allowed when a network profile is set.

**Consumption Budget 400 (offerType: None):** Cost Management consumption budgets only support Enterprise Agreement, Web direct, and Microsoft Customer Agreement. Visual Studio / MSDN subscriptions can return `offerType: None`; keep `enable_consumption_budget = false` for this stack.

**"next: not found" on Azure App Service:** The deploy workflow uses Next.js standalone output. After build, `.next/static` and `public` are copied into `.next/standalone/`, the standalone `package.json` start script is set to `node server.js`, and Terraform sets `app_command_line = "node server.js"`.

**ApplicationGatewayDeprecatedTlsVersionUsedInSslPolicy:** The gateway module must keep a static `ssl_policy` block with `policy_name = "AppGwSslPolicy20220101"`.

## Production Defaults

- Key Vault: `nl-prod-hov-kv`
- Storage Account: `nlprodhovst`
- Resource Group: `nl-prod-hov-rg`

## Verifying the Fix

1. Trigger the Terraform plan workflow or run a controlled plan with the deploy principal.
2. Confirm Terraform refresh reaches Key Vault and Storage without 403s.
3. Confirm planned firewall rules use the container/database subnet IDs and deployer IP rules, with no runner subnet references.