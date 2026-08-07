/**
 * Unit coverage for the PostgreSQL estate repository.
 *
 * The `pg` driver is never loaded: `@/lib/db/postgres` and the schema module are
 * mocked, so these tests exercise decoding, predicate building and SQL shaping
 * without a database. Assertions marked "documents current behaviour" pin down
 * semantics that diverge from the Baserow backend — they are characterisation
 * tests, not endorsements.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const postgres = vi.hoisted(() => ({
  isPostgresConfigured: vi.fn(() => true),
  query: vi.fn(),
  withClient: vi.fn(),
  getPool: vi.fn(),
  ensureSchema: vi.fn(),
  closePool: vi.fn(),
}))

vi.mock("@/lib/db/postgres", () => postgres)
vi.mock("@/lib/db/estate-schema", () => ({
  ensureEstateSchema: vi.fn(async () => undefined),
  resetEstateSchemaForTests: vi.fn(),
}))

import {
  estateRepositoryPostgresTestInternals,
  postgresEstateRepository,
} from "@/lib/repositories/estate-repository-postgres"

const { decodeRow, buildWhere, resolveEmployeeIdByAppId } = estateRepositoryPostgresTestInternals

// ---------------------------------------------------------------------------
// A synthetic table def, one field per FieldKind. Using a fixture rather than a
// real entity keeps the decoding assertions readable and independent of any
// single entity's field list.
// ---------------------------------------------------------------------------

interface SampleEntity {
  id: number
  label: string
  quantity: number
  amount: number
  active: boolean
  day: string
  moment: string
  refs: number[]
}

const sampleTable = {
  table: "samples",
  orderBy: "id ASC",
  fields: {
    label: { column: "label", kind: "text" },
    quantity: { column: "quantity", kind: "int" },
    amount: { column: "amount", kind: "num" },
    active: { column: "active", kind: "bool" },
    day: { column: "day", kind: "date" },
    moment: { column: "moment", kind: "ts" },
    refs: { column: "refs", kind: "intArray" },
  },
} as const

function decode(row: Record<string, unknown>): Partial<SampleEntity> & { id: number } {
  return decodeRow<SampleEntity>(sampleTable, row)
}

/** A pg row is always keyed by column name; `id` is present on every select. */
function row(overrides: Record<string, unknown>): Record<string, unknown> {
  return { id: 1, ...overrides }
}

