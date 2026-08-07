# ADR-013: Database Hosting and Estate Backend Consolidation

**Status:** Accepted
**Date:** 2026-08-06
**Deciders:** Jurie (owner)
**Supersedes in part:** [ADR-005](./05-persistence-strategy-adr.md) — which assumed a dedicated HOV PostgreSQL Flexible Server that was specified but never provisioned.

---

## Context

ADR-005 chose PostgreSQL as the primary store. Terraform defines the module, but a 2026-08-06 audit found that `enable_database` defaults to `false` and **no PostgreSQL server has ever existed in `nl-prod-hov-rg`**. The consequence was a data layer spread across three-and-a-half stores, none of them actually serving operational data:

| Store | Intended role | Actual state (2026-08-06) |
| --- | --- | --- |
| Baserow | 15 operational tables, 103 code files | **Unconfigured** — `/api/health` reported `dataMode: empty`; never held a row |
| PostgreSQL | users, audit, uploads, dashboard config | **Never provisioned** |
| Cosmos (Mongo API) | kiosk, tasks | Provisioned (`nlprodhovcosmos`) |
| PostgreSQL (embedded) | DocuSeal / Baserow backing databases | Defined, gated off with the above |

Because Baserow had never been configured, there was **no data to migrate** — making this the cheapest possible moment to consolidate.

Two decisions follow: *what* backs estate data, and *where* that database lives.

---

## Decision 1 — Consolidate estate operational data on PostgreSQL

Estate data moves behind a datastore-agnostic repository seam (`lib/repositories/estate-repository.ts`), with a PostgreSQL implementation selected by `ESTATE_BACKEND=postgres`.

**Rationale**

- **The data is relational.** Employees own leave requests, time-clock entries, loans and PPE issuances; payroll aggregates the time clock; expenses roll into budgets. These are joins and `GROUP BY`s. A document store would force denormalisation or app-side joins across what is conceptually one schema.
- **PostgreSQL already holds the correctness-critical data** — users, RBAC and the audit log. Keeping employees in a different engine from users makes that seam a permanent cross-store join.
- **It collapses three stores into one** — one backup policy, one connection secret, one migration path, one thing to be down.

Baserow remains a supported backend, Terraform-provisioned and flag-gated (`enable_operational_services && enable_database`), defaulting off. It is not deleted; it is demoted to an alternative.

**Rejected:** Cosmos DB for Mongo as the primary estate store. It is the better fit for the kiosk documents and stays there, but RU floors across 15+ collections cost more than a burstable Postgres at this scale, and the relational shape argues against it. Mystira's [ADR-0014](https://github.com/phoenixvc/mystira-workspace/blob/main/docs/architecture/adr/0014-polyglot-persistence-framework-selection.md) reaches a compatible conclusion from the opposite direction: Cosmos primary for documents, PostgreSQL for relational and analytical work.

---

## Decision 2 — Host on an org-level shared server, `nl-prod-shared-pg`

A dedicated server, `nl-prod-shared-pg` (resource group `nl-prod-shared-rg`, South Africa North, PostgreSQL 16, `Standard_B1ms`, 32 GB), is owned at organisation level rather than by any one application. Each application gets its own database and its own scoped login role.

**Current tenants**

| Database | Owner role | Migrated |
| --- | --- | --- |
| `houseofveritas` | `houseofveritas` | 2026-08-06 — schema self-creates; no data to move |
| `convolens` | `convolens` | 2026-08-06 — 6 tables, 26 rows |

**How this was reached.** HOV was first placed on the existing `nl-prod-convolens-pg` server, on the reasoning that cost was the binding constraint and a second B1ms was unjustified. That was correct about cost and wrong about structure: it made HOV a guest on another application's production instance, with a shared administrative credential and coupled backup/restore. Moving *both* applications onto a neutral server keeps the server count — and therefore the cost — unchanged, while removing the guest relationship entirely.

**Rationale**

- **Server count is unchanged**, so the cost argument that drove the original decision still holds. `nl-prod-convolens-pg` is retained only as rollback and should be deleted once both applications have been observed healthy.
- **No application is a guest of another.** Ownership sits with the organisation; neither app's lifecycle, maintenance window or restore decision is imposed on the other.
- **Least privilege by construction.** Each database is owned by its own role. Neither role holds rights on the other's objects, and no application uses the server admin.
- **Region is correct** — South Africa North, matching both applications and POPIA residency expectations.

**Remaining costs, honestly stated**

