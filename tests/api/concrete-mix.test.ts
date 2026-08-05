import { describe, it, expect } from "vitest"
import { GET, POST } from "@/app/api/concrete-mix/route"

const adminHeaders = {
  "x-user-id": "hans",
  "x-user-role": "admin",
  "x-user-email": "smit.jurie@gmail.com",
}

const operatorHeaders = {
  "x-user-id": "lucky",
  "x-user-role": "operator",
  "x-user-email": "lucky@houseofv.com",
}

const residentHeaders = {
  "x-user-id": "irma",
  "x-user-role": "resident",
  "x-user-email": "irma@houseofv.com",
}

function postRequest(body: unknown, headers: Record<string, string> = operatorHeaders) {
  return new Request("http://localhost/api/concrete-mix", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("GET /api/concrete-mix", () => {
  it("returns the presets, mix designs and intensities for an operator", async () => {
    const res = await GET(
      new Request("http://localhost/api/concrete-mix", { headers: operatorHeaders })
    )

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.data.slabPresets.length).toBeGreaterThan(0)
    expect(payload.data.mixDesigns.length).toBeGreaterThan(0)
    expect(payload.data.colorIntensities.length).toBe(4)
    expect(payload.data.defaults.wastePercent).toBe(10)
  })

  it("returns 401 without auth", async () => {
    const res = await GET(new Request("http://localhost/api/concrete-mix"))
    expect(res.status).toBe(401)
  })

  it("returns 403 for a resident", async () => {
    const res = await GET(
      new Request("http://localhost/api/concrete-mix", { headers: residentHeaders })
    )
    expect(res.status).toBe(403)
  })
})

describe("POST /api/concrete-mix", () => {
  it("calculates a batch from a preset", async () => {
    const res = await POST(postRequest({ presetId: "square-400", slabCount: 20 }))

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.summary.slabCount).toBe(20)
    expect(payload.summary.pigmentGramsPerSlab).toBe(144)
    expect(payload.summary.cementBags).toBeGreaterThan(0)
    expect(payload.summary.estimatedCostCents).toBeNull()
    expect(payload.data.materials.map((line: { material: string }) => line.material)).toEqual([
      "cement",
      "sand",
      "water",
      "pigment",
    ])
  })

  it("accepts admin as well as operator", async () => {
    const res = await POST(postRequest({ presetId: "brick-paver", slabCount: 100 }, adminHeaders))
    expect(res.status).toBe(200)
  })

  it("returns the cost total when unit prices are supplied", async () => {
    const res = await POST(
      postRequest({
        presetId: "square-400",
        slabCount: 50,
        wastePercent: 0,
        costs: { cementPerBagCents: 12000, pigmentPerKgCents: 8995 },
      })
    )

    const payload = await res.json()
    expect(payload.summary.estimatedCostCents).toBe(107960)
  })

  it("surfaces warnings in the summary count", async () => {
    const res = await POST(
      postRequest({
        dimensions: { lengthMm: 400, widthMm: 400, thicknessMm: 20 },
        slabCount: 5,
      })
    )

    const payload = await res.json()
    expect(payload.summary.warningCount).toBeGreaterThan(0)
    expect(payload.data.warnings.length).toBe(payload.summary.warningCount)
  })

  it("returns 400 with the validation reason for a bad slab count", async () => {
    const res = await POST(postRequest({ presetId: "square-400", slabCount: 0 }))

    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error).toContain("slabCount")
  })

  it("returns 400 when neither preset nor dimensions are given", async () => {
    const res = await POST(postRequest({ slabCount: 5 }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for a body that is not JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/concrete-mix", {
        method: "POST",
        headers: { ...operatorHeaders, "Content-Type": "application/json" },
        body: "not json",
      })
    )

    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.error).toContain("JSON")
  })

  it("returns 401 without auth", async () => {
    const res = await POST(
      new Request("http://localhost/api/concrete-mix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: "square-400", slabCount: 1 }),
      })
    )

    expect(res.status).toBe(401)
  })
})
