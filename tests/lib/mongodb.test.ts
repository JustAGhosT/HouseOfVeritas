import { ObjectId } from "mongodb"
import { describe, expect, it } from "vitest"
import { sanitizeDocument, withoutMongoId } from "@/lib/db/mongodb"

describe("MongoDB document helpers", () => {
  it("removes Mongo internals from API documents", () => {
    expect(withoutMongoId({ _id: new ObjectId(), id: "project-1", name: "Project" })).toEqual({
      id: "project-1",
      name: "Project",
    })
  })

  it("preserves an application id when sanitizing documents", () => {
    const sanitized = sanitizeDocument({ _id: new ObjectId(), id: "domain-id", name: "Domain object" })

    expect(sanitized.id).toBe("domain-id")
  })
})
