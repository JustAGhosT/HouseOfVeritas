/**
 * Coverage for the estate seam itself: the Baserow wire-shape translation and
 * backend selection. The concrete backends are covered in their own suites.
 */

import { afterEach, describe, expect, it } from "vitest"

import {
  estateRepositoryTestInternals,
  getEstateRepository,
} from "@/lib/repositories/estate-repository"
import type * as baserow from "@/lib/services/baserow"

const { toRecurringTemplate } = estateRepositoryTestInternals

/** A fully populated Baserow recurring-template row. */
function wireRow(
  overrides: Partial<baserow.RecurringTaskTemplate> = {}
): baserow.RecurringTaskTemplate {
  return {
    id: 11,
    Title: "Clean the pool filter",
    Description: "Backwash and rinse",
    "Assigned To": [{ id: 4 }],
    Recurrence: "Weekly",
    "Is Recurring": true,
    Priority: { value: "High" },
    Project: "Pool",
    ...overrides,
  }
}

describe("toRecurringTemplate", () => {
  it("flattens the nested Baserow wire shape into the domain type", () => {
    expect(toRecurringTemplate(wireRow())).toEqual({
      id: 11,
      title: "Clean the pool filter",
      description: "Backwash and rinse",
      assignedTo: 4,
      recurrence: "Weekly",
      isRecurring: true,
      priority: "High",
      project: "Pool",
    })
  })

  it("substitutes a placeholder title when the row has none", () => {
    expect(toRecurringTemplate(wireRow({ Title: undefined })).title).toBe("Task")
  })

  it("keeps an empty title as-is rather than substituting", () => {
    // `??` not `||`: an empty title is a value the source chose, not an absence.
    expect(toRecurringTemplate(wireRow({ Title: "" })).title).toBe("")
  })

  describe("assignee link field", () => {
    it("takes the first linked row id", () => {
      expect(
        toRecurringTemplate(wireRow({ "Assigned To": [{ id: 9 }, { id: 12 }] })).assignedTo
      ).toBe(9)
    })

    it("leaves the assignee undefined when the link array is empty", () => {
      expect(toRecurringTemplate(wireRow({ "Assigned To": [] })).assignedTo).toBeUndefined()
    })

    it("leaves the assignee undefined when the field is absent", () => {
      expect(toRecurringTemplate(wireRow({ "Assigned To": undefined })).assignedTo).toBeUndefined()
    })
  })

  describe("priority single-select field", () => {
    it("unwraps the select value", () => {
      expect(toRecurringTemplate(wireRow({ Priority: { value: "Urgent" } })).priority).toBe(
        "Urgent"
      )
    })

    it("defaults to Medium when the field is absent", () => {
      expect(toRecurringTemplate(wireRow({ Priority: undefined })).priority).toBe("Medium")
    })

    it("defaults to Medium when the select carries no value", () => {
      expect(toRecurringTemplate(wireRow({ Priority: {} })).priority).toBe("Medium")
    })

    it("documents current behaviour: unknown priorities are not validated", () => {
      // The cast to Task["priority"] is unchecked, so a renamed select option
      // reaches the domain as-is. See the report.
      expect(toRecurringTemplate(wireRow({ Priority: { value: "Whenever" } })).priority).toBe(
        "Whenever"
      )
    })
  })

  describe("recurring flag", () => {
    it("treats an explicit false as false", () => {
      expect(toRecurringTemplate(wireRow({ "Is Recurring": false })).isRecurring).toBe(false)
    })

    it("treats an absent flag as recurring", () => {
      // Only a literal `false` opts out; the upstream query already filters on
      // the flag, so an absent value means the row came from that filtered set.
      expect(toRecurringTemplate(wireRow({ "Is Recurring": undefined })).isRecurring).toBe(true)
    })

    it("treats an explicit true as true", () => {
      expect(toRecurringTemplate(wireRow({ "Is Recurring": true })).isRecurring).toBe(true)
    })
  })

  it("passes optional descriptive fields through untouched, including absences", () => {
    const template = toRecurringTemplate({ id: 3, "Is Recurring": false })
    expect(template).toEqual({
      id: 3,
      title: "Task",
      description: undefined,
      assignedTo: undefined,
      recurrence: undefined,
      isRecurring: false,
      priority: "Medium",
      project: undefined,
    })
  })
})

describe("getEstateRepository", () => {
  const originalBackend = process.env.ESTATE_BACKEND

  afterEach(() => {
    if (originalBackend === undefined) delete process.env.ESTATE_BACKEND
    else process.env.ESTATE_BACKEND = originalBackend
  })

  it("defaults to Baserow when no backend is selected", () => {
    delete process.env.ESTATE_BACKEND
    expect(getEstateRepository().backend).toBe("baserow")
  })

  it("ignores an unrecognised backend value", () => {
    process.env.ESTATE_BACKEND = "cosmos"
    expect(getEstateRepository().backend).toBe("baserow")
  })

  /**
   * The regression guard for the 2026-08-07 outage.
   *
   * Selecting Postgres used to reach the module through a lazy `require()`.
   * Turbopack cannot synchronously require an ES module — it hands back an empty
   * object — so the repository was `undefined` and the first property access
   * threw, on every route that touches estate data. This suite stayed green
   * because vitest resolves the module perfectly well.
   *
   * The import is now static, so the only way this test can fail is a genuine
   * regression in selection: reaching the Postgres branch at all is what proves
   * the module resolved.
   */
  it("falls back to Baserow when Postgres is selected but unconfigured", () => {
    process.env.ESTATE_BACKEND = "postgres"
    // No DATABASE_URL in the test environment, so the real Postgres repository
    // reports itself unconfigured. The documented promise is that selecting an
    // unconfigured backend degrades rather than failing.
    expect(getEstateRepository().backend).toBe("baserow")
  })
})
