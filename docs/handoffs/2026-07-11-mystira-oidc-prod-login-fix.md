# Handoff — Production login `/api/auth/error` (Mystira OIDC)

- **Date:** 2026-07-11
- **Branch:** `codex/clean-default-proof`
- **Status:** ✅ **FIXED IN PRODUCTION + VERIFIED.** Login redirects to the Mystira IdP.
  Terraform/workflow code changes still UNCOMMITTED in the working tree (need commit + PR).
- **Area:** Auth.js v5 (next-auth beta) + Mystira OIDC, Azure DNS + App Service custom
  domain, Terraform webapp module, deploy workflow

## Problem (as reported)

Clicking **Login** on https://hov.neuralliquid.ai showed "server not found" / a server
error instead of redirecting to the Mystira identity provider.

## Root cause — CORRECTED after live investigation

The original diagnosis (missing app settings) was **only one of three** problems, and not
the one behind "server not found". Live probing on 2026-07-11 found:

1. **DNS dead-end — the real "server not found".** `hov.neuralliquid.ai` is a CNAME in the
   `neuralliquid.ai` zone (`mys-global-shared-rg`). It still pointed at
   `nl-prod-hov-app-san.azurewebsites.net` — the **`-san` demo app that the canonical
   naming migration deleted** (see `docs/03-deployment/07-canonical-azure-naming-migration.md`).
   A CNAME to a deleted host dead-ends → **NXDOMAIN** on public DNS (confirmed on 8.8.8.8) →
   browser "server not found". Nothing in the repo touched this; it was DNS drift left by
   the `-san` teardown.
2. **App config error on the reachable host.** The App Service is reachable at
   `nl-prod-hov-app.azurewebsites.net`. There, `/api/auth/providers` returned **HTTP 500
   `Configuration`** because (a) no `AUTH_TRUST_HOST` → Auth.js v5 rejects the proxied host
   (`UntrustedHost`), and (b) `MYSTIRA_OIDC_ISSUER` was unset → fell back to the in-code dev
   default `http://localhost:5262` (`auth.config.ts:8`), unreachable from Azure.
3. **Callback host ≠ allowlisted host.** The Mystira `neuralliquid-hov-web` OpenIddict
   client allowlists **only** `https://hov.neuralliquid.ai/api/auth/callback/mystira`
   (verified: authorize probe with a valid `code_challenge` → 302 `/connect/login`). The
   `nl-prod-hov-app.azurewebsites.net` callback is **rejected** (`ID2043`). So even after
   fixing #2, deriving the callback from the request host (the original plan, `AUTH_URL`
   unset) would emit the azurewebsites.net callback and the IdP would reject it. `AUTH_URL`
   must be **pinned** to `https://hov.neuralliquid.ai`.

   > Note on probe method: a PKCE-less authorize probe returns `ID2029` (code_challenge
   > missing) for ANY redirect_uri — OpenIddict checks `code_challenge` before `redirect_uri`.
   > `ID2029`-vs-`ID2043` does **not** distinguish an accepted URI. Probe **with** a valid
   > `code_challenge` (+`code_challenge_method=S256`): accepted → 302 `/connect/login`,
   > rejected → `ID2043`.

## Fix applied to production (Option A: restore the canonical domain)

All executed against subscription `bb4e3882-…` (`jurie@phoenixvc.tech`) on 2026-07-11:

1. **Re-pointed DNS.** `hov` CNAME in `neuralliquid.ai` (`mys-global-shared-rg`):
   `nl-prod-hov-app-san.azurewebsites.net` → **`nl-prod-hov-app.azurewebsites.net`**, TTL 300.
   Resolves publicly again (`→ 102.133.154.33`).
2. **Bound custom hostname.** `hov.neuralliquid.ai` added to `nl-prod-hov-app`
   (`hostNameType: Verified` — the pre-existing `asuid.hov` TXT already matched the app's
   `customDomainVerificationId`, so no extra verification step).
3. **Managed certificate.** Created a free App Service managed cert for `hov.neuralliquid.ai`
   (thumbprint `6521E63EDA292F5EB039766A84CF7D0A4F6E1FA5`) and bound it SNI → `SniEnabled`.
