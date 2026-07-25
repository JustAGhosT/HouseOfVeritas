// Baserow API Integration Service
// This service handles all interactions with the Baserow operational database

import { logger } from "@/lib/logger"
import { toISODateString } from "@/lib/utils"
import { isMongoConfigured } from "@/lib/db/mongodb"
import { getTaskRepository } from "@/lib/repositories/task-repository"

interface BaserowConfig {
  apiUrl: string
  apiToken: string
  databaseId: string
}

// Table IDs - these will be configured once Baserow is deployed
interface TableIds {
  employees: number
  assets: number
  tasks: number
  timeClock: number
  incidents: number
  vehicleLogs: number
  expenses: number
  documentExpiry: number
  leaveRequests: number
  loans: number
  pettyCash: number
  onboardingChecklist: number
  budget: number
  ppe: number
  policyVersions: number
  contractorContracts: number
  insuranceClaims: number
}

// Generic row type
interface BaserowRow {
  id: number
  [key: string]: any
}

export interface PaginatedResult<T> {
  items: T[]
  count: number
}

const DEFAULT_PAGE_SIZE = 100
const DEMO_DATA_ENABLED = process.env.ALLOW_DEMO_DATA === "true"

function appendPagination(endpoint: string, page?: number, size?: number): string {
  if (page == null && size == null) return endpoint
  const params = new URLSearchParams()
  if (page != null) params.set("page", String(page))
  if (size != null) params.set("size", String(size))
  const sep = endpoint.includes("?") ? "&" : "?"
  return `${endpoint}${sep}${params.toString()}`
}

// Employee type
export interface Employee {
  id: number
  fullName: string
  idNumber?: string
  role: string
  employmentStartDate?: string
  probationStatus?: string
  contractRef?: string
  leaveBalance: number
  email: string
  phone: string
  photo?: string
  onboardingStatus?: string
  buddyId?: number
  itProvisionedAt?: string
}

// Asset type
export interface Asset {
  id: number
  assetId: string
  type: string
  description?: string
  purchaseDate?: string
  price?: number
  condition: string
  location: string
  checkedOutBy?: number
  checkOutDate?: string
  photo?: string
  expectedReturnDate?: string
  lateReturnLockoutUntil?: string
}

// Task type
export interface Task {
  id: number
  title: string
  description?: string
  assignedTo?: number
  assignedToName?: string
  dueDate?: string
  priority: "Low" | "Medium" | "High" | "Urgent"
  status: "Not Started" | "In Progress" | "Completed"
  timeSpent?: number
  completionNotes?: string
  relatedAsset?: number
  project?: string
  createdDate?: string
  completedDate?: string
  dependsOn?: number[]
}

// Time Clock Entry type
export interface TimeClockEntry {
  id: number
  employee: number
  employeeName?: string
  date: string
  clockIn?: string
  clockOut?: string
  breakDuration?: number
  totalHours?: number
  overtimeHours?: number
  approvalStatus: "Pending" | "Approved" | "Rejected"
  notes?: string
}

// Expense type
export interface Expense {
  id: number
  requester: number
  requesterName?: string
  type: "Request" | "Post-Hoc"
  category: string
  amount: number
  vendor?: string
  date: string
  approvalStatus: "Pending" | "Approved" | "Rejected" | "Post-Hoc" | "Pending Secondary"
  receipt?: string
  project?: string
  milestone?: string
  notes?: string
  approver?: number
  approvalDate?: string
  secondaryApprover?: number
  secondaryApprovalDate?: string
}

// Vehicle Log type
export interface VehicleLog {
  id: number
  driver: number
  driverName?: string
  vehicle: number
  vehicleName?: string
  dateOut: string
  dateIn?: string
  odometerStart: number
  odometerEnd?: number
  distance?: number
  fuelAdded?: number
  fuelCost?: number
  childPassenger?: boolean
  notes?: string
}

// Default config - uses environment variables or fallback
const getConfig = (): BaserowConfig => ({
  apiUrl: process.env.BASEROW_API_URL || "https://ops.nexamesh.ai/api",
  apiToken: process.env.BASEROW_API_TOKEN || "",
  databaseId: process.env.BASEROW_DATABASE_ID || "",
})

// Table IDs - would be configured after Baserow deployment
const getTableIds = (): TableIds => ({
  employees: parseInt(process.env.BASEROW_TABLE_EMPLOYEES || "0"),
  assets: parseInt(process.env.BASEROW_TABLE_ASSETS || "0"),
  tasks: parseInt(process.env.BASEROW_TABLE_TASKS || "0"),
  timeClock: parseInt(process.env.BASEROW_TABLE_TIME_CLOCK || "0"),
  incidents: parseInt(process.env.BASEROW_TABLE_INCIDENTS || "0"),
  vehicleLogs: parseInt(process.env.BASEROW_TABLE_VEHICLE_LOGS || "0"),
  expenses: parseInt(process.env.BASEROW_TABLE_EXPENSES || "0"),
  documentExpiry: parseInt(process.env.BASEROW_TABLE_DOCUMENT_EXPIRY || "0"),
  leaveRequests: parseInt(process.env.BASEROW_TABLE_LEAVE_REQUESTS || "0"),
  loans: parseInt(process.env.BASEROW_TABLE_LOANS || "0"),
  pettyCash: parseInt(process.env.BASEROW_TABLE_PETTY_CASH || "0"),
  onboardingChecklist: parseInt(process.env.BASEROW_TABLE_ONBOARDING_CHECKLIST || "0"),
  budget: parseInt(process.env.BASEROW_TABLE_BUDGET || "0"),
  ppe: parseInt(process.env.BASEROW_TABLE_PPE || "0"),
  policyVersions: parseInt(process.env.BASEROW_TABLE_POLICY_VERSIONS || "0"),
  contractorContracts: parseInt(process.env.BASEROW_TABLE_CONTRACTOR_CONTRACTS || "0"),
  insuranceClaims: parseInt(process.env.BASEROW_TABLE_INSURANCE_CLAIMS || "0"),
})

// Check if Baserow is configured
export const isBaserowConfigured = (): boolean => {
  const config = getConfig()
  return !!config.apiToken && !!config.databaseId
}

export type TaskDataSource = "baserow" | "mongodb" | "empty"

export function getTaskDataSource(): TaskDataSource {
  const tableIds = getTableIds()
  if (isBaserowConfigured() && !!tableIds.tasks) return "baserow"
  if (isMongoConfigured()) return "mongodb"
  return "empty"
}

export function isIncidentsTableConfigured(): boolean {
  const tableIds = getTableIds()
  return isBaserowConfigured() && !!tableIds.incidents
}

export function isEmployeesTableConfigured(): boolean {
  const tableIds = getTableIds()
  return isBaserowConfigured() && !!tableIds.employees
}

export function isOnboardingTableConfigured(): boolean {
  const tableIds = getTableIds()
  return isBaserowConfigured() && !!tableIds.onboardingChecklist
}

// Generic fetch function
async function baserowFetch<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  const config = getConfig()

  if (!config.apiToken) {
    return null
  }

  const FETCH_TIMEOUT_MS = 10000
  try {
    const response = await fetch(`${config.apiUrl}${endpoint}`, {
      ...options,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Authorization: `Token ${config.apiToken}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Baserow API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    logger.error("Baserow API error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// ==================== EMPLOYEES ====================

export async function getEmployees(): Promise<Employee[]> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.employees) {
    return getMockEmployees()
  }

  const result = await baserowFetch<{ results: BaserowRow[] }>(
    `/database/rows/table/${tableIds.employees}/?user_field_names=true`
  )

  if (!result) {
    return getMockEmployees()
  }

  return result.results.map(mapRowToEmployee)
}

export async function getEmployeesPaginated(
  page: number = 1,
  size: number = DEFAULT_PAGE_SIZE
): Promise<PaginatedResult<Employee>> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.employees) {
    const items = getMockEmployees()
    return { items, count: items.length }
  }

  const endpoint = appendPagination(
    `/database/rows/table/${tableIds.employees}/?user_field_names=true`,
    page,
    size
  )
  const result = await baserowFetch<{ results: BaserowRow[]; count?: number }>(endpoint)

  if (!result) {
    const items = getMockEmployees()
    return { items, count: items.length }
  }

  return {
    items: result.results.map(mapRowToEmployee),
    count: result.count ?? result.results.length,
  }
}

export async function getEmployee(id: number): Promise<Employee | null> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.employees) {
    return getMockEmployees().find((e) => e.id === id) || null
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.employees}/${id}/?user_field_names=true`
  )

  return row ? mapRowToEmployee(row) : null
}

export async function updateEmployee(
  id: number,
  updates: Partial<
    Pick<
      Employee,
      "leaveBalance" | "contractRef" | "probationStatus" | "onboardingStatus" | "itProvisionedAt"
    >
  >
): Promise<Employee | null> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.employees) {
    const mock = getMockEmployees().find((e) => e.id === id)
    return mock ? { ...mock, ...updates } : null
  }

  const body: Record<string, unknown> = {}
  if (updates.leaveBalance !== undefined) body["Leave Balance"] = updates.leaveBalance
  if (updates.contractRef !== undefined) body["Contract Ref"] = updates.contractRef
  if (updates.probationStatus !== undefined) body["Probation Status"] = updates.probationStatus
  if (updates.onboardingStatus !== undefined) body["Onboarding Status"] = updates.onboardingStatus
  if (updates.itProvisionedAt !== undefined) body["IT Provisioned At"] = updates.itProvisionedAt
  if (Object.keys(body).length === 0) return getEmployee(id)

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.employees}/${id}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  )

  return row ? mapRowToEmployee(row) : null
}