describe("decodeRow — kind-driven decoding of pg values", () => {
  describe("numeric kinds", () => {
    it("parses a NUMERIC string into a number", () => {
      // pg returns NUMERIC as a string to preserve precision.
      expect(decode(row({ amount: "12.5" })).amount).toBe(12.5)
    })

    it("passes a native number through unchanged", () => {
      expect(decode(row({ amount: 12.5 })).amount).toBe(12.5)
    })

    it("keeps zero rather than dropping it as falsy", () => {
      const decoded = decode(row({ amount: "0" }))
      expect(decoded.amount).toBe(0)
      expect("amount" in decoded).toBe(true)
    })

    it("parses negative and exponent-notation numerics", () => {
      expect(decode(row({ amount: "-4.25" })).amount).toBe(-4.25)
      expect(decode(row({ amount: "1e3" })).amount).toBe(1000)
    })

    it("omits values that do not parse to a finite number", () => {
      expect("amount" in decode(row({ amount: "not-a-number" }))).toBe(false)
      expect("amount" in decode(row({ amount: "Infinity" }))).toBe(false)
      expect("amount" in decode(row({ amount: {} }))).toBe(false)
    })

    it("documents current behaviour: the int kind does not round", () => {
      // Every "int" field maps to an INTEGER column today, so pg never hands
      // back a fraction. The kind is nonetheless decoded identically to "num" —
      // unlike the radar mapper's int(), which applies Math.round.
      expect(decode(row({ quantity: "12.5" })).quantity).toBe(12.5)
    })
  })

  describe("date kind", () => {
    it("renders a Date as YYYY-MM-DD, not a full ISO timestamp", () => {
      const decoded = decode(row({ day: new Date(Date.UTC(2026, 6, 17, 12, 0, 0)) }))
      expect(decoded.day).toBe("2026-07-17")
    })

    it("truncates an ISO string to the date portion", () => {
      expect(decode(row({ day: "2026-07-17T22:30:00.000Z" })).day).toBe("2026-07-17")
      expect(decode(row({ day: "2026-07-17" })).day).toBe("2026-07-17")
    })

    it("takes the calendar day in LOCAL time, not UTC (regression: off-by-one)", () => {
      // pg parses a DATE column into local midnight (postgres-date:
      // "YYYY-MM-DD will be parsed as local time"). This instant is
      // 2026-07-18T00:00 in SAST (UTC+2) — what pg produces for DATE
      // '2026-07-18' on a UTC+2 host.
      //
      // Decoding it via toISOString() re-projected to UTC and yielded the
      // PREVIOUS day, silently shifting every date field (tasks, leave,
      // expenses, PPE, time clock) back one day on any UTC+ host. Now decoded
      // from local components, and lib/db/postgres pins the DATE type parser so
      // pg hands back the raw string in the first place.
      // Constructed as LOCAL midnight, which is exactly what pg produces for
      // DATE '2026-07-18' on any host. Deliberately not Date.UTC(...): that
      // pins a fixed instant whose local calendar day varies by offset, which
      // made an earlier version of this test pass in SAST and fail on UTC CI.
      const localMidnight = new Date(2026, 6, 18, 0, 0, 0)
      expect(decode(row({ day: localMidnight })).day).toBe("2026-07-18")
    })

    it("omits empty and non-date values", () => {
      expect("day" in decode(row({ day: "" }))).toBe(false)
      expect("day" in decode(row({ day: 20260717 }))).toBe(false)
    })
  })

  describe("ts kind", () => {
    it("renders a Date as a full ISO timestamp", () => {
      const decoded = decode(row({ moment: new Date(Date.UTC(2026, 6, 17, 8, 30, 15, 250)) }))
      expect(decoded.moment).toBe("2026-07-17T08:30:15.250Z")
    })

    it("passes a non-empty string through untouched", () => {
      expect(decode(row({ moment: "2026-07-17 08:30:15+02" })).moment).toBe(
        "2026-07-17 08:30:15+02"
      )
    })

    it("omits empty strings and non-timestamp values", () => {
      expect("moment" in decode(row({ moment: "" }))).toBe(false)
      expect("moment" in decode(row({ moment: 1782000000000 }))).toBe(false)
    })
  })

  describe("bool kind", () => {
    it("decodes native booleans", () => {
      expect(decode(row({ active: true })).active).toBe(true)
      expect(decode(row({ active: false })).active).toBe(false)
    })

    it("coerces numeric truthiness", () => {
      expect(decode(row({ active: 1 })).active).toBe(true)
      expect(decode(row({ active: 0 })).active).toBe(false)
    })

    it('documents current behaviour: the string "false" decodes to true', () => {
      // Harmless while every bool field maps to a BOOLEAN column (pg returns a
      // real boolean); it would bite if one were ever backed by TEXT.
      expect(decode(row({ active: "false" })).active).toBe(true)
    })
  })

  describe("intArray kind", () => {
    it("decodes an integer array", () => {
      expect(decode(row({ refs: [1, 2, 3] })).refs).toEqual([1, 2, 3])
    })

    it("coerces numeric strings inside the array", () => {
      expect(decode(row({ refs: ["4", "5"] })).refs).toEqual([4, 5])
    })

    it("drops non-numeric members rather than failing", () => {
      expect(decode(row({ refs: ["abc", {}, 6] })).refs).toEqual([6])
    })

    it("preserves an empty array as an empty array", () => {
      const decoded = decode(row({ refs: [] }))
      expect(decoded.refs).toEqual([])
      expect("refs" in decoded).toBe(true)
    })

    it("omits the key when the value is not an array", () => {
      expect("refs" in decode(row({ refs: "1,2,3" }))).toBe(false)
      expect("refs" in decode(row({ refs: 7 }))).toBe(false)
    })

    it("documents current behaviour: a NULL array member becomes 0", () => {
      // Postgres INTEGER[] may contain NULL; Number(null) is 0, which is finite
      // and therefore survives the filter. See the report.
      expect(decode(row({ refs: [1, null, 3] })).refs).toEqual([1, 0, 3])
    })
  })

  describe("text kind", () => {
    it("passes strings through, including the empty string", () => {
      expect(decode(row({ label: "Gate motor" })).label).toBe("Gate motor")
      const empty = decode(row({ label: "" }))
      expect(empty.label).toBe("")
      expect("label" in empty).toBe(true)
    })

    it("stringifies non-string values", () => {
      expect(decode(row({ label: 42 })).label).toBe("42")
      expect(decode(row({ label: true })).label).toBe("true")
    })
  })

  describe("null handling and identity", () => {
    it("omits null and undefined columns entirely instead of setting null", () => {
      const decoded = decode({
        id: 5,
        label: null,
        quantity: null,
        amount: undefined,
        active: null,
        day: null,
        moment: null,
        refs: null,
      })

      expect(decoded).toEqual({ id: 5 })
      expect(Object.keys(decoded)).toEqual(["id"])
      expect("label" in decoded).toBe(false)
      expect("active" in decoded).toBe(false)
    })

    it("returns only the id when the row has no mapped columns", () => {
      expect(decode({ id: 9 })).toEqual({ id: 9 })
    })

    it("ignores columns that are absent from the field map", () => {
      const decoded = decode(row({ label: "kept", legacy_column: "dropped" }))
      expect(decoded).toEqual({ id: 1, label: "kept" })
      expect("legacy_column" in decoded).toBe(false)
    })

    it("coerces the id via Number()", () => {
      expect(decode({ id: "42" }).id).toBe(42)
      expect(decode({ id: 42 }).id).toBe(42)
    })

    it("documents current behaviour: a missing id decodes to NaN", () => {
      // Unreachable through SELECT *, but the decoder does not guard it.
      expect(Number.isNaN(decode({}).id)).toBe(true)
    })
  })
})

