/**
 * Estate data-access seam.
 *
 * Consumers depend on these interfaces, never on a concrete datastore. Today the
 * only implementation delegates to `lib/services/baserow`; swapping to Postgres,
 * Cosmos, or anything else means adding a sibling implementation and changing
 * `getEstateRepository()` — not touching call sites.
 *
 * Capabilities are composed per entity rather than forced into one uniform CRUD
 * interface, because the entities genuinely differ: assets have no create path,
 * vehicle logs are read-only, and several entities have no by-id lookup. The
 * interface states what actually exists so the compiler catches assumptions.
 */

import * as baserow from "@/lib/services/baserow"
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
  RecurringTaskTemplate,
  Task,
  TimeClockEntry,
  VehicleLog,
} from "@/lib/domain/estate-types"

// ---------------------------------------------------------------------------
// Capability building blocks
// ---------------------------------------------------------------------------

export interface Listable<T, F = void> {
  list(filters?: F): Promise<T[]>
}

export interface Gettable<T> {
  get(id: EntityId): Promise<T | null>
}

export interface Creatable<T> {
  create(input: Omit<T, "id">): Promise<T | null>
}

export interface Updatable<T, U = Partial<T>> {
  update(id: EntityId, updates: U): Promise<T | null>
}

export interface Pageable<T, F = void> {
  listPaginated(page?: number, size?: number, filters?: F): Promise<PaginatedResult<T>>
}

/**
 * Per-entity readiness.
 *
 * Some entities can be unwritable while the store as a whole is reachable —
 * under Baserow a table id may be unset, so writes would silently no-op. Routes
 * that guard creation need to ask the entity, not just the connection.
 */
