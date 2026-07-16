import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { withRole } from "@/lib/auth/rbac"
import { routeToInngest } from "@/lib/workflows"

const DEMO_DATA_ENABLED = process.env.ALLOW_DEMO_DATA === "true"

// Scheduled maintenance items (synced with calendar)
interface ScheduledMaintenance {
  id: string
  assetId: string
  assetName: string
  type: "routine" | "urgent" | "preventive"
  description: string
  scheduledDate: string
  estimatedDuration: number // hours
  estimatedCost: number
  assignedTo: string
  calendarEventId?: string
  status: "scheduled" | "in_progress" | "completed" | "cancelled"
  createdAt: string
  aiGenerated: boolean
  actualCost?: number
  notes?: string
}

const DEMO_SCHEDULED_MAINTENANCE: ScheduledMaintenance[] = [
  {
    id: "maint_001",
    assetId: "asset_2",
    assetName: "Pool Pump System",
    type: "urgent",
    description: "Address filter pressure issue and inspect motor",
    scheduledDate: "2026-02-21T09:00:00Z",
    estimatedDuration: 2,
    estimatedCost: 850,
    assignedTo: "charl",
    calendarEventId: "evt_maint_001",
    status: "scheduled",
    createdAt: "2026-02-20T21:00:00Z",
    aiGenerated: true,
  },
  {
    id: "maint_002",
    assetId: "asset_1",
    assetName: "Husqvarna Ride-on Mower",
    type: "preventive",
    description: "Blade sharpening and belt inspection",
    scheduledDate: "2026-02-25T08:00:00Z",
    estimatedDuration: 3,
    estimatedCost: 450,
    assignedTo: "charl",
    calendarEventId: "evt_maint_002",
    status: "scheduled",
    createdAt: "2026-02-20T21:00:00Z",
    aiGenerated: true,
  },
  {
    id: "maint_003",
    assetId: "vehicle_1",
    assetName: "Toyota Hilux (CA 123-456)",
    type: "routine",
    description: "Full service - oil change, brake inspection, fluid top-up",
    scheduledDate: "2026-03-15T07:30:00Z",
    estimatedDuration: 4,
    estimatedCost: 4500,
    assignedTo: "charl",
    status: "scheduled",
    createdAt: "2026-02-20T21:00:00Z",
    aiGenerated: true,
  },
]

// In-memory store for scheduled maintenance
let scheduledMaintenance: ScheduledMaintenance[] = DEMO_DATA_ENABLED
  ? [...DEMO_SCHEDULED_MAINTENANCE]
  : []

// GET - List scheduled maintenance
export const GET = withRole(
  "admin",
  "operator"
)(async (request) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const assetId = searchParams.get("assetId")
  const assignedTo = searchParams.get("assignedTo")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  let items = [...scheduledMaintenance]

  if (status) {
    items = items.filter((m) => m.status === status)
  }
  if (assetId) {
    items = items.filter((m) => m.assetId === assetId)
  }
  if (assignedTo) {
    items = items.filter((m) => m.assignedTo === assignedTo)
  }
  if (startDate) {
    items = items.filter((m) => m.scheduledDate >= startDate)
  }
  if (endDate) {
    items = items.filter((m) => m.scheduledDate <= endDate)
  }

  // Sort by date
  items.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())

  const summary = {
    total: items.length,
    scheduled: items.filter((m) => m.status === "scheduled").length,
    inProgress: items.filter((m) => m.status === "in_progress").length,
    completed: items.filter((m) => m.status === "completed").length,
    urgent: items.filter((m) => m.type === "urgent").length,
    totalEstimatedCost: items.reduce((sum, m) => sum + m.estimatedCost, 0),
    aiGenerated: items.filter((m) => m.aiGenerated).length,
  }

  return NextResponse.json({
    items,
    summary,
    generatedAt: new Date().toISOString(),
  })
})

