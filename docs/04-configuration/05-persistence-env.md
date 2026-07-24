# Persistence Environment Variables

When configured, House of Veritas uses PostgreSQL for audit logs, users, and file upload metadata; Redis for rate limiting; MongoDB for kiosk requests and audit-log fallback; Baserow for time-clock records; and Azure Blob Storage or local disk for uploaded files.

## PostgreSQL (audit_logs, users)

| Variable       | Description                                                  | Example                                                             |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string for House of Veritas app tables | `postgresql://user:pass@host:5432/house_of_veritas?sslmode=require` |
| `POSTGRES_URL` | Alternative to DATABASE_URL                                  | Same format                                                         |

The `house_of_veritas` database is created automatically when using Docker Compose (see `config/docker-compose.yml`). For production, add this database to your Terraform PostgreSQL module.

## Redis (rate limiting)

| Variable    | Description             | Example                            |
| ----------- | ----------------------- | ---------------------------------- |
| `REDIS_URL` | Redis connection string | `redis://:password@localhost:6379` |

When set, rate limiting uses Redis instead of in-memory storage. Redis is already in Docker Compose for Baserow; use the same instance or a dedicated one.

## MongoDB (Cosmos DB Mongo API)

| Variable      | Description                | Example                                                                          |
| ------------- | -------------------------- | -------------------------------------------------------------------------------- |
| `MONGODB_URI` | MongoDB connection string  | `mongodb://<account>.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb` |
| `MONGO_URL`   | Alternative to MONGODB_URI | Same format                                                                      |

When set, kiosk requests (stock orders, salary advances, issue reports) are stored in MongoDB. When PostgreSQL is not configured, the audit log reads from MongoDB. When MongoDB is unavailable, kiosk uses an in-memory fallback. For local development, MongoDB is included in Docker Compose (`config/docker-compose.yml`).

### Cosmos DB Configuration

The Terraform module (`terraform/modules/cosmosdb-mongo`) provisions a Cosmos DB account with Mongo API compatibility. Key settings:

- **Throughput:** Default 400 RU/s (configurable, min 400, max 1000000)
- **Public Network Access:** Disabled by default for security (enable only for development)
- **Consistency Level:** Session (configurable: Eventual, ConsistentPrefix, BoundedStaleness, Strong)
- **Free Tier:** Disabled by default (enable for dev/test environments only)

### Storage Synchronization Strategy

The application uses a tiered persistence approach:

1. **Primary:** PostgreSQL for structured data (users, audit logs, file metadata)
2. **Secondary:** Cosmos DB Mongo API for high-write scenarios (kiosk requests)
3. **Fallback:** In-memory stores when databases are unavailable
4. **File Storage:** Azure Blob Storage with local `/tmp` fallback

Data flows:

- Kiosk requests → MongoDB (with in-memory fallback)
- Audit logs → PostgreSQL → MongoDB fallback (if PostgreSQL unavailable)
- File uploads → Azure Blob → Local disk fallback
- Time-clock records → Baserow (when configured)

## Baserow (time-clock persistence)

Time-clock records are persisted to Baserow when `BASEROW_API_URL`, `BASEROW_TOKEN`, and `BASEROW_TABLE_TIME_CLOCK` are configured. See [02-baserow-setup.md](02-baserow-setup.md).

## File/Image Uploads

| API            | Storage                                                               | Metadata                                                          |
| -------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `/api/files`   | Azure Blob (asset-photos, invoice-scans, documents) or `/tmp/uploads` | Returned in response only                                         |
| `/api/uploads` | `/home/hov-uploads` in production; `/tmp/hov-uploads` locally/tests     | PostgreSQL `file_uploads` when `DATABASE_URL` set; else sidecar + in-memory |

**Serving:** Files uploaded via `/api/uploads` are served at `GET /api/uploads/{fileId}`. Files in `/tmp/uploads` (from `/api/files` when Azure not configured) are served at `GET /api/files/serve?category=...&filename=...`.
