# Property Deal Radar Monitoring

Radar ingestion is production-governed by Terraform variables and Azure Function
telemetry. Keep these settings explicit in the canonical production tfvars:

- `radar_enabled`: publishes rows and exposes the public Radar surface.
- `radar_seed_enabled`: allows the bundled seed source to run.
- `baserow_table_deal_radar_listings`: Baserow listings table ID.
- `baserow_table_deal_radar_quarantine`: Baserow quarantine table ID.
- `enable_radar_alerts`: creates Azure Monitor scheduled query alerts.

Default production posture is off/empty. Enable Radar only after the production
Terraform state drift is resolved and the Baserow table IDs are confirmed in the
canonical backend.

## Enablement Runbook

Verified state as of 2026-08-06: the feature is deployed and publicly reachable but
correctly disabled. `GET https://hov.neuralliquid.ai/api/radar` returns HTTP 200 with
`{"data":[],"summary":{"mode":"disabled","enabled":false,"configured":false,"count":0}}`.
No listing has ever been published.

Four prerequisites, in order. Steps 1–3 are mechanical; step 4 is a human gate that
no agent may perform or substitute for.

### 1. Create the two Baserow tables

Neither table exists. `baserow_table_deal_radar_listings` and
`baserow_table_deal_radar_quarantine` both default to `""` in
`terraform/environments/production/variables.tf` and are unset in the canonical tfvars,
which is why the API reports `configured: false`.

Create both in the operational Baserow instance, shaped per `lib/services/radar/types.ts`
(listings: facts + sub-scores + provenance + `lastSeen` + `status` + `canonicalKey` +
`analystNote`; quarantine: the same plus QA failure reason). Record the numeric table IDs.

### 2. Add the radar variables to `.env.example`

No radar variables exist there yet — a gap already flagged in
`docs/specs/property-deal-radar-killswitch-popia.md`. Local and Function runtimes read
`RADAR_ENABLED`, `TABLE_DEAL_RADAR_LISTINGS`, `TABLE_DEAL_RADAR_QUARANTINE`; the web app
reads `BASEROW_TABLE_DEAL_RADAR_LISTINGS`. Document all four as empty/false defaults so the
dark posture is the documented one.

### 3. Clear the Terraform state drift

Tracked as Baton task `068f0cde`, reopened 2026-08-06 for having been closed without meeting
its acceptance criterion (`terraform plan -refresh-only` returning 0 changes). Outstanding:

- `terraform apply -refresh-only` against the canonical backend, to absorb four Web App
  `app_settings` added out-of-band (`AUTH_TRUST_HOST`, `AUTH_URL`, `MYSTIRA_OIDC_CLIENT_ID`,
  `MYSTIRA_OIDC_ISSUER`).
- A controlled manual apply for the PR #92 Key Vault access-policy replacement.
- Confirmation of the intended canonical state key (`production-canonical.terraform.tfstate`
  vs `production.terraform.tfstate`).

Radar tfvars cannot be applied through a drifted plan. `terraform-apply.yml` is
`workflow_dispatch`-only, so nothing applies automatically.

### 4. Obtain sign-off — hard gate

`docs/specs/property-deal-radar-legal-signoff.md` §5 is currently unsigned: all eight boxes
unchecked, both signature rows blank, go/no-go blank. That document states plainly that until
the block is signed, `RADAR_ENABLED` stays `false`/unset and **no agent may change it**.

Boxes 3–6 are now factually satisfiable (mitigations shipped, compliance page live at
`/radar/about`, kill-switch demonstrated). Box 1 — attorney written answers to the ten open
questions in §4 — is a genuine external dependency that has not happened.

If the intent is a *private, single-user MVP* rather than public launch, see §6 D1 of that
document: that path needs its own explicit criteria (access restriction, volume cap, no
indexing, no promotion), because §5 models public launch only.

### 5. Flip the flag

Only after 1–4. Set `radar_enabled = true` plus the two table IDs in the canonical production
tfvars, dispatch the Terraform apply workflow manually, then confirm
`GET /api/radar` reports `enabled: true`, `configured: true` and a non-zero count, and that
`enable_radar_alerts` alert rules are live before leaving it running unattended.

The `DealRadarRefresh` Function emits `DealRadarRefreshTelemetry` with counts and
flags only. Azure Monitor alert rules use stable log markers for:

- missing daily refresh
- zero-row refresh
- quarantine rows
- source-shape drift

## Docket Alignment

The verified Docket host is `https://docket.phoenixvc.tech`.

Useful read surfaces:

- `GET /health`
- `GET /openapi.json`
- `GET /docs`

Do not assume `/api/health`; it currently routes to the SPA. This repo does not
write Radar evidence into Docket yet. Use Docket manually for MVP evidence until
an authenticated write contract is selected for `action-log`, resource actions,
or workflow runs.
