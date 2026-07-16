import { describe, expect, it } from "vitest"
import {
  getProjectKind,
  isJob,
  isScope,
  toStoredProjectType,
  withProjectKind,
  type Project,
} from "@/lib/projects"

const baseProject = {
  id: "proj-1",
  name: "32 Singlehurst",
  status: "planned",
  members: [],
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
} satisfies Omit<Project, "type">

describe("project work model aliases", () => {
  it("maps legacy stored types to scope and job kinds", () => {
    expect(getProjectKind({ type: "major" })).toBe("scope")
    expect(getProjectKind({ type: "subproject" })).toBe("job")
    expect(isScope({ type: "major" })).toBe(true)
    expect(isJob({ type: "subproject" })).toBe(true)
  })

  it("normalizes public type aliases to stored types", () => {
    expect(toStoredProjectType("scope")).toBe("major")
    expect(toStoredProjectType("job")).toBe("subproject")
    expect(toStoredProjectType("major")).toBe("major")
    expect(toStoredProjectType("subproject")).toBe("subproject")
    expect(toStoredProjectType("unknown")).toBeNull()
    expect(toStoredProjectType(null)).toBeNull()
  })

  it("adds kind without changing the stored type", () => {
    const project = withProjectKind({ ...baseProject, type: "major" })

    expect(project.type).toBe("major")
    expect(project.kind).toBe("scope")
  })
})
