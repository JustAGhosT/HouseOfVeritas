import { NextResponse } from "next/server"
import {
  getInsuranceClaims,
  createInsuranceClaim,
  updateInsuranceClaim,
} from "@/lib/services/baserow"
import { submitClaim, getClaimStatus } from "@/lib/integrations/insurance"
import { withDataSource } from "@/lib/api/response"
import { withRole } from "@/lib/auth/rbac"
import { toISODateString } from "@/lib/utils"
import { logger } from "@/lib/logger"

export const GET = withRole(
  "admin",
  "operator"
)(async (request) => {
  const { searchParams } = new URL(request.url)
  const incident = searchParams.get("incident")
  const status = searchParams.get("status")

  try {
    const claims = await getInsuranceClaims({
      incident: incident ? parseInt(incident, 10) : undefined,
      status: status || undefined,
    })
    return withDataSource({ claims })
  } catch (error) {
    logger.error("Error fetching insurance claims", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch insurance claims" }, { status: 500 })
  }
})

export const POST = withRole("admin")(async (request) => {
  try {
    const body = await request.json()
    const { incident, asset, description, amount, notes } = body

    if (!description || amount == null) {
      return NextResponse.json({ error: "Description and amount are required" }, { status: 400 })
    }

    const claim = await createInsuranceClaim({
      incident,
      asset,
      description,
      amount,
      status: "Draft",
      createdAt: toISODateString(),
      notes,
    })

    if (!claim) {
      return NextResponse.json({ error: "Failed to create insurance claim" }, { status: 500 })
    }

    return withDataSource({ claim })
  } catch (error) {
    logger.error("Error creating insurance claim", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create insurance claim" }, { status: 500 })
  }
})

export const PATCH = withRole("admin")(async (request) => {
  try {
    const body = await request.json()
    const { id, status, submitToInsurer } = body

    if (!id) {
      return NextResponse.json({ error: "Claim ID is required" }, { status: 400 })
    }

    const existing = (await getInsuranceClaims({})).find((c) => c.id === id)
    if (!existing) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    const updates: Record<string, unknown> = { ...body }
    delete updates.id
    delete updates.submitToInsurer

    if (submitToInsurer && existing.status === "Draft") {
      const result = await submitClaim({
        incidentId: existing.incident ? String(existing.incident) : undefined,
        assetId: existing.asset ? String(existing.asset) : undefined,
        description: existing.description,
        amount: existing.amount,
        currency: "ZAR",
      })

      if (result.success) {
        updates.claimId = result.claimId
        updates.status = "Submitted"
        updates.submittedAt = toISODateString()
      } else {
        return NextResponse.json(
          { error: "Insurance submission failed", details: result.message ?? "Unknown error" },
          { status: 502 }
        )
      }
    } else if (status) {
      updates.status = status
    }

    const claim = await updateInsuranceClaim(
      id,
      updates as Parameters<typeof updateInsuranceClaim>[1]
    )

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    return withDataSource({ claim })
  } catch (error) {
    logger.error("Error updating insurance claim", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to update insurance claim" }, { status: 500 })
  }
})
