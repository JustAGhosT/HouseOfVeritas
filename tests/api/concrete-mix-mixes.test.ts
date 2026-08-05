import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ConcreteMixRecord } from "@/lib/concrete-mix-records"

let records: ConcreteMixRecord[] = []

vi.mock("@/lib/repositories/concrete-mix-repository", () => ({
  listConcreteMixRecords: vi.fn(async () => [...records]),
  findConcreteMixRecordById: vi.fn(
    async (id: string) => records.find((record) => record.id === id) ?? null
  ),
  createConcreteMixRecord: vi.fn(async (record: ConcreteMixRecord) => {
    records.push(record)
    return record
  }),
  replaceConcreteMixRecord: vi.fn(async (record: ConcreteMixRecord) => {
    const index = records.findIndex((entry) => entry.id === record.id)
    if (index === -1) return null
    records[index] = record
    return record
  }),
  deleteConcreteMixRecord: vi.fn(async (id: string) => {
    const before = records.length
    records = records.filter((record) => record.id !== id)
    return records.length < before
  }),
}))

import { GET as LIST, POST as CREATE } from "@/app/api/concrete-mix/mixes/route"
import {
  GET as READ,
  PUT as UPDATE,
  DELETE as REMOVE,
} from "@/app/api/concrete-mix/mixes/[id]/route"
import {
  POST as ADD_SAMPLE,
  DELETE as REMOVE_SAMPLE,
} from "@/app/api/concrete-mix/mixes/[id]/samples/route"

const operatorHeaders = {
  "x-user-id": "lucky",
  "x-user-role": "operator",
  "x-user-email": "lucky@houseofv.com",
  "Content-Type": "application/json",
}

const employeeHeaders = {
  "x-user-id": "sam",
  "x-user-role": "employee",
  "x-user-email": "sam@houseofv.com",
  "Content-Type": "application/json",
}

const residentHeaders = {
  "x-user-id": "irma",
  "x-user-role": "resident",
  "x-user-email": "irma@houseofv.com",
  "Content-Type": "application/json",
}

const DRAFT = {
  name: "Our terracotta",
  mixDesignId: "garden-stone",
  castMethodId: "wet",
  pigmentDosagePercent: 6,
  cementType: "white",
}

