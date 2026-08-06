/**
 * Canonical estate domain types.
 *
 * These describe the business entities, not any particular datastore. Nothing in
 * this file may import from `lib/services/baserow` (or any other backend) — the
 * dependency runs the other way, so the storage engine can be swapped without
 * touching the domain. Backend-shaped wire formats (Baserow's `"Doc Name"`-style
 * raw rows) deliberately stay in the service module that speaks that protocol.
 */

/**
 * Identifier for a persisted entity.
 *
 * Currently numeric because every entity is Baserow row-backed. Aliased so a move
 * to UUID/ObjectId keys is a single-line change here plus whatever the compiler
 * then flags, rather than a search-and-replace across ~77 consumer files.
 */
export type EntityId = number

export interface PaginatedResult<T> {
  items: T[]
  count: number
}

export interface Employee {
  id: EntityId
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

export interface Asset {
  id: EntityId
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

export interface Task {
  id: EntityId
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

export interface TimeClockEntry {
  id: EntityId
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

export interface Expense {
  id: EntityId
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

export interface VehicleLog {
  id: EntityId
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

export interface LeaveRequest {
  id: EntityId
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
  id: EntityId
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
  id: EntityId
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
  id: EntityId
  employee: number
  items: string
  completedAt?: string
  assignedBuddy?: number
  status: "In Progress" | "Completed"
  createdAt: string
  notes?: string
}

export interface Budget {
  id: EntityId
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
  id: EntityId
  asset: number
  issuedTo: number
  issueDate: string
  expiryDate?: string
  returnDate?: string
  status: "Issued" | "Returned" | "Expired"
  notes?: string
}

export interface PolicyVersion {
  id: EntityId
  document: number
  version: string
  effectiveDate: string
  supersededBy?: number
  status: "Current" | "Superseded"
  docuSealRef?: string
  notes?: string
}

export interface ContractorContract {
  id: EntityId
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
  id: EntityId
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
  id: EntityId
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

export interface DocumentExpiryRow {
  id: EntityId
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
