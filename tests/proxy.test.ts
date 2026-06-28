import { describe, it, expect, beforeAll } from "vitest"
import { NextRequest } from "next/server"

describe("proxy", () => {
  let proxy: (request: NextRequest) => Promise<Response | undefined> | Response | undefined

  beforeAll(async () => {
    const mod = await import("@/proxy")
    proxy = mod.proxy as unknown as typeof proxy
  })

  it("exports proxy function", () => {
    expect(typeof proxy).toBe("function")
  })

  it("allows public path /api/health without auth", async () => {
    const request = new NextRequest("http://localhost/api/health", { method: "GET" })
    const response = await proxy(request)
    expect(response).toBeDefined()
    expect(response!.status).toBe(200)
  })

  it("returns 401 for /api/tasks without auth cookie", async () => {
    const request = new NextRequest("http://localhost/api/tasks", { method: "GET" })
    const response = await proxy(request)
    expect(response).toBeDefined()
    expect(response!.status).toBe(401)
  })
})
