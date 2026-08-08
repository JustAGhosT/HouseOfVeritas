# HOV-side facts for the dev-Identity credential exposure

**Date:** 2026-08-08
**Status:** Findings only. No authentication configuration was changed.
**Counterpart:** `mystira-workspace` security review
`.agents/traces/guardian-2026-08-07-dev-identity-committed-client-exposure.md`
(rated HIGH, conditionally CRITICAL)

---

## Why this document exists

The Mystira review lists, under *What I could NOT verify*, that
`~/repos/house-of-veritas` was outside its workspace. Its remediation then blocks
on **R0 — resolve the §1.3 dichotomy**, and states that rotation "requires the
HOV owner".

This records the HOV half, so that review does not have to guess at it. It
changes nothing and recommends nothing be changed unilaterally — see
[Sequencing](#sequencing).

## R0 is resolved: branch (a) holds

**House of Veritas production authenticates through the dev Identity issuer, and
sign-in currently works.** Verified 2026-08-08 without privileged access:

```
login.hov.neuralliquid.ai
  → CNAME mys-dev-id-webapi.azurewebsites.net
  → waws-prod-jnb21-031.sip.azurewebsites.windows.net

https://login.hov.neuralliquid.ai/.well-known/openid-configuration
  issuer:                 https://mys-dev-id-webapi.azurewebsites.net/
  authorization_endpoint: https://login.hov.neuralliquid.ai/connect/authorize
```

The HOV-branded login hostname is a vanity name in front of dev Identity. The
discovery document served under HOV's own domain names the dev issuer.

## What `nl-prod-hov-app` actually holds

Live app settings, 2026-08-08:

| Setting | Value |
| --- | --- |
| `MYSTIRA_OIDC_ISSUER` | `https://mys-dev-id-webapi.azurewebsites.net` |
| `MYSTIRA_OIDC_AUTHORIZATION_ENDPOINT` | `https://login.hov.neuralliquid.ai/connect/authorize` |
| `MYSTIRA_OIDC_END_SESSION_ENDPOINT` | `https://login.hov.neuralliquid.ai/connect/endsession` |
| `MYSTIRA_OIDC_CLIENT_ID` | `neuralliquid-hov-web` |
| `MYSTIRA_OIDC_CLIENT_SECRET` | set, 104 characters |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | `https://hov.neuralliquid.ai` |

The client secret is held at `nl-prod-hov-kv/mystira-oidc-client-secret`. This
repository does not contain it, and nothing here has been compared against the
value committed in `appsettings.Development.json` — establishing whether they
match is a rotation-coordination question, not something to determine by reading
both.

Hostname bindings on `nl-prod-hov-app` are `hov.neuralliquid.ai` and the default
`azurewebsites.net` name. **`login.hov.neuralliquid.ai` is not bound to any HOV
resource** — it belongs to the Identity side entirely.

## Consequences for the review's severity ruling

With branch (a) confirmed:

- The review's re-rating condition is met.
- Its ordering constraint is live: the production redirect URI **cannot** be
  removed before HOV is repointed, or HOV sign-in fails immediately with
  `invalid_redirect_uri`.
- R1 rotation is a hard coupling. The dev-side value and
  `nl-prod-hov-kv/mystira-oidc-client-secret` must change together, or HOV
  production login breaks. HOV cannot rotate alone and neither can Identity.
- Every HOV production user who has completed sign-in has account data resident
  in the dev environment. HOV holds no copy of that and cannot enumerate it.

## Sequencing

A repoint to `identity.mystira.app` is **not** a configuration edit on this side.
It requires, together and in this order: a client registration on the production
IdP with HOV's redirect URIs, a client secret issued there and stored in
`nl-prod-hov-kv`, then `MYSTIRA_OIDC_ISSUER` and the secret changed in the same
change. Moving the issuer alone — with a secret issued by a different IdP — takes
sign-in down.

This repository is already defended against doing that by accident:
`terraform/environments/production/variables.tf` carries a warning on
`mystira_oidc_issuer`, whose default (`https://identity.mystira.app`) does **not**
match production. Any apply must pin the live value:

```
-var 'mystira_oidc_issuer=https://mys-dev-id-webapi.azurewebsites.net'
```

That warning was added in #188 for a different reason — a plain apply silently
queued the issuer change during the PostgreSQL cutover — and it happens to be the
correct guard for this finding too.

## Not done here, deliberately

- No rotation. It is coupled to the Identity side and cannot be done unilaterally.
- No repoint. See above; doing it alone breaks sign-in.
- No comparison of secret values across repositories.

## Owner decision required

Rotation and repoint both need the HOV owner and an Identity-side counterpart in
the same window. This document exists so that conversation starts from verified
facts rather than from an unresolved dichotomy.
