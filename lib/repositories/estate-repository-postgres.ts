/**
 * PostgreSQL implementation of the estate repository.
 *
 * Field maps are explicit per entity — that mapping is the part worth reading,
 * so it is not generated. The SQL boilerplate around it (SELECT/INSERT/UPDATE
 * shaping, pagination, row decoding) is shared, because 15 entities of
 * hand-rolled identical SQL is where transcription bugs breed.
 *
 * Decoding matters: `pg` returns NUMERIC as string and DATE/TIMESTAMPTZ as
 * `Date`, while the domain types are all `number`/`string`. Each field carries a
 * kind so decoding is deterministic rather than guessed from the runtime value.
 */

import { ensureEstateSchema } from "@/lib/db/estate-schema"
import { isPostgresConfigured, query } from "@/lib/db/postgres"
import type {
  Asset,
  Budget,
  ContractorContract,
  DocumentExpiryRow,
  EntityId,
  Employee,
  Expense,
  Incident,
  InsuranceClaim,
  LeaveRequest,
  Loan,
  OnboardingChecklist,
  PaginatedResult,
  PettyCash,
  PPE,
  Task,
  TimeClockEntry,
  VehicleLog,
} from "@/lib/domain/estate-types"
import type {
  AssetUpdate,
  BudgetFilters,
  ContractorContractFilters,
  EmployeeScopedFilters,
  EstateRepository,
  ExpenseFilters,
  IncidentFilters,
  InsuranceClaimFilters,
  PettyCashFilters,
  PPEFilters,
  TaskFilters,
  TimeClockFilters,
  VehicleLogFilters,
} from "@/lib/repositories/estate-repository"

const DEFAULT_PAGE_SIZE = 100

type FieldKind = "text" | "int" | "num" | "bool" | "date" | "ts" | "intArray"

interface FieldDef {
  column: string
  kind: FieldKind
}

type FieldMap<T> = { [K in keyof Omit<T, "id">]-?: FieldDef }

interface TableDef<T> {
  table: string
  fields: FieldMap<T>
  /** Stable ordering so pagination is deterministic. */
  orderBy: string
}

// ---------------------------------------------------------------------------
// Encoding / decoding
// ---------------------------------------------------------------------------

function toDateString(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "string" && value) return value.slice(0, 10)
  return undefined
}

function toTimestampString(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value) return value
  return undefined
}

function decodeField(value: unknown, kind: FieldKind): unknown {
  if (value === null || value === undefined) return undefined

  switch (kind) {
    case "num":
    case "int": {
      // NUMERIC arrives as string to preserve precision; the domain wants number.
      const parsed = typeof value === "string" ? Number(value) : value
      return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined
    }
    case "bool":
      return Boolean(value)
    case "date":
      return toDateString(value)
    case "ts":
      return toTimestampString(value)
    case "intArray":
      return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : undefined
    case "text":
    default:
      return typeof value === "string" ? value : String(value)
  }
}

function decodeRow<T>(def: TableDef<T>, row: Record<string, unknown>): T {
  const result: Record<string, unknown> = { id: Number(row.id) }

  for (const [key, field] of Object.entries(def.fields) as Array<[string, FieldDef]>) {
    const decoded = decodeField(row[field.column], field.kind)
    if (decoded !== undefined) result[key] = decoded
  }

  return result as T
}

/** Split a partial domain object into parallel column/value arrays. */
function encodeFields<T>(
  def: TableDef<T>,
  input: Record<string, unknown>
): { columns: string[]; values: unknown[] } {
  const columns: string[] = []
  const values: unknown[] = []

  for (const [key, field] of Object.entries(def.fields) as Array<[string, FieldDef]>) {
    if (!(key in input)) continue
    const value = input[key]
    if (value === undefined) continue
    columns.push(field.column)
    values.push(value === null ? null : value)
  }

  return { columns, values }
}

// ---------------------------------------------------------------------------
// Generic operations
// ---------------------------------------------------------------------------

interface WhereClause {
  sql: string
  values: unknown[]
}

