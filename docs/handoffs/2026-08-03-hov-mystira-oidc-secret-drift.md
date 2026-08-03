# HOV Mystira OIDC client-secret drift

- **Date:** 2026-08-03
- **Repository:** `C:\Users\smitj\repos\house-of-veritas`
- **Baton task:** `dd38d58a-c815-4689-a980-82acaf08ac62`
- **Area:** production authentication, Azure Key Vault, deployment workflows

## Incident

A fresh `omniposthq@gmail.com` sign-in reached Microsoft and returned to HOV, but
Auth.js ended at `/api/auth/error?error=Configuration` with HTTP 500. The HOV App
Service runtime log recorded Mystira's token response as `invalid_client`
(`ID2055`): the configured client credentials were invalid.

A non-user token probe established that Mystira's persisted
`neuralliquid-hov-web` client still recognized the intended development client
secret. HOV's `nl-prod-hov-kv/mystira-oidc-client-secret` value had drifted from
that recognized value, so the callback failed before HOV could resolve the email
to a local persona.

## Live repair

With explicit operator approval:

1. The current operator received temporary `Set` permission on `nl-prod-hov-kv`.
2. Only `mystira-oidc-client-secret` was restored to the IdP-recognized value.
3. The temporary Key Vault policy was removed and its absence was verified.
4. App Service Key Vault references were refreshed and `nl-prod-hov-app` was
   restarted.
5. `https://hov.neuralliquid.ai/api/health` returned healthy on build
   `e627181c6fe8661f8352aaa894e1fc6151195764`.

No secret value, browser session, token, or user credential was recorded.

## Durable workflow guard

The protected GitHub `production` environment now contains
`MYSTIRA_OIDC_CLIENT_SECRET`. Production deployment workflows reconcile that
value into the versionless Key Vault secret before an App Service deployment or
manual Terraform apply:

- `.github/workflows/deploy-on-merge.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/terraform-apply.yml`

The step fails closed if the GitHub environment secret is absent. It first reads
and compares the current Key Vault value, creates a new version only when the
values differ, immediately refreshes the App Service's versionless Key Vault
references after a change, emits no secret material, and unsets local shell
variables after the comparison. Staging skips the production-only
reconciliation in the full deployment workflow.

## Verification

- `pnpm install --frozen-lockfile`
- `pnpm exec prettier --check .github/workflows/deploy-on-merge.yml .github/workflows/deploy.yml .github/workflows/terraform-apply.yml`
- `pnpm run lint`
- `git diff --check`

## Remaining acceptance

Complete a fresh visible Microsoft sign-in using `omniposthq@gmail.com`, then
verify that `/api/auth/me` identifies the Lucky operator before and after a page
refresh. Deployment health and a successful token exchange are not substitutes
for that authenticated persona-link proof.
