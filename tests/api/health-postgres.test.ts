import { beforeEach, describe, expect, it, vi } from "vitest"

const healthMocks = vi.hoisted(() => ({
  query: vi.fn(),
}))

vi.mock("@/lib/repositories/estate-repository", () => ({
  getEstateRepository: () => ({ backend: "postgres", isConfigured: () => true }),
}))

vi.mock("@/lib/db/postgres", () => ({
  query: healthMocks.query,
}))

vi.mock("@/lib/services/docuseal", () => ({
  isDocuSealConfigured: () => false,
}))

import { GET } from "@/app/api/health/route"

describe("GET /api/health PostgreSQL positive control", () => {
  beforeEach(() => {
    healthMocks.query.mockReset()
  })

  it("reports PostgreSQL up only after a real SQL query succeeds", async () => {
    healthMocks.query.mockResolvedValue({ rows: [{ health: 1 }], rowCount: 1 })

    const data = await (await GET()).json()
    const postgres = data.services.find((service: { name: string }) => service.name === "postgres")

    expect(healthMocks.query).toHaveBeenCalledWith("SELECT 1 AS health")
    expect(postgres.status).toBe("up")
  })

  it("reports PostgreSQL down when the SQL positive control fails", async () => {
    healthMocks.query.mockRejectedValue(new Error("unreachable"))

    const data = await (await GET()).json()
    const postgres = data.services.find((service: { name: string }) => service.name === "postgres")

    expect(postgres.status).toBe("down")
    expect(data.status).toBe("degraded")
  })
})