function mapEmployeeToRow(emp: Partial<Employee>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (emp.fullName !== undefined) row["Full Name"] = emp.fullName
  if (emp.idNumber !== undefined) row["ID Number"] = emp.idNumber
  if (emp.role !== undefined) row["Role"] = emp.role
  if (emp.employmentStartDate !== undefined) row["Employment Start Date"] = emp.employmentStartDate
  if (emp.probationStatus !== undefined) row["Probation Status"] = emp.probationStatus
  if (emp.contractRef !== undefined) row["Contract Ref"] = emp.contractRef
  if (emp.leaveBalance !== undefined) row["Leave Balance"] = emp.leaveBalance
  if (emp.email !== undefined) row["Email"] = emp.email
  if (emp.phone !== undefined) row["Phone"] = emp.phone
  if (emp.onboardingStatus !== undefined) row["Onboarding Status"] = emp.onboardingStatus
  return row
}

export async function createEmployee(emp: Omit<Employee, "id">): Promise<Employee | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.employees) return null

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.employees}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(mapEmployeeToRow(emp)),
    }
  )
  return row ? mapRowToEmployee(row) : null
}

// ==================== TASKS ====================

export async function getTask(id: number): Promise<Task | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.tasks) {
    if (isMongoConfigured()) {
      return (await getTaskRepository("mongodb")).get(id)
    }
    return getMockTasks().find((task) => task.id === id) ?? null
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.tasks}/${id}/?user_field_names=true`
  )
  return row ? mapRowToTask(row) : null
}

export async function getTasks(filters?: {
  assignedTo?: number
  assignedToName?: string
  status?: string
}): Promise<Task[]> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.tasks) {
    if (isMongoConfigured()) {
      return (await getTaskRepository("mongodb")).list(filters)
    }
    let tasks = getMockTasks()
    if (filters?.assignedTo) {
      tasks = tasks.filter((t) => t.assignedTo === filters.assignedTo)
    } else if (filters?.assignedToName) {
      const name = filters.assignedToName.toLowerCase()
      tasks = tasks.filter((t) => (t.assignedToName ?? "").toLowerCase() === name)
    }
    if (filters?.status) {
      tasks = tasks.filter((t) => t.status === filters.status)
    }
    return tasks
  }

  let endpoint = `/database/rows/table/${tableIds.tasks}/?user_field_names=true`
  if (filters?.assignedTo) {
    endpoint += `&filter__field_assigned_to__link_row_has=${filters.assignedTo}`
  }
  if (filters?.status) {
    endpoint += `&filter__field_status__equal=${filters.status}`
  }

  const result = await baserowFetch<{ results: BaserowRow[] }>(endpoint)

  if (!result) {
    return getMockTasks()
  }

  return result.results.map(mapRowToTask)
}

export async function getTasksPaginated(
  page: number = 1,
  size: number = DEFAULT_PAGE_SIZE,
  filters?: { assignedTo?: number; status?: string }
): Promise<PaginatedResult<Task>> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.tasks) {
    if (isMongoConfigured()) {
      const items = await (await getTaskRepository("mongodb")).list(filters)
      const start = Math.max(0, page - 1) * size
      return { items: items.slice(start, start + size), count: items.length }
    }
    let items = getMockTasks()
    if (filters?.assignedTo) items = items.filter((t) => t.assignedTo === filters.assignedTo)
    if (filters?.status) items = items.filter((t) => t.status === filters.status)
    return { items, count: items.length }
  }

  let endpoint = `/database/rows/table/${tableIds.tasks}/?user_field_names=true`
  if (filters?.assignedTo)
    endpoint += `&filter__field_assigned_to__link_row_has=${filters.assignedTo}`
  if (filters?.status) endpoint += `&filter__field_status__equal=${filters.status}`
  endpoint = appendPagination(endpoint, page, size)

  const result = await baserowFetch<{ results: BaserowRow[]; count?: number }>(endpoint)

  if (!result) {
    const items = getMockTasks()
    return { items, count: items.length }
  }

  return {
    items: result.results.map(mapRowToTask),
    count: result.count ?? result.results.length,
  }
}

export async function createTask(task: Omit<Task, "id">): Promise<Task | null> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.tasks) {
    if (isMongoConfigured()) {
      return (await getTaskRepository("mongodb")).create(task)
    }
    return { ...task, id: Date.now() } as Task
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.tasks}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(mapTaskToRow(task)),
    }
  )

  return row ? mapRowToTask(row) : null
}

export async function updateTask(id: number, updates: Partial<Task>): Promise<Task | null> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.tasks) {
    if (isMongoConfigured()) {
      return (await getTaskRepository("mongodb")).update(id, updates)
    }
    const mockTask = getMockTasks().find((t) => t.id === id)
    return mockTask ? { ...mockTask, ...updates } : null
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.tasks}/${id}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify(mapTaskToRow(updates)),
    }
  )

  return row ? mapRowToTask(row) : null
}

export interface RecurringTaskTemplate {
  id: number
  Title?: string
  Description?: string
  "Assigned To"?: Array<{ id: number }>
  Recurrence?: string
  "Is Recurring"?: boolean
  Priority?: { value?: string }
  Project?: string
}

export async function getRecurringTaskTemplates(): Promise<RecurringTaskTemplate[]> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.tasks) return []
  const result = await baserowFetch<{ results: BaserowRow[] }>(
    `/database/rows/table/${tableIds.tasks}/?user_field_names=true&size=200`
  )
  if (!result?.results) return []
  return result.results.filter(
    (r) => r["Is Recurring"] && r["Recurrence"]
  ) as RecurringTaskTemplate[]
}

// ==================== EXPENSES ====================

export async function getExpenses(filters?: {
  requester?: number
  status?: string
}): Promise<Expense[]> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.expenses) {
    let expenses = getMockExpenses()
    if (filters?.requester) {
      expenses = expenses.filter((e) => e.requester === filters.requester)
    }
    if (filters?.status) {
      expenses = expenses.filter((e) => e.approvalStatus === filters.status)
    }
    return expenses
  }

  let endpoint = `/database/rows/table/${tableIds.expenses}/?user_field_names=true`

  const result = await baserowFetch<{ results: BaserowRow[] }>(endpoint)

  if (!result) {
    return getMockExpenses()
  }

  return result.results.map(mapRowToExpense)
}

export async function getExpensesPaginated(
  page: number = 1,
  size: number = DEFAULT_PAGE_SIZE,
  filters?: { requester?: number; status?: string }
): Promise<PaginatedResult<Expense>> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.expenses) {
    let items = getMockExpenses()
    if (filters?.requester) items = items.filter((e) => e.requester === filters.requester)
    if (filters?.status) items = items.filter((e) => e.approvalStatus === filters.status)
    return { items, count: items.length }
  }

  let endpoint = `/database/rows/table/${tableIds.expenses}/?user_field_names=true`
  endpoint = appendPagination(endpoint, page, size)

  const result = await baserowFetch<{ results: BaserowRow[]; count?: number }>(endpoint)

  if (!result) {
    const items = getMockExpenses()
    return { items, count: items.length }
  }

  return {
    items: result.results.map(mapRowToExpense),
    count: result.count ?? result.results.length,
  }
}

export async function createExpense(expense: Omit<Expense, "id">): Promise<Expense | null> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.expenses) {
    return { ...expense, id: Date.now() } as Expense
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.expenses}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(mapExpenseToRow(expense)),
    }
  )

  return row ? mapRowToExpense(row) : null
}

export async function getExpense(id: number): Promise<Expense | null> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.expenses) {
    return getMockExpenses().find((e) => e.id === id) || null
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.expenses}/${id}/?user_field_names=true`
  )

  return row ? mapRowToExpense(row) : null
}