function buildWhere(conditions: Array<[string, unknown]>): WhereClause {
  const active = conditions.filter(([, value]) => value !== undefined && value !== null)
  if (active.length === 0) return { sql: "", values: [] }

  const sql = active.map(([column], index) => `${column} = $${index + 1}`).join(" AND ")
  return { sql: ` WHERE ${sql}`, values: active.map(([, value]) => value) }
}

async function ready(): Promise<boolean> {
  if (!isPostgresConfigured()) return false
  await ensureEstateSchema()
  return true
}

async function listRows<T>(def: TableDef<T>, where: WhereClause = { sql: "", values: [] }) {
  if (!(await ready())) return []

  const { rows } = await query<Record<string, unknown>>(
    `SELECT * FROM ${def.table}${where.sql} ORDER BY ${def.orderBy}`,
    where.values
  )
  return rows.map((row) => decodeRow(def, row))
}

async function listRowsPaginated<T>(
  def: TableDef<T>,
  page = 1,
  size = DEFAULT_PAGE_SIZE,
  where: WhereClause = { sql: "", values: [] }
): Promise<PaginatedResult<T>> {
  if (!(await ready())) return { items: [], count: 0 }

  const offset = Math.max(0, (page - 1) * size)
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${def.table}${where.sql}`,
    where.values
  )

  const { rows } = await query<Record<string, unknown>>(
    `SELECT * FROM ${def.table}${where.sql} ORDER BY ${def.orderBy} LIMIT $${
      where.values.length + 1
    } OFFSET $${where.values.length + 2}`,
    [...where.values, size, offset]
  )

  return {
    items: rows.map((row) => decodeRow(def, row)),
    count: Number(countResult.rows[0]?.count ?? 0),
  }
}

async function getRow<T>(def: TableDef<T>, id: EntityId): Promise<T | null> {
  if (!(await ready())) return null

  const { rows } = await query<Record<string, unknown>>(
    `SELECT * FROM ${def.table} WHERE id = $1`,
    [id]
  )
  return rows[0] ? decodeRow(def, rows[0]) : null
}

async function insertRow<T>(def: TableDef<T>, input: Omit<T, "id">): Promise<T | null> {
  if (!(await ready())) return null

  const { columns, values } = encodeFields(def, input as Record<string, unknown>)
  if (columns.length === 0) return null

  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ")
  const { rows } = await query<Record<string, unknown>>(
    `INSERT INTO ${def.table} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  )
  return rows[0] ? decodeRow(def, rows[0]) : null
}

async function updateRow<T>(
  def: TableDef<T>,
  id: EntityId,
  // `object` rather than `Record<string, unknown>`: declared interfaces (e.g.
  // AssetUpdate) have no implicit index signature and would not be assignable.
  // Only keys present in the field map are read, so the widening is safe.
  updates: object
): Promise<T | null> {
  if (!(await ready())) return null

  const { columns, values } = encodeFields(def, updates as Record<string, unknown>)
  if (columns.length === 0) return getRow(def, id)

  const assignments = columns.map((column, index) => `${column} = $${index + 1}`).join(", ")
  const { rows } = await query<Record<string, unknown>>(
    `UPDATE ${def.table} SET ${assignments} WHERE id = $${columns.length + 1} RETURNING *`,
    [...values, id]
  )
  return rows[0] ? decodeRow(def, rows[0]) : null
}

// ---------------------------------------------------------------------------
// Table definitions
// ---------------------------------------------------------------------------

const employees: TableDef<Employee> = {
  table: "employees",
  orderBy: "id ASC",
  fields: {
    fullName: { column: "full_name", kind: "text" },
    idNumber: { column: "id_number", kind: "text" },
    role: { column: "role", kind: "text" },
    employmentStartDate: { column: "employment_start_date", kind: "date" },
    probationStatus: { column: "probation_status", kind: "text" },
    contractRef: { column: "contract_ref", kind: "text" },
    leaveBalance: { column: "leave_balance", kind: "num" },
    email: { column: "email", kind: "text" },
    phone: { column: "phone", kind: "text" },
    photo: { column: "photo", kind: "text" },
    onboardingStatus: { column: "onboarding_status", kind: "text" },
    buddyId: { column: "buddy_id", kind: "int" },
    itProvisionedAt: { column: "it_provisioned_at", kind: "ts" },
  },
}

