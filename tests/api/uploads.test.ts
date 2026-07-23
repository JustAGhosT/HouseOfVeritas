import { POST } from "@/app/api/uploads/route"
import { describe, expect, it } from "vitest"

const authHeaders = {
  "x-user-id": "charl",
  "x-user-role": "operator",
  "x-user-email": "charl@example.com",
}

describe("POST /api/uploads", () => {
  it("uses the authenticated user as uploader instead of a form userId", async () => {
    const formData = new FormData()
    formData.append(
      "file",
      new File(["photo"], "inventory.jpg", { type: "image/jpeg" })
    )
    formData.append("userId", "hans")
    formData.append("category", "image")
    formData.append("resourceType", "inventory")

    const response = await POST(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        headers: authHeaders,
        body: formData,
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.file.uploadedBy).toBe("charl")
    expect(body.file.resourceType).toBe("inventory")
    expect(body.file.url).toMatch(/^\/api\/uploads\/file_/)
  })
})
