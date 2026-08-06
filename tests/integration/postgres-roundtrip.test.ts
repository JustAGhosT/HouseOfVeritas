/**
 * Live PostgreSQL round-trip.
 *
 * Skips entirely unless DATABASE_URL is set, so it is inert in normal CI. Run
 * with a real DSN to exercise the paths that unit tests cannot reach: that the
 * DDL in lib/db/estate-schema actually accepts what the encoder produces, that
 * identity columns interact correctly with the insert path, and above all that
 * a DATE survives a write/read round-trip on a UTC+ host without shifting a day.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest"

const DSN = process.env.DATABASE_URL
const describeIfDb = DSN ? describe : describe.skip

describeIfDb("postgres round-trip", () => {
  let estate: typeof import("@/lib/repositories/estate-repository-postgres").postgresEstateRepository
  let query: typeof import("@/lib/db/postgres").query
  const created: number[] = []

  beforeAll(async () => {
    process.env.ESTATE_BACKEND = "postgres"
    ;({ postgresEstateRepository: estate } = await import(
      "@/lib/repositories/estate-repository-postgres"
    ))
    ;({ query } = await import("@/lib/db/postgres"))
    const { ensureEstateSchema } = await import("@/lib/db/estate-schema")
    await ensureEstateSchema()
  })

  afterAll(async () => {
    for (const id of created) {
      await query("DELETE FROM employees WHERE id = $1", [id]).catch(() => {})
    }
    await query("DELETE FROM time_clock_entries WHERE employee = $1", [-999]).catch(() => {})
  })

  it("creates the estate schema", async () => {
    const { rows } = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN
       ('employees','tasks','expenses','time_clock_entries','recurring_task_templates')`
    )
    expect(rows.map((r) => r.table_name).sort()).toEqual([
      "employees",
      "expenses",
      "recurring_task_templates",
      "tasks",
      "time_clock_entries",
    ])
  })

  it("round-trips an employee including a DATE without shifting a day", async () => {
    const startDate = "2026-07-18"
    const employee = await estate.employees.create({
      fullName: "Roundtrip Probe",
      role: "Test",
      email: "probe@example.invalid",
      phone: "",
      leaveBalance: 12.5,
      employmentStartDate: startDate,
    })

    expect(employee).not.toBeNull()
    created.push(employee!.id)

    // The bug this exists for: DATE '2026-07-18' previously read back as
    // "2026-07-17" on any UTC+ host.
    expect(employee!.employmentStartDate).toBe(startDate)

    const reread = await estate.employees.get(employee!.id)
    expect(reread!.employmentStartDate).toBe(startDate)

    // NUMERIC arrives from pg as a string; the decoder must yield a number.
    expect(reread!.leaveBalance).toBe(12.5)
    expect(typeof reread!.leaveBalance).toBe("number")
  })

  it("updates and re-reads without corrupting the date", async () => {
    const id = created[0]
    const updated = await estate.employees.update(id, { role: "Updated", leaveBalance: 3 })
    expect(updated!.role).toBe("Updated")
    expect(updated!.leaveBalance).toBe(3)
    expect(updated!.employmentStartDate).toBe("2026-07-18")
  })

  it("clocks in with the local calendar date and clocks out", async () => {
    const entry = await estate.timeClock.clockIn(-999)
    expect(entry).not.toBeNull()

    const now = new Date()
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`
    expect(entry!.date).toBe(localToday)
    expect(entry!.clockIn).toMatch(/^\d{2}:\d{2}$/)

    const out = await estate.timeClock.clockOut(entry!.id)
    expect(out!.clockOut).toMatch(/^\d{2}:\d{2}$/)
  })

  it("paginates with a stable count", async () => {
    const page = await estate.employees.listPaginated(1, 5)
    expect(Array.isArray(page.items)).toBe(true)
    expect(typeof page.count).toBe("number")
    expect(page.count).toBeGreaterThanOrEqual(1)
  })
})