export async function updateExpense(
  id: number,
  updates: Partial<Expense>
): Promise<Expense | null> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.expenses) {
    const mockExpense = getMockExpenses().find((e) => e.id === id)
    return mockExpense ? { ...mockExpense, ...updates } : null
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.expenses}/${id}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify(mapExpenseToRow(updates)),
    }
  )

  return row ? mapRowToExpense(row) : null
}

// ==================== LEAVE REQUESTS ====================

function mapRowToLeaveRequest(row: BaserowRow): LeaveRequest {
  return {
    id: row.id,
    employee: row["Employee"]?.[0]?.id ?? row.employee ?? 0,
    startDate: row["Start Date"] || row.start_date || "",
    endDate: row["End Date"] || row.end_date || "",
    type: row["Type"]?.value || row.type || "Annual",
    status: row["Status"]?.value || row.status || "Pending",
    approver: row["Approver"]?.[0]?.id ?? row.approver,
    approvedAt: row["Approved At"] || row.approved_at,
    submittedAt: row["Submitted At"] || row.submitted_at || "",
    notes: row["Notes"] || row.notes,
  }
}

function mapLeaveRequestToRow(lr: Partial<LeaveRequest>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (lr.employee !== undefined) row["Employee"] = [lr.employee]
  if (lr.startDate !== undefined) row["Start Date"] = lr.startDate
  if (lr.endDate !== undefined) row["End Date"] = lr.endDate
  if (lr.type !== undefined) row["Type"] = lr.type
  if (lr.status !== undefined) row["Status"] = lr.status
  if (lr.approver !== undefined) row["Approver"] = [lr.approver]
  if (lr.approvedAt !== undefined) row["Approved At"] = lr.approvedAt
  if (lr.submittedAt !== undefined) row["Submitted At"] = lr.submittedAt
  if (lr.notes !== undefined) row["Notes"] = lr.notes
  return row
}

export async function getLeaveRequests(filters?: {
  employee?: number
  status?: string
}): Promise<LeaveRequest[]> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.leaveRequests) return []

  let endpoint = `/database/rows/table/${tableIds.leaveRequests}/?user_field_names=true`
  if (filters?.employee) endpoint += `&filter__field_employee__link_row_has=${filters.employee}`
  if (filters?.status) endpoint += `&filter__field_status__equal=${filters.status}`

  const result = await baserowFetch<{ results: BaserowRow[] }>(endpoint)
  if (!result?.results) return []
  return result.results.map(mapRowToLeaveRequest)
}

export async function getLeaveRequest(id: number): Promise<LeaveRequest | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.leaveRequests) {
    return null
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.leaveRequests}/${id}/?user_field_names=true`
  )
  return row ? mapRowToLeaveRequest(row) : null
}

export async function createLeaveRequest(
  lr: Omit<LeaveRequest, "id">
): Promise<LeaveRequest | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.leaveRequests) {
    return { ...lr, id: Date.now() } as LeaveRequest
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.leaveRequests}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(mapLeaveRequestToRow(lr)),
    }
  )
  return row ? mapRowToLeaveRequest(row) : null
}

export async function updateLeaveRequest(
  id: number,
  updates: Partial<LeaveRequest>
): Promise<LeaveRequest | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.leaveRequests) return null

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.leaveRequests}/${id}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify(mapLeaveRequestToRow(updates)),
    }
  )
  return row ? mapRowToLeaveRequest(row) : null
}

// ==================== LOANS ====================

function mapRowToLoan(row: BaserowRow): Loan {
  return {
    id: row.id,
    employee: row["Employee"]?.[0]?.id ?? row.employee ?? 0,
    amount: row["Amount"] ?? row.amount ?? 0,
    purpose: row["Purpose"] || row.purpose || "",
    repaymentSchedule: row["Repayment Schedule"] || row.repayment_schedule,
    status: row["Status"]?.value || row.status || "Pending",
    outstandingBalance: row["Outstanding Balance"] ?? row.outstanding_balance ?? 0,
    nextRepaymentDate: row["Next Repayment Date"] || row.next_repayment_date,
    approvedBy: row["Approved By"]?.[0]?.id ?? row.approved_by,
    approvedAt: row["Approved At"] || row.approved_at,
    disbursedAt: row["Disbursed At"] || row.disbursed_at,
    createdAt: row["Created At"] || row.created_at || "",
    notes: row["Notes"] || row.notes,
  }
}

function mapLoanToRow(loan: Partial<Loan>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (loan.employee !== undefined) row["Employee"] = [loan.employee]
  if (loan.amount !== undefined) row["Amount"] = loan.amount
  if (loan.purpose !== undefined) row["Purpose"] = loan.purpose
  if (loan.repaymentSchedule !== undefined) row["Repayment Schedule"] = loan.repaymentSchedule
  if (loan.status !== undefined) row["Status"] = loan.status
  if (loan.outstandingBalance !== undefined) row["Outstanding Balance"] = loan.outstandingBalance
  if (loan.nextRepaymentDate !== undefined) row["Next Repayment Date"] = loan.nextRepaymentDate
  if (loan.approvedBy !== undefined) row["Approved By"] = [loan.approvedBy]
  if (loan.approvedAt !== undefined) row["Approved At"] = loan.approvedAt
  if (loan.disbursedAt !== undefined) row["Disbursed At"] = loan.disbursedAt
  if (loan.createdAt !== undefined) row["Created At"] = loan.createdAt
  if (loan.notes !== undefined) row["Notes"] = loan.notes
  return row
}

export async function getLoans(filters?: { employee?: number; status?: string }): Promise<Loan[]> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.loans) return []

  let endpoint = `/database/rows/table/${tableIds.loans}/?user_field_names=true`
  if (filters?.employee) endpoint += `&filter__field_employee__link_row_has=${filters.employee}`
  if (filters?.status) endpoint += `&filter__field_status__equal=${filters.status}`

  const result = await baserowFetch<{ results: BaserowRow[] }>(endpoint)
  if (!result?.results) return []
  return result.results.map(mapRowToLoan)
}

export async function getLoan(id: number): Promise<Loan | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.loans) return null
  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.loans}/${id}/?user_field_names=true`
  )
  return row ? mapRowToLoan(row) : null
}

export async function createLoan(loan: Omit<Loan, "id">): Promise<Loan | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.loans) {
    return { ...loan, id: Date.now() } as Loan
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.loans}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(mapLoanToRow(loan)),
    }
  )
  return row ? mapRowToLoan(row) : null
}

export async function updateLoan(id: number, updates: Partial<Loan>): Promise<Loan | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.loans) return null

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.loans}/${id}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify(mapLoanToRow(updates)),
    }
  )
  return row ? mapRowToLoan(row) : null
}

// ==================== PETTY CASH ====================

function mapRowToPettyCash(row: BaserowRow): PettyCash {
  return {
    id: row.id,
    requester: row["Requester"]?.[0]?.id ?? row.requester ?? 0,
    amount: row["Amount"] ?? row.amount ?? 0,
    purpose: row["Purpose"] || row.purpose || "",
    receipt: row["Receipt"]?.[0]?.url ?? row.receipt,
    status: row["Status"]?.value || row.status || "Pending",
    issuedBy: row["Issued By"]?.[0]?.id ?? row.issued_by,
    issuedAt: row["Issued At"] || row.issued_at,
    approvedBy: row["Approved By"]?.[0]?.id ?? row.approved_by,
    approvedAt: row["Approved At"] || row.approved_at,
    createdAt: row["Created At"] || row.created_at || "",
    notes: row["Notes"] || row.notes,
  }
}

function mapPettyCashToRow(pc: Partial<PettyCash>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (pc.requester !== undefined) row["Requester"] = [pc.requester]
  if (pc.amount !== undefined) row["Amount"] = pc.amount
  if (pc.purpose !== undefined) row["Purpose"] = pc.purpose
  if (pc.receipt !== undefined) row["Receipt"] = pc.receipt
  if (pc.status !== undefined) row["Status"] = pc.status
  if (pc.issuedBy !== undefined) row["Issued By"] = [pc.issuedBy]
  if (pc.issuedAt !== undefined) row["Issued At"] = pc.issuedAt
  if (pc.approvedBy !== undefined) row["Approved By"] = [pc.approvedBy]
  if (pc.approvedAt !== undefined) row["Approved At"] = pc.approvedAt
  if (pc.createdAt !== undefined) row["Created At"] = pc.createdAt
  if (pc.notes !== undefined) row["Notes"] = pc.notes
  return row
}

