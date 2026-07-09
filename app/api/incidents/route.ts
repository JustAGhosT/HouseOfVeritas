import { withRole } from "@/lib/auth/rbac"
import { logger } from "@/lib/logger"
import type { Incident } from "@/lib/services/baserow"
import {
  createIncident,
  getBaserowEmployeeIdByAppId,
  getEmployee,
  getIncidents,
  isIncidentsTableConfigured,
} from "@/lib/services/baserow"
import { routeToInngest } from "@/lib/workflows"
import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

const SEED_INCIDENTS: ReadonlyArray<Readonly<Incident & { reporterName?: string }>> = Object.freeze(
  [
    {
      id: 1,
      dateTime: "2025-01-18T14:30:00",
      type: "Safety",
      location: "Workshop",
      reporter: 2,
      severity: "Low" as const,
      status: "Resolved" as const,
      description: "Minor cut on hand while handling metal sheet",
      relatedIncidentIds: undefined,
      victimSupportPath: false,
    },
    {
      id: 2,
      dateTime: "2025-01-15T09:15:00",
      type: "Equipment",
      location: "Garden",
      reporter: 3,
      severity: "Medium" as const,
      status: "In Progress" as const,
      description: "Lawnmower blade damaged, requires replacement",
      relatedIncidentIds: undefined,
      victimSupportPath: false,
    },
    {
      id: 3,
      dateTime: "2025-01-10T16:45:00",
      type: "Vehicle",
      location: "Driveway",
      reporter: 1,
      severity: "Low" as const,
      status: "Resolved" as const,
      description: "Vehicle reverse sensor malfunction",
      relatedIncidentIds: undefined,
      victimSupportPath: false,
    },
    {
      id: 4,
      dateTime: "2025-01-20T11:00:00",
      type: "Household",
      location: "Kitchen",
      reporter: 4,
      severity: "Low" as const,
      status: "Reported" as const,
      description: "Refrigerator making unusual noise",
      relatedIncidentIds: undefined,
      victimSupportPath: false,
    },
  ].map((obj) => Object.freeze(obj))
)

// NOTE: This in-memory store is NON-PERSISTENT and not shared across serverless invocations.
// It is intended for local development and demo purposes only. In production, use Baserow.
// The GET/POST handlers will prefer Baserow when isIncidentsTableConfigured() returns true.
const inMemoryIncidents: Incident[] = []
const DEMO_DATA_ENABLED = process.env.ALLOW_DEMO_DATA === "true"

// Maximum number of in-memory incidents to prevent unbounded growth
const MAX_IN_MEMORY_INCIDENTS = 1000

// TTL for in-memory incidents (24 hours)
const IN_MEMORY_TTL_MS = 24 * 60 * 60 * 1000

// Track when in-memory store was created for TTL enforcement
let inMemoryStoreCreatedAt = Date.now()

function isDevMode(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_IN_MEMORY_INCIDENTS === "true"
}

type InMemoryCheckResult =
  | { allowed: true; error: undefined }
  | { allowed: false; error: NextResponse }

function checkInMemoryAllowed(): InMemoryCheckResult {
  if (!isDevMode()) {
    return {
      allowed: false,
      error: NextResponse.json(
        {
          error:
            "In-memory incident store is not allowed in production. Configure Baserow integration.",
        },
        { status: 503 }
      ),
    }
  }
  // Check TTL
  if (Date.now() - inMemoryStoreCreatedAt > IN_MEMORY_TTL_MS) {
    // Reset the store if TTL expired
    inMemoryIncidents.length = 0
    inMemoryStoreCreatedAt = Date.now()
  }
  // Check capacity
  if (inMemoryIncidents.length >= MAX_IN_MEMORY_INCIDENTS) {
    return {
      allowed: false,
      error: NextResponse.json(
        { error: "In-memory incident store capacity exceeded. Use Baserow for production." },
        { status: 503 }
      ),
    }
  }
  return { allowed: true, error: undefined }
}

function getIncidentsData(): Incident[] {
  return [...(DEMO_DATA_ENABLED ? SEED_INCIDENTS : []), ...inMemoryIncidents]
}

function formatIncidentForApi(incident: Incident & { reporterName?: string }) {
  const [datePart, timePart] = (incident.dateTime || "").split("T")
  const time = timePart ? timePart.slice(0, 5) : ""
  return {
    id: incident.id,
    date: datePart || "",
    time,
    type: incident.type,
    location: incident.location || "",
    reporter: incident.reporterName ?? String(incident.reporter ?? ""),
    severity: incident.severity,
    status: incident.status,
    description: incident.description,
    actions: null as string | null,
    witnesses: null as string | null,
    followUpRequired: ["High", "Critical"].includes(incident.severity),
    victimSupportPath: !!incident.victimSupportPath,
  }
}

async function loadIncidentsWithNames(incidents: Incident[]) {
  const result = []
  for (const i of incidents) {
    const reporterName = i.reporter ? (await getEmployee(i.reporter))?.fullName : undefined
    result.push(formatIncidentForApi({ ...i, reporterName }))
  }
  return result
}

