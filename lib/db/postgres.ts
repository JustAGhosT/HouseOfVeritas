import { Pool, PoolClient } from "pg"
import { logger } from "@/lib/logger"

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL

let pool: Pool | null = null

export function isPostgresConfigured(): boolean {
  return !!DATABASE_URL
}

export async function getPool(): Promise<Pool> {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL or POSTGRES_URL is not configured")
  }
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
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
          url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
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
    logger.info("PostgreSQL pool closed")
  }
}
