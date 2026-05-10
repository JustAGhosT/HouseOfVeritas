#!/usr/bin/env bash
#
# bootstrap-azure.sh — one-shot Azure + GitHub Actions bootstrap for HoV.
#
# Creates:
#   - Service principal (Contributor on the chosen subscription, plus
#     Storage Blob Data Contributor on the tfstate storage account so
#     terraform can read/write state via Azure AD auth).
#     The Key Vault module uses access_policy resources, not role
#     assignments, so User Access Administrator is intentionally not
#     granted — this avoids ABAC-condition AuthorizationFailed errors
#     in tenants that restrict role-assignment elevation.
#   - Terraform state backend: resource group, storage account, container.
#
# Sets the following GitHub Actions repo secrets via the gh CLI:
#   - AZURE_CREDENTIALS        (full SP JSON, "--json-auth" shape)
#   - TF_STATE_RESOURCE_GROUP
#   - TF_STATE_STORAGE_ACCOUNT
#   - TF_STATE_CONTAINER
#   - TF_STATE_KEY             (production.terraform.tfstate)
#   - DB_ADMIN_PASSWORD        (random 24-char value — also printed once at end)
#
# Run interactively from a shell where you can `az login` and `gh auth login`:
#
#   ./config/scripts/bootstrap-azure.sh
#
# Override defaults via env vars (all optional):
#   SUBSCRIPTION_ID, SP_NAME, TF_RG, TF_STORAGE, TF_CONTAINER, TF_LOCATION, REPO
#
# Requirements on the machine running this script:
#   - az CLI (>= 2.51 for --json-auth)
#   - jq
#   - gh CLI, already authenticated (`gh auth status`)
#   - openssl (Git Bash on Windows ships with it)
#   - The signed-in Azure principal must have *Owner* + *User Access
#     Administrator* on the target subscription (so it can create role
#     assignments for the new SP).

set -euo pipefail

# Stop Git Bash / MSYS2 from rewriting Azure resource scopes like
# "/subscriptions/<guid>" into Windows paths ("C:/Program Files/Git/...").
# Without this every `az role assignment create` and `az ... --scopes` call
# fails with MissingSubscription on Windows.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

# ── Config (override via env) ────────────────────────────────────────────────
SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-}"
SP_NAME="${SP_NAME:-hov-shared-deploy-sp}"
TF_RG="${TF_RG:-hov-shared-tfstate-rg}"
TF_STORAGE="${TF_STORAGE:-hovsharedtfstatesa}"
TF_CONTAINER="${TF_CONTAINER:-tfstate}"
TF_LOCATION="${TF_LOCATION:-southafricanorth}"
TF_STATE_KEY="${TF_STATE_KEY:-production.terraform.tfstate}"
REPO="${REPO:-JustAGhosT/house-of-veritas}"

# ── Sanity checks ────────────────────────────────────────────────────────────
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }; }
need az
need jq
need gh
need openssl

if ! gh auth status >/dev/null 2>&1; then
  echo "gh CLI is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

# ── Azure login + subscription ───────────────────────────────────────────────
if ! az account show >/dev/null 2>&1; then
  echo "Not logged in to Azure. Running 'az login'..."
  az login >/dev/null
fi

if [[ -z "$SUBSCRIPTION_ID" ]]; then
  SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
fi
echo "Using subscription: $SUBSCRIPTION_ID"
az account set --subscription "$SUBSCRIPTION_ID"

# ── 1. Service principal ─────────────────────────────────────────────────────
echo
echo "[1/4] Creating service principal '$SP_NAME' (Contributor on /subscriptions/$SUBSCRIPTION_ID)..."
# --json-auth keeps the shape that azure/login@v2 + the workflow's
# `jq -r .clientId` parsing expects.
SP_JSON="$(az ad sp create-for-rbac \
  --name "$SP_NAME" \
  --role Contributor \
  --scopes "/subscriptions/$SUBSCRIPTION_ID" \
  --json-auth)"
SP_APPID="$(echo "$SP_JSON" | jq -r .clientId)"

