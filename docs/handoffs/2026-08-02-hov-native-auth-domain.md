# HOV native authentication domain

Status: deployed; Microsoft/OIDC path accepted, magic-link path remains a separate evidence gate

House of Veritas now supports a separate browser-facing OIDC authorization
endpoint. Production is configured for
`https://login.hov.neuralliquid.ai/connect/authorize` while the issuer,
discovery, JWKS, and token endpoint remain canonical Mystira Identity.

This hostname is intentionally separate from `hov.neuralliquid.ai`. Binding
Identity directly to the isolated login hostname keeps Identity's host-only
session cookie away from the HOV relying-party application.

Deployment order:

1. Apply the `neuralliquid-org` DNS change for the `login.hov` CNAME and
   `asuid.login.hov` TXT record.
2. Run and apply Mystira's separate `terraform-entra-external-id` dev workflow
   so Microsoft can return to the new Identity hostname.
3. Apply the `mystira-workspace` Identity hostname, managed certificate, and SNI
   bindings; verify HTTPS, authorization, and end-session routes on the hostname.
4. Deploy this HOV change.
5. Complete a legitimate HOV magic-link sign-in and verify the callback returns
   to HOV with an authenticated session.

Current evidence (2026-08-03):

- PR #168 is merged and the HOV authorization endpoint is live on
  `login.hov.neuralliquid.ai`.
- The custom-domain discovery document resolves successfully while retaining the
  canonical Mystira issuer.
- A legitimate Microsoft/Mystira sign-in for the mapped Lucky identity returned
  to `/dashboard/lucky`; the session persisted after reload and `/api/auth/me`
  returned 200.
- PR #169 repaired the production client-secret drift and added fail-closed,
  idempotent reconciliation to the deployment workflows. Production health
  reported the exact deployed merge commit `6713f633`.
- A dedicated magic-link acceptance on the custom domain has not been recorded;
  do not infer it from the Microsoft/OIDC acceptance above.

The next presentation-layer slice is defined in
`docs/handoffs/2026-08-03-hov-native-auth-ui-next.md`.

CI, health probes, and Terraform plans do not constitute authenticated user
acceptance. Do not deploy step 3 before the certificate in step 2 is issued.
