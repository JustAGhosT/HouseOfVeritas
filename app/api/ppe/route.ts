import { NextResponse } from "next/server"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { resolveEmployeeForGet } from "@/lib/api/employee-resolver"
import { withDataSource } from "@/lib/api/response"
import { withRole } from "@/lib/auth/rbac"
import { toISODateString } from "@/lib/utils"
import { logger } from "@/lib/logger"

export const GET = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request, context) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  const { employeeId, error } = await resolveEmployeeForGet(context, searchParams, {
    paramName: "issuedTo",
  })
  if (error) return error

  try {
    const records = await getEstateRepository().ppe.list({
      issuedTo: employeeId,
      status: status || undefined,
    })
    return withDataSource({ records })
  } catch (error) {
    logger.error("Error fetching PPE records", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch PPE records" }, { status: 500 })
  }
})

export const POST = withRole(
  "admin",
  "operator"
)(async (request) => {
  try {
    const body = await request.json()
    const { asset, issuedTo, expiryDate, notes } = body

    if (!asset || !issuedTo) {
      return NextResponse.json({ error: "Asset and issuedTo are required" }, { status: 400 })
    }

    const ppe = await getEstateRepository().ppe.create({
      asset,
      issuedTo,
      issueDate: toISODateString(),
      expiryDate,
      status: "Issued",
      notes,
    })

    if (!ppe) {
      return NextResponse.json({ error: "Failed to create PPE record" }, { status: 500 })
    }

    return withDataSource({ ppe })
  } catch (error) {
    logger.error("Error creating PPE record", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create PPE record" }, { status: 500 })
  }
})

export const PATCH = withRole(
  "admin",
  "operator"
)(async (request) => {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "PPE record ID is required" }, { status: 400 })
    }

    const ppe = await getEstateRepository().ppe.update(id, updates)

    if (!ppe) {
      return NextResponse.json({ error: "PPE record not found" }, { status: 404 })
    }

    return withDataSource({ ppe })
  } catch (error) {
    logger.error("Error updating PPE record", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to update PPE record" }, { status: 500 })
  }
})
