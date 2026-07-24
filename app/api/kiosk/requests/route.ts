import { withAuth, withRole } from "@/lib/auth/rbac"
import {
  getKioskStore,
  sanitizeKioskDoc,
  sanitizeKioskDocs,
  type KioskRequestDoc,
} from "@/lib/db/kiosk-store"
import { getInventoryRepository } from "@/lib/repositories/inventory-repository"
import { logger } from "@/lib/logger"
import { NotificationChannel, sendNotification } from "@/lib/services/notification-service"
import { routeToInngest } from "@/lib/workflows"
import { ObjectId } from "mongodb"
import { NextResponse } from "next/server"

// Re-export for tests that may reference SEED_DATA
export { KIOSK_SEED_DATA as SEED_DATA } from "@/lib/db/kiosk-store"

async function notifyEmployee(
  request: KioskRequestDoc,
  status: "approved" | "rejected",
  notes?: string
) {
  const typeLabels: Record<string, string> = {
    stock_order: "Stock Order",
    salary_advance: "Salary Advance",
    issue_report: "Issue Report",
  }

  const title = `Request ${status === "approved" ? "Approved" : "Rejected"}`
  let message = `Your ${typeLabels[request.type]} request has been ${status}.`

  if (request.type === "stock_order") {
    message += ` Item: ${(request.data as { itemName?: string }).itemName}`
  } else if (request.type === "salary_advance") {
    message += ` Amount: R${(request.data as { amount?: number }).amount}`
  } else if (request.type === "issue_report") {
    message += ` Asset: ${(request.data as { assetName?: string }).assetName}`
  }

  if (notes) {
    message += ` Note: ${notes}`
  }

  const channels: NotificationChannel[] = ["sms", "in_app"]
  try {
    const results = await sendNotification({
      type: status === "approved" ? "expense_approved" : "expense_rejected",
      userId: request.employeeId,
      title,
      message,
      channels,
      data: {
        requestId: request._id?.toString(),
        requestType: request.type,
        status,
      },
      priority: "high",
    })
    logger.info("Notification sent", { employeeName: request.employeeName, results })
    return results
  } catch (error) {
    logger.error("Notification error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

async function notifyManager(request: KioskRequestDoc) {
  const typeLabels: Record<string, string> = {
    stock_order: "Stock Order",
    salary_advance: "Salary Advance Request",
    issue_report: "Issue Report",
  }

  let description = ""
  const d = request.data as Record<string, unknown>
  if (request.type === "stock_order") {
    description = `${d.quantity}x ${d.itemName}`
  } else if (request.type === "salary_advance") {
    description = `R${d.amount} - ${d.reason}`
  } else if (request.type === "issue_report") {
    description = `${d.assetName} - ${d.issueType}`
  }

  const channels: NotificationChannel[] = ["in_app"]
  if (d.urgency === "urgent" || d.issueType === "safety") {
    channels.push("sms")
  }

  try {
    await sendNotification({
      type: "approval_required",
      userId: "hans",
      title: `New ${typeLabels[request.type]}`,
      message: `${request.employeeName} submitted: ${description}`,
      channels,
      data: {
        requestType: request.type,
        submittedBy: request.employeeName,
        description,
      },
      priority: d.urgency === "urgent" || d.issueType === "safety" ? "urgent" : "medium",
    })
  } catch (error) {
    logger.error("Manager notification error", {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export const GET = withAuth(async (request) => {
  try {
    const { store, mode } = await getKioskStore()
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")
    const typeParam = searchParams.get("type")
    const statusParam = searchParams.get("status")

    const validTypes = ["stock_order", "salary_advance", "issue_report"] as const
    const validStatuses = ["pending", "approved", "rejected", "completed"] as const

    const options = {
      employeeId: employeeId || undefined,
      type: validTypes.includes(typeParam as (typeof validTypes)[number])
        ? (typeParam as KioskRequestDoc["type"])
        : undefined,
      status: validStatuses.includes(statusParam as (typeof validStatuses)[number])
        ? (statusParam as KioskRequestDoc["status"])
        : undefined,
    }

    const requests = await store.find(options)
    const allRequests = await store.find()
    const summary = {
      total: allRequests.length,
      pending: allRequests.filter((r) => r.status === "pending").length,
      approved: allRequests.filter((r) => r.status === "approved").length,
      rejected: allRequests.filter((r) => r.status === "rejected").length,
      byType: {
        stock_order: allRequests.filter((r) => r.type === "stock_order").length,
        salary_advance: allRequests.filter((r) => r.type === "salary_advance").length,
        issue_report: allRequests.filter((r) => r.type === "issue_report").length,
      },
    }

    return NextResponse.json({
      success: true,
      requests: sanitizeKioskDocs(requests),
      summary,
      storage: mode,
    })
  } catch (error) {
    logger.error("GET kiosk requests error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ success: false, error: "Failed to fetch requests" }, { status: 500 })
  }
})

export const POST = withAuth(async (request) => {
  try {
    const { store, mode } = await getKioskStore()
    const body = await request.json()
    const { type, employeeId, employeeName, data, timestamp } = body

    if (!type || !employeeId || !data) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    const newRequest: Omit<KioskRequestDoc, "_id"> = {
      type,
      employeeId,
      employeeName: employeeName || employeeId,
      data,
      timestamp: timestamp || new Date().toISOString(),
      status: "pending",
    }

    const result = await store.insertOne(newRequest)
    const insertedRequest: KioskRequestDoc = {
      ...newRequest,
      _id: result.insertedId,
    }

    const useInngest = process.env.USE_INNGEST_APPROVALS === "true"
    try {
      if (useInngest) {
        await routeToInngest({
          name: "house-of-veritas/kiosk.request.submitted",
          data: {
            requestId: result.insertedId.toString(),
            type: insertedRequest.type,
            employeeId: insertedRequest.employeeId,
            employeeName: insertedRequest.employeeName,
            data: insertedRequest.data,
            timestamp: insertedRequest.timestamp,
          },
        })
      } else {
        await notifyManager(insertedRequest)
      }
    } catch (dispatchError) {
      logger.error("Kiosk: dispatch failed after insert", {
        requestId: result.insertedId.toString(),
        type: insertedRequest.type,
        error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
      })
    }
    logger.info("Kiosk: New request", { type, employeeName: employeeName || employeeId, data })

    return NextResponse.json({
      success: true,
      request: sanitizeKioskDoc(insertedRequest),
      message: getSuccessMessage(type),
      storage: mode,
    })
  } catch (error) {
    logger.error("POST kiosk request error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ success: false, error: "Failed to create request" }, { status: 500 })
  }
})

export const PATCH = withRole("admin")(async (request, context) => {
  try {
    const { store, mode } = await getKioskStore()
    const body = await request.json()
    const { requestId, status, notes } = body

    if (!requestId || !status) {
      return NextResponse.json(
        { success: false, error: "Missing requestId or status" },
        { status: 400 }
      )
    }

    const VALID_STATUSES = ["approved", "rejected", "pending"] as const
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      )
    }

    let objectId: ObjectId
    try {
      objectId = new ObjectId(requestId)
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request ID format" },
        { status: 400 }
      )
    }

    const existingRequest = await store.findOne({ _id: objectId })
    if (!existingRequest) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 })
    }
    // Capture previous status BEFORE updating to avoid race conditions with in-memory stores
    const previousStatus = existingRequest.status

    const updateData = {
      status,
      reviewedBy: context.userId,
      reviewedAt: new Date().toISOString(),
      notes,
    }

    await store.updateOne({ _id: objectId }, { $set: updateData })
    const updatedRequest = { ...existingRequest, ...updateData }

    const statusChanged = previousStatus !== status
    if (statusChanged && (status === "approved" || status === "rejected")) {
      await notifyEmployee(updatedRequest, status, notes)
    }

    if (
      statusChanged &&
      previousStatus !== "approved" &&
      status === "approved" &&
      updatedRequest.type === "stock_order"
    ) {
      const d = updatedRequest.data as { itemName?: string; quantity?: number }
      const itemName = d?.itemName
      const quantity = typeof d?.quantity === "number" ? d.quantity : 0
      if (itemName && quantity > 0) {
        const { repository: inventoryRepository } = await getInventoryRepository()
        const restocked = await inventoryRepository.restockByName(itemName, quantity)
        if (restocked) {
          logger.info("Kiosk: Auto-restocked inventory from approved stock order", {
            itemName,
            quantity,
            itemId: restocked.id,
          })
        }
        try {
          await routeToInngest({
            name: "house-of-veritas/kiosk.stock_order.approved",
            data: {
              requestId: requestId,
              itemName,
              quantity,
              employeeId: updatedRequest.employeeId,
              reviewedBy: context.userId,
            },
          })
        } catch (inngestError) {
          logger.error("Kiosk: Failed to route approved stock order to Inngest", {
            requestId,
            itemName,
            reviewedBy: context.userId,
            error: inngestError instanceof Error ? inngestError.message : String(inngestError),
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      request: sanitizeKioskDoc(updatedRequest),
      storage: mode,
    })
  } catch (error) {
    logger.error("PATCH kiosk request error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ success: false, error: "Failed to update request" }, { status: 500 })
  }
})

function getSuccessMessage(type: string): string {
  switch (type) {
    case "stock_order":
      return "Stock order request submitted. Management will review and process your order."
    case "salary_advance":
      return "Salary advance request submitted. This requires approval from management."
    case "issue_report":
      return "Issue report submitted. Maintenance will be scheduled accordingly."
    default:
      return "Request submitted successfully."
  }
}
