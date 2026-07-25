import { beforeEach, describe, expect, it, vi } from "vitest"

const taskRepository = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

vi.mock("@/lib/db/mongodb", () => ({
  isMongoConfigured: () => true,
}))

vi.mock("@/lib/repositories/task-repository", () => ({
  getTaskRepository: vi.fn(async () => taskRepository),
}))

import {
  createTask,
  getTask,
  getTaskDataSource,
  getTasks,
  getTasksPaginated,
  updateTask,
  type Task,
} from "@/lib/services/baserow"

const storedTask: Task = {
  id: 123,
  title: "Stored task",
  assignedTo: 4,
  priority: "Medium",
  status: "Not Started",
}

describe("Baserow task service Mongo fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("BASEROW_API_TOKEN", "")
    vi.stubEnv("BASEROW_DATABASE_ID", "")
    vi.stubEnv("BASEROW_TABLE_TASKS", "")
  })

  it("reports MongoDB as the configured task data source", () => {
    expect(getTaskDataSource()).toBe("mongodb")
  })

  it("delegates individual task lookup to the persistent repository", async () => {
    taskRepository.get.mockResolvedValue(storedTask)

    await expect(getTask(storedTask.id)).resolves.toEqual(storedTask)
    expect(taskRepository.get).toHaveBeenCalledWith(storedTask.id)
  })

  it("delegates task lists and pagination to the persistent repository", async () => {
    taskRepository.list.mockResolvedValue([storedTask])

    await expect(getTasks({ assignedTo: 4 })).resolves.toEqual([storedTask])
    expect(taskRepository.list).toHaveBeenCalledWith({ assignedTo: 4 })

    await expect(getTasksPaginated(2, 1, { status: "Not Started" })).resolves.toEqual({
      items: [],
      count: 1,
    })
    expect(taskRepository.list).toHaveBeenCalledWith({ status: "Not Started" })
  })

  it("delegates task creates and updates to the persistent repository", async () => {
    const taskInput = {
      title: storedTask.title,
      assignedTo: storedTask.assignedTo,
      priority: storedTask.priority,
      status: storedTask.status,
    }
    taskRepository.create.mockResolvedValue(storedTask)
    taskRepository.update.mockResolvedValue({ ...storedTask, status: "In Progress" })

    await expect(createTask(taskInput)).resolves.toEqual(storedTask)
    expect(taskRepository.create).toHaveBeenCalledWith(taskInput)

    await expect(updateTask(storedTask.id, { status: "In Progress" })).resolves.toMatchObject({
      id: storedTask.id,
      status: "In Progress",
    })
    expect(taskRepository.update).toHaveBeenCalledWith(storedTask.id, {
      status: "In Progress",
    })
  })
})