const assets: TableDef<Asset> = {
  table: "assets",
  orderBy: "id ASC",
  fields: {
    assetId: { column: "asset_id", kind: "text" },
    type: { column: "type", kind: "text" },
    description: { column: "description", kind: "text" },
    purchaseDate: { column: "purchase_date", kind: "date" },
    price: { column: "price", kind: "num" },
    condition: { column: "condition", kind: "text" },
    location: { column: "location", kind: "text" },
    checkedOutBy: { column: "checked_out_by", kind: "int" },
    checkOutDate: { column: "check_out_date", kind: "ts" },
    photo: { column: "photo", kind: "text" },
    expectedReturnDate: { column: "expected_return_date", kind: "ts" },
    lateReturnLockoutUntil: { column: "late_return_lockout_until", kind: "ts" },
  },
}

const tasks: TableDef<Task> = {
  table: "tasks",
  orderBy: "created_date DESC, id DESC",
  fields: {
    title: { column: "title", kind: "text" },
    description: { column: "description", kind: "text" },
    assignedTo: { column: "assigned_to", kind: "int" },
    assignedToName: { column: "assigned_to_name", kind: "text" },
    dueDate: { column: "due_date", kind: "date" },
    priority: { column: "priority", kind: "text" },
    status: { column: "status", kind: "text" },
    timeSpent: { column: "time_spent", kind: "num" },
    completionNotes: { column: "completion_notes", kind: "text" },
    relatedAsset: { column: "related_asset", kind: "int" },
    project: { column: "project", kind: "text" },
    createdDate: { column: "created_date", kind: "ts" },
    completedDate: { column: "completed_date", kind: "ts" },
    dependsOn: { column: "depends_on", kind: "intArray" },
  },
}

const timeClock: TableDef<TimeClockEntry> = {
  table: "time_clock_entries",
  orderBy: "date DESC, id DESC",
  fields: {
    employee: { column: "employee", kind: "int" },
    employeeName: { column: "employee_name", kind: "text" },
    date: { column: "date", kind: "date" },
    clockIn: { column: "clock_in", kind: "text" },
    clockOut: { column: "clock_out", kind: "text" },
    breakDuration: { column: "break_duration", kind: "num" },
    totalHours: { column: "total_hours", kind: "num" },
    overtimeHours: { column: "overtime_hours", kind: "num" },
    approvalStatus: { column: "approval_status", kind: "text" },
    notes: { column: "notes", kind: "text" },
  },
}

const expenses: TableDef<Expense> = {
  table: "expenses",
  orderBy: "date DESC, id DESC",
  fields: {
    requester: { column: "requester", kind: "int" },
    requesterName: { column: "requester_name", kind: "text" },
    type: { column: "type", kind: "text" },
    category: { column: "category", kind: "text" },
    amount: { column: "amount", kind: "num" },
    vendor: { column: "vendor", kind: "text" },
    date: { column: "date", kind: "date" },
    approvalStatus: { column: "approval_status", kind: "text" },
    receipt: { column: "receipt", kind: "text" },
    project: { column: "project", kind: "text" },
    milestone: { column: "milestone", kind: "text" },
    notes: { column: "notes", kind: "text" },
    approver: { column: "approver", kind: "int" },
    approvalDate: { column: "approval_date", kind: "ts" },
    secondaryApprover: { column: "secondary_approver", kind: "int" },
    secondaryApprovalDate: { column: "secondary_approval_date", kind: "ts" },
  },
}