export async function getPettyCashRequests(filters?: {
  requester?: number
  status?: string
}): Promise<PettyCash[]> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.pettyCash) return []

  let endpoint = `/database/rows/table/${tableIds.pettyCash}/?user_field_names=true`
  if (filters?.requester) endpoint += `&filter__field_requester__link_row_has=${filters.requester}`
  if (filters?.status) endpoint += `&filter__field_status__equal=${filters.status}`

  const result = await baserowFetch<{ results: BaserowRow[] }>(endpoint)
  if (!result?.results) return []
  return result.results.map(mapRowToPettyCash)
}

export async function createPettyCashRequest(pc: Omit<PettyCash, "id">): Promise<PettyCash | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.pettyCash) {
    return { ...pc, id: Date.now() } as PettyCash
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.pettyCash}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(mapPettyCashToRow(pc)),
    }
  )
  return row ? mapRowToPettyCash(row) : null
}

export async function updatePettyCashRequest(
  id: number,
  updates: Partial<PettyCash>
): Promise<PettyCash | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.pettyCash) return null

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.pettyCash}/${id}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify(mapPettyCashToRow(updates)),
    }
  )
  return row ? mapRowToPettyCash(row) : null
}

// ==================== CONTRACTOR CONTRACTS ====================

function mapRowToContractorContract(row: BaserowRow): ContractorContract {
  return {
    id: row.id,
    contractor: row["Contractor"] ?? row.contractor ?? "",
    project: row["Project"] || row.project || "",
    milestones: row["Milestones"] || row.milestones || "[]",
    amounts: row["Amounts"] || row.amounts || "[]",
    status: row["Status"]?.value || row.status || "Active",
    startDate: row["Start Date"] || row.start_date,
    endDate: row["End Date"] || row.end_date,
    notes: row["Notes"] || row.notes,
  }
}

export async function getContractorContracts(filters?: {
  status?: string
}): Promise<ContractorContract[]> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.contractorContracts) return []

  let endpoint = `/database/rows/table/${tableIds.contractorContracts}/?user_field_names=true`
  if (filters?.status) endpoint += `&filter__field_status__equal=${filters.status}`

  const result = await baserowFetch<{ results: BaserowRow[] }>(endpoint)
  if (!result?.results) return []
  return result.results.map(mapRowToContractorContract)
}

// ==================== ONBOARDING CHECKLIST ====================

function mapRowToOnboardingChecklist(row: BaserowRow): OnboardingChecklist {
  return {
    id: row.id,
    employee: row["Employee"]?.[0]?.id ?? row.employee ?? 0,
    items: row["Items"] || row.items || "[]",
    completedAt: row["Completed At"] || row.completed_at,
    assignedBuddy: row["Assigned Buddy"]?.[0]?.id ?? row.assigned_buddy,
    status: row["Status"]?.value || row.status || "In Progress",
    createdAt: row["Created At"] || row.created_at || "",
    notes: row["Notes"] || row.notes,
  }
}

function mapOnboardingChecklistToRow(oc: Partial<OnboardingChecklist>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (oc.employee !== undefined) row["Employee"] = [oc.employee]
  if (oc.items !== undefined) row["Items"] = oc.items
  if (oc.completedAt !== undefined) row["Completed At"] = oc.completedAt
  if (oc.assignedBuddy !== undefined) row["Assigned Buddy"] = [oc.assignedBuddy]
  if (oc.status !== undefined) row["Status"] = oc.status
  if (oc.createdAt !== undefined) row["Created At"] = oc.createdAt
  if (oc.notes !== undefined) row["Notes"] = oc.notes
  return row
}

export async function getOnboardingChecklists(filters?: {
  employee?: number
  status?: string
}): Promise<OnboardingChecklist[]> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.onboardingChecklist) return []

  let endpoint = `/database/rows/table/${tableIds.onboardingChecklist}/?user_field_names=true`
  if (filters?.employee) endpoint += `&filter__field_employee__link_row_has=${filters.employee}`
  if (filters?.status) endpoint += `&filter__field_status__equal=${filters.status}`

  const result = await baserowFetch<{ results: BaserowRow[] }>(endpoint)
  if (!result?.results) return []
  return result.results.map(mapRowToOnboardingChecklist)
}

export async function createOnboardingChecklist(
  oc: Omit<OnboardingChecklist, "id">
): Promise<OnboardingChecklist | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.onboardingChecklist) {
    return { ...oc, id: Date.now() } as OnboardingChecklist
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.onboardingChecklist}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(mapOnboardingChecklistToRow(oc)),
    }
  )
  return row ? mapRowToOnboardingChecklist(row) : null
}

export async function updateOnboardingChecklist(
  id: number,
  updates: Partial<OnboardingChecklist>
): Promise<OnboardingChecklist | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.onboardingChecklist) return null

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.onboardingChecklist}/${id}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify(mapOnboardingChecklistToRow(updates)),
    }
  )
  return row ? mapRowToOnboardingChecklist(row) : null
}

// ==================== BUDGET ====================

function mapRowToBudget(row: BaserowRow): Budget {
  return {
    id: row.id,
    category: row["Category"]?.value || row.category || "",
    amount: row["Amount"] ?? row.amount ?? 0,
    period: row["Period"] || row.period || "",
    version: row["Version"] ?? row.version ?? 1,
    status: row["Status"]?.value || row.status || "Draft",
    approvedBy: row["Approved By"]?.[0]?.id ?? row.approved_by,
    approvedAt: row["Approved At"] || row.approved_at,
    docuSealRef: row["DocuSeal Ref"] || row.docu_seal_ref,
    notes: row["Notes"] || row.notes,
  }
}

function mapBudgetToRow(b: Partial<Budget>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (b.category !== undefined) row["Category"] = b.category
  if (b.amount !== undefined) row["Amount"] = b.amount
  if (b.period !== undefined) row["Period"] = b.period
  if (b.version !== undefined) row["Version"] = b.version
  if (b.status !== undefined) row["Status"] = b.status
  if (b.approvedBy !== undefined) row["Approved By"] = [b.approvedBy]
  if (b.approvedAt !== undefined) row["Approved At"] = b.approvedAt
  if (b.docuSealRef !== undefined) row["DocuSeal Ref"] = b.docuSealRef
  if (b.notes !== undefined) row["Notes"] = b.notes
  return row
}

export async function getBudgets(filters?: {
  period?: string
  status?: string
}): Promise<Budget[]> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.budget) return []

  let endpoint = `/database/rows/table/${tableIds.budget}/?user_field_names=true`
  if (filters?.period) endpoint += `&filter__field_period__equal=${filters.period}`
  if (filters?.status) endpoint += `&filter__field_status__equal=${filters.status}`

  const result = await baserowFetch<{ results: BaserowRow[] }>(endpoint)
  if (!result?.results) return []
  return result.results.map(mapRowToBudget)
}

export async function createBudget(b: Omit<Budget, "id">): Promise<Budget | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.budget) {
    return { ...b, id: Date.now() } as Budget
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.budget}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(mapBudgetToRow(b)),
    }
  )
  return row ? mapRowToBudget(row) : null
}

export async function updateBudget(id: number, updates: Partial<Budget>): Promise<Budget | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.budget) return null

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.budget}/${id}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify(mapBudgetToRow(updates)),
    }
  )
  return row ? mapRowToBudget(row) : null
}

// ==================== INSURANCE CLAIMS ====================

function mapRowToInsuranceClaim(row: BaserowRow): InsuranceClaim {
  return {
    id: row.id,
    incident: row["Incident"]?.[0]?.id ?? row.incident,
    asset: row["Asset"]?.[0]?.id ?? row.asset,
    description: row["Description"] || row.description || "",
    amount: row["Amount"] ?? row.amount ?? 0,
    status: row["Status"]?.value || row.status || "Draft",
    claimId: row["Claim Id"] || row.claim_id,
    submittedAt: row["Submitted At"] || row.submitted_at,
    createdAt: row["Created At"] || row.created_at || "",
    notes: row["Notes"] || row.notes,
  }
}

function mapInsuranceClaimToRow(ic: Partial<InsuranceClaim>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (ic.incident !== undefined) row["Incident"] = [ic.incident]
  if (ic.asset !== undefined) row["Asset"] = [ic.asset]
  if (ic.description !== undefined) row["Description"] = ic.description
  if (ic.amount !== undefined) row["Amount"] = ic.amount
  if (ic.status !== undefined) row["Status"] = ic.status
  if (ic.claimId !== undefined) row["Claim Id"] = ic.claimId
  if (ic.submittedAt !== undefined) row["Submitted At"] = ic.submittedAt
  if (ic.createdAt !== undefined) row["Created At"] = ic.createdAt
  if (ic.notes !== undefined) row["Notes"] = ic.notes
  return row
}

