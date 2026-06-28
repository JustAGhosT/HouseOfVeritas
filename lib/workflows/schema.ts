export type WorkflowEventName =
  | "house-of-veritas/kiosk.request.submitted"
  | "house-of-veritas/expense.created"
  | "house-of-veritas/leave.request.submitted"
  | "house-of-veritas/loan.request.submitted"
  | "house-of-veritas/petty.cash.request.submitted"
  | "house-of-veritas/petty.cash.policy.violation"
  | "house-of-veritas/employee.created"
  | "house-of-veritas/onboarding.checklist.progressed"
  | "house-of-veritas/kitchen.cross.contamination"
  | "house-of-veritas/kitchen.meal.feedback"
  | "house-of-veritas/succession.live.test"
  | "house-of-veritas/document.expiry.check"
  | "house-of-veritas/recurring.tasks.create"
  | "house-of-veritas/overtime.calculate"
  | "house-of-veritas/task.created"
  | "house-of-veritas/incident.created"
  | "house-of-veritas/maintenance.scheduled"
  | "house-of-veritas/inventory.low_stock"
  | "house-of-veritas/docuseal.submission.completed"
  | "house-of-veritas/project.suggestion.approved"
  | "house-of-veritas/kiosk.stock_order.approved"
  | "house-of-veritas/purchase_order.created"
  | "house-of-veritas/project.started"
  | "house-of-veritas/contractor.milestone.completed"

export interface KioskRequestPayload {
  requestId: string
  type: "stock_order" | "salary_advance" | "issue_report"
  employeeId: string
  employeeName: string
  data: Record<string, unknown>
  timestamp: string
}

export interface ExpensePayload {
  id?: number
  requester?: number
  type?: string
  category?: string
  amount?: number
  approvalStatus?: string
  submittedBy?: string
}

export interface DocumentExpiryPayload {
  documentId: string
  expiryDate: string
  daysUntilExpiry: number
}

export interface TaskPayload {
  id: number
  title: string
  assigneeId?: number
  assigneeEmail?: string
}

export interface KitchenCrossContaminationPayload {
  taskId: number
  description: string
  location: string
}

export interface KitchenMealFeedbackPayload {
  taskId: number
  description: string
  mealName?: string
  servedBy?: string
  location: string
  severity: "low" | "medium" | "high"
}

export interface IncidentPayload {
  id: string
  severity: "Low" | "Medium" | "High" | "Critical"
  assigneeId?: string
  victimSupportPath?: boolean
}

export interface MaintenancePayload {
  id: string
  assigneeId?: string
  assigneeEmail?: string
  scheduledDate: string
}

export interface DocuSealSubmissionPayload {
  submissionId: string
  templateName: string
  documentUrl: string
  completedAt: string
  submitterEmails: string[]
}

export interface InventoryLowStockPayload {
  itemId: string
  name: string
  category: string
  currentStock: number
  reorderPoint: number
  location: string
  urgency: "critical" | "warning"
}

export interface ProjectSuggestionApprovedPayload {
  projectId: string
  name: string
  type: string
  suggestedBy: string
  reviewedBy: string
}

export interface StockOrderApprovedPayload {
  requestId: string
  itemName: string
  quantity: number
  employeeId: string
  reviewedBy: string
}

export interface PurchaseOrderCreatedPayload {
  poId: string
  vendor: string
  amount: number
  items: string
  createdBy: string
}

export interface ProjectStartedPayload {
  projectId: string
  name: string
  type: string
}

export interface ContractorMilestonePayload {
  contractorId: number
  contractorName: string
  project: string
  stage: string
  amount: number
}

export interface LeaveRequestPayload {
  id: number
  employeeId: number
  startDate: string
  endDate: string
  type: string
  days: number
}

export interface LoanPayload {
  id: number
  employeeId: number
  amount: number
  purpose: string
}

export interface PettyCashPayload {
  id?: number
  requesterId: number
  amount: number
  purpose: string
  reason?: string
}

export type WorkflowEvent =
  | { name: "house-of-veritas/kiosk.request.submitted"; data: KioskRequestPayload }
  | { name: "house-of-veritas/expense.created"; data: ExpensePayload }
  | {
      name: "house-of-veritas/employee.created"
      data: { employeeId: number; name: string; email: string }
    }
  | {
      name: "house-of-veritas/onboarding.checklist.progressed"
      data: { checklistId?: number; employeeId?: number }
    }
  | { name: "house-of-veritas/kitchen.cross.contamination"; data: KitchenCrossContaminationPayload }
  | { name: "house-of-veritas/kitchen.meal.feedback"; data: KitchenMealFeedbackPayload }
  | { name: "house-of-veritas/document.expiry.check"; data?: Record<string, unknown> }
  | { name: "house-of-veritas/recurring.tasks.create"; data?: Record<string, unknown> }
  | { name: "house-of-veritas/overtime.calculate"; data?: Record<string, unknown> }
  | { name: "house-of-veritas/task.created"; data: TaskPayload }
  | { name: "house-of-veritas/incident.created"; data: IncidentPayload }
  | { name: "house-of-veritas/maintenance.scheduled"; data: MaintenancePayload }
  | { name: "house-of-veritas/inventory.low_stock"; data: InventoryLowStockPayload }
  | { name: "house-of-veritas/docuseal.submission.completed"; data: DocuSealSubmissionPayload }
  | { name: "house-of-veritas/project.suggestion.approved"; data: ProjectSuggestionApprovedPayload }
  | { name: "house-of-veritas/kiosk.stock_order.approved"; data: StockOrderApprovedPayload }
  | { name: "house-of-veritas/purchase_order.created"; data: PurchaseOrderCreatedPayload }
  | { name: "house-of-veritas/project.started"; data: ProjectStartedPayload }
  | { name: "house-of-veritas/contractor.milestone.completed"; data: ContractorMilestonePayload }
  | { name: "house-of-veritas/leave.request.submitted"; data: LeaveRequestPayload }
  | { name: "house-of-veritas/loan.request.submitted"; data: LoanPayload }
  | { name: "house-of-veritas/petty.cash.request.submitted"; data: PettyCashPayload }
  | { name: "house-of-veritas/petty.cash.policy.violation"; data: PettyCashPayload }