const vehicleLogs: TableDef<VehicleLog> = {
  table: "vehicle_logs",
  orderBy: "date_out DESC, id DESC",
  fields: {
    driver: { column: "driver", kind: "int" },
    driverName: { column: "driver_name", kind: "text" },
    vehicle: { column: "vehicle", kind: "int" },
    vehicleName: { column: "vehicle_name", kind: "text" },
    dateOut: { column: "date_out", kind: "ts" },
    dateIn: { column: "date_in", kind: "ts" },
    odometerStart: { column: "odometer_start", kind: "num" },
    odometerEnd: { column: "odometer_end", kind: "num" },
    distance: { column: "distance", kind: "num" },
    fuelAdded: { column: "fuel_added", kind: "num" },
    fuelCost: { column: "fuel_cost", kind: "num" },
    childPassenger: { column: "child_passenger", kind: "bool" },
    notes: { column: "notes", kind: "text" },
  },
}

const leaveRequests: TableDef<LeaveRequest> = {
  table: "leave_requests",
  orderBy: "submitted_at DESC, id DESC",
  fields: {
    employee: { column: "employee", kind: "int" },
    startDate: { column: "start_date", kind: "date" },
    endDate: { column: "end_date", kind: "date" },
    type: { column: "type", kind: "text" },
    status: { column: "status", kind: "text" },
    approver: { column: "approver", kind: "int" },
    approvedAt: { column: "approved_at", kind: "ts" },
    submittedAt: { column: "submitted_at", kind: "ts" },
    notes: { column: "notes", kind: "text" },
  },
}

const loans: TableDef<Loan> = {
  table: "loans",
  orderBy: "created_at DESC, id DESC",
  fields: {
    employee: { column: "employee", kind: "int" },
    amount: { column: "amount", kind: "num" },
    purpose: { column: "purpose", kind: "text" },
    repaymentSchedule: { column: "repayment_schedule", kind: "text" },
    status: { column: "status", kind: "text" },
    outstandingBalance: { column: "outstanding_balance", kind: "num" },
    nextRepaymentDate: { column: "next_repayment_date", kind: "date" },
    approvedBy: { column: "approved_by", kind: "int" },
    approvedAt: { column: "approved_at", kind: "ts" },
    disbursedAt: { column: "disbursed_at", kind: "ts" },
    createdAt: { column: "created_at", kind: "ts" },
    notes: { column: "notes", kind: "text" },
  },
}

const pettyCash: TableDef<PettyCash> = {
  table: "petty_cash",
  orderBy: "created_at DESC, id DESC",
  fields: {
    requester: { column: "requester", kind: "int" },
    amount: { column: "amount", kind: "num" },
    purpose: { column: "purpose", kind: "text" },
    receipt: { column: "receipt", kind: "text" },
    status: { column: "status", kind: "text" },
    issuedBy: { column: "issued_by", kind: "int" },
    issuedAt: { column: "issued_at", kind: "ts" },
    approvedBy: { column: "approved_by", kind: "int" },
    approvedAt: { column: "approved_at", kind: "ts" },
    createdAt: { column: "created_at", kind: "ts" },
    notes: { column: "notes", kind: "text" },
  },
}

const onboarding: TableDef<OnboardingChecklist> = {
  table: "onboarding_checklists",
  orderBy: "created_at DESC, id DESC",
  fields: {
    employee: { column: "employee", kind: "int" },
    items: { column: "items", kind: "text" },
    completedAt: { column: "completed_at", kind: "ts" },
    assignedBuddy: { column: "assigned_buddy", kind: "int" },
    status: { column: "status", kind: "text" },
    createdAt: { column: "created_at", kind: "ts" },
    notes: { column: "notes", kind: "text" },
  },
}

const budgets: TableDef<Budget> = {
  table: "budgets",
  orderBy: "id DESC",
  fields: {
    category: { column: "category", kind: "text" },
    amount: { column: "amount", kind: "num" },
    period: { column: "period", kind: "text" },
    version: { column: "version", kind: "int" },
    status: { column: "status", kind: "text" },
    approvedBy: { column: "approved_by", kind: "int" },
    approvedAt: { column: "approved_at", kind: "ts" },
    docuSealRef: { column: "docuseal_ref", kind: "text" },
    notes: { column: "notes", kind: "text" },
  },
}