export async function getInsuranceClaims(filters?: {
  incident?: number
  status?: string
}): Promise<InsuranceClaim[]> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.insuranceClaims) return []

  let endpoint = `/database/rows/table/${tableIds.insuranceClaims}/?user_field_names=true`
  if (filters?.incident) endpoint += `&filter__field_incident__link_row_has=${filters.incident}`
  if (filters?.status) endpoint += `&filter__field_status__equal=${filters.status}`

  const result = await baserowFetch<{ results: BaserowRow[] }>(endpoint)
  if (!result?.results) return []
  return result.results.map(mapRowToInsuranceClaim)
}

export async function createInsuranceClaim(
  ic: Omit<InsuranceClaim, "id">
): Promise<InsuranceClaim | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.insuranceClaims) {
    return { ...ic, id: Date.now() } as InsuranceClaim
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.insuranceClaims}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(mapInsuranceClaimToRow(ic)),
    }
  )
  return row ? mapRowToInsuranceClaim(row) : null
}

export async function updateInsuranceClaim(
  id: number,
  updates: Partial<InsuranceClaim>
): Promise<InsuranceClaim | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.insuranceClaims) return null

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.insuranceClaims}/${id}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify(mapInsuranceClaimToRow(updates)),
    }
  )
  return row ? mapRowToInsuranceClaim(row) : null
}

// ==================== ASSETS ====================

export async function getAssets(filters?: { type?: string; location?: string }): Promise<Asset[]> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.assets) {
    return getMockAssets()
  }

  const result = await baserowFetch<{ results: BaserowRow[] }>(
    `/database/rows/table/${tableIds.assets}/?user_field_names=true`
  )

  if (!result) {
    return getMockAssets()
  }

  return result.results.map(mapRowToAsset)
}

export async function getAssetsPaginated(
  page: number = 1,
  size: number = DEFAULT_PAGE_SIZE
): Promise<PaginatedResult<Asset>> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.assets) {
    const items = getMockAssets()
    return { items, count: items.length }
  }

  const endpoint = appendPagination(
    `/database/rows/table/${tableIds.assets}/?user_field_names=true`,
    page,
    size
  )
  const result = await baserowFetch<{ results: BaserowRow[]; count?: number }>(endpoint)

  if (!result) {
    const items = getMockAssets()
    return { items, count: items.length }
  }

  return {
    items: result.results.map(mapRowToAsset),
    count: result.count ?? result.results.length,
  }
}

export async function getAsset(id: number): Promise<Asset | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.assets) {
    return getMockAssets().find((a) => a.id === id) ?? null
  }
  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.assets}/${id}/?user_field_names=true`
  )
  return row ? mapRowToAsset(row) : null
}

// ==================== INCIDENTS ====================

function mapRowToIncident(row: BaserowRow): Incident {
  return {
    id: row.id,
    type: row["Type"]?.value || row.type || "",
    dateTime: row["Date Time"] || row.date_time || "",
    location: row["Location"] || row.location,
    reporter: row["Reporter"]?.[0]?.id ?? row.reporter,
    description: row["Description"] || row.description || "",
    severity: row["Severity"]?.value || row.severity || "Low",
    status: row["Status"]?.value || row.status || "",
    relatedAsset: row["Related Asset"]?.[0]?.id ?? row.related_asset,
    relatedEmployee: row["Related Employee"]?.[0]?.id ?? row.related_employee,
    relatedIncidentIds: row["Related Incident IDs"] || row.related_incident_ids,
    victimSupportPath: row["Victim Support Path"] ?? row.victim_support_path,
  }
}

export async function getIncidents(filters?: {
  type?: string
  status?: string
}): Promise<Incident[]> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.incidents) return []

  let endpoint = `/database/rows/table/${tableIds.incidents}/?user_field_names=true`
  if (filters?.type) endpoint += `&filter__field_type__equal=${filters.type}`
  if (filters?.status) endpoint += `&filter__field_status__equal=${filters.status}`

  const result = await baserowFetch<{ results: BaserowRow[] }>(endpoint)
  if (!result?.results) return []
  return result.results.map(mapRowToIncident)
}

function mapIncidentToRow(incident: Omit<Incident, "id">): Record<string, unknown> {
  const row: Record<string, unknown> = {
    Type: incident.type,
    "Date Time": incident.dateTime,
    Location: incident.location ?? "",
    Description: incident.description,
    Severity: incident.severity,
    Status: incident.status || "Reported",
  }
  if (incident.reporter != null) row["Reporter"] = [incident.reporter]
  if (incident.victimSupportPath !== undefined)
    row["Victim Support Path"] = incident.victimSupportPath
  return row
}

export async function createIncident(incident: Omit<Incident, "id">): Promise<Incident | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.incidents) return null

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.incidents}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(mapIncidentToRow(incident)),
    }
  )
  return row ? mapRowToIncident(row) : null
}

export async function updateIncident(
  id: number,
  updates: Partial<Pick<Incident, "relatedIncidentIds" | "victimSupportPath" | "status">>
): Promise<Incident | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.incidents) return null

  const body: Record<string, unknown> = {}
  if (updates.relatedIncidentIds !== undefined)
    body["Related Incident IDs"] = updates.relatedIncidentIds
  if (updates.victimSupportPath !== undefined)
    body["Victim Support Path"] = updates.victimSupportPath
  if (updates.status !== undefined) body["Status"] = updates.status
  if (Object.keys(body).length === 0) return null

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.incidents}/${id}/?user_field_names=true`,
    { method: "PATCH", body: JSON.stringify(body) }
  )
  return row ? mapRowToIncident(row) : null
}

// ==================== PPE ====================

function mapRowToPPE(row: BaserowRow): PPE {
  return {
    id: row.id,
    asset: row["Asset"]?.[0]?.id ?? row.asset ?? 0,
    issuedTo: row["Issued To"]?.[0]?.id ?? row.issued_to ?? 0,
    issueDate: row["Issue Date"] || row.issue_date || "",
    expiryDate: row["Expiry Date"] || row.expiry_date,
    returnDate: row["Return Date"] || row.return_date,
    status: row["Status"]?.value || row.status || "Issued",
    notes: row["Notes"] || row.notes,
  }
}

function mapPPEToRow(ppe: Partial<PPE>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (ppe.asset !== undefined) row["Asset"] = [ppe.asset]
  if (ppe.issuedTo !== undefined) row["Issued To"] = [ppe.issuedTo]
  if (ppe.issueDate !== undefined) row["Issue Date"] = ppe.issueDate
  if (ppe.expiryDate !== undefined) row["Expiry Date"] = ppe.expiryDate
  if (ppe.returnDate !== undefined) row["Return Date"] = ppe.returnDate
  if (ppe.status !== undefined) row["Status"] = ppe.status
  if (ppe.notes !== undefined) row["Notes"] = ppe.notes
  return row
}

export async function getPPERecords(filters?: {
  issuedTo?: number
  status?: string
}): Promise<PPE[]> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.ppe) return []

  let endpoint = `/database/rows/table/${tableIds.ppe}/?user_field_names=true`
  if (filters?.issuedTo) endpoint += `&filter__field_issued_to__link_row_has=${filters.issuedTo}`
  if (filters?.status) endpoint += `&filter__field_status__equal=${filters.status}`

  const result = await baserowFetch<{ results: BaserowRow[] }>(endpoint)
  if (!result?.results) return []
  return result.results.map(mapRowToPPE)
}

export async function createPPERecord(ppe: Omit<PPE, "id">): Promise<PPE | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.ppe) {
    return { ...ppe, id: Date.now() } as PPE
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.ppe}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(mapPPEToRow(ppe)),
    }
  )
  return row ? mapRowToPPE(row) : null
}

export async function updatePPERecord(id: number, updates: Partial<PPE>): Promise<PPE | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.ppe) return null

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.ppe}/${id}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify(mapPPEToRow(updates)),
    }
  )
  return row ? mapRowToPPE(row) : null
}

// ==================== TIME CLOCK ====================

export async function getTimeClockEntries(filters?: {
  employee?: number
  date?: string
}): Promise<TimeClockEntry[]> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.timeClock) {
    return getMockTimeClockEntries()
  }

  const result = await baserowFetch<{ results: BaserowRow[] }>(
    `/database/rows/table/${tableIds.timeClock}/?user_field_names=true`
  )

  if (!result) {
    return getMockTimeClockEntries()
  }

  return result.results.map(mapRowToTimeClockEntry)
}

