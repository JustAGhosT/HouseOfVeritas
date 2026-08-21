# ADR-005: Persistence Strategy and Polyglot Data Stores

**Status:** Accepted  
**Date:** 2026-02-21  
**Deciders:** Technical Lead, Architecture Team

---

## Context

House of Veritas currently uses several in-memory stores that are volatile and lost on restart. Production requires persistent storage for users, audit logs, rate limiting, real-time events, and time-clock records.

The following list recorded the intended supporting topology when this ADR was accepted, not the verified production runtime. ADR-013 partially supersedes this current-state assumption: it records a shared HOV PostgreSQL database, role, and schema, but the canonical HOV app was not connected to them at its last verification. Re-inventory live configuration before migration.

The intended supporting stores were:

- **PostgreSQL** (Azure Flexible): DocuSeal, Baserow databases
- **MongoDB** (optional): Kiosk requests, audit log dual-write
- **Redis** (Docker Compose): Baserow caching
- **Azure Blob Storage**: Documents, backups

### Current In-Memory Stores

| Store                | Location                      | Data                              | Impact of Loss                    |
| -------------------- | ----------------------------- | --------------------------------- | --------------------------------- |
| Users                | `lib/users.ts`                | Hardcoded users, password hashes  | None (static seed)                |
| Audit log            | `lib/audit-log.ts`            | Activity history                  | Compliance gap, no history        |
| Rate limiter         | `lib/auth/rate-limit.ts`      | Per-key request counts            | Rate limits reset; abuse possible |
| Event store          | `lib/realtime/event-store.ts` | SSE events (last 100)             | Real-time feed lost               |
| Biometric/time clock | `app/api/biometric/route.ts`  | Clock records, enrolled employees | Time tracking lost                |

---

## Decision Drivers

1. **Compliance** – Audit logs must persist for governance and incident review
2. **Security** – Rate limiting must survive restarts to prevent abuse
3. **Operational** – Time-clock records needed for payroll and BCEA compliance
4. **Cost** – Target <R950/month; minimize new infrastructure
5. **Simplicity** – Prefer existing stores over new ones

---

## Primary Database Choice: Weighted Decision Matrix

**Criteria** (weights sum to 100):

| Criterion          | Weight | Description                                            |
| ------------------ | ------ | ------------------------------------------------------ |
| ACID / consistency | 20     | Strong consistency for financial and audit data        |
| Operational fit    | 20     | Aligns with existing PostgreSQL/Baserow stack          |
| Cost               | 15     | Minimal additional spend                               |
| Query flexibility  | 15     | Support for filtering, aggregation, time-range queries |
| Ops complexity     | 15     | Fewer moving parts preferred                           |
| Scalability        | 10     | Handles 10+ users, 100k docs                           |
| Compliance / audit | 5      | Audit trail, retention support                         |

**Options scored 1–5** (5 = best):

| Criterion          | PostgreSQL | MongoDB | Hybrid (PG + Mongo) |
| ------------------ | ---------- | ------- | ------------------- |
| ACID / consistency | 5          | 3       | 4                   |
| Operational fit    | 5          | 3       | 4                   |
| Cost               | 5          | 4       | 3                   |
| Query flexibility  | 5          | 5       | 5                   |
| Ops complexity     | 5          | 4       | 3                   |
| Scalability        | 4          | 5       | 4                   |
| Compliance / audit | 5          | 4       | 4                   |
| **Weighted total** | **98**     | **78**  | **82**              |

**Primary database decision:** **PostgreSQL** – Already in use for DocuSeal and Baserow; strong consistency, low ops overhead, and best fit for audit and financial data.

---

## Polyglot Persistence Approach

Use the right store per concern instead of forcing everything into one database.

| Concern              | Store                                | Rationale                                  |
| -------------------- | ------------------------------------ | ------------------------------------------ |
| Users                | PostgreSQL (new schema)              | ACID, joins, existing PG infra             |
| Audit log            | PostgreSQL (new schema)              | Compliance, time-range queries, retention  |
| Rate limiting        | Redis                                | TTL, atomic incr, low latency              |
| Real-time events     | In-memory (short-term) + optional PG | Ephemeral by design; optional archive      |
| Time-clock records   | PostgreSQL (Baserow or new table)    | Payroll, BCEA, existing Baserow Time table |
| Biometric enrollment | PostgreSQL (new table or Baserow)    | Small, structured, needs persistence       |

---

## Per-Concern Weighted Decision Matrices

### 1. Users

| Criterion          | Weight | PostgreSQL | MongoDB  | Baserow (Employees) |
| ------------------ | ------ | ---------- | -------- | ------------------- |
| ACID               | 25     | 5          | 3        | 4                   |
| Auth integration   | 25     | 5          | 4        | 3                   |
| Ops fit            | 20     | 5          | 3        | 4                   |
| Cost               | 15     | 5          | 4        | 5                   |
| Migration effort   | 15     | 4          | 3        | 5                   |
| **Weighted total** |        | **4.85**   | **3.45** | **4.15**            |

