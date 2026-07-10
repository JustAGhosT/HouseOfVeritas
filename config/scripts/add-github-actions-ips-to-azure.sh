#!/usr/bin/env bash
# Add GitHub Actions IP ranges to Azure Key Vault and Storage Account firewalls.
# Run this from a machine that CAN already connect (e.g. VM in VNet, or after temporarily allowing all networks).
#
# Usage:
#   ./add-github-actions-ips-to-azure.sh [--dry-run]
#
# Requires: az, curl, jq

set -e

KV_NAME="${TF_KEY_VAULT_NAME:-nl-prod-hov-kv}"
SA_NAME="${TF_STORAGE_ACCOUNT_NAME:-nlprodhovst}"
DRY_RUN=false

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

echo "Fetching and compressing GitHub Actions IP ranges..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IPS=$(python3 "$SCRIPT_DIR/fetch-github-actions-ips.py" | jq -r '.[]')
COUNT=$(echo "$IPS" | grep -c . || echo 0)

if [[ "$COUNT" -eq 0 ]]; then
  echo "No IPv4 ranges found in GitHub meta. Check api.github.com/meta structure."
  exit 1
fi

echo "Found $COUNT IPv4 CIDR blocks for GitHub Actions."

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run - would add these to Key Vault ($KV_NAME) and Storage ($SA_NAME):"
  echo "$IPS" | head -20
  echo "..."
  exit 0
fi

echo "Adding IP ranges to Key Vault: $KV_NAME"
while IFS= read -r cidr; do
  [[ -z "$cidr" ]] && continue
  az keyvault network-rule add --name "$KV_NAME" --ip-address "$cidr" 2>/dev/null || true
done <<< "$IPS"

echo "Adding IP ranges to Storage Account: $SA_NAME"
while IFS= read -r cidr; do
  [[ -z "$cidr" ]] && continue
  az storage account network-rule add --account-name "$SA_NAME" --ip-address "$cidr" 2>/dev/null || true
done <<< "$IPS"

echo "Done. GitHub Actions runners should now be able to reach Key Vault and Storage."