describe("buildWhere", () => {
  it("returns an empty clause for no conditions", () => {
    expect(buildWhere([])).toEqual({ sql: "", values: [] })
  })

  it("returns an empty clause when every value is undefined", () => {
    expect(
      buildWhere([
        ["assigned_to", undefined],
        ["status", undefined],
      ])
    ).toEqual({ sql: "", values: [] })
  })

  it("builds a single-condition clause with a leading space", () => {
    const where = buildWhere([["status", "Open"]])
    expect(where.sql).toBe(" WHERE status = $1")
    expect(where.values).toEqual(["Open"])
    // The leading space matters: callers concatenate `${table}${where.sql}`.
    expect(where.sql.startsWith(" WHERE ")).toBe(true)
  })

  it("joins multiple conditions with AND and numbers placeholders sequentially", () => {
    const where = buildWhere([
      ["assigned_to", 3],
      ["status", "In Progress"],
    ])
    expect(where.sql).toBe(" WHERE assigned_to = $1 AND status = $2")
    expect(where.values).toEqual([3, "In Progress"])
  })

  it("renumbers placeholders after dropping undefined conditions", () => {
    const where = buildWhere([
      ["a", undefined],
      ["b", 1],
      ["c", undefined],
      ["d", 2],
    ])
    // Numbering must follow the surviving conditions, not the input index.
    expect(where.sql).toBe(" WHERE b = $1 AND d = $2")
    expect(where.values).toEqual([1, 2])
  })

  it("passes boolean false through as a real condition", () => {
    // Regression guard: a naive truthiness filter would drop `false` and
    // silently widen the query to every row.
    const where = buildWhere([["is_recurring", false]])
    expect(where.sql).toBe(" WHERE is_recurring = $1")
    expect(where.values).toEqual([false])
  })

  it("passes boolean true through", () => {
    expect(buildWhere([["is_recurring", true]])).toEqual({
      sql: " WHERE is_recurring = $1",
      values: [true],
    })
  })

  it("drops null instead of emitting an equality predicate", () => {
    // `column = NULL` is never true in SQL, so buildWhere cannot express an
    // IS NULL predicate — which is why findOpenTimeClockEntry hand-writes
    // `clock_out IS NULL`. Using buildWhere there would drop the condition and
    // match every row.
    expect(buildWhere([["clock_out", null]])).toEqual({ sql: "", values: [] })
    expect(
      buildWhere([
        ["employee", 4],
        ["clock_out", null],
      ])
    ).toEqual({ sql: " WHERE employee = $1", values: [4] })
  })

  it("passes zero through as a real condition", () => {
    expect(buildWhere([["distance", 0]])).toEqual({
      sql: " WHERE distance = $1",
      values: [0],
    })
  })

  it("documents current behaviour: the empty string becomes an equality filter", () => {
    // Baserow's filter handling treats "" as "no filter"; here it narrows to
    // rows whose column is literally empty. See the report.
    expect(buildWhere([["status", ""]])).toEqual({
      sql: " WHERE status = $1",
      values: [""],
    })
  })
})

