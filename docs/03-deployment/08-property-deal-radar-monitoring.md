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
