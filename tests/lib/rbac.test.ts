import { describe, it, expect } from "vitest"
import { NextResponse } from "next/server"
import {
  getAuthContext,
  isAdminOrOperator,
  withRole,
  withResponsibility,
  withAuth,
} from "@/lib/auth/rbac"

const ok = () => new NextResponse("ok")

function makeRequest(headers: Record<string, string> = {}): Request {
  const h = new Headers()
  for (const [k, v] of Object.entries(headers)) {
    h.set(k, v)
  }
  return new Request("http://localhost/api/test", { headers: h })
}

describe("RBAC", () => {
  describe("getAuthContext", () => {
    it("should extract auth context from headers", () => {
      const req = makeRequest({
        "x-user-id": "hans",
        "x-user-role": "admin",
        "x-user-email": "hans@houseofv.com",
      })
      const ctx = getAuthContext(req)
      expect(ctx).toMatchObject({
        userId: "hans",
        role: "admin",
        email: "hans@houseofv.com",
      })
      expect(Array.isArray(ctx?.responsibilities)).toBe(true)
    })

    it("should parse responsibilities from header", () => {
      const req = makeRequest({
        "x-user-id": "charl",
        "x-user-role": "operator",
        "x-user-email": "charl@houseofv.com",
        "x-user-responsibilities": '["Projects","Assets"]',
      })
      const ctx = getAuthContext(req)
      expect(ctx?.responsibilities).toEqual(["Projects", "Assets"])
    })

    it("should fallback to default responsibilities for invalid JSON", () => {
      const req = makeRequest({
        "x-user-id": "charl",
        "x-user-role": "operator",
        "x-user-email": "charl@houseofv.com",
        "x-user-responsibilities": "invalid-json",
      })
      const ctx = getAuthContext(req)
      expect(Array.isArray(ctx?.responsibilities)).toBe(true)
      expect(ctx?.responsibilities?.length).toBeGreaterThan(0)
    })

    it("should return null when headers are missing", () => {
      expect(getAuthContext(makeRequest())).toBeNull()
      expect(getAuthContext(makeRequest({ "x-user-id": "hans" }))).toBeNull()
    })
  })

  describe("isAdminOrOperator", () => {
    it("returns true for admin and operator", () => {
      expect(isAdminOrOperator("admin")).toBe(true)
      expect(isAdminOrOperator("operator")).toBe(true)
    })
    it("returns false for resident and employee", () => {
      expect(isAdminOrOperator("resident")).toBe(false)
      expect(isAdminOrOperator("employee")).toBe(false)
    })
  })

  describe("withRole", () => {
    it("returns 401 when no auth", async () => {
      const handler = withRole("admin")(async () => ok())
      const res = await handler(makeRequest())
      expect(res.status).toBe(401)
    })

    it("calls handler when role allowed", async () => {
      const handler = withRole("admin")(async () => ok())
      const res = await handler(
        makeRequest({
          "x-user-id": "hans",
          "x-user-role": "admin",
          "x-user-email": "hans@houseofv.com",
        })
      )
      expect(res.status).toBe(200)
      expect(await res.text()).toBe("ok")
    })

    it("returns 403 when role not allowed", async () => {
      const handler = withRole("admin")(async () => ok())
      const res = await handler(
        makeRequest({
          "x-user-id": "irma",
          "x-user-role": "resident",
          "x-user-email": "irma@houseofv.com",
        })
      )
      expect(res.status).toBe(403)
    })
  })

  describe("withResponsibility", () => {
    it("returns 401 when no auth", async () => {
      const handler = withResponsibility("Projects")(async () => ok())
      const res = await handler(makeRequest())
      expect(res.status).toBe(401)
    })

    it("allows admin without responsibility", async () => {
      const handler = withResponsibility("Expenses")(async () => ok())
      const res = await handler(
        makeRequest({
          "x-user-id": "hans",
          "x-user-role": "admin",
          "x-user-email": "hans@houseofv.com",
        })
      )
      expect(res.status).toBe(200)
    })

    it("returns 403 when responsibility missing", async () => {
      const handler = withResponsibility("Expenses")(async () => ok())
      const res = await handler(
        makeRequest({
          "x-user-id": "irma",
          "x-user-role": "resident",
          "x-user-email": "irma@houseofv.com",
          "x-user-responsibilities": '["Household","Documents"]',
        })
      )
      expect(res.status).toBe(403)
    })
  })

  describe("withAuth", () => {
    it("returns 401 when no auth", async () => {
      const handler = withAuth(async () => ok())
      const res = await handler(makeRequest())
      expect(res.status).toBe(401)
    })

    it("calls handler when authenticated", async () => {
      const handler = withAuth(async () => ok())
      const res = await handler(
        makeRequest({
          "x-user-id": "charl",
          "x-user-role": "operator",
          "x-user-email": "charl@houseofv.com",
        })
      )
      expect(res.status).toBe(200)
    })
  })
})