describe("resolveEmployeeIdByAppId", () => {
  beforeEach(() => {
    postgres.query.mockReset()
    postgres.isPostgresConfigured.mockReturnValue(true)
  })

  function mockEmployees(rows: Array<Record<string, unknown>>) {
    postgres.query.mockResolvedValue({ rows, rowCount: rows.length })
  }

  it("maps a persona id to the matching employee by name prefix", async () => {
    mockEmployees([
      { id: 1, full_name: "Charl van Wyk" },
      { id: 2, full_name: "Hans Steyn" },
    ])
    await expect(resolveEmployeeIdByAppId("hans")).resolves.toBe(2)
  })

  it("is case-insensitive on the persona id", async () => {
    mockEmployees([{ id: 7, full_name: "Lucky Ndlovu" }])
    await expect(resolveEmployeeIdByAppId("LUCKY")).resolves.toBe(7)
  })

  it("is case-insensitive on the stored name", async () => {
    mockEmployees([{ id: 8, full_name: "irma smit" }])
    await expect(resolveEmployeeIdByAppId("irma")).resolves.toBe(8)
  })

  it("falls back to the raw app id for personas outside the known map", async () => {
    mockEmployees([{ id: 3, full_name: "Nomsa Dlamini" }])
    await expect(resolveEmployeeIdByAppId("nomsa")).resolves.toBe(3)
  })

  it("matches on a substring when the name does not start with the persona", async () => {
    mockEmployees([{ id: 4, full_name: "Mr Hans Steyn" }])
    await expect(resolveEmployeeIdByAppId("hans")).resolves.toBe(4)
  })

  it("returns null when no employee matches", async () => {
    mockEmployees([{ id: 1, full_name: "Charl van Wyk" }])
    await expect(resolveEmployeeIdByAppId("hans")).resolves.toBeNull()
  })

  it("returns null for an empty employee table", async () => {
    mockEmployees([])
    await expect(resolveEmployeeIdByAppId("hans")).resolves.toBeNull()
  })

  it("tolerates rows with no full_name", async () => {
    // decodeRow omits null columns, so fullName can be absent at runtime even
    // though the domain type declares it required.
    mockEmployees([{ id: 1, full_name: null }, { id: 2 }])
    await expect(resolveEmployeeIdByAppId("hans")).resolves.toBeNull()
  })

  it("returns null without querying when Postgres is unconfigured", async () => {
    postgres.isPostgresConfigured.mockReturnValue(false)
    await expect(resolveEmployeeIdByAppId("hans")).resolves.toBeNull()
    expect(postgres.query).not.toHaveBeenCalled()
  })
})