// POST - Create maintenance schedule or auto-schedule from AI predictions
export const POST = withRole(
  "admin",
  "operator"
)(async (request) => {
  try {
    const body = await request.json()
    const { action } = body

    // Auto-schedule from AI maintenance predictions
    if (action === "auto-schedule") {
      // Fetch AI predictions
      const predictionsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai/maintenance`
      )
      const predictionsData = await predictionsResponse.json()

      if (!predictionsData.predictions) {
        return NextResponse.json({ error: "Failed to fetch predictions" }, { status: 500 })
      }

      const newSchedules: ScheduledMaintenance[] = []
      const calendarEvents: Array<{
        summary: string
        description: string
        start: string
        end: string
        assignedTo: string
      }> = []

      for (const prediction of predictionsData.predictions) {
        // Skip if already scheduled
        const existing = scheduledMaintenance.find(
          (m) => m.assetId === prediction.assetId && m.status === "scheduled"
        )
        if (existing) continue

        // Create maintenance schedule
        const maintenanceId = `maint_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        const scheduledDate = new Date(prediction.dueDate)
        scheduledDate.setHours(9, 0, 0, 0) // Schedule at 9 AM

        const newMaintenance: ScheduledMaintenance = {
          id: maintenanceId,
          assetId: prediction.assetId,
          assetName: prediction.assetName,
          type:
            prediction.urgency === "high"
              ? "urgent"
              : prediction.urgency === "medium"
                ? "preventive"
                : "routine",
          description: prediction.recommendedAction,
          scheduledDate: scheduledDate.toISOString(),
          estimatedDuration: prediction.urgency === "high" ? 2 : 4,
          estimatedCost: prediction.estimatedCost,
          assignedTo: "charl", // Default to Charl for maintenance
          status: "scheduled",
          createdAt: new Date().toISOString(),
          aiGenerated: true,
        }

        scheduledMaintenance.push(newMaintenance)
        newSchedules.push(newMaintenance)

        // Create calendar event
        calendarEvents.push({
          summary: `🔧 ${newMaintenance.assetName} - ${newMaintenance.type} maintenance`,
          description: `${newMaintenance.description}\n\nEstimated cost: R${newMaintenance.estimatedCost}\nDuration: ${newMaintenance.estimatedDuration}h`,
          start: scheduledDate.toISOString(),
          end: new Date(
            scheduledDate.getTime() + newMaintenance.estimatedDuration * 60 * 60 * 1000
          ).toISOString(),
          assignedTo: newMaintenance.assignedTo,
        })
      }

      // Create calendar events
      for (const event of calendarEvents) {
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/calendar`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(event),
            }
          )
        } catch (e) {
          logger.error("Failed to create calendar event", {
            error: e instanceof Error ? e.message : String(e),
          })
        }
      }

      for (const m of newSchedules) {
        await routeToInngest({
          name: "house-of-veritas/maintenance.scheduled",
          data: {
            id: m.id,
            assigneeId: m.assignedTo,
            assigneeEmail: undefined,
            scheduledDate: m.scheduledDate,
          },
        })
      }

      return NextResponse.json({
        success: true,
        scheduledCount: newSchedules.length,
        calendarEventsCreated: calendarEvents.length,
        newSchedules,
        message: `Auto-scheduled ${newSchedules.length} maintenance items from AI predictions`,
      })
    }

    // Manual schedule creation
    const {
      assetId,
      assetName,
      type = "routine",
      description,
      scheduledDate,
      estimatedDuration = 2,
      estimatedCost = 0,
      assignedTo = "charl",
      createCalendarEvent = true,
    } = body

    if (!assetId || !assetName || !description || !scheduledDate) {
      return NextResponse.json(
        { error: "Missing required fields: assetId, assetName, description, scheduledDate" },
        { status: 400 }
      )
    }

    const maintenanceId = `maint_${Date.now()}`
    const newMaintenance: ScheduledMaintenance = {
      id: maintenanceId,
      assetId,
      assetName,
      type,
      description,
      scheduledDate,
      estimatedDuration,
      estimatedCost,
      assignedTo,
      status: "scheduled",
      createdAt: new Date().toISOString(),
      aiGenerated: false,
    }

    // Create calendar event if requested
    if (createCalendarEvent) {
      try {
        const calendarResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/calendar`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              summary: `🔧 ${assetName} - ${type} maintenance`,
              description: `${description}\n\nEstimated cost: R${estimatedCost}`,
              start: scheduledDate,
              end: new Date(
                new Date(scheduledDate).getTime() + estimatedDuration * 60 * 60 * 1000
              ).toISOString(),
            }),
          }
        )
        const calendarEvent = await calendarResponse.json()
        newMaintenance.calendarEventId = calendarEvent.event?.id
      } catch (e) {
        logger.error("Failed to create calendar event", {
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }

    scheduledMaintenance.push(newMaintenance)

    await routeToInngest({
      name: "house-of-veritas/maintenance.scheduled",
      data: {
        id: newMaintenance.id,
        assigneeId: newMaintenance.assignedTo,
        assigneeEmail: undefined,
        scheduledDate: newMaintenance.scheduledDate,
      },
    })

    return NextResponse.json({
      success: true,
      maintenance: newMaintenance,
      calendarEventCreated: !!newMaintenance.calendarEventId,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to schedule maintenance" }, { status: 500 })
  }
})

// PUT - Update maintenance status
export const PUT = withRole(
  "admin",
  "operator"
)(async (request) => {
  try {
    const body = await request.json()
    const { id, status, notes, actualCost } = body

    if (!id) {
      return NextResponse.json({ error: "Maintenance ID required" }, { status: 400 })
    }

    const index = scheduledMaintenance.findIndex((m) => m.id === id)
    if (index === -1) {
      return NextResponse.json({ error: "Maintenance not found" }, { status: 404 })
    }

    if (status) {
      scheduledMaintenance[index].status = status
    }
    if (actualCost !== undefined) {
      scheduledMaintenance[index].actualCost = actualCost
    }
    if (notes) {
      scheduledMaintenance[index].notes = notes
    }

    return NextResponse.json({
      success: true,
      maintenance: scheduledMaintenance[index],
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update maintenance" }, { status: 500 })
  }
})

// DELETE - Cancel scheduled maintenance
export const DELETE = withRole(
  "admin",
  "operator"
)(async (request) => {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Maintenance ID required" }, { status: 400 })
  }

  const index = scheduledMaintenance.findIndex((m) => m.id === id)
  if (index === -1) {
    return NextResponse.json({ error: "Maintenance not found" }, { status: 404 })
  }

  scheduledMaintenance[index].status = "cancelled"

  return NextResponse.json({
    success: true,
    message: "Maintenance cancelled",
    id,
  })
})
