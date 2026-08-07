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

## Decision 2 — Host on the shared `nl-prod-convolens-pg` server

HOV's `houseofveritas` database is created on the **existing** `nl-prod-convolens-pg` Flexible Server (South Africa North, PostgreSQL 16, `Standard_B1ms`), rather than provisioning a dedicated HOV server.

**Rationale**

- **Cost is the binding constraint.** The project is pre-revenue; a second `Standard_B1ms` is unjustified spend for four users.
- **Capacity is not a concern at this scale.** Four personas and a once-daily ingestion job will not stress a B1ms.
- **Region is right.** It is the only candidate in South Africa North. The two `nl-dev-omnipost-*` servers are in North Europe and Sweden Central — wrong on both latency and POPIA data-residency grounds.

**Accepted costs — recorded deliberately, not overlooked**

1. **Shared blast radius.** A runaway query, a restart, a storage-full event or a maintenance window on convolens affects HOV, and vice versa. This was raised and consciously accepted: at alpha, an outage is cheap and cash is not.
2. ~~**Shared administrative credential.**~~ **Resolved 2026-08-06.** HOV initially connected as `convolensadmin`, the server admin for another application, which gave each app full rights over the other's data. A dedicated `houseofveritas` login role now owns the `houseofveritas` database, its schema, and all 18 tables and their sequences; the connection string is stored at `nl-prod-convolens-kv/hov-estate-database-url` and the admin credential is no longer used by HOV. Verified by running the live round-trip suite as the scoped role.
3. ~~**No least-privilege role.**~~ **Resolved 2026-08-06** — see above. `ensureEstateSchema()` now runs as `houseofveritas`, which owns the objects it alters.

   *Residual:* PostgreSQL grants `CONNECT` on every database to `PUBLIC` by default, so the `houseofveritas` role can still open a connection to convolens' database (without rights on its objects). Closing that requires `REVOKE CONNECT ON DATABASE <convolens> FROM PUBLIC`, which touches convolens' own access path and was therefore left to its owner rather than changed unilaterally.
4. **Backup and restore are coupled.** Point-in-time restore operates on the server, so restoring HOV means restoring convolens' server too.
5. **Cross-project ownership.** `nl-prod-convolens-rg` is not HOV's resource group; HOV's Terraform does not own the server it depends on.

---

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Dedicated `nl-prod-hov-pg` (flip `enable_database = true`) | Cleanest isolation and the ADR-005 assumption. Rejected on cost alone. |
| **Shared `nl-prod-*` org server, database-per-app** | **The right end state.** One deliberately-shared server owned at org level, with a database and a scoped role per app — same cost as today, without grafting onto another app's production instance. Deferred, not rejected. |
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

- `DATABASE_URL` for HOV points at `nl-prod-convolens-pg.postgres.database.azure.com/houseofveritas`.
- The server's firewall permits `allow-azure-services`, which covers the HOV App Service and Function App. Ad-hoc access from developer machines requires a temporary firewall rule, added and removed per use.
- `ensureEstateSchema()` and `ensureRadarSchema()` create their tables idempotently on first use; there is no separate migration step.
- The Function App now receives `ESTATE_BACKEND`, `DATABASE_URL` and `POSTGRES_URL`, and creates its own radar schema, so the ingestion job no longer depends on the web app having run first. Under Postgres it addresses tables by name; the `TABLE_DEAL_RADAR_*` settings apply to the Baserow path only.
- Verified live on 2026-08-06: schema creation, insert/read/update round-trip, `DATE` fidelity, `NUMERIC` decoding, and time-clock clock-in/clock-out all pass against this server (`tests/integration/postgres-roundtrip.test.ts`) — first as the server admin, then again as the scoped `houseofveritas` role.
- The connection string lives only in Key Vault. `estate_database_url` is a `sensitive` Terraform variable supplied out of band; nothing is committed.

---

## References

- [ADR-005: Persistence Strategy and Polyglot Data Stores](./05-persistence-strategy-adr.md)
- Mystira ADR-0014: Polyglot Persistence Framework Selection — compatible conclusion, .NET/EF Core implementation; the pattern transfers, the code does not
- PR #184 — repository seam, PostgreSQL backend, Baserow independence
