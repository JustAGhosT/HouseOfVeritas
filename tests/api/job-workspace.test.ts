import { beforeEach, describe, expect, it, vi } from "vitest"

const authHeaders = {
  "x-user-id": "hans",
  "x-user-role": "admin",
  "x-user-email": "smit.jurie@gmail.com",
  "Content-Type": "application/json",
}

const routeContext = { params: Promise.resolve({ id: "job-1" }) }

type FileStore = Map<string, string>

async function importWithMockedFiles<T>(modulePath: string, files: FileStore = new Map()): Promise<T> {
  vi.resetModules()
  vi.doMock("fs/promises", () => {
    const mockFs = {
      readFile: vi.fn(async (path: string) => {
        const key = [...files.keys()].find((fileName) => String(path).endsWith(fileName))
        if (!key) throw new Error("ENOENT")
        return files.get(key)
      }),
      mkdir: vi.fn(async () => undefined),
      writeFile: vi.fn(async (path: string, data: string) => {
        files.set(String(path), data)
      }),
    }
    return { ...mockFs, default: mockFs }
  })

  return import(modulePath) as Promise<T>
}

describe("job areas API", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("filters areas to the requested job", async () => {
    const files = new Map<string, string>([
      [
        "job-areas.json",
        JSON.stringify([
          { id: "area-1", projectId: "job-1", name: "Bathroom", kind: "room", createdAt: "now", updatedAt: "now" },
          { id: "area-2", projectId: "job-2", name: "Workshop", kind: "zone", createdAt: "now", updatedAt: "now" },
        ]),
      ],
    ])
    const { GET } = await importWithMockedFiles<typeof import("@/app/api/projects/[id]/areas/route")>(
      "@/app/api/projects/[id]/areas/route",
      files
    )

    const response = await GET(new Request("http://localhost/api/projects/job-1/areas"), routeContext)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.areas).toHaveLength(1)
    expect(data.areas[0]).toMatchObject({ id: "area-1", name: "Bathroom" })
  })

  it("creates a normalized area for the requested job", async () => {
    const files = new Map<string, string>()
    const { POST } = await importWithMockedFiles<typeof import("@/app/api/projects/[id]/areas/route")>(
      "@/app/api/projects/[id]/areas/route",
      files
    )

    const response = await POST(
      new Request("http://localhost/api/projects/job-1/areas", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ name: "  Fishpond  ", kind: "not-a-kind", notes: "  Pump repair  " }),
      }),
      routeContext
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.area).toMatchObject({ projectId: "job-1", name: "Fishpond", kind: "area", notes: "Pump repair" })
  })
})

describe("job allocations API", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("filters allocations by job and optional type", async () => {
    const files = new Map<string, string>([
      [
        "job-allocations.json",
        JSON.stringify([
          { id: "alloc-1", projectId: "job-1", type: "material", name: "Tiles", createdAt: "now", updatedAt: "now" },
          { id: "alloc-2", projectId: "job-1", type: "labour", name: "Plumber", createdAt: "now", updatedAt: "now" },
          { id: "alloc-3", projectId: "job-2", type: "material", name: "Paint", createdAt: "now", updatedAt: "now" },
        ]),
      ],
    ])
    const { GET } = await importWithMockedFiles<typeof import("@/app/api/projects/[id]/allocations/route")>(
      "@/app/api/projects/[id]/allocations/route",
      files
    )

    const response = await GET(
      new Request("http://localhost/api/projects/job-1/allocations?type=material"),
      routeContext
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.allocations).toEqual([expect.objectContaining({ id: "alloc-1", name: "Tiles" })])
  })

  it("keeps material and labour fields separate", async () => {
    const files = new Map<string, string>()
    const { POST } = await importWithMockedFiles<typeof import("@/app/api/projects/[id]/allocations/route")>(
      "@/app/api/projects/[id]/allocations/route",
      files
    )

    const response = await POST(
      new Request("http://localhost/api/projects/job-1/allocations", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ name: "Electrician", type: "labour", hours: "3.5", rateCents: "45000", quantity: "99" }),
      }),
      routeContext
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.allocation).toMatchObject({ projectId: "job-1", type: "labour", name: "Electrician", hours: 3.5, rateCents: 45000 })
    expect(data.allocation.quantity).toBeUndefined()
  })
})

describe("job task groups API", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("requires the project name when loading grouped tasks", async () => {
    const { GET } = await importWithMockedFiles<typeof import("@/app/api/projects/[id]/task-groups/route")>(
      "@/app/api/projects/[id]/task-groups/route"
    )

    const response = await GET(new Request("http://localhost/api/projects/job-1/task-groups"), routeContext)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe("projectName is required")
  })

  it("attaches area and group metadata to existing project tasks", async () => {
    const files = new Map<string, string>([
      [
        "job-task-groups.json",
        JSON.stringify([{ taskId: 101, projectId: "job-1", areaId: "area-1", groupName: "Prep", createdAt: "now", updatedAt: "now" }]),
      ],
    ])
    vi.resetModules()
    vi.doMock("fs/promises", () => {
      const mockFs = {
        readFile: vi.fn(async (path: string) => {
          const key = [...files.keys()].find((fileName) => String(path).endsWith(fileName))
          return key ? files.get(key) : "[]"
        }),
        mkdir: vi.fn(async () => undefined),
        writeFile: vi.fn(async (path: string, data: string) => files.set(String(path), data)),
      }
      return { ...mockFs, default: mockFs }
    })
    vi.doMock("@/lib/services/baserow", () => ({
      getTasks: vi.fn(async () => [
        { id: 101, title: "Strip tiles", project: "Old Bathroom Name", status: "Not Started", priority: "Medium" },
        { id: 102, title: "Paint wall", project: "Other Job", status: "Not Started", priority: "Medium" },
      ]),
      createTask: vi.fn(),
    }))
    const { GET } = await import("@/app/api/projects/[id]/task-groups/route")

    const response = await GET(
      new Request("http://localhost/api/projects/job-1/task-groups?projectName=Bathroom%20Repair"),
      routeContext
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tasks).toEqual([
      expect.objectContaining({ id: 101, title: "Strip tiles", areaId: "area-1", groupName: "Prep" }),
    ])
  })
})

describe("project suggestion approval", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("preserves scope category when approving a scope suggestion", async () => {
    const files = new Map<string, string>([
      [
        "project-suggestions.json",
        JSON.stringify([
          {
            id: "sug-1",
            name: "Zeerust Farm",
            type: "major",
            scopeKind: "asset",
            suggestedBy: "lucky",
            suggestedAt: "now",
            status: "pending",
          },
        ]),
      ],
      ["projects.json", "[]"],
    ])
    vi.doMock("@/lib/workflows", () => ({ routeToInngest: vi.fn(async () => undefined) }))
    const { PATCH } = await importWithMockedFiles<
      typeof import("@/app/api/projects/suggestions/[id]/route")
    >("@/app/api/projects/suggestions/[id]/route", files)

    const response = await PATCH(
      new Request("http://localhost/api/projects/suggestions/sug-1", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ status: "approved" }),
      }),
      { params: Promise.resolve({ id: "sug-1" }) }
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.project).toMatchObject({ name: "Zeerust Farm", type: "major", scopeKind: "asset", kind: "scope" })
  })
})