function post(url: string, body: unknown, headers = operatorHeaders) {
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function seeded(overrides: Partial<ConcreteMixRecord> = {}): ConcreteMixRecord {
  return {
    id: "mix_1",
    name: "Our terracotta",
    mixDesignId: "garden-stone",
    castMethodId: "wet",
    pigmentDosagePercent: 6,
    colorIntensityId: null,
    cementType: "white",
    reinforcement: "none",
    admixtures: [],
    samples: [],
    createdBy: "lucky",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

beforeEach(() => {
  records = []
})

describe("saved mixes CRUD", () => {
  it("creates a mix and lists it back", async () => {
    const created = await CREATE(post("http://localhost/api/concrete-mix/mixes", DRAFT))
    expect(created.status).toBe(201)
    const createdPayload = await created.json()
    expect(createdPayload.data.name).toBe("Our terracotta")
    expect(createdPayload.data.createdBy).toBe("lucky")
    expect(createdPayload.data.samples).toEqual([])

    const listed = await LIST(
      new Request("http://localhost/api/concrete-mix/mixes", { headers: operatorHeaders })
    )
    const listPayload = await listed.json()
    expect(listPayload.summary.count).toBe(1)
    expect(listPayload.summary.withSamples).toBe(0)
  })

  it("refuses a second mix with the same name", async () => {
    await CREATE(post("http://localhost/api/concrete-mix/mixes", DRAFT))
    const duplicate = await CREATE(
      post("http://localhost/api/concrete-mix/mixes", { ...DRAFT, name: "our TERRACOTTA" })
    )

    expect(duplicate.status).toBe(409)
    expect(records).toHaveLength(1)
  })

  it("rejects a draft that does not pin down its mix", async () => {
    const res = await CREATE(
      post("http://localhost/api/concrete-mix/mixes", { name: "Vague", castMethodId: "wet" })
    )

    expect(res.status).toBe(400)
    expect(records).toEqual([])
  })

  it("reads one mix and 404s an unknown id", async () => {
    records = [seeded()]

    const found = await READ(
      new Request("http://localhost/api/concrete-mix/mixes/mix_1", { headers: operatorHeaders }),
      params("mix_1")
    )
    expect(found.status).toBe(200)
    expect((await found.json()).data.id).toBe("mix_1")

    const missing = await READ(
      new Request("http://localhost/api/concrete-mix/mixes/ghost", { headers: operatorHeaders }),
      params("ghost")
    )
    expect(missing.status).toBe(404)
  })

  it("updates the settings but never the samples or provenance", async () => {
    records = [
      seeded({
        samples: [
          {
            id: "sample_1",
            photoUrl: "/api/uploads/a",
            capturedBy: "lucky",
            capturedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      }),
    ]

    const res = await UPDATE(
      new Request("http://localhost/api/concrete-mix/mixes/mix_1", {
        method: "PUT",
        headers: operatorHeaders,
        body: JSON.stringify({
          ...DRAFT,
          pigmentDosagePercent: 9,
          samples: [],
          createdBy: "someone-else",
        }),
      }),
      params("mix_1")
    )

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.data.pigmentDosagePercent).toBe(9)
    expect(payload.data.samples).toHaveLength(1)
    expect(payload.data.createdBy).toBe("lucky")
    expect(payload.data.createdAt).toBe("2026-01-01T00:00:00.000Z")
    expect(payload.data.updatedAt).not.toBe("2026-01-01T00:00:00.000Z")
  })

  it("deletes a mix for an operator but not for an employee", async () => {
    records = [seeded()]

    const employee = await REMOVE(
      new Request("http://localhost/api/concrete-mix/mixes/mix_1", {
        method: "DELETE",
        headers: employeeHeaders,
      }),
      params("mix_1")
    )
    expect(employee.status).toBe(403)
    expect(records).toHaveLength(1)

    const operator = await REMOVE(
      new Request("http://localhost/api/concrete-mix/mixes/mix_1", {
        method: "DELETE",
        headers: operatorHeaders,
      }),
      params("mix_1")
    )
    expect(operator.status).toBe(200)
    expect(records).toEqual([])
  })

  it("keeps residents out entirely", async () => {
    const listed = await LIST(
      new Request("http://localhost/api/concrete-mix/mixes", { headers: residentHeaders })
    )
    expect(listed.status).toBe(403)

    const created = await CREATE(
      post("http://localhost/api/concrete-mix/mixes", DRAFT, residentHeaders)
    )
    expect(created.status).toBe(403)
    expect(records).toEqual([])
  })
})

describe("cast samples", () => {
  beforeEach(() => {
    records = [seeded()]
  })

  it("attaches a photographed sample with its shade and cure age", async () => {
    const res = await ADD_SAMPLE(
      post("http://localhost/api/concrete-mix/mixes/mix_1/samples", {
        photoUrl: "/api/uploads/stone-1",
        observedShade: "Deep rust",
        cureAgeDays: 28,
      }),
      params("mix_1")
    )

    expect(res.status).toBe(201)
    const payload = await res.json()
    expect(payload.data.sample.observedShade).toBe("Deep rust")
    expect(payload.data.sample.capturedBy).toBe("lucky")
    expect(payload.data.sampleCount).toBe(1)
    expect(records[0].samples).toHaveLength(1)
  })

  it("refuses a photo url the app would not serve", async () => {
    const res = await ADD_SAMPLE(
      post("http://localhost/api/concrete-mix/mixes/mix_1/samples", {
        photoUrl: "http://evil.example.com/x.jpg",
      }),
      params("mix_1")
    )

    expect(res.status).toBe(400)
    expect(records[0].samples).toEqual([])
  })

  it("404s a sample added to a mix that does not exist", async () => {
    const res = await ADD_SAMPLE(
      post("http://localhost/api/concrete-mix/mixes/ghost/samples", {
        photoUrl: "/api/uploads/a",
      }),
      params("ghost")
    )

    expect(res.status).toBe(404)
  })

  it("removes a sample by id", async () => {
    await ADD_SAMPLE(
      post("http://localhost/api/concrete-mix/mixes/mix_1/samples", {
        photoUrl: "/api/uploads/stone-1",
      }),
      params("mix_1")
    )
    const sampleId = records[0].samples[0].id

    const res = await REMOVE_SAMPLE(
      new Request(`http://localhost/api/concrete-mix/mixes/mix_1/samples?sampleId=${sampleId}`, {
        method: "DELETE",
        headers: operatorHeaders,
      }),
      params("mix_1")
    )

    expect(res.status).toBe(200)
    expect(records[0].samples).toEqual([])
  })

  it("404s removing a sample that is not on the mix", async () => {
    const res = await REMOVE_SAMPLE(
      new Request("http://localhost/api/concrete-mix/mixes/mix_1/samples?sampleId=nope", {
        method: "DELETE",
        headers: operatorHeaders,
      }),
      params("mix_1")
    )

    expect(res.status).toBe(404)
  })

  it("requires a sampleId to remove one", async () => {
    const res = await REMOVE_SAMPLE(
      new Request("http://localhost/api/concrete-mix/mixes/mix_1/samples", {
        method: "DELETE",
        headers: operatorHeaders,
      }),
      params("mix_1")
    )

    expect(res.status).toBe(400)
  })
})
