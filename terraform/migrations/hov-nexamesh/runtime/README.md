# HOV target runtime

This root creates only the HOV runtime in Celladore Systems `nexamesh-sub`. It
reads non-secret network, Key Vault, storage, PostgreSQL and Cosmos metadata
from `hov/prod/foundation-data.tfstate`; it never reads or migrates the
NeuralLiquid source state.

The runtime is a B1 Linux App Service on Node.js 22 with VNet integration,
system-assigned identity, workspace-based Application Insights, TLS 1.2 and
FTPS disabled. Its identity receives only Key Vault Secrets User and Storage
Blob Data Contributor at the target resource scopes.

Key Vault references contain secret names, not values. Populate the reviewed
target secrets out of band before acceptance. PostgreSQL is Entra-only: after
the App Service identity exists, an authorized database administrator must
create the least-privilege `nex-prod-hov-app` database principal for the output
object ID. No static or server-administrator DSN is accepted.

`identity_cutover_approved` defaults to `false`, so Mystira issuer,
browser-facing authorization and end-session endpoints, client, client-secret
reference and `AUTH_URL` settings are absent while the target is built and
rehearsed. When approved, the runtime pins the browser endpoints to
`login.hov.nexamesh.ai` while the issuer remains canonical Mystira Identity.
The migration workflow exposes the switch only for the `runtime` root. Its
reviewed non-secret defaults are the canonical Mystira issuer, the existing HOV
client registration ID and Key Vault secret name, and `https://hov.nexamesh.ai`
as `AUTH_URL`; the corresponding `HOV_MYSTIRA_*` and `HOV_AUTH_URL` environment
variables may override them when an explicitly reviewed rotation requires it.
Its plan policy permits only the in-place App Service update for that phase.
Perform identity and callback changes only as an atomic cutover with the edge
operator steps and a newly reviewed exact plan.

Initialize this root only against the target backend key
`hov/prod/runtime.tfstate`. Do not run ad-hoc apply commands; use the sealed
plan artifact and hash gate in `hov-nexamesh-migration.yml`.
