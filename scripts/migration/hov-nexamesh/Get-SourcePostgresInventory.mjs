#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import process from "node:process"
import pg from "pg"

const SOURCE_TENANT = "9530cd32-9e33-47f0-9247-ed964730b580"
const SOURCE_SUBSCRIPTION = "bb4e3882-2079-4bab-8974-611bc0b8bb58"
const SOURCE_RESOURCE_GROUP = "nl-prod-hov-rg"
const SOURCE_POSTGRES_HOST = "nl-prod-shared-pg.postgres.database.azure.com"
const TARGET_TENANT = "5384ef74-e517-4b22-9472-df990f61e8b5"
const TARGET_SUBSCRIPTION = "8a5dc70a-bafa-4a04-a281-9b4862a70810"

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function option(name) {
  const index = process.argv.indexOf(name)
  if (index < 0 || !process.argv[index + 1]) fail(`Missing required option ${name}.`)
  return process.argv[index + 1]
}

function azJson(args) {
  return JSON.parse(
    execFileSync("az", [...args, "--output", "json", "--only-show-errors"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
  )
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`
}

const outputPath = resolve(option("--output"))
const expectedDatabase = option("--expected-database")
const expectedRole = option("--expected-role")
const crossBoundaryRunner = process.argv.includes("--migration-runner-cross-boundary")
const connectionString = process.env.HOV_SOURCE_DATABASE_URL
if (!connectionString) fail("HOV_SOURCE_DATABASE_URL is required in process environment.")

let parsedConnection
try {
  parsedConnection = new URL(connectionString)
} catch {
  fail("HOV_SOURCE_DATABASE_URL is not a valid PostgreSQL URL.")
}
if (
  parsedConnection.hostname !== SOURCE_POSTGRES_HOST ||
  decodeURIComponent(parsedConnection.username) !== expectedRole ||
  decodeURIComponent(parsedConnection.pathname.replace(/^\//, "")) !== expectedDatabase ||
  parsedConnection.searchParams.get("sslmode") !== "verify-full" ||
  parsedConnection.searchParams.get("sslrootcert") !== "system"
) {
  fail(
    "PostgreSQL URL does not match the exact approved source host, database, role and system-trust TLS policy."
  )
}

const account = azJson(["account", "show"])
if (crossBoundaryRunner) {
  if (account.tenantId !== TARGET_TENANT || account.id !== TARGET_SUBSCRIPTION) {
    fail(
      "Cross-boundary source inventory must run on the exact target migration-runner Azure context."
    )
  }
} else {
  if (account.tenantId !== SOURCE_TENANT || account.id !== SOURCE_SUBSCRIPTION) {
    fail("Azure context does not match the exact HOV source tenant and subscription.")
  }
  const sourceGroupExists = execFileSync(
    "az",
    [
      "group",
      "exists",
      "--name",
      SOURCE_RESOURCE_GROUP,
      "--subscription",
      SOURCE_SUBSCRIPTION,
      "--output",
      "tsv",
      "--only-show-errors",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
  ).trim()
  if (sourceGroupExists !== "true") fail("The exact HOV source resource group was not found.")
}

// Match the application contract: PostgreSQL DATE (OID 1082) remains YYYY-MM-DD.
pg.types.setTypeParser(1082, (value) => value)
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 5_000,
  application_name: "hov-nexamesh-readonly-inventory",
})

try {
  const identity = (
    await pool.query(
      "SELECT current_database() AS database, current_user AS role, current_setting('server_version') AS version, current_setting('TimeZone') AS timezone, DATE '2026-07-18' AS date_control, pg_is_in_recovery() AS recovering"
    )
  ).rows[0]
  if (identity.database !== expectedDatabase || identity.role !== expectedRole) {
    fail("PostgreSQL connection does not match the exact expected source database and role.")
  }
  if (identity.date_control !== "2026-07-18") fail("Node PostgreSQL DATE fidelity control failed.")

  const extensions = (
    await pool.query(
      "SELECT extname AS name, extversion AS version FROM pg_extension ORDER BY extname"
    )
  ).rows
  const tables = (
    await pool.query(
      "SELECT schemaname AS schema, tablename AS table, tableowner AS owner FROM pg_tables WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema' ORDER BY schemaname, tablename"
    )
  ).rows
  const indexes = (
    await pool.query(
      "SELECT schemaname AS schema, tablename AS table, indexname AS index FROM pg_indexes WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema' ORDER BY schemaname, tablename, indexname"
    )
  ).rows

  const measurements = []
  for (const table of tables) {
    const qualified = `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.table)}`
    const count = await pool.query(`SELECT count(*)::bigint AS count FROM ${qualified}`)
    measurements.push({
      schema: table.schema,
      table: table.table,
      owner: table.owner,
      rowCount: count.rows[0].count,
    })
  }

  const result = {
    schemaVersion: 1,
    capturedAtUtc: new Date().toISOString(),
    boundary: {
      tenantId: crossBoundaryRunner ? TARGET_TENANT : SOURCE_TENANT,
      subscriptionId: crossBoundaryRunner ? TARGET_SUBSCRIPTION : SOURCE_SUBSCRIPTION,
      resourceGroup: SOURCE_RESOURCE_GROUP,
      execution: crossBoundaryRunner ? "target-vnet-migration-runner" : "source-operator-context",
      sourcePostgresHost: SOURCE_POSTGRES_HOST,
    },
    database: identity.database,
    role: identity.role,
    serverVersion: identity.version,
    serverTimeZone: identity.timezone,
    recovering: identity.recovering,
    dateFidelityControl: identity.date_control,
    extensions,
    tables: measurements,
    indexes,
    safeguards: [
      "No row contents were selected",
      "No connection string or credential was logged or written",
      "Only names, owners, counts, extension/index metadata, and DATE control were recorded",
    ],
  }
  if (outputPath.match(/(?:^|[\\/])(?:\.git|secrets?|credentials?)(?:[\\/]|$)/i)) {
    fail("Unsafe output path.")
  }
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  })
  process.stdout.write(`Read-only PostgreSQL inventory written to ${outputPath}\n`)
} catch (error) {
  // Database errors can include connection details; emit a fixed message only.
  fail("Read-only PostgreSQL inventory failed. Review protected operator diagnostics.")
} finally {
  await pool.end().catch(() => {})
}
