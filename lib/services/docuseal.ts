// DocuSeal API Integration Service
// This service handles all interactions with the DocuSeal e-signature platform

import { logger } from "@/lib/logger"

const FETCH_TIMEOUT_MS = 10000
const DEMO_DATA_ENABLED = process.env.ALLOW_DEMO_DATA === "true"

interface DocuSealConfig {
  apiUrl: string
  apiKey: string
}

interface DocumentTemplate {
  id: string
  name: string
  fields: Array<{
    name: string
    type: "signature" | "text" | "date" | "checkbox"
    required: boolean
  }>
}

interface SignatureSubmission {
  id: string
  templateId: string
  recipients: Array<{
    email: string
    name: string
    role: string
  }>
  status: "pending" | "completed" | "expired" | "cancelled"
  createdAt: Date
  completedAt?: Date
  documentUrl?: string
  signingUrl?: string
}

interface CreateSubmissionRequest {
  templateId: string
  recipients: Array<{
    email: string
    name: string
    role: string
  }>
  metadata?: Record<string, any>
}

// Default config - uses environment variables or fallback
const getConfig = (): DocuSealConfig => ({
  apiUrl: process.env.DOCUSEAL_API_URL || "https://sign.nexamesh.ai/api",
  apiKey: process.env.DOCUSEAL_API_KEY || "",
})

// Check if DocuSeal is configured
export const isDocuSealConfigured = (): boolean => {
  const config = getConfig()
  return !!config.apiKey
}

// Get all document templates
export async function getTemplates(): Promise<DocumentTemplate[]> {
  const config = getConfig()

  if (!config.apiKey) {
    return DEMO_DATA_ENABLED ? getMockTemplates() : []
  }

  try {
    const response = await fetch(`${config.apiUrl}/templates`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "X-Auth-Token": config.apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`DocuSeal API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    logger.error("DocuSeal getTemplates error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return DEMO_DATA_ENABLED ? getMockTemplates() : []
  }
}

// Create a new signature submission
export async function createSubmission(
  request: CreateSubmissionRequest
): Promise<SignatureSubmission | null> {
  const config = getConfig()

  if (!config.apiKey) {
    return DEMO_DATA_ENABLED ? createMockSubmission(request) : null
  }

  try {
    const response = await fetch(`${config.apiUrl}/submissions`, {
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "X-Auth-Token": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: request.templateId,
        send_email: true,
        submitters: request.recipients.map((r) => ({
          email: r.email,
          name: r.name,
          role: r.role,
        })),
        metadata: request.metadata,
      }),
    })

    if (!response.ok) {
      throw new Error(`DocuSeal API error: ${response.status}`)
    }

    const data = await response.json()
    const baseUrl = config.apiUrl.replace(/\/api\/?$/, "")
    const submitters = Array.isArray(data) ? data : data.submitters || []
    const firstSubmitter =
      submitters.find((s: { email?: string }) => s.email === request.recipients[0]?.email) ||
      submitters[0]
    const signingUrl = firstSubmitter?.embed_src
      ? firstSubmitter.embed_src
      : firstSubmitter?.slug
        ? `${baseUrl}/s/${firstSubmitter.slug}`
        : undefined

    return {
      id: String(data.id ?? data.submission_id ?? firstSubmitter?.submission_id ?? ""),
      templateId: request.templateId,
      recipients: request.recipients,
      status: "pending",
      createdAt: new Date(),
      signingUrl,
    }
  } catch (error) {
    logger.error("DocuSeal createSubmission error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return DEMO_DATA_ENABLED ? createMockSubmission(request) : null
  }
}

// Get submission status
export async function getSubmissionStatus(
  submissionId: string
): Promise<SignatureSubmission | null> {
  const config = getConfig()

  if (!config.apiKey) {
    return DEMO_DATA_ENABLED ? getMockSubmissionStatus(submissionId) : null
  }

  try {
    const response = await fetch(`${config.apiUrl}/submissions/${submissionId}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "X-Auth-Token": config.apiKey,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`DocuSeal API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      id: data.id,
      templateId: data.template_id,
      recipients: data.submitters.map((s: any) => ({
        email: s.email,
        name: s.name,
        role: s.role,
      })),
      status: data.status,
      createdAt: new Date(data.created_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      documentUrl: data.document_url,
    }
  } catch (error) {
    logger.error("DocuSeal getSubmissionStatus error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return DEMO_DATA_ENABLED ? getMockSubmissionStatus(submissionId) : null
  }
}

// Mock data functions
function getMockTemplates(): DocumentTemplate[] {
  return [
    {
      id: "tpl_employment_contract",
      name: "Employment Contract",
      fields: [
        { name: "employee_signature", type: "signature", required: true },
        { name: "employer_signature", type: "signature", required: true },
        { name: "start_date", type: "date", required: true },
        { name: "position", type: "text", required: true },
      ],
    },
    {
      id: "tpl_house_rules",
      name: "House Rules Acknowledgment",
      fields: [
        { name: "resident_signature", type: "signature", required: true },
        { name: "acknowledgment_date", type: "date", required: true },
        { name: "understood_checkbox", type: "checkbox", required: true },
      ],
    },
    {
      id: "tpl_popia_consent",
      name: "POPIA Consent Form",
      fields: [
        { name: "subject_signature", type: "signature", required: true },
        { name: "consent_date", type: "date", required: true },
        { name: "data_processing_consent", type: "checkbox", required: true },
      ],
    },
    {
      id: "tpl_vehicle_checkout",
      name: "Vehicle Checkout Form",
      fields: [
        { name: "driver_signature", type: "signature", required: true },
        { name: "checkout_date", type: "date", required: true },
        { name: "vehicle_condition_acknowledged", type: "checkbox", required: true },
      ],
    },
    {
      id: "tpl_expense_approval",
      name: "Expense Approval Form",
      fields: [
        { name: "requester_signature", type: "signature", required: true },
        { name: "approver_signature", type: "signature", required: true },
        { name: "amount", type: "text", required: true },
        { name: "approval_date", type: "date", required: true },
      ],
    },
  ]
}

function createMockSubmission(request: CreateSubmissionRequest): SignatureSubmission {
  return {
    id: `sub_mock_${Date.now()}`,
    templateId: request.templateId,
    recipients: request.recipients,
    status: "pending",
    createdAt: new Date(),
  }
}

function getMockSubmissionStatus(submissionId: string): SignatureSubmission {
  // Simulate different statuses based on ID
  const isCompleted = submissionId.includes("completed")
  return {
    id: submissionId,
    templateId: "tpl_employment_contract",
    recipients: [{ email: "user@houseofv.com", name: "User", role: "signer" }],
    status: isCompleted ? "completed" : "pending",
    createdAt: new Date(Date.now() - 86400000), // Yesterday
    completedAt: isCompleted ? new Date() : undefined,
    documentUrl: isCompleted ? `https://docs.nexamesh.ai/documents/${submissionId}` : undefined,
  }
}

export type { DocumentTemplate, SignatureSubmission, CreateSubmissionRequest }
