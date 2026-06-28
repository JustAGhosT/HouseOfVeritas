import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import { healthCheck } from "@/lib/inngest/functions"
import { kioskRequestSubmitted } from "@/lib/workflows/kiosk"
import { expenseCreated } from "@/lib/workflows/expense"
import { documentExpiryCheck } from "@/lib/workflows/document-expiry"
import { recurringTasksCreate } from "@/lib/workflows/recurring-tasks"
import { overtimeCalculate } from "@/lib/workflows/overtime"
import { taskCreated } from "@/lib/workflows/task-assignment"
import { incidentCreated } from "@/lib/workflows/incident"
import { maintenanceScheduled } from "@/lib/workflows/maintenance"
import { leaveBalanceUpdate } from "@/lib/workflows/leave-balance"
import { inventoryLowStock } from "@/lib/workflows/inventory-low-stock"
import { inventoryLowStockCron } from "@/lib/workflows/inventory-low-stock-cron"
import { taskOverdueCheck } from "@/lib/workflows/task-overdue"
import { docusealSubmissionCompleted } from "@/lib/workflows/docuseal-webhook"
import { shoppingListWeekly } from "@/lib/workflows/shopping-list-weekly"
import { projectSuggestionApproved } from "@/lib/workflows/project-suggestion"
import { vehicleMileageCheck } from "@/lib/workflows/vehicle-mileage"
import { inventoryExpiryCheck } from "@/lib/workflows/inventory-expiry"
import { reorderAutomation } from "@/lib/workflows/reorder-automation"
import { supplierOrderPlaced } from "@/lib/workflows/supplier-order"
import { purchaseOrderCreated } from "@/lib/workflows/purchase-order"
import { projectStarted } from "@/lib/workflows/project-started"
import { contractorMilestoneCompleted } from "@/lib/workflows/contractor-milestone"
import { probationReminder } from "@/lib/workflows/probation-reminder"
import { expenseApprovalReminder } from "@/lib/workflows/expense-approval-reminder"
import { payrollSummary } from "@/lib/workflows/payroll-summary"
import { emergencyDrillReminder } from "@/lib/workflows/emergency-drill-reminder"
import { successionDrill } from "@/lib/workflows/succession-drill"
import { leaveRequestSubmitted } from "@/lib/workflows/leave-request-submitted"
import { leaveCarryoverExpiry } from "@/lib/workflows/leave-carryover-expiry"
import { leaveCompulsoryAudit } from "@/lib/workflows/leave-compulsory-audit"
import { loanRequestSubmitted } from "@/lib/workflows/loan-request-submitted"
import { loanRepaymentReminder } from "@/lib/workflows/loan-repayment-reminder"
import { loanOverdueEscalation } from "@/lib/workflows/loan-overdue-escalation"
import { pettyCashRequestSubmitted, pettyCashPolicyViolation } from "@/lib/workflows/petty-cash"
import { contractorPaymentDue } from "@/lib/workflows/contractor-payment-due"
import { monthlyFinancialAudit } from "@/lib/workflows/monthly-financial-audit"
import { budgetBreachAlert } from "@/lib/workflows/budget-breach-alert"
import { insuranceClaimStatusSync } from "@/lib/workflows/insurance-claim-status-sync"
import { onboardingBuddyAssign } from "@/lib/workflows/onboarding-buddy-assign"
import { onboardingFeedbackSurvey } from "@/lib/workflows/onboarding-feedback-survey"
import { onboardingReferenceCheck } from "@/lib/workflows/onboarding-reference-check"
import { onboardingItProvision } from "@/lib/workflows/onboarding-it-provision"
import { taskHandoverAbsence } from "@/lib/workflows/task-handover-absence"
import { taskAssignmentRotate } from "@/lib/workflows/task-assignment-rotate"
import { taskFailurePropagate } from "@/lib/workflows/task-failure-propagate"
import { kitchenCrossContamination } from "@/lib/workflows/kitchen-cross-contamination"
import { kitchenMealFeedback } from "@/lib/workflows/kitchen-meal-feedback"
import { kitchenLockerAudit } from "@/lib/workflows/kitchen-locker-audit"
import { kitchenForcedDeepClean } from "@/lib/workflows/kitchen-forced-deep-clean"
import { assetMiniAudit } from "@/lib/workflows/asset-mini-audit"
import { assetLateReturnLockout } from "@/lib/workflows/asset-late-return-lockout"
import { incidentRepeatLinkage } from "@/lib/workflows/incident-repeat-linkage"
import { incidentHazardWalk } from "@/lib/workflows/incident-hazard-walk"
import { ppeExpiryReminder } from "@/lib/workflows/ppe-expiry-reminder"
import { toolCalibrationReminder } from "@/lib/workflows/tool-calibration-reminder"
import { documentAgingAlert } from "@/lib/workflows/document-aging-alert"
import { successionPremortem } from "@/lib/workflows/succession-premortem"
import { vehicleComplianceExpiry } from "@/lib/workflows/vehicle-compliance-expiry"
import { successionLiveTest } from "@/lib/workflows/succession-live-test"
import { workflowAgingAlert } from "@/lib/workflows/workflow-aging-alert"
import { improvementPrompt } from "@/lib/workflows/improvement-prompt"
import { feedbackRecap } from "@/lib/workflows/feedback-recap"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    healthCheck,
    kioskRequestSubmitted,
    expenseCreated,
    documentExpiryCheck,
    recurringTasksCreate,
    overtimeCalculate,
    taskCreated,
    incidentCreated,
    maintenanceScheduled,
    leaveBalanceUpdate,
    inventoryLowStock,
    inventoryLowStockCron,
    taskOverdueCheck,
    docusealSubmissionCompleted,
    shoppingListWeekly,
    projectSuggestionApproved,
    vehicleMileageCheck,
    inventoryExpiryCheck,
    reorderAutomation,
    supplierOrderPlaced,
    purchaseOrderCreated,
    projectStarted,
    contractorMilestoneCompleted,
    probationReminder,
    expenseApprovalReminder,
    payrollSummary,
    emergencyDrillReminder,
    successionDrill,
    leaveRequestSubmitted,
    leaveCarryoverExpiry,
    leaveCompulsoryAudit,
    loanRequestSubmitted,
    loanRepaymentReminder,
    loanOverdueEscalation,
    pettyCashRequestSubmitted,
    pettyCashPolicyViolation,
    contractorPaymentDue,
    monthlyFinancialAudit,
    budgetBreachAlert,
    insuranceClaimStatusSync,
    onboardingBuddyAssign,
    onboardingFeedbackSurvey,
    onboardingReferenceCheck,
    onboardingItProvision,
    taskHandoverAbsence,
    taskAssignmentRotate,
    taskFailurePropagate,
    kitchenCrossContamination,
    kitchenMealFeedback,
    kitchenLockerAudit,
    kitchenForcedDeepClean,
    assetMiniAudit,
    assetLateReturnLockout,
    incidentRepeatLinkage,
    incidentHazardWalk,
    ppeExpiryReminder,
    toolCalibrationReminder,
    documentAgingAlert,
    successionPremortem,
    vehicleComplianceExpiry,
    successionLiveTest,
    workflowAgingAlert,
    improvementPrompt,
    feedbackRecap,
  ],
})