export const GET = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async () => {
  try {
    const useBaserow = isIncidentsTableConfigured()

    let incidents: Awaited<ReturnType<typeof loadIncidentsWithNames>>
    if (useBaserow) {
      const baserowIncidents = await getIncidents()
      incidents = await loadIncidentsWithNames(baserowIncidents)
    } else {
      incidents = await loadIncidentsWithNames(getIncidentsData())
    }

    const summary = {
      total: incidents.length,
      resolved: incidents.filter((i) => i.status === "Resolved").length,
      inProgress: incidents.filter((i) => i.status === "In Progress").length,
      pending: incidents.filter((i) => i.status === "Pending" || i.status === "Reported").length,
      bySeverity: {
        High: incidents.filter((i) => i.severity === "High").length,
        Medium: incidents.filter((i) => i.severity === "Medium").length,
        Low: incidents.filter((i) => i.severity === "Low").length,
        Critical: incidents.filter((i) => i.severity === "Critical").length,
      },
      byType: {} as Record<string, number>,
    }
    for (const i of incidents) {
      summary.byType[i.type] = (summary.byType[i.type] || 0) + 1
    }

    return NextResponse.json({ incidents, summary })
  } catch (error) {
    logger.error("GET incidents error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch incidents" }, { status: 500 })
  }
})

export const POST = withRole(
  "admin",
  "operator",
  "employee",
  "resident"
)(async (request, context) => {
  // Parse JSON body with explicit error handling
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch (parseError) {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
  }

  // Use authenticated user from context instead of trusting client header
  if (!context?.userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  try {
    const { type, location, severity, description, reporter, victimSupportPath } = body as {
      type?: string
      location?: string
      severity?: string
      description?: string
      reporter?: string
      victimSupportPath?: boolean
    }
    const userId = context.userId

    if (!type || !location || !severity || !description) {
      return NextResponse.json(
        { error: "type, location, severity, and description are required" },
        { status: 400 }
      )
    }

    const validSeverity = ["Low", "Medium", "High", "Critical"]
    if (!validSeverity.includes(severity)) {
      return NextResponse.json(
        { error: `severity must be one of: ${validSeverity.join(", ")}` },
        { status: 400 }
      )
    }

    const severityValue = severity as Incident["severity"]
    const now = new Date()
    // Use full ISO string with timezone (UTC) to preserve timezone context
    const dateTime = now.toISOString()
    const reporterId = (await getBaserowEmployeeIdByAppId(reporter || userId)) ?? undefined

    const useBaserow = isIncidentsTableConfigured()

    let newIncident: {
      id: number | string
      severity: Incident["severity"]
      victimSupportPath: boolean
    }
    let apiIncident: ReturnType<typeof formatIncidentForApi>

    if (useBaserow) {
      const created = await createIncident({
        type,
        dateTime,
        location,
        reporter: reporterId,
        description,
        severity: severityValue,
        status: "Reported",
        victimSupportPath: !!victimSupportPath,
      })
      if (!created) {
        return NextResponse.json({ error: "Failed to create incident" }, { status: 500 })
      }
      newIncident = {
        id: created.id,
        severity: created.severity,
        victimSupportPath: !!created.victimSupportPath,
      }
      const reporterName = created.reporter
        ? (await getEmployee(created.reporter))?.fullName
        : undefined
      apiIncident = formatIncidentForApi({ ...created, reporterName })
    } else {
      // Check if in-memory mode is allowed before proceeding
      const { allowed, error } = checkInMemoryAllowed()
      if (!allowed) return error

      // Use UUID for collision-resistant IDs in in-memory mode
      const id = randomUUID()
      newIncident = {
        id,
        severity: severityValue,
        victimSupportPath: !!victimSupportPath,
      }
      // Create in-memory incident with string ID (dev mode only)

      const inMemory: any = {
        id,
        type,
        dateTime,
        location: location || "",
        reporter: reporterId,
        description,
        severity: severityValue,
        status: "Reported",
        victimSupportPath: !!victimSupportPath,
      }
      inMemoryIncidents.push(inMemory)
      apiIncident = formatIncidentForApi(inMemory)
    }

    // Emit event after persistence - wrap in try/catch to avoid 500 on event failure
    try {
      await routeToInngest({
        name: "house-of-veritas/incident.created",
        data: {
          id: String(newIncident.id),
          severity: newIncident.severity,
          victimSupportPath: newIncident.victimSupportPath,
        },
      })
    } catch (eventError) {
      logger.error("Failed to emit incident.created event", {
        incidentId: newIncident.id,
        error: eventError instanceof Error ? eventError.message : String(eventError),
      })
      // Do not rethrow - the incident was successfully created
    }

    return NextResponse.json({ incident: apiIncident })
  } catch (error) {
    logger.error("POST incident error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to create incident" }, { status: 500 })
  }
})