const ppe: TableDef<PPE> = {
  table: "ppe_records",
  orderBy: "issue_date DESC, id DESC",
  fields: {
    asset: { column: "asset", kind: "int" },
    issuedTo: { column: "issued_to", kind: "int" },
    issueDate: { column: "issue_date", kind: "date" },
    expiryDate: { column: "expiry_date", kind: "date" },
    returnDate: { column: "return_date", kind: "date" },
    status: { column: "status", kind: "text" },
    notes: { column: "notes", kind: "text" },
  },
}

const contractorContracts: TableDef<ContractorContract> = {
  table: "contractor_contracts",
  orderBy: "id DESC",
  fields: {
    contractor: { column: "contractor", kind: "text" },
    project: { column: "project", kind: "text" },
    milestones: { column: "milestones", kind: "text" },
    amounts: { column: "amounts", kind: "text" },
    status: { column: "status", kind: "text" },
    startDate: { column: "start_date", kind: "date" },
    endDate: { column: "end_date", kind: "date" },
    notes: { column: "notes", kind: "text" },
  },
}

const insuranceClaims: TableDef<InsuranceClaim> = {
  table: "insurance_claims",
  orderBy: "created_at DESC, id DESC",
  fields: {
    incident: { column: "incident", kind: "int" },
    asset: { column: "asset", kind: "int" },
    description: { column: "description", kind: "text" },
    amount: { column: "amount", kind: "num" },
    status: { column: "status", kind: "text" },
    claimId: { column: "claim_id", kind: "text" },
    submittedAt: { column: "submitted_at", kind: "ts" },
    createdAt: { column: "created_at", kind: "ts" },
    notes: { column: "notes", kind: "text" },
  },
}

const incidents: TableDef<Incident> = {
  table: "incidents",
  orderBy: "date_time DESC, id DESC",
  fields: {
    type: { column: "type", kind: "text" },
    dateTime: { column: "date_time", kind: "ts" },
    location: { column: "location", kind: "text" },
    reporter: { column: "reporter", kind: "int" },
    description: { column: "description", kind: "text" },
    severity: { column: "severity", kind: "text" },
    status: { column: "status", kind: "text" },
    relatedAsset: { column: "related_asset", kind: "int" },
    relatedEmployee: { column: "related_employee", kind: "int" },
    relatedIncidentIds: { column: "related_incident_ids", kind: "text" },
    victimSupportPath: { column: "victim_support_path", kind: "bool" },
  },
}

const documentExpiry: TableDef<DocumentExpiryRow> = {
  table: "document_expiry",
  orderBy: "next_review ASC NULLS LAST, id ASC",
  fields: {
    docName: { column: "doc_name", kind: "text" },
    type: { column: "type", kind: "text" },
    lastReview: { column: "last_review", kind: "date" },
    nextReview: { column: "next_review", kind: "date" },
    partyResponsible: { column: "party_responsible", kind: "intArray" },
    supersededBy: { column: "superseded_by", kind: "intArray" },
    versionBlocked: { column: "version_blocked", kind: "bool" },
    docuSealRef: { column: "docuseal_ref", kind: "text" },
    status: { column: "status", kind: "text" },
  },
}

// ---------------------------------------------------------------------------
// Time-clock helpers (domain verbs, parity with the Baserow behaviour)
// ---------------------------------------------------------------------------

/**
 * App persona id → employee name prefix. Mirrors the Baserow implementation so
 * clock-in by persona resolves identically across backends.
 */
const APP_ID_TO_NAME: Record<string, string> = {
  hans: "Hans",
  charl: "Charl",
  lucky: "Lucky",
  irma: "Irma",
}

/** "HH:MM" wall clock, matching the stored format. */
function wallClock(now: Date): string {
  return now.toTimeString().slice(0, 5)
}

function isoDate(now: Date): string {
  return now.toISOString().slice(0, 10)
}

async function resolveEmployeeIdByAppId(appId: string): Promise<EntityId | null> {
  const all = await listRows(employees)
  const name = (APP_ID_TO_NAME[appId.toLowerCase()] || appId).toLowerCase()
  const match = all.find(
    (employee) =>
      employee.fullName?.toLowerCase().startsWith(name) ||
      employee.fullName?.toLowerCase().includes(name)
  )
  return match ? match.id : null
}

