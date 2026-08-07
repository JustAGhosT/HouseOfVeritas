import { NextResponse } from "next/server"
import { getEstateRepository } from "@/lib/repositories/estate-repository"
import { withDataSource } from "@/lib/api/response"
import { toISODateString } from "@/lib/utils"
import { logger } from "@/lib/logger"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const employeeParam = searchParams.get("employee")
  const personaId = searchParams.get("personaId")
  const date = searchParams.get("date")

  let employee: number | undefined
  if (employeeParam) {
    employee = parseInt(employeeParam, 10)
    if (Number.isNaN(employee)) employee = undefined
  } else if (personaId) {
    employee = (await getEstateRepository().employees.resolveIdByAppId(personaId)) ?? undefined
  }

  try {
    const entries = await getEstateRepository().timeClock.list({
      employee,
      date: date || undefined,
    })

    const today = toISODateString()
    const todayEntries = entries.filter((e) => e.date === today)

    const summary = {
      total: entries.length,
      todayClockedIn: todayEntries.filter((e) => e.clockIn && !e.clockOut).length,
      todayCompleted: todayEntries.filter((e) => e.clockIn && e.clockOut).length,
      totalHoursToday: todayEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0),
      pendingApproval: entries.filter((e) => e.approvalStatus === "Pending").length,
    }

    return withDataSource({ entries, summary })
  } catch (error) {
    logger.error("Error fetching time clock entries", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to fetch time clock entries" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, employeeId, entryId, personaId } = body

    if (action === "clockIn") {
      let entry
      if (personaId && typeof personaId === "string") {
        entry = await getEstateRepository().timeClock.clockInByAppId(personaId)
      } else if (employeeId != null) {
        const id = typeof employeeId === "number" ? employeeId : parseInt(String(employeeId), 10)
        if (Number.isNaN(id)) {
          // Treat non-numeric string employeeId as a persona/app ID
          entry = await getEstateRepository().timeClock.clockInByAppId(String(employeeId))
        } else {
          entry = await getEstateRepository().timeClock.clockIn(id)
        }
      } else {
        return NextResponse.json(
          { error: "Employee ID or personaId is required for clock in" },
          { status: 400 }
        )
      }

      return withDataSource({ entry, message: "Clocked in successfully" })
    } else if (action === "clockOut") {
      if (personaId && typeof personaId === "string") {
        const entry = await getEstateRepository().timeClock.clockOutByAppId(personaId)
        return withDataSource({ entry, message: "Clocked out successfully" })
      }
      if (!entryId) {
        return NextResponse.json(
          { error: "Entry ID or personaId is required for clock out" },
          { status: 400 }
        )
      }

      const entry = await getEstateRepository().timeClock.clockOut(
        typeof entryId === "number" ? entryId : parseInt(String(entryId), 10)
      )

      return withDataSource({ entry, message: "Clocked out successfully" })
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "clockIn" or "clockOut"' },
        { status: 400 }
      )
    }
  } catch (error) {
    logger.error("Error processing time clock action", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to process time clock action" }, { status: 500 })
  }
}