**Decision:** **PostgreSQL** – Dedicated `users` table in `house_of_veritas` (or shared PG instance). Keeps auth data separate from Baserow operational data.

---

### 2. Audit Log

| Criterion          | Weight | PostgreSQL | MongoDB  | Blob (append) |
| ------------------ | ------ | ---------- | -------- | ------------- |
| Time-range queries | 25     | 5          | 5        | 2             |
| Compliance         | 25     | 5          | 4        | 3             |
| Append performance | 20     | 4          | 5        | 5             |
| Ops fit            | 15     | 5          | 3        | 4             |
| Retention / TTL    | 15     | 5          | 5        | 3             |
| **Weighted total** |        | **4.65**   | **4.35** | **3.25**      |

**Decision:** **PostgreSQL** – `audit_logs` table with indexes on `timestamp`, `user_id`, `action`, `resource_type`. MongoDB dual-write can remain for kiosk/analytics use cases if desired.

---

### 3. Rate Limiting

| Criterion            | Weight | Redis    | PostgreSQL | In-memory |
| -------------------- | ------ | -------- | ---------- | --------- |
| TTL / window support | 30     | 5        | 3          | 4         |
| Latency              | 25     | 5        | 3          | 5         |
| Multi-instance       | 25     | 5        | 4          | 1         |
| Ops complexity       | 20     | 4        | 5          | 5         |
| **Weighted total**   |        | **4.75** | **3.65**   | **3.65**  |

**Decision:** **Redis** – Use Redis when `REDIS_URL` is set; fallback to in-memory for local dev. Redis already in docker-compose for Baserow.

---

### 4. Real-Time Events (SSE)

| Criterion           | Weight | In-memory | PostgreSQL | Redis Pub/Sub |
| ------------------- | ------ | --------- | ---------- | ------------- |
| Latency             | 30     | 5         | 3          | 5             |
| Ephemeral by design | 25     | 5         | 2          | 4             |
| Ops complexity      | 25     | 5         | 3          | 4             |
| Optional archive    | 20     | 2         | 5          | 3             |
| **Weighted total**  |        | **4.35**  | **3.15**   | **4.15**      |

**Decision:** **In-memory primary** – Keep current behavior. Optional: write to PostgreSQL for recent-event replay (e.g. last 24h). Redis Pub/Sub considered if multi-instance scaling is needed.

---

### 5. Time-Clock / Biometric Records

| Criterion           | Weight | PostgreSQL | Baserow | MongoDB  |
| ------------------- | ------ | ---------- | ------- | -------- |
| Payroll integration | 30     | 5          | 5       | 3        |
| Ops fit             | 25     | 5          | 5       | 3        |
| Structured schema   | 25     | 5          | 5       | 4        |
| Biometric metadata  | 20     | 5          | 4       | 4        |
| **Weighted total**  |        | **5.0**    | **4.8** | **3.45** |

**Decision:** **PostgreSQL or Baserow** – Prefer Baserow Time Clock Entries table if schema matches. Otherwise, new `clock_records` table in PostgreSQL. Biometric enrollment: new `biometric_enrollments` table or Baserow extension.

---

## Summary: Polyglot Persistence Map

| Data                 | Store                           | Migration                                    |
| -------------------- | ------------------------------- | -------------------------------------------- |
| Users                | PostgreSQL `users`              | New table, seed from `lib/users.ts`          |
| Audit log            | PostgreSQL `audit_logs`         | New table; read from PG when configured      |
| Rate limit           | Redis                           | Use Redis when `REDIS_URL` set               |
| Events               | In-memory (optional PG archive) | No change; optional `event_archive` table    |
| Time clock           | PostgreSQL or Baserow           | Sync with Baserow Time table or new PG table |
| Biometric enrollment | PostgreSQL or Baserow           | New table or Baserow extension               |

---

## Consequences

### Positive

- Audit logs persist for compliance
- Rate limiting survives restarts
- Time-clock data available for payroll
- Users can be managed without code changes
- Reuses existing PostgreSQL and Redis

### Negative

- New PostgreSQL schema/tables to maintain
- Redis required for production rate limiting (already in docker-compose)
- Migration effort for each store

### Risks

- Redis not yet in Azure production – add to Terraform or use Azure Cache for Redis
- Baserow vs dedicated PG for time clock – prefer Baserow if schema aligns to avoid dual writes

---

## Implementation Order

1. **Audit log** – Add `audit_logs` table; read from PG when `DATABASE_URL` or `POSTGRES_URL` set
2. **Users** – Add `users` table; migrate from `lib/users.ts`; support both during transition
3. **Rate limiter** – Add Redis backend when `REDIS_URL` set
4. **Time clock** – Persist to Baserow Time table or new PG table
5. **Biometric enrollment** – New table when biometric feature is production-ready

---

## References

- [Technical Design](01-technical-design.md)
- [Infrastructure](03-infrastructure.md)
- `lib/audit-log.ts`, `lib/auth/rate-limit.ts`, `lib/users.ts`
- `lib/realtime/event-store.ts`, `app/api/biometric/route.ts`