async function clockIn(employeeId: EntityId): Promise<TimeClockEntry | null> {
  const now = new Date()
  return insertRow(timeClock, {
    employee: employeeId,
    date: isoDate(now),
    clockIn: wallClock(now),
    approvalStatus: "Pending",
  } as Omit<TimeClockEntry, "id">)
}

async function clockOut(entryId: EntityId): Promise<TimeClockEntry | null> {
  return updateRow(timeClock, entryId, { clockOut: wallClock(new Date()) })
}

/** Most recent entry for an employee that has been clocked in but not out. */
async function findOpenTimeClockEntry(employeeId: EntityId): Promise<TimeClockEntry | null> {
  if (!(await ready())) return null

  const { rows } = await query<Record<string, unknown>>(
    `SELECT * FROM ${timeClock.table}
     WHERE employee = $1 AND clock_out IS NULL
     ORDER BY date DESC, id DESC
     LIMIT 1`,
    [employeeId]
  )
  return rows[0] ? decodeRow(timeClock, rows[0]) : null
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const postgresEstateRepository: EstateRepository = {
  backend: "postgres",
  isConfigured: () => isPostgresConfigured(),

  employees: {
    // Postgres has no per-entity gate: the schema is created idempotently, so
    // entity readiness collapses to connection readiness.
    isConfigured: () => isPostgresConfigured(),
    resolveIdByAppId: (appId) => resolveEmployeeIdByAppId(appId),
    list: () => listRows(employees),
    get: (id) => getRow(employees, id),
    create: (input) => insertRow(employees, input),
    update: (id, updates) => updateRow(employees, id, updates),
    listPaginated: (page, size) => listRowsPaginated(employees, page, size),
  },

  tasks: {
    list: (filters?: TaskFilters) =>
      listRows(
        tasks,
        buildWhere([
          ["assigned_to", filters?.assignedTo],
          ["status", filters?.status],
        ])
      ),
    get: (id) => getRow(tasks, id),
    create: (input) => insertRow(tasks, input),
    update: (id, updates) => updateRow(tasks, id, updates),
    listPaginated: (page, size, filters?: TaskFilters) =>
      listRowsPaginated(
        tasks,
        page,
        size,
        buildWhere([
          ["assigned_to", filters?.assignedTo],
          ["status", filters?.status],
        ])
      ),
  },

  expenses: {
    list: (filters?: ExpenseFilters) =>
      listRows(
        expenses,
        buildWhere([
          ["requester", filters?.requester],
          ["approval_status", filters?.status],
        ])
      ),
    get: (id) => getRow(expenses, id),
    create: (input) => insertRow(expenses, input),
    update: (id, updates) => updateRow(expenses, id, updates),
    listPaginated: (page, size, filters?: ExpenseFilters) =>
      listRowsPaginated(
        expenses,
        page,
        size,
        buildWhere([
          ["requester", filters?.requester],
          ["approval_status", filters?.status],
        ])
      ),
  },

  assets: {
    list: (filters?: { type?: string; location?: string }) =>
      listRows(
        assets,
        buildWhere([
          ["type", filters?.type],
          ["location", filters?.location],
        ])
      ),
    get: (id) => getRow(assets, id),
    update: (id, updates: AssetUpdate) => updateRow(assets, id, updates),
    listPaginated: (page, size) => listRowsPaginated(assets, page, size),
  },

  leaveRequests: {
    list: (filters?: EmployeeScopedFilters) =>
      listRows(
        leaveRequests,
        buildWhere([
          ["employee", filters?.employee],
          ["status", filters?.status],
        ])
      ),
    get: (id) => getRow(leaveRequests, id),
    create: (input) => insertRow(leaveRequests, input),
    update: (id, updates) => updateRow(leaveRequests, id, updates),
  },

  loans: {
    list: (filters?: EmployeeScopedFilters) =>
      listRows(
        loans,
        buildWhere([
          ["employee", filters?.employee],
          ["status", filters?.status],
        ])
      ),
    get: (id) => getRow(loans, id),
    create: (input) => insertRow(loans, input),
    update: (id, updates) => updateRow(loans, id, updates),
  },

  pettyCash: {
    list: (filters?: PettyCashFilters) =>
      listRows(
        pettyCash,
        buildWhere([
          ["requester", filters?.requester],
          ["status", filters?.status],
        ])
      ),
    create: (input) => insertRow(pettyCash, input),
    update: (id, updates) => updateRow(pettyCash, id, updates),
  },

  onboarding: {
    isConfigured: () => isPostgresConfigured(),
    list: (filters?: EmployeeScopedFilters) =>
      listRows(
        onboarding,
        buildWhere([
          ["employee", filters?.employee],
          ["status", filters?.status],
        ])
      ),
    create: (input) => insertRow(onboarding, input),
    update: (id, updates) => updateRow(onboarding, id, updates),
  },

  budgets: {
    list: (filters?: BudgetFilters) =>
      listRows(
        budgets,
        buildWhere([
          ["period", filters?.period],
          ["status", filters?.status],
        ])
      ),
    create: (input) => insertRow(budgets, input),
    update: (id, updates) => updateRow(budgets, id, updates),
  },

  incidents: {
    isConfigured: () => isPostgresConfigured(),
    list: (filters?: IncidentFilters) =>
      listRows(
        incidents,
        buildWhere([
          ["type", filters?.type],
          ["status", filters?.status],
        ])
      ),
    create: (input) => insertRow(incidents, input),
    update: (id, updates) => updateRow(incidents, id, updates),
  },

  ppe: {
    list: (filters?: PPEFilters) =>
      listRows(
        ppe,
        buildWhere([
          ["issued_to", filters?.issuedTo],
          ["status", filters?.status],
        ])
      ),
    create: (input) => insertRow(ppe, input),
    update: (id, updates) => updateRow(ppe, id, updates),
  },

  insuranceClaims: {
    list: (filters?: InsuranceClaimFilters) =>
      listRows(
        insuranceClaims,
        buildWhere([
          ["incident", filters?.incident],
          ["status", filters?.status],
        ])
      ),
    create: (input) => insertRow(insuranceClaims, input),
    update: (id, updates) => updateRow(insuranceClaims, id, updates),
  },

  contractorContracts: {
    list: (filters?: ContractorContractFilters) =>
      listRows(contractorContracts, buildWhere([["status", filters?.status]])),
  },

  vehicleLogs: {
    list: (filters?: VehicleLogFilters) =>
      listRows(vehicleLogs, buildWhere([["driver", filters?.driver]])),
    listPaginated: (page, size, filters?: VehicleLogFilters) =>
      listRowsPaginated(vehicleLogs, page, size, buildWhere([["driver", filters?.driver]])),
  },

  documentExpiry: {
    list: () => listRows(documentExpiry),
    update: (id, updates) => updateRow(documentExpiry, id, updates),
  },

  timeClock: {
    list: (filters?: TimeClockFilters) =>
      listRows(
        timeClock,
        buildWhere([
          ["employee", filters?.employee],
          ["date", filters?.date],
        ])
      ),
    update: (id, updates) => updateRow(timeClock, id, updates),
    listPaginated: (page, size, filters?: TimeClockFilters) =>
      listRowsPaginated(
        timeClock,
        page,
        size,
        buildWhere([
          ["employee", filters?.employee],
          ["date", filters?.date],
        ])
      ),
    clockIn,
    clockOut,
    async clockInByAppId(appId) {
      const employeeId = await resolveEmployeeIdByAppId(appId)
      return employeeId === null ? null : clockIn(employeeId)
    },
    async clockOutByAppId(appId) {
      const employeeId = await resolveEmployeeIdByAppId(appId)
      if (employeeId === null) return null

      // `buildWhere` drops null values, so the open-entry predicate is written
      // explicitly: we want rows where clock_out IS NULL, not equality to null.
      const latest = await findOpenTimeClockEntry(employeeId)
      return latest ? clockOut(latest.id) : null
    },
  },
}

export const estateRepositoryPostgresTestInternals = {
  resolveEmployeeIdByAppId,
  decodeRow,
  buildWhere,
}