export async function getTimeClockEntriesPaginated(
  page: number = 1,
  size: number = DEFAULT_PAGE_SIZE,
  filters?: { employee?: number; date?: string }
): Promise<PaginatedResult<TimeClockEntry>> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.timeClock) {
    const items = getMockTimeClockEntries()
    return { items, count: items.length }
  }

  let endpoint = `/database/rows/table/${tableIds.timeClock}/?user_field_names=true`
  if (filters?.employee) endpoint += `&filter__field_employee__link_row_has=${filters.employee}`
  if (filters?.date) endpoint += `&filter__field_date__date_equal=${filters.date}`
  endpoint = appendPagination(endpoint, page, size)

  const result = await baserowFetch<{ results: BaserowRow[]; count?: number }>(endpoint)

  if (!result) {
    const items = getMockTimeClockEntries()
    return { items, count: items.length }
  }

  return {
    items: result.results.map(mapRowToTimeClockEntry),
    count: result.count ?? result.results.length,
  }
}

export async function clockIn(employeeId: number): Promise<TimeClockEntry | null> {
  const tableIds = getTableIds()
  const now = new Date()

  const clockTime = now.toTimeString().slice(0, 5)
  const entry: Record<string, unknown> = {
    Employee: [employeeId],
    Date: toISODateString(now),
    "Clock In": clockTime,
    "Approval Status": "Pending",
  }

  if (!isBaserowConfigured() || !tableIds.timeClock) {
    return {
      employee: employeeId,
      date: toISODateString(now),
      clockIn: clockTime,
      approvalStatus: "Pending",
      id: Date.now(),
    } as TimeClockEntry
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.timeClock}/?user_field_names=true`,
    {
      method: "POST",
      body: JSON.stringify(entry),
    }
  )

  return row
    ? mapRowToTimeClockEntry(row)
    : ({
        employee: employeeId,
        date: toISODateString(now),
        clockIn: clockTime,
        approvalStatus: "Pending",
        id: Date.now(),
      } as TimeClockEntry)
}

export async function clockOut(entryId: number): Promise<TimeClockEntry | null> {
  const tableIds = getTableIds()
  const now = new Date()

  if (!isBaserowConfigured() || !tableIds.timeClock) {
    return null
  }

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.timeClock}/${entryId}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify({ "Clock Out": now.toTimeString().slice(0, 5) }),
    }
  )

  return row ? mapRowToTimeClockEntry(row) : null
}

export async function updateTimeClockEntry(
  entryId: number,
  updates: { approvalStatus?: string }
): Promise<TimeClockEntry | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.timeClock) return null
  const body: Record<string, unknown> = {}
  if (updates.approvalStatus) body["Approval Status"] = updates.approvalStatus
  if (Object.keys(body).length === 0) return null
  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.timeClock}/${entryId}/?user_field_names=true`,
    { method: "PATCH", body: JSON.stringify(body) }
  )
  return row ? mapRowToTimeClockEntry(row) : null
}

const APP_ID_TO_NAME: Record<string, string> = {
  hans: "Hans",
  charl: "Charl",
  lucky: "Lucky",
  irma: "Irma",
}

export async function getBaserowEmployeeIdByAppId(appId: string): Promise<number | null> {
  const employees = await getEmployees()
  const name = APP_ID_TO_NAME[appId.toLowerCase()] || appId
  const emp = employees.find(
    (e) =>
      e.fullName?.toLowerCase().startsWith(name.toLowerCase()) ||
      e.fullName?.toLowerCase().includes(name.toLowerCase())
  )
  return emp ? emp.id : null
}

export async function clockInByAppId(appId: string): Promise<TimeClockEntry | null> {
  const baserowEmployeeId = await getBaserowEmployeeIdByAppId(appId)
  if (baserowEmployeeId === null) return null
  return clockIn(baserowEmployeeId)
}

export async function clockOutByAppId(appId: string): Promise<TimeClockEntry | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.timeClock) return null

  const baserowEmployeeId = await getBaserowEmployeeIdByAppId(appId)
  if (baserowEmployeeId === null) return null

  const today = toISODateString()
  const result = await baserowFetch<{ results: BaserowRow[] }>(
    `/database/rows/table/${tableIds.timeClock}/?user_field_names=true&filter__field_employee__link_row_has=${baserowEmployeeId}&filter__field_date__date_equal=${today}`
  )
  if (!result?.results?.length) return null

  const openEntry = result.results.find((r) => !r["Clock Out"] && !r.clock_out)
  if (!openEntry) return null

  return clockOut(openEntry.id)
}

// ==================== VEHICLE LOGS ====================

export async function getVehicleLogs(filters?: { driver?: number }): Promise<VehicleLog[]> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.vehicleLogs) {
    return getMockVehicleLogs()
  }

  const result = await baserowFetch<{ results: BaserowRow[] }>(
    `/database/rows/table/${tableIds.vehicleLogs}/?user_field_names=true`
  )

  if (!result) {
    return getMockVehicleLogs()
  }

  return result.results.map(mapRowToVehicleLog)
}

export async function getVehicleLogsPaginated(
  page: number = 1,
  size: number = DEFAULT_PAGE_SIZE,
  filters?: { driver?: number }
): Promise<PaginatedResult<VehicleLog>> {
  const tableIds = getTableIds()

  if (!isBaserowConfigured() || !tableIds.vehicleLogs) {
    const items = getMockVehicleLogs()
    return { items, count: items.length }
  }

  let endpoint = `/database/rows/table/${tableIds.vehicleLogs}/?user_field_names=true`
  if (filters?.driver) endpoint += `&filter__field_driver__link_row_has=${filters.driver}`
  endpoint = appendPagination(endpoint, page, size)

  const result = await baserowFetch<{ results: BaserowRow[]; count?: number }>(endpoint)

  if (!result) {
    const items = getMockVehicleLogs()
    return { items, count: items.length }
  }

  return {
    items: result.results.map(mapRowToVehicleLog),
    count: result.count ?? result.results.length,
  }
}

// ==================== MAPPING FUNCTIONS ====================

function mapRowToEmployee(row: BaserowRow): Employee {
  return {
    id: row.id,
    fullName: row["Full Name"] || row.full_name || "",
    idNumber: row["ID Number"] || row.id_number,
    role: row["Role"]?.value || row.role || "",
    employmentStartDate: row["Employment Start Date"] || row.employment_start_date,
    probationStatus: row["Probation Status"]?.value || row.probation_status,
    contractRef: row["Contract Ref"] || row.contract_ref,
    leaveBalance: row["Leave Balance"] || row.leave_balance || 0,
    email: row["Email"] || row.email || "",
    phone: row["Phone"] || row.phone || "",
    photo: row["Photo"]?.[0]?.url || row.photo,
    onboardingStatus: row["Onboarding Status"]?.value || row.onboarding_status,
    buddyId: row["Buddy"]?.[0]?.id || row.buddy_id,
    itProvisionedAt: row["IT Provisioned At"] || row.it_provisioned_at,
  }
}

function mapRowToTask(row: BaserowRow): Task {
  return {
    id: row.id,
    title: row["Title"] || row.title || "",
    description: row["Description"] || row.description,
    assignedTo: row["Assigned To"]?.[0]?.id || row.assigned_to,
    assignedToName: row["Assigned To"]?.[0]?.value || "",
    dueDate: row["Due Date"] || row.due_date,
    priority: row["Priority"]?.value || row.priority || "Medium",
    status: row["Status"]?.value || row.status || "Not Started",
    timeSpent: row["Time Spent"] || row.time_spent,
    completionNotes: row["Completion Notes"] || row.completion_notes,
    relatedAsset: row["Related Asset"]?.[0]?.id || row.related_asset,
    project: row["Project"] || row.project,
    createdDate: row["Created Date"] || row.created_date,
    completedDate: row["Completed Date"] || row.completed_date,
  }
}

function mapTaskToRow(task: Partial<Task>): Record<string, any> {
  const row: Record<string, any> = {}
  if (task.title !== undefined) row["Title"] = task.title
  if (task.description !== undefined) row["Description"] = task.description
  if (task.assignedTo !== undefined) row["Assigned To"] = [task.assignedTo]
  if (task.dueDate !== undefined) row["Due Date"] = task.dueDate
  if (task.priority !== undefined) row["Priority"] = task.priority
  if (task.status !== undefined) row["Status"] = task.status
  if (task.timeSpent !== undefined) row["Time Spent"] = task.timeSpent
  if (task.completionNotes !== undefined) row["Completion Notes"] = task.completionNotes
  if (task.project !== undefined) row["Project"] = task.project
  return row
}