# ── 2. Terraform state backend ───────────────────────────────────────────────
echo
echo "[2/4] Creating Terraform state backend in $TF_LOCATION..."
az group create --name "$TF_RG" --location "$TF_LOCATION" >/dev/null

# Storage account names must be globally unique, lowercase alphanum, 3–24 chars.
if ! az storage account show --name "$TF_STORAGE" --resource-group "$TF_RG" >/dev/null 2>&1; then
  echo "      Creating storage account $TF_STORAGE..."
  az storage account create \
    --name "$TF_STORAGE" \
    --resource-group "$TF_RG" \
    --location "$TF_LOCATION" \
    --sku Standard_LRS \
    --kind StorageV2 \
    --min-tls-version TLS1_2 \
    --allow-blob-public-access false >/dev/null
else
  echo "      Storage account $TF_STORAGE already exists, reusing."
fi

ACCOUNT_KEY="$(az storage account keys list \
  --account-name "$TF_STORAGE" \
  --resource-group "$TF_RG" \
  --query '[0].value' -o tsv)"

az storage container create \
  --name "$TF_CONTAINER" \
  --account-name "$TF_STORAGE" \
  --account-key "$ACCOUNT_KEY" >/dev/null

# Give the new SP data-plane access to the state container too.
SP_OBJECTID="$(az ad sp show --id "$SP_APPID" --query id -o tsv)"
az role assignment create \
  --assignee-object-id "$SP_OBJECTID" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$TF_RG/providers/Microsoft.Storage/storageAccounts/$TF_STORAGE" >/dev/null || true

# ── 3. Generate DB admin password ────────────────────────────────────────────
echo
echo "[3/4] Generating DB admin password..."
DB_ADMIN_PASSWORD="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 24)"

# ── 4. Publish to GitHub Actions ─────────────────────────────────────────────
echo
echo "[4/4] Setting GitHub Actions secrets on $REPO..."
echo "$SP_JSON"          | gh secret set AZURE_CREDENTIALS         --repo "$REPO"
printf "%s" "$TF_RG"      | gh secret set TF_STATE_RESOURCE_GROUP   --repo "$REPO"
printf "%s" "$TF_STORAGE" | gh secret set TF_STATE_STORAGE_ACCOUNT  --repo "$REPO"
printf "%s" "$TF_CONTAINER" | gh secret set TF_STATE_CONTAINER      --repo "$REPO"
printf "%s" "$TF_STATE_KEY" | gh secret set TF_STATE_KEY            --repo "$REPO"
printf "%s" "$DB_ADMIN_PASSWORD" | gh secret set DB_ADMIN_PASSWORD  --repo "$REPO"

# ── Done ─────────────────────────────────────────────────────────────────────
cat <<EOF

==========================================
 Bootstrap complete.
==========================================
 Service principal : $SP_NAME (clientId=$SP_APPID)
 Subscription      : $SUBSCRIPTION_ID
 TF state          : $TF_STORAGE / $TF_CONTAINER  (rg=$TF_RG)
 TF state key      : $TF_STATE_KEY
 Secrets set       : AZURE_CREDENTIALS, TF_STATE_*, DB_ADMIN_PASSWORD

 Still TODO before triggering deploy:
   - ACS_CONNECTION_STRING                      (Azure Communication Services
                                                 Email — Functions + Next.js
                                                 app email)
   - SMTP_USERNAME, SMTP_PASSWORD               (DocuSeal SMTP relay — point
                                                 at smtp.azurecomm.net:587
                                                 with ACS-derived creds)
   - SSL_CERTIFICATE_DATA, SSL_CERTIFICATE_PASSWORD
       (PFX cert — or change terraform/modules/gateway to use an
        Azure-managed cert if the domain is already in your tenant)
   - DOCUSEAL_URL, BASEROW_URL                  (after first deploy)
   - 'production' environment in the GitHub UI must approve the run

 DB_ADMIN_PASSWORD (saved only as a GitHub secret — copy now if you
 need it for psql etc.; you can rotate via 'az postgres flexible-server
 update' later):
   $DB_ADMIN_PASSWORD
==========================================
EOF