export interface Configurable {
  isConfigured(): boolean
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface TaskFilters {
  assignedTo?: number
  /** Name-based fallback used when the caller only knows the assignee's name. */
  assignedToName?: string
  status?: string
}

export interface ExpenseFilters {
  requester?: number
  status?: string
}

export interface EmployeeScopedFilters {
  employee?: number
  status?: string
}

export interface TimeClockFilters {
  employee?: number
  date?: string
}

export interface VehicleLogFilters {
  driver?: number
}

export interface IncidentFilters {
  type?: string
  status?: string
}

export interface PettyCashFilters {
  requester?: number
  status?: string
}

export interface BudgetFilters {
  period?: string
  status?: string
}

export interface InsuranceClaimFilters {
  incident?: number
  status?: string
}

export interface PPEFilters {
  issuedTo?: number
  status?: string
}

export interface ContractorContractFilters {
  status?: string
}

/** Assets expose a deliberately narrow update surface (checkout/lockout only). */
export interface AssetUpdate {
  lateReturnLockoutUntil?: string
  checkedOutBy?: number | null
  expectedReturnDate?: string | null
  checkOutDate?: string | null
}

// ---------------------------------------------------------------------------
// Entity repositories
// ---------------------------------------------------------------------------

export type EmployeeRepository = Listable<Employee> &
  Gettable<Employee> &
  Creatable<Employee> &
  Updatable<Employee> &
  Pageable<Employee> &
  Configurable & {
    /**
     * Resolve an app persona id (e.g. "hans") to an employee record id.
     * Name-based, so it is a best-effort lookup and may return null.
     */
    resolveIdByAppId(appId: string): Promise<EntityId | null>
  }

/** Narrow update surface — only the fields the expiry workflow writes back. */
export interface DocumentExpiryUpdate {
  docuSealRef?: string
  lastReview?: string
  status?: string
}

export type DocumentExpiryRepository = Listable<DocumentExpiryRow> &
  Updatable<DocumentExpiryRow, DocumentExpiryUpdate>

export type TaskRepositoryPort = Listable<Task, TaskFilters> &
  Gettable<Task> &
  Creatable<Task> &
  Updatable<Task> &
  Pageable<Task, TaskFilters> &
  Configurable & {
    /** Templates for tasks that regenerate on a schedule. */
    listRecurringTemplates(): Promise<RecurringTaskTemplate[]>
  }

export type ExpenseRepository = Listable<Expense, ExpenseFilters> &
  Gettable<Expense> &
  Creatable<Expense> &
  Updatable<Expense> &
  Pageable<Expense, ExpenseFilters>

/** No create path: assets are provisioned outside the app. */
export type AssetRepository = Listable<Asset, { type?: string; location?: string }> &
  Gettable<Asset> &
  Updatable<Asset, AssetUpdate> &
  Pageable<Asset>

export type LeaveRequestRepository = Listable<LeaveRequest, EmployeeScopedFilters> &
  Gettable<LeaveRequest> &
  Creatable<LeaveRequest> &
  Updatable<LeaveRequest>

export type LoanRepository = Listable<Loan, EmployeeScopedFilters> &
  Gettable<Loan> &
  Creatable<Loan> &
  Updatable<Loan>

/** No by-id lookup in the current backend. */
export type PettyCashRepository = Listable<PettyCash, PettyCashFilters> &
  Creatable<PettyCash> &
  Updatable<PettyCash>

export type OnboardingRepository = Listable<OnboardingChecklist, EmployeeScopedFilters> &
  Creatable<OnboardingChecklist> &
  Updatable<OnboardingChecklist> &
  Configurable

export type BudgetRepository = Listable<Budget, BudgetFilters> &
  Creatable<Budget> &
  Updatable<Budget>

export type IncidentRepository = Listable<Incident, IncidentFilters> &
  Creatable<Incident> &
  Updatable<Incident> &
  Configurable

export type PPERepository = Listable<PPE, PPEFilters> & Creatable<PPE> & Updatable<PPE>

export type InsuranceClaimRepository = Listable<InsuranceClaim, InsuranceClaimFilters> &
  Creatable<InsuranceClaim> &
  Updatable<InsuranceClaim>

/** Read-only in the current backend. */
export type ContractorContractRepository = Listable<
  ContractorContract,
  ContractorContractFilters
>

/** Read-only in the current backend. */
export type VehicleLogRepository = Listable<VehicleLog, VehicleLogFilters> &
  Pageable<VehicleLog, VehicleLogFilters>

/** Time clock carries domain verbs beyond CRUD. */
export type TimeClockRepository = Listable<TimeClockEntry, TimeClockFilters> &
  Updatable<TimeClockEntry> &
  Pageable<TimeClockEntry, TimeClockFilters> & {
    clockIn(employeeId: EntityId): Promise<TimeClockEntry | null>
    clockOut(entryId: EntityId): Promise<TimeClockEntry | null>
    clockInByAppId(appId: string): Promise<TimeClockEntry | null>
    clockOutByAppId(appId: string): Promise<TimeClockEntry | null>
  }

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export type EstateBackend = "baserow" | "postgres"

export interface EstateRepository {
  readonly backend: EstateBackend
  /** Whether the backing store is configured; unconfigured reads return empty. */
  isConfigured(): boolean