function mapRowToExpense(row: BaserowRow): Expense {
  return {
    id: row.id,
    requester: row["Requester"]?.[0]?.id || row.requester || 0,
    requesterName: row["Requester"]?.[0]?.value || "",
    type: row["Type"]?.value || row.type || "Request",
    category: row["Category"]?.value || row.category || "",
    amount: row["Amount"] || row.amount || 0,
    vendor: row["Vendor"] || row.vendor,
    date: row["Date"] || row.date || "",
    approvalStatus: row["Approval Status"]?.value || row.approval_status || "Pending",
    receipt: row["Receipt"]?.[0]?.url || row.receipt,
    project: row["Project"] || row.project,
    milestone: row["Milestone"] || row.milestone,
    notes: row["Notes"] || row.notes,
    approver: row["Approver"]?.[0]?.id || row.approver,
    approvalDate: row["Approval Date"] || row.approval_date,
    secondaryApprover: row["Secondary Approver"]?.[0]?.id ?? row.secondary_approver,
    secondaryApprovalDate: row["Secondary Approval Date"] || row.secondary_approval_date,
  }
}

function mapExpenseToRow(expense: Partial<Expense>): Record<string, any> {
  const row: Record<string, any> = {}
  if (expense.requester !== undefined) row["Requester"] = [expense.requester]
  if (expense.type !== undefined) row["Type"] = expense.type
  if (expense.category !== undefined) row["Category"] = expense.category
  if (expense.amount !== undefined) row["Amount"] = expense.amount
  if (expense.vendor !== undefined) row["Vendor"] = expense.vendor
  if (expense.date !== undefined) row["Date"] = expense.date
  if (expense.approvalStatus !== undefined) row["Approval Status"] = expense.approvalStatus
  if (expense.project !== undefined) row["Project"] = expense.project
  if (expense.notes !== undefined) row["Notes"] = expense.notes
  if (expense.approver !== undefined) row["Approver"] = [expense.approver]
  if (expense.approvalDate !== undefined) row["Approval Date"] = expense.approvalDate
  if (expense.secondaryApprover !== undefined)
    row["Secondary Approver"] = [expense.secondaryApprover]
  if (expense.secondaryApprovalDate !== undefined)
    row["Secondary Approval Date"] = expense.secondaryApprovalDate
  return row
}

function mapRowToAsset(row: BaserowRow): Asset {
  return {
    id: row.id,
    assetId: row["Asset ID"] || row.asset_id || "",
    type: row["Type"]?.value || row.type || "",
    description: row["Description"] || row.description,
    purchaseDate: row["Purchase Date"] || row.purchase_date,
    price: row["Price"] || row.price,
    condition: row["Condition"]?.value || row.condition || "",
    location: row["Location"]?.value || row.location || "",
    checkedOutBy: row["Checked Out By"]?.[0]?.id || row.checked_out_by,
    checkOutDate: row["Check Out Date"] || row.check_out_date,
    photo: row["Photo"]?.[0]?.url || row.photo,
    expectedReturnDate: row["Expected Return Date"] || row.expected_return_date,
    lateReturnLockoutUntil: row["Late Return Lockout Until"] || row.late_return_lockout_until,
  }
}

type AssetUpdate = Partial<Omit<Asset, "checkedOutBy" | "expectedReturnDate" | "checkOutDate">> & {
  checkedOutBy?: number | null
  expectedReturnDate?: string | null
  checkOutDate?: string | null
}

function mapAssetToRow(asset: AssetUpdate): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (asset.expectedReturnDate !== undefined)
    row["Expected Return Date"] = asset.expectedReturnDate ?? null
  if (asset.lateReturnLockoutUntil !== undefined)
    row["Late Return Lockout Until"] = asset.lateReturnLockoutUntil
  if (asset.checkedOutBy !== undefined)
    row["Checked Out By"] = asset.checkedOutBy == null ? [] : [asset.checkedOutBy]
  if (asset.checkOutDate !== undefined) row["Check Out Date"] = asset.checkOutDate ?? null
  return row
}

export async function updateAsset(
  id: number,
  updates: Partial<Pick<Asset, "lateReturnLockoutUntil">> & {
    checkedOutBy?: number | null
    expectedReturnDate?: string | null
    checkOutDate?: string | null
  }
): Promise<Asset | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.assets) return null

  const row = await baserowFetch<BaserowRow>(
    `/database/rows/table/${tableIds.assets}/${id}/?user_field_names=true`,
    {
      method: "PATCH",
      body: JSON.stringify(mapAssetToRow(updates)),
    }
  )
  return row ? mapRowToAsset(row) : null
}

function mapRowToTimeClockEntry(row: BaserowRow): TimeClockEntry {
  return {
    id: row.id,
    employee: row["Employee"]?.[0]?.id || row.employee || 0,
    employeeName: row["Employee"]?.[0]?.value || "",
    date: row["Date"] || row.date || "",
    clockIn: row["Clock In"] || row.clock_in,
    clockOut: row["Clock Out"] || row.clock_out,
    breakDuration: row["Break Duration"] || row.break_duration,
    totalHours: row["Total Hours"] || row.total_hours,
    overtimeHours: row["Overtime Hours"] || row.overtime_hours,
    approvalStatus: row["Approval Status"]?.value || row.approval_status || "Pending",
    notes: row["Notes"] || row.notes,
  }
}

function mapRowToVehicleLog(row: BaserowRow): VehicleLog {
  return {
    id: row.id,
    driver: row["Driver"]?.[0]?.id || row.driver || 0,
    driverName: row["Driver"]?.[0]?.value || "",
    vehicle: row["Vehicle"]?.[0]?.id || row.vehicle || 0,
    vehicleName: row["Vehicle"]?.[0]?.value || "",
    dateOut: row["Date Out"] || row.date_out || "",
    dateIn: row["Date In"] || row.date_in,
    odometerStart: row["Odometer Start"] || row.odometer_start || 0,
    odometerEnd: row["Odometer End"] || row.odometer_end,
    distance: row["Distance"] || row.distance,
    fuelAdded: row["Fuel Added"] || row.fuel_added,
    fuelCost: row["Fuel Cost"] || row.fuel_cost,
    childPassenger: row["Child Passenger"] || row.child_passenger,
    notes: row["Notes"] || row.notes,
  }
}

// ==================== MOCK DATA ====================

function getMockEmployees(): Employee[] {
  if (!DEMO_DATA_ENABLED) return []
  return [
    {
      id: 1,
      fullName: "Hans van der Berg",
      role: "Owner",
      leaveBalance: 21,
      email: "hans@houseofv.com",
      phone: "+27692381255",
    },
    {
      id: 2,
      fullName: "Charl Pieterse",
      role: "Employee",
      leaveBalance: 15,
      email: "charl@houseofv.com",
      phone: "+27711488390",
    },
    {
      id: 3,
      fullName: "Lucky Mokoena",
      role: "Employee",
      leaveBalance: 8,
      email: "lucky@houseofv.com",
      phone: "+27794142410",
    },
    {
      id: 4,
      fullName: "Irma van Niekerk",
      role: "Resident",
      leaveBalance: 0,
      email: "irma@houseofv.com",
      phone: "+27711488390",
    },
  ]
}

function getMockTasks(): Task[] {
  if (!DEMO_DATA_ENABLED) return []
  return [
    {
      id: 1,
      title: "Fix electrical outlet - Kitchen",
      assignedTo: 2,
      assignedToName: "Charl",
      priority: "High",
      status: "In Progress",
      dueDate: toISODateString(),
      project: "Electrical Work",
    },
    {
      id: 2,
      title: "Repair leaking pipe - Bathroom",
      assignedTo: 2,
      assignedToName: "Charl",
      priority: "High",
      status: "Completed",
      dueDate: toISODateString(),
      project: "Plumbing",
    },
    {
      id: 3,
      title: "Weekly lawn mowing",
      assignedTo: 3,
      assignedToName: "Lucky",
      priority: "Medium",
      status: "Completed",
      dueDate: toISODateString(),
      project: "Garden Maintenance",
    },
    {
      id: 4,
      title: "Trim hedges - front",
      assignedTo: 3,
      assignedToName: "Lucky",
      priority: "Medium",
      status: "Completed",
      dueDate: toISODateString(),
      project: "Garden Maintenance",
    },
    {
      id: 5,
      title: "Fix irrigation zone 3",
      assignedTo: 3,
      assignedToName: "Lucky",
      priority: "High",
      status: "In Progress",
      dueDate: toISODateString(),
      project: "Garden Maintenance",
    },
    {
      id: 6,
      title: "Morning kitchen clean",
      assignedTo: 4,
      assignedToName: "Irma",
      priority: "Medium",
      status: "Completed",
      dueDate: toISODateString(),
      project: "Household",
    },
    {
      id: 7,
      title: "Meal preparation - dinner",
      assignedTo: 4,
      assignedToName: "Irma",
      priority: "High",
      status: "In Progress",
      dueDate: toISODateString(),
      project: "Household",
    },
  ]
}