4. **App settings** on `nl-prod-hov-app` (out-of-band; Terraform below reconciles state):
   `AUTH_TRUST_HOST=true`, `MYSTIRA_OIDC_ISSUER=https://mys-dev-id-webapi.azurewebsites.net`,
   `MYSTIRA_OIDC_CLIENT_ID=neuralliquid-hov-web`, `AUTH_URL=https://hov.neuralliquid.ai`.
   (`MYSTIRA_OIDC_CLIENT_SECRET` deliberately not set — the in-code fallback
   `hov-dev-secret-change-in-staging` **matches** the seeded client's `ClientSecret`, confirmed
   in `mystira-workspace` `apps/identity/.../appsettings.Development.json`.)

The Mystira IdP side needed **no change** — `hov.neuralliquid.ai` callback + post-logout were
already allowlisted (migration PR #2882, live since 2026-07-04).

## Verification (live, 2026-07-11)

- `https://hov.neuralliquid.ai/api/health` → **200** (DNS + cert + app all good).
- `https://hov.neuralliquid.ai/api/auth/providers` → **200**, emitting
  `callbackUrl: https://hov.neuralliquid.ai/api/auth/callback/mystira` (was HTTP 500).
- `POST /api/auth/signin/mystira` (with CSRF) → **302** to
  `…/connect/authorize?client_id=neuralliquid-hov-web&redirect_uri=https://hov.neuralliquid.ai/api/auth/callback/mystira&scope=openid+profile+email+offline_access&code_challenge=…&code_challenge_method=S256`.
- IdP accepts that exact `redirect_uri` (302 → `/connect/login`); client secret matches for
  the token exchange → full login flow works.

## Uncommitted code changes (this branch — need commit + PR)

1. `terraform/modules/webapp/main.tf` — `locals.auth_app_settings` merged into `app_settings`.
   `AUTH_TRUST_HOST="true"` unconditionally; `MYSTIRA_OIDC_*` / `AUTH_URL` emitted only when
   non-empty (so an unset var leaves the setting absent and the code `?? default` applies).
2. `terraform/modules/webapp/variables.tf` — declared `mystira_oidc_issuer`,
   `mystira_oidc_client_id`, `mystira_oidc_client_secret` (sensitive), `auth_url`.
3. `terraform/environments/production/main.tf` — passes the four vars into `module.webapp`.
4. `terraform/environments/production/variables.tf` — prod defaults: issuer → dev IdP,
   client id `neuralliquid-hov-web`, client secret `""`, and **`auth_url` pinned to
   `https://hov.neuralliquid.ai`** (matches the applied setting + the IdP allowlist).
5. `.github/workflows/deploy.yml` — Terraform plan passes `mystira_oidc_client_secret`
   (secret), `MYSTIRA_OIDC_ISSUER`/`AUTH_URL` (repo vars) with the canonical host as the
   `AUTH_URL` fallback so an unset repo var doesn't blank the pinned default.
6. `docs/README.md` — handoffs index entry.

**State drift:** the app settings + DNS + hostname/cert were applied via `az`, not Terraform.
A future `terraform apply` on the canonical backend key reconciles the app settings (same
values). DNS/hostname/cert live in the shared `mys-global-shared-rg` zone and are **not** in
this repo's Terraform — they stay managed out-of-band unless imported.

## Next owner — steps

1. **Commit + PR** the changes above; run the deploy workflow so Terraform state matches the
   live app settings (no functional change expected).
2. **Optional / longer-term.** Provision a dedicated staging/prod Mystira issuer (prod still
   points at the dev IdP), move the client secret to Key Vault, and consider codifying the
   `hov.neuralliquid.ai` DNS + custom-domain binding in IaC (currently manual, in the shared
   zone). Managed cert auto-renews.
3. **Watch item.** If the `-san` cleanup or a shared-zone change ever re-touches the `hov`
   CNAME, login breaks again with "server not found". The record must point at
   `nl-prod-hov-app.azurewebsites.net`.

## Side note

`terraform/environments/production/terraform.tfvars` contains a plaintext `db_admin_password`
but is **not tracked by git** (local untracked file, not a committed secret). Rotating it is
advisable but not urgent. Do not edit `*.tfvars` — a protect-sensitive hook blocks them.