  employees: EmployeeRepository
  tasks: TaskRepositoryPort
  expenses: ExpenseRepository
  assets: AssetRepository
  leaveRequests: LeaveRequestRepository
  loans: LoanRepository
  pettyCash: PettyCashRepository
  onboarding: OnboardingRepository
  budgets: BudgetRepository
  incidents: IncidentRepository
  ppe: PPERepository
  insuranceClaims: InsuranceClaimRepository
  contractorContracts: ContractorContractRepository
  vehicleLogs: VehicleLogRepository
  timeClock: TimeClockRepository
  documentExpiry: DocumentExpiryRepository
}

// ---------------------------------------------------------------------------
// Baserow implementation
// ---------------------------------------------------------------------------

/**
 * Flatten Baserow's nested field objects into the domain shape. Keeping this
 * here rather than in the workflow is the whole point: `"Assigned To"[0].id`
 * and `Priority.value` are storage details, not domain concepts.
 */
function toRecurringTemplate(row: baserow.RecurringTaskTemplate): RecurringTaskTemplate {
  const priority = row.Priority?.value
  return {
    id: row.id,
    title: row.Title ?? "Task",
    description: row.Description,
    assignedTo: row["Assigned To"]?.[0]?.id,
    recurrence: row.Recurrence,
    isRecurring: row["Is Recurring"] !== false,
    priority: (priority as Task["priority"]) ?? "Medium",
    project: row.Project,
  }
}

const baserowEstateRepository: EstateRepository = {
  backend: "baserow",
  isConfigured: () => baserow.isBaserowConfigured(),

  employees: {
    isConfigured: () => baserow.isEmployeesTableConfigured(),
    resolveIdByAppId: (appId) => baserow.getBaserowEmployeeIdByAppId(appId),
    list: () => baserow.getEmployees(),
    get: (id) => baserow.getEmployee(id),
    create: (input) => baserow.createEmployee(input),
    update: (id, updates) => baserow.updateEmployee(id, updates),
    listPaginated: (page, size) => baserow.getEmployeesPaginated(page, size),
  },

  tasks: {
    // Mirrors the Baserow rule exactly: the tasks table id must be set, not
    // just the connection. Without it baserow.getTasks() falls back to the
    // Mongo task repository, so reporting "baserow" here would be a lie.
    isConfigured: () => baserow.getTaskDataSource() === "baserow",
    list: (filters) => baserow.getTasks(filters),
    get: (id) => baserow.getTask(id),
    create: (input) => baserow.createTask(input),
    update: (id, updates) => baserow.updateTask(id, updates),
    listPaginated: (page, size, filters) => baserow.getTasksPaginated(page, size, filters),
    listRecurringTemplates: async () =>
      (await baserow.getRecurringTaskTemplates()).map(toRecurringTemplate),
  },

  expenses: {
    list: (filters) => baserow.getExpenses(filters),
    get: (id) => baserow.getExpense(id),
    create: (input) => baserow.createExpense(input),
    update: (id, updates) => baserow.updateExpense(id, updates),
    listPaginated: (page, size, filters) => baserow.getExpensesPaginated(page, size, filters),
  },

  assets: {
    list: (filters) => baserow.getAssets(filters),
    get: (id) => baserow.getAsset(id),
    update: (id, updates) => baserow.updateAsset(id, updates),
    listPaginated: (page, size) => baserow.getAssetsPaginated(page, size),
  },

  leaveRequests: {
    list: (filters) => baserow.getLeaveRequests(filters),
    get: (id) => baserow.getLeaveRequest(id),
    create: (input) => baserow.createLeaveRequest(input),
    update: (id, updates) => baserow.updateLeaveRequest(id, updates),
  },

  loans: {
    list: (filters) => baserow.getLoans(filters),
    get: (id) => baserow.getLoan(id),
    create: (input) => baserow.createLoan(input),
    update: (id, updates) => baserow.updateLoan(id, updates),
  },

  pettyCash: {
    list: (filters) => baserow.getPettyCashRequests(filters),
    create: (input) => baserow.createPettyCashRequest(input),
    update: (id, updates) => baserow.updatePettyCashRequest(id, updates),
  },

  onboarding: {
    isConfigured: () => baserow.isOnboardingTableConfigured(),
    list: (filters) => baserow.getOnboardingChecklists(filters),
    create: (input) => baserow.createOnboardingChecklist(input),
    update: (id, updates) => baserow.updateOnboardingChecklist(id, updates),
  },

  budgets: {
    list: (filters) => baserow.getBudgets(filters),
    create: (input) => baserow.createBudget(input),
    update: (id, updates) => baserow.updateBudget(id, updates),
  },

  incidents: {
    isConfigured: () => baserow.isIncidentsTableConfigured(),
    list: (filters) => baserow.getIncidents(filters),
    create: (input) => baserow.createIncident(input),
    update: (id, updates) => baserow.updateIncident(id, updates),
  },

  ppe: {
    list: (filters) => baserow.getPPERecords(filters),
    create: (input) => baserow.createPPERecord(input),
    update: (id, updates) => baserow.updatePPERecord(id, updates),
  },

  insuranceClaims: {
    list: (filters) => baserow.getInsuranceClaims(filters),
    create: (input) => baserow.createInsuranceClaim(input),
    update: (id, updates) => baserow.updateInsuranceClaim(id, updates),
  },

  contractorContracts: {
    list: (filters) => baserow.getContractorContracts(filters),
  },

  vehicleLogs: {
    list: (filters) => baserow.getVehicleLogs(filters),
    listPaginated: (page, size, filters) => baserow.getVehicleLogsPaginated(page, size, filters),
  },

  documentExpiry: {
    list: () => baserow.getDocumentExpiryRows(),
    update: (id, updates) => baserow.updateDocumentExpiryRow(id, updates),
  },

  timeClock: {
    list: (filters) => baserow.getTimeClockEntries(filters),
    update: (id, updates) => baserow.updateTimeClockEntry(id, updates),
    listPaginated: (page, size, filters) =>
      baserow.getTimeClockEntriesPaginated(page, size, filters),
    clockIn: (employeeId) => baserow.clockIn(employeeId),
    clockOut: (entryId) => baserow.clockOut(entryId),
    clockInByAppId: (appId) => baserow.clockInByAppId(appId),
    clockOutByAppId: (appId) => baserow.clockOutByAppId(appId),
  },
}

/**
 * Resolve the estate repository.
 *
 * Single point of backend selection. Postgres is the consolidation target and
 * wins when `ESTATE_BACKEND=postgres` is set and Postgres is configured;
 * otherwise Baserow remains the default so nothing changes for existing
 * deployments until the flag is flipped deliberately.
 *
 * The Postgres module is required lazily so the `pg` pool is never constructed
 * in deployments still running on Baserow.
 *
 * NOTE: `require()` here is a known hazard. The identical pattern in
 * `radar-repository.ts` was statically resolved by the test module graph and
 * dragged `pg` into every transitive importer, causing widespread timeouts; it
 * was changed to an async `import()`. This resolver is left synchronous because
 * ~64 call sites depend on that, and it currently measures clean — but if
 * unexplained slowness appears across unrelated suites, suspect this first.
 */
export function getEstateRepository(): EstateRepository {
  if (process.env.ESTATE_BACKEND?.toLowerCase() !== "postgres") {
    return baserowEstateRepository
  }

  // Relative specifier, NOT the "@/" alias: the alias is resolved by the Next
  // bundler but not by plain Node, so an aliased require() made this branch
  // throw under Vitest/tsx and in any non-bundled script — i.e. the one switch
  // that enables the whole Postgres backend was unreachable outside Next.
  const { postgresEstateRepository } =
    require("./estate-repository-postgres") as typeof import("./estate-repository-postgres")

  return postgresEstateRepository.isConfigured() ? postgresEstateRepository : baserowEstateRepository
}

/**
 * Which store is actually serving tasks.
 *
 * Tasks are the one entity with a third backend (Mongo, via task-repository),
 * so this cannot be derived from `backend` alone. Reported to clients as a
 * provenance hint, not used for routing.
 */
export type TaskDataSource = EstateBackend | "mongodb" | "empty"

/**
 * Env-only check, deliberately duplicated from `lib/db/mongodb`.
 *
 * Importing that module here would pull the MongoClient driver into every
 * consumer of this seam — including `lib/api/response`, which nearly every
 * route imports. Duplicating a two-variable predicate is the cheaper trade.
 */
function mongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI || process.env.MONGO_URL)
}

export function getTaskDataSource(): TaskDataSource {
  const estate = getEstateRepository()
  if (estate.tasks.isConfigured()) return estate.backend
  if (mongoConfigured()) return "mongodb"
  return "empty"
}

/** Wire-shape translation is worth testing directly; nothing else may use this. */
export const estateRepositoryTestInternals = {
  toRecurringTemplate,
}
