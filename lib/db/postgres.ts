import { Pool, PoolClient, types } from "pg"
import type { PoolConfig } from "pg"
import { ManagedIdentityCredential } from "@azure/identity"
import { logger } from "@/lib/logger"

// DATE (oid 1082) must stay a plain "YYYY-MM-DD" string.
//
// node-postgres otherwise parses it into a JS Date at LOCAL midnight; calling
// .toISOString() on that then re-projects to UTC and loses a day on any host
// east of Greenwich. On SAST (UTC+2), DATE '2026-07-18' read back as
// "2026-07-17" across tasks, leave, expenses, PPE and the time clock.
//
// Overriding the parser fixes every date-typed column for both the estate and
// radar repositories at once, and matches what Baserow returned (strings).
types.setTypeParser(1082, (value) => value)

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL
const AZURE_POSTGRES_AUTH_MODE = process.env.AZURE_POSTGRES_AUTH_MODE
const AZURE_POSTGRES_HOST = process.env.AZURE_POSTGRES_HOST
const AZURE_POSTGRES_DATABASE = process.env.AZURE_POSTGRES_DATABASE
const AZURE_POSTGRES_USER = process.env.AZURE_POSTGRES_USER
const POSTGRES_TOKEN_SCOPE = "https://ossrdbms-aad.database.windows.net/.default"

let pool: Pool | null = null
let managedIdentityCredential: ManagedIdentityCredential | null = null

export function isPostgresConfigured(): boolean {
  return Boolean(DATABASE_URL || AZURE_POSTGRES_AUTH_MODE)
}

function getPoolConfiguration(): PoolConfig {
  if (AZURE_POSTGRES_AUTH_MODE === "entra-only" && DATABASE_URL) {
    throw new Error(
      "DATABASE_URL/POSTGRES_URL must be absent when AZURE_POSTGRES_AUTH_MODE=entra-only"
    )
  }

  if (AZURE_POSTGRES_AUTH_MODE === "entra-only") {
    if (!AZURE_POSTGRES_HOST || !AZURE_POSTGRES_DATABASE || !AZURE_POSTGRES_USER) {
      throw new Error(
        "AZURE_POSTGRES_HOST, AZURE_POSTGRES_DATABASE and AZURE_POSTGRES_USER are required for Entra-only PostgreSQL"
      )
    }

    if (!AZURE_POSTGRES_HOST.endsWith(".postgres.database.azure.com")) {
      throw new Error("AZURE_POSTGRES_HOST must be an Azure PostgreSQL hostname")
    }

    managedIdentityCredential ??= new ManagedIdentityCredential()

    return {
      host: AZURE_POSTGRES_HOST,
      port: 5432,
      database: AZURE_POSTGRES_DATABASE,
      user: AZURE_POSTGRES_USER,
      ssl: { rejectUnauthorized: true },
      password: async () => {
        const accessToken = await managedIdentityCredential!.getToken(POSTGRES_TOKEN_SCOPE)
        if (!accessToken?.token) {
          throw new Error("Managed identity did not return a PostgreSQL access token")
        }
        return accessToken.token
      },
    }
  }

  if (DATABASE_URL) {
    return { connectionString: DATABASE_URL }
  }

  throw new Error("DATABASE_URL/POSTGRES_URL or AZURE_POSTGRES_AUTH_MODE=entra-only is required")
}

export async function getPool(): Promise<Pool> {
  if (!isPostgresConfigured()) {
    throw new Error("PostgreSQL is not configured")
  }
  if (!pool) {
    pool = new Pool({
      ...getPoolConfiguration(),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
    pool.on("error", (err) => {
      logger.error("PostgreSQL pool error", { error: err.message })
    })
  }
  return pool
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const p = await getPool()
  const result = await p.query(text, params)
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 }
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const p = await getPool()
  const client = await p.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

export async function ensureSchema(): Promise<void> {
  if (!isPostgresConfigured()) return

  try {
    await withClient(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT,
          resource_name TEXT,
          details JSONB,
          ip_address TEXT,
          user_agent TEXT,
          success BOOLEAN NOT NULL DEFAULT true,
          error_message TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          oidc_email TEXT,
          phone TEXT NOT NULL,
          role TEXT NOT NULL,
          description TEXT DEFAULT '',
          color TEXT DEFAULT 'gray',
          theme_id TEXT,
          icon TEXT DEFAULT '👤',
          specialty TEXT[] DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
      `)

      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_id TEXT;`)
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_email TEXT;`)

      // Legacy column drop: pre-OIDC databases created `users` with a NOT NULL
      // `password_hash` column. The bcrypt+JWT auth it backed was fully removed
      // in the Auth.js/Mystira OIDC migration, so the column is now dead weight
      // (and its NOT NULL constraint blocks inserts that omit it). Idempotent —
      // a no-op on fresh databases where the column was never created.
      await client.query(`ALTER TABLE users DROP COLUMN IF EXISTS password_hash;`)

      await client.query(`
        CREATE TABLE IF NOT EXISTS file_uploads (
          id TEXT PRIMARY KEY,
          original_name TEXT NOT NULL,
          stored_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size INTEGER NOT NULL,
          uploaded_by TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'general',
          resource_type TEXT,
          resource_id TEXT,
          storage TEXT NOT NULL DEFAULT 'local',
          storage_path TEXT,
          blob_name TEXT,
          container_name TEXT,
          owner_id_hash TEXT,
          url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS container_name TEXT;
        ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS owner_id_hash TEXT;
        CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_by ON file_uploads(uploaded_by);
        CREATE INDEX IF NOT EXISTS idx_file_uploads_category ON file_uploads(category);
        CREATE INDEX IF NOT EXISTS idx_file_uploads_resource ON file_uploads(resource_type, resource_id);
      `)
    })
    logger.info("PostgreSQL schema ensured")
  } catch (err) {
    logger.error("PostgreSQL schema ensure failed", {
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    managedIdentityCredential = null
    logger.info("PostgreSQL pool closed")
  }
}
