import { beforeEach, describe, expect, it } from "vitest"
import { getTaskRepository, resetTaskRepositoryForTests } from "@/lib/repositories/task-repository"

describe("task repository", () => {
  beforeEach(() => {
    resetTaskRepositoryForTests()
  })

  it("persists task create, filtered list, and update through the repository contract", async () => {
    const repository = await getTaskRepository("memory")
    const created = await repository.create({
      title: "Resident guidance proof",
      description: "Persist this task for guidance.",
      assignedTo: 4,
      assignedToName: "Irma",
      priority: "Medium",
      status: "Not Started",
    })

    expect(created.id).toEqual(expect.any(Number))
    expect(created.createdDate).toEqual(expect.any(String))
    await expect(repository.list({ assignedTo: 4 })).resolves.toEqual([created])
    await expect(repository.list({ assignedToName: "irma" })).resolves.toEqual([created])
    await expect(repository.list({ assignedTo: 1 })).resolves.toEqual([])

    const updated = await repository.update(created.id, { status: "In Progress" })
    expect(updated).toMatchObject({ id: created.id, status: "In Progress" })
    await expect(repository.list({ status: "In Progress" })).resolves.toEqual([updated])
  })

  it("returns null when updating an unknown task", async () => {
    const repository = await getTaskRepository("memory")
    await expect(repository.update(999, { status: "Completed" })).resolves.toBeNull()
  })
})