1. **Shared blast radius persists.** One server still means one restart, one storage limit, one maintenance window, one CPU-credit budget. This is inherent to consolidation and was accepted deliberately: at alpha, an outage is cheap and a second server is not.
2. **Backup and restore remain server-scoped.** Point-in-time restore still affects both databases. Per-database recovery requires a dump, not PITR.
3. ~~**`PUBLIC` retains `CONNECT` by default.**~~ **Closed 2026-08-07.** PostgreSQL grants `CONNECT` on every database to `PUBLIC`, so either role could open a connection to the other's database — holding no rights on its objects, but able to enumerate that it existed. `REVOKE CONNECT ON DATABASE <db> FROM PUBLIC` was run for both; each database's ACL went from `=Tc/owner` to `=T/owner`, and the owner keeps `CONNECT` in its own right. Verified by connecting as each role to both databases: own database allowed, other database refused with `permission denied for database`.
4. **The server is no longer drift.** It was created with `az` during the migration and is now owned by an org-level stack — [`neuralliquid-org/infra/terraform/shared-data`](https://github.com/neuralliquid/neuralliquid-org/tree/main/infra/terraform/shared-data), governed by that repo's [ADR 0002](https://github.com/neuralliquid/neuralliquid-org/blob/main/docs/adr/0002-shared-data-plane-ownership.md) — which adopted all seven resources on 2026-08-07 and now plans clean. One thing that stack surfaced: azurerm refuses to update a flexible server without its admin password, so the `environment` and `project` tags the server was created without had to be applied through the tags API rather than by Terraform.
5. **HOV production is not yet on this database.** The `houseofveritas` database, role and schema exist and are verified — but everything that uses them, this ADR included, lives on an unmerged branch. Production runs `main`, which predates the repository seam entirely: `nl-prod-hov-app` holds none of `ESTATE_BACKEND`, `DATABASE_URL` or `POSTGRES_URL`, still carries the Baserow table configuration, and `/api/health` reports `dataMode: empty` with Baserow `unconfigured`. The migration built and proved the destination; merging, deploying and applying the Terraform that points the app at it is a separate, unfinished step. Convolens, by contrast, is fully cut over.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Dedicated `nl-prod-hov-pg` (flip `enable_database = true`) | Cleanest isolation and the ADR-005 assumption. Rejected on cost: it adds a server rather than relocating one. |
| **Shared `nl-prod-*` org server, database-per-app** | **Adopted 2026-08-06.** See Decision 2. |
| Host HOV on `nl-prod-convolens-pg` | Adopted briefly, then superseded the same day — see Decision 2. |
| Graft onto `nl-dev-omnipost-*` | Rejected: North Europe / Sweden Central. |
| Cosmos (Mongo API) as primary estate store | Rejected — see Decision 1. |

---

## Revisit triggers

Move to a dedicated org-level shared server when **any** of these becomes true:

- HOV holds real POPIA-sensitive personal data at volume (the shared-admin credential stops being acceptable well before this point);
- either application needs an independent maintenance or restore window;
- contention appears on the B1ms — connection exhaustion, storage pressure, or CPU credit depletion;
- HOV becomes revenue-generating, or the cost constraint otherwise relaxes;
- a third application would otherwise be added to the same server.

**Migration path is cheap by construction.** Because the unit is a database rather than a schema-in-a-shared-database, moving is `pg_dump` → restore → change `DATABASE_URL`. Nothing in the application layer is aware of which server it sits on.

---

## Consequences

- `DATABASE_URL` for HOV points at `nl-prod-shared-pg.postgres.database.azure.com/houseofveritas`, stored at **`nl-prod-hov-kv/estate-database-url`**. It previously sat in `nl-prod-convolens-kv`, which was the wrong home twice over — that vault also held the shared server's admin password, making one product's vault the org credential store. Both were relocated on 2026-08-07: the admin password to `nl-prod-shared-kv/postgres-admin-password`, HOV's connection string to HOV's own vault. Reading it requires a Key Vault access policy on `nl-prod-hov-kv`; one was added by hand for the operator and is not yet in `terraform/modules/security`, so it is drift until codified.
- The server's firewall permits Azure services only, which covers the HOV App Service, the Function App and the convolens container app. Ad-hoc access from developer machines requires a temporary firewall rule, added and removed per use — as was done throughout this migration.
- `nl-prod-convolens-pg` still holds both original databases and is the rollback path. Deleting it is a separate, deliberate step once both applications have run healthy for long enough to trust.
- `ensureEstateSchema()` and `ensureRadarSchema()` create their tables idempotently on first use; there is no separate migration step.
- HOV's Terraform passes `ESTATE_BACKEND`, `DATABASE_URL` and `POSTGRES_URL` to the Function App, which creates its own radar schema, so the ingestion job does not depend on the web app having run first. Under Postgres it addresses tables by name; the `TABLE_DEAL_RADAR_*` settings apply to the Baserow path only. This describes the configuration, not a running system: `enable_functions` defaults to `false` and no Function App exists in the subscription.
- Verified live on 2026-08-06: schema creation, insert/read/update round-trip, `DATE` fidelity, `NUMERIC` decoding, and time-clock clock-in/clock-out all pass against this server (`tests/integration/postgres-roundtrip.test.ts`) — first as the server admin, then again as the scoped `houseofveritas` role.
- The connection string lives only in Key Vault. `estate_database_url` is a `sensitive` Terraform variable supplied out of band; nothing is committed.

---

## References

- [ADR-005: Persistence Strategy and Polyglot Data Stores](./05-persistence-strategy-adr.md)
- Mystira ADR-0014: Polyglot Persistence Framework Selection — compatible conclusion, .NET/EF Core implementation; the pattern transfers, the code does not
- PR #184 — repository seam, PostgreSQL backend, Baserow independence
