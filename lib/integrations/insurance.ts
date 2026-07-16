/**
 * Insurance portal API integration stub for claim submission and status.
 * Used for asset loss/damage and incident-related insurance claims.
 *
 * Configure INSURANCE_PORTAL_URL and INSURANCE_API_KEY to enable. When not configured,
 * submitClaim logs the attempted claim and returns a failure; getClaimStatus returns null.
 */

import { logger } from "@/lib/logger"

export interface ClaimRequest {
  incidentId?: string
  assetId?: string
  description: string
  amount: number
  currency: string
  attachments?: string[]
}

export interface ClaimResult {
  success: boolean
  claimId?: string
  message?: string
}

export type ClaimStatus = "Submitted" | "Under Review" | "Approved" | "Denied"

export interface ClaimStatusResult {
  claimId: string
  status: ClaimStatus
  updatedAt?: string
}

function isConfigured(): boolean {
  return !!(process.env.INSURANCE_PORTAL_URL && process.env.INSURANCE_API_KEY)
}

export async function submitClaim(claim: ClaimRequest): Promise<ClaimResult> {
  if (!isConfigured()) {
    logger.info("Insurance portal not configured, claim logged only", {
      incidentId: claim.incidentId,
      assetId: claim.assetId,
      amount: claim.amount,
    })
    return {
      success: false,
      message: "Insurance portal is not configured; claim was not submitted",
    }
  }

  try {
    const response = await fetch(`${process.env.INSURANCE_PORTAL_URL}/claims`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INSURANCE_API_KEY}`,
      },
      body: JSON.stringify(claim),
    })

    if (!response.ok) {
      const text = await response.text()
      logger.error("Insurance claim submission failed", {
        status: response.status,
        body: text,
      })
      return {
        success: false,
        message: `Insurance API error: ${response.status}`,
      }
    }

    const data = (await response.json()) as { claimId?: string }
    return {
      success: true,
      claimId: data.claimId ?? `ins-${Date.now()}`,
    }
  } catch (error) {
    logger.error("Insurance API request failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function getClaimStatus(claimId: string): Promise<ClaimStatusResult | null> {
  if (!isConfigured()) {
    logger.info("Insurance portal not configured, claim status unavailable", { claimId })
    return null
  }

  try {
    const response = await fetch(
      `${process.env.INSURANCE_PORTAL_URL}/claims/${encodeURIComponent(claimId)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.INSURANCE_API_KEY}`,
        },
      }
    )

    if (!response.ok) {
      logger.warn("Insurance claim status fetch failed", {
        claimId,
        status: response.status,
      })
      return null
    }

    const data = (await response.json()) as {
      claimId?: string
      status?: ClaimStatus
      updatedAt?: string
    }
    return {
      claimId: data.claimId ?? claimId,
      status: data.status ?? "Submitted",
      updatedAt: data.updatedAt,
    }
  } catch (error) {
    logger.error("Insurance status request failed", {
      claimId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
