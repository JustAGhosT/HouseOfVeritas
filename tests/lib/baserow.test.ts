import { describe, it, expect, beforeEach, vi } from "vitest"
import { isBaserowConfigured, getEmployees, getTasks, getExpenses } from "@/lib/services/baserow"

describe("baserow service", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  describe("isBaserowConfigured", () => {
    it("returns false when BASEROW_API_TOKEN and BASEROW_DATABASE_ID are unset", () => {
      delete process.env.BASEROW_API_TOKEN
      delete process.env.BASEROW_DATABASE_ID
      expect(isBaserowConfigured()).toBe(false)
    })

    it("returns false when only token is set", () => {
      process.env.BASEROW_API_TOKEN = "test-token"
      delete process.env.BASEROW_DATABASE_ID
      expect(isBaserowConfigured()).toBe(false)
    })

    it("returns true when token and database are set", () => {
      process.env.BASEROW_API_TOKEN = "test-token"
      process.env.BASEROW_DATABASE_ID = "db123"
      expect(isBaserowConfigured()).toBe(true)
    })
  })

  describe("getEmployees (empty fallback)", () => {
    it("returns empty employees when not configured and demo data is disabled", async () => {
      delete process.env.BASEROW_API_TOKEN
      const employees = await getEmployees()
      expect(Array.isArray(employees)).toBe(true)
      expect(employees).toHaveLength(0)
    })
  })

  describe("getTasks (empty fallback)", () => {
    it("returns empty tasks when not configured and demo data is disabled", async () => {
      delete process.env.BASEROW_API_TOKEN
      const tasks = await getTasks()
      expect(Array.isArray(tasks)).toBe(true)
      expect(tasks).toHaveLength(0)
    })

    it("returns empty assignedTo results when not configured and demo data is disabled", async () => {
      delete process.env.BASEROW_API_TOKEN
      const tasks = await getTasks({ assignedTo: 1 })
      expect(tasks).toEqual([])
    })
  })

  describe("getExpenses (empty fallback)", () => {
    it("returns empty expenses when not configured and demo data is disabled", async () => {
      delete process.env.BASEROW_API_TOKEN
      const expenses = await getExpenses()
      expect(Array.isArray(expenses)).toBe(true)
      expect(expenses).toHaveLength(0)
    })
  })
})