describe("repository SQL shaping", () => {
  beforeEach(() => {
    postgres.query.mockReset()
    postgres.isPostgresConfigured.mockReturnValue(true)
  })

  it("decodes a task row through the real tasks field map", async () => {
    postgres.query.mockResolvedValue({
      rows: [
        {
          id: "7",
          title: "Service the gate motor",
          description: null,
          assigned_to: 3,
          assigned_to_name: "Charl van Wyk",
          due_date: new Date(Date.UTC(2026, 7, 20, 12, 0, 0)),
          priority: "High",
          status: "In Progress",
          time_spent: "2.50",
          created_date: new Date(Date.UTC(2026, 7, 7, 6, 15, 0)),
          completed_date: null,
          depends_on: [4, 5],
        },
      ],
      rowCount: 1,
    })

    const [task] = await postgresEstateRepository.tasks.list()

    expect(task).toEqual({
      id: 7,
      title: "Service the gate motor",
      assignedTo: 3,
      assignedToName: "Charl van Wyk",
      dueDate: "2026-08-20",
      priority: "High",
      status: "In Progress",
      timeSpent: 2.5,
      createdDate: "2026-08-07T06:15:00.000Z",
      dependsOn: [4, 5],
    })
    expect("description" in task).toBe(false)
    expect("completedDate" in task).toBe(false)
  })

  it("applies task filters as a parameterised WHERE clause with stable ordering", async () => {
    postgres.query.mockResolvedValue({ rows: [], rowCount: 0 })

    await postgresEstateRepository.tasks.list({ assignedTo: 3, status: "Not Started" })

    expect(postgres.query).toHaveBeenCalledWith(
      "SELECT * FROM tasks WHERE assigned_to = $1 AND status = $2 ORDER BY created_date DESC, id DESC",
      [3, "Not Started"]
    )
  })

  it("omits the WHERE clause entirely when no filters are supplied", async () => {
    postgres.query.mockResolvedValue({ rows: [], rowCount: 0 })

    await postgresEstateRepository.tasks.list()

    expect(postgres.query).toHaveBeenCalledWith(
      "SELECT * FROM tasks ORDER BY created_date DESC, id DESC",
      []
    )
  })

  it("selects recurring templates with a boolean predicate", async () => {
    postgres.query.mockResolvedValue({ rows: [], rowCount: 0 })

    await postgresEstateRepository.tasks.listRecurringTemplates()

    expect(postgres.query).toHaveBeenCalledWith(
      "SELECT * FROM recurring_task_templates WHERE is_recurring = $1 ORDER BY id ASC",
      [true]
    )
  })

  it("numbers LIMIT/OFFSET after the filter placeholders and returns the count", async () => {
    postgres.query.mockImplementation(async (text: string) => {
      if (text.includes("COUNT(*)")) return { rows: [{ count: "12" }], rowCount: 1 }
      return { rows: [{ id: 1, title: "T", priority: "Low", status: "Not Started" }], rowCount: 1 }
    })

    const result = await postgresEstateRepository.tasks.listPaginated(2, 5, { status: "Completed" })

    expect(postgres.query).toHaveBeenCalledWith(
      "SELECT COUNT(*)::text AS count FROM tasks WHERE status = $1",
      ["Completed"]
    )
    expect(postgres.query).toHaveBeenCalledWith(expect.stringContaining("LIMIT $2 OFFSET $3"), [
      "Completed",
      5,
      5,
    ])
    expect(result.count).toBe(12)
    expect(result.items).toHaveLength(1)
  })

  it("clamps a non-positive page number to offset zero", async () => {
    postgres.query.mockImplementation(async (text: string) => {
      if (text.includes("COUNT(*)")) return { rows: [{ count: "0" }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })

    await postgresEstateRepository.tasks.listPaginated(0, 25)

    expect(postgres.query).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT $1 OFFSET $2"),
      [25, 0]
    )
  })

  it("treats a missing count row as zero", async () => {
    postgres.query.mockImplementation(async (text: string) => {
      if (text.includes("COUNT(*)")) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    })

    await expect(postgresEstateRepository.employees.listPaginated()).resolves.toEqual({
      items: [],
      count: 0,
    })
  })

  it("finds the open time-clock entry with IS NULL, not an equality predicate", async () => {
    const queries: string[] = []
    postgres.query.mockImplementation(async (text: string) => {
      queries.push(text)
      if (text.includes("FROM employees")) {
        return { rows: [{ id: 2, full_name: "Charl van Wyk" }], rowCount: 1 }
      }
      if (text.startsWith("UPDATE")) {
        return {
          rows: [{ id: 9, employee: 2, date: "2026-08-07", clock_out: "17:05" }],
          rowCount: 1,
        }
      }
      return { rows: [{ id: 9, employee: 2, date: "2026-08-07", clock_in: "07:00" }], rowCount: 1 }
    })

    const entry = await postgresEstateRepository.timeClock.clockOutByAppId("charl")

    const openEntryQuery = queries.find((text) => text.includes("FROM time_clock_entries"))
    expect(openEntryQuery).toContain("clock_out IS NULL")
    expect(openEntryQuery).not.toContain("clock_out = $")
    expect(entry?.clockOut).toBe("17:05")
  })

  it("does not clock out when the persona has no open entry", async () => {
    postgres.query.mockImplementation(async (text: string) => {
      if (text.includes("FROM employees")) {
        return { rows: [{ id: 2, full_name: "Charl van Wyk" }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    await expect(postgresEstateRepository.timeClock.clockOutByAppId("charl")).resolves.toBeNull()
    expect(postgres.query).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE"),
      expect.anything()
    )
  })

  it("does not clock in when the persona cannot be resolved to an employee", async () => {
    postgres.query.mockResolvedValue({ rows: [], rowCount: 0 })

    await expect(postgresEstateRepository.timeClock.clockInByAppId("ghost")).resolves.toBeNull()
    expect(postgres.query).toHaveBeenCalledTimes(1)
  })

  it("writes a pending entry with an HH:MM clock-in time", async () => {
    postgres.query.mockResolvedValue({ rows: [{ id: 3, employee: 2 }], rowCount: 1 })

    await postgresEstateRepository.timeClock.clockIn(2)

    const [sql, values] = postgres.query.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain("INSERT INTO time_clock_entries")
    expect(sql).toContain("RETURNING *")
    expect(values[0]).toBe(2)
    expect(values[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(values[2]).toMatch(/^\d{2}:\d{2}$/)
    expect(values[3]).toBe("Pending")
  })

  it("skips columns the caller did not supply on update", async () => {
    postgres.query.mockResolvedValue({ rows: [{ id: 4, status: "Approved" }], rowCount: 1 })

    await postgresEstateRepository.leaveRequests.update(4, { status: "Approved" })

    expect(postgres.query).toHaveBeenCalledWith(
      "UPDATE leave_requests SET status = $1 WHERE id = $2 RETURNING *",
      ["Approved", 4]
    )
  })

  it("falls back to a plain read when an update carries no mapped columns", async () => {
    postgres.query.mockResolvedValue({ rows: [{ id: 4 }], rowCount: 1 })

    await postgresEstateRepository.leaveRequests.update(4, {})

    expect(postgres.query).toHaveBeenCalledWith("SELECT * FROM leave_requests WHERE id = $1", [4])
  })

  describe("when Postgres is unconfigured", () => {
    beforeEach(() => {
      postgres.isPostgresConfigured.mockReturnValue(false)
    })

    it("reports itself as unconfigured", () => {
      expect(postgresEstateRepository.isConfigured()).toBe(false)
      expect(postgresEstateRepository.tasks.isConfigured()).toBe(false)
      expect(postgresEstateRepository.employees.isConfigured()).toBe(false)
    })

    it("returns empty reads and null writes without touching the database", async () => {
      await expect(postgresEstateRepository.tasks.list()).resolves.toEqual([])
      await expect(postgresEstateRepository.tasks.get(1)).resolves.toBeNull()
      await expect(postgresEstateRepository.tasks.listPaginated()).resolves.toEqual({
        items: [],
        count: 0,
      })
      await expect(
        postgresEstateRepository.incidents.create({
          type: "Near miss",
          dateTime: "2026-08-07T06:00:00.000Z",
          description: "Ladder slipped",
          severity: "Low",
          status: "Open",
        })
      ).resolves.toBeNull()
      await expect(postgresEstateRepository.timeClock.update(1, {})).resolves.toBeNull()
      expect(postgres.query).not.toHaveBeenCalled()
    })
  })
})
