# HOV native authentication domain

Status: prepared, not deployed

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
2. Apply the `mystira-workspace` Identity hostname, managed certificate, and SNI
   bindings; verify HTTPS and the authorization route on the new hostname.
3. Deploy this HOV change.
4. Complete a legitimate HOV magic-link sign-in and verify the callback returns
   to HOV with an authenticated session.

CI, health probes, and Terraform plans do not constitute authenticated user
acceptance. Do not deploy step 3 before the certificate in step 2 is issued.