function getMockExpenses(): Expense[] {
  if (!DEMO_DATA_ENABLED) return []
  return [
    {
      id: 1,
      requester: 2,
      requesterName: "Charl",
      type: "Request",
      category: "Materials",
      amount: 850,
      date: toISODateString(),
      approvalStatus: "Pending",
      project: "Workshop",
    },
    {
      id: 2,
      requester: 3,
      requesterName: "Lucky",
      type: "Request",
      category: "Supplies",
      amount: 320,
      date: toISODateString(),
      approvalStatus: "Pending",
      project: "Garden",
    },
    {
      id: 3,
      requester: 3,
      requesterName: "Lucky",
      type: "Post-Hoc",
      category: "Fuel",
      amount: 280,
      date: toISODateString(new Date(Date.now() - 86400000)),
      approvalStatus: "Approved",
    },
    {
      id: 4,
      requester: 2,
      requesterName: "Charl",
      type: "Post-Hoc",
      category: "Fuel",
      amount: 450,
      date: toISODateString(new Date(Date.now() - 172800000)),
      approvalStatus: "Approved",
    },
  ]
}

function getMockAssets(): Asset[] {
  if (!DEMO_DATA_ENABLED) return []
  return [
    {
      id: 1,
      assetId: "WS-001",
      type: "Tool",
      description: "Makita Drill Set",
      condition: "Good",
      location: "Workshop",
      checkedOutBy: 2,
    },
    {
      id: 2,
      assetId: "WS-002",
      type: "Tool",
      description: "Angle Grinder",
      condition: "Good",
      location: "Workshop",
      checkedOutBy: 2,
    },
    {
      id: 3,
      assetId: "WS-003",
      type: "Tool",
      description: "Multimeter",
      condition: "Excellent",
      location: "Workshop",
    },
    {
      id: 4,
      assetId: "VH-001",
      type: "Vehicle",
      description: "Toyota Hilux",
      condition: "Good",
      location: "Garage",
    },
    {
      id: 5,
      assetId: "GD-001",
      type: "Equipment",
      description: "Lawn Mower",
      condition: "Good",
      location: "Garden Shed",
    },
  ]
}

function getMockTimeClockEntries(): TimeClockEntry[] {
  if (!DEMO_DATA_ENABLED) return []
  const today = toISODateString()
  return [
    {
      id: 1,
      employee: 2,
      employeeName: "Charl",
      date: today,
      clockIn: "07:15",
      approvalStatus: "Pending",
    },
    {
      id: 2,
      employee: 3,
      employeeName: "Lucky",
      date: today,
      clockIn: "06:30",
      approvalStatus: "Pending",
    },
  ]
}

function getMockVehicleLogs(): VehicleLog[] {
  if (!DEMO_DATA_ENABLED) return []
  return [
    {
      id: 1,
      driver: 3,
      driverName: "Lucky",
      vehicle: 4,
      vehicleName: "Toyota Hilux",
      dateOut: toISODateString(),
      odometerStart: 124532,
    },
    {
      id: 2,
      driver: 2,
      driverName: "Charl",
      vehicle: 4,
      vehicleName: "Toyota Hilux",
      dateOut: toISODateString(new Date(Date.now() - 86400000)),
      dateIn: toISODateString(new Date(Date.now() - 86400000)),
      odometerStart: 124500,
      odometerEnd: 124532,
      distance: 32,
    },
  ]
}

export interface DocumentExpiryRowRaw {
  id: number
  "Doc Name"?: string
  Type?: string
  "Last Review"?: string
  "Next Review"?: string
  "Party Responsible"?: Array<{ id: number; value: string }>
  "Superseded By"?: number[]
  "Version Blocked"?: boolean
  "DocuSeal Ref"?: string
  Status?: string
}

export interface DocumentExpiryRow {
  id: number
  docName: string
  type: string
  lastReview?: string
  nextReview?: string
  partyResponsible?: number[]
  supersededBy?: number[]
  versionBlocked: boolean
  docuSealRef?: string
  status?: string
}

export function mapBaserowToDocumentExpiryRow(raw: DocumentExpiryRowRaw): DocumentExpiryRow {
  return {
    id: raw.id,
    docName: raw["Doc Name"] || "Untitled Document",
    type: raw.Type || "General",
    lastReview: raw["Last Review"],
    nextReview: raw["Next Review"],
    partyResponsible: raw["Party Responsible"]?.map((p) => p.id),
    supersededBy: raw["Superseded By"],
    versionBlocked: !!raw["Version Blocked"],
    docuSealRef: raw["DocuSeal Ref"],
    status: raw.Status,
  }
}

export interface LeaveRequest {
  id: number
  employee: number
  startDate: string
  endDate: string
  type: string
  status: "Pending" | "Approved" | "Rejected"
  approver?: number
  approvedAt?: string
  submittedAt: string
  notes?: string
}

export interface Loan {
  id: number
  employee: number
  amount: number
  purpose: string
  repaymentSchedule?: string
  status: "Pending" | "Approved" | "Rejected" | "Active" | "Repaid"
  outstandingBalance: number
  nextRepaymentDate?: string
  approvedBy?: number
  approvedAt?: string
  disbursedAt?: string
  createdAt: string
  notes?: string
}

export interface PettyCash {
  id: number
  requester: number
  amount: number
  purpose: string
  receipt?: string
  status: "Pending" | "Approved" | "Rejected" | "Issued"
  issuedBy?: number
  issuedAt?: string
  approvedBy?: number
  approvedAt?: string
  createdAt: string
  notes?: string
}

export interface OnboardingChecklist {
  id: number
  employee: number
  items: string
  completedAt?: string
  assignedBuddy?: number
  status: "In Progress" | "Completed"
  createdAt: string
  notes?: string
}

export interface Budget {
  id: number
  category: string
  amount: number
  period: string
  version: number
  status: "Draft" | "Active" | "Superseded"
  approvedBy?: number
  approvedAt?: string
  docuSealRef?: string
  notes?: string
}

export interface PPE {
  id: number
  asset: number
  issuedTo: number
  issueDate: string
  expiryDate?: string
  returnDate?: string
  status: "Issued" | "Returned" | "Expired"
  notes?: string
}

export interface PolicyVersion {
  id: number
  document: number
  version: string
  effectiveDate: string
  supersededBy?: number
  status: "Current" | "Superseded"
  docuSealRef?: string
  notes?: string
}

export interface ContractorContract {
  id: number
  contractor: string | number
  project: string
  milestones: string
  amounts: string
  status: "Active" | "Completed" | "Terminated"
  startDate?: string
  endDate?: string
  notes?: string
}

export interface InsuranceClaim {
  id: number
  incident?: number
  asset?: number
  description: string
  amount: number
  status: "Draft" | "Submitted" | "Under Review" | "Approved" | "Denied"
  claimId?: string
  submittedAt?: string
  createdAt: string
  notes?: string
}

export interface Incident {
  id: number
  type: string
  dateTime: string
  location?: string
  reporter?: number
  description: string
  severity: "Low" | "Medium" | "High" | "Critical"
  status: string
  relatedAsset?: number
  relatedEmployee?: number
  relatedIncidentIds?: string
  victimSupportPath?: boolean
}

export async function getDocumentExpiryRows(): Promise<DocumentExpiryRow[]> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.documentExpiry) {
    return []
  }
  const result = await baserowFetch<{ results: DocumentExpiryRowRaw[] }>(
    `/database/rows/table/${tableIds.documentExpiry}/?user_field_names=true&size=200`
  )
  if (!result?.results) return []
  return result.results.map(mapBaserowToDocumentExpiryRow)
}

export async function updateDocumentExpiryRow(
  id: number,
  updates: { docuSealRef?: string; lastReview?: string; status?: string }
): Promise<DocumentExpiryRow | null> {
  const tableIds = getTableIds()
  if (!isBaserowConfigured() || !tableIds.documentExpiry) return null
  const body: Record<string, unknown> = {}
  if (updates.docuSealRef !== undefined) body["DocuSeal Ref"] = updates.docuSealRef
  if (updates.lastReview !== undefined) body["Last Review"] = updates.lastReview
  if (updates.status !== undefined) body["Status"] = updates.status
  if (Object.keys(body).length === 0) return null
  const row = await baserowFetch<DocumentExpiryRowRaw>(
    `/database/rows/table/${tableIds.documentExpiry}/${id}/?user_field_names=true`,
    { method: "PATCH", body: JSON.stringify(body) }
  )
  return row ? mapBaserowToDocumentExpiryRow(row) : null
}
