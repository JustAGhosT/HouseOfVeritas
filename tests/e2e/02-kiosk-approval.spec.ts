import { expect, test } from "@playwright/test"

const hansHeaders = {
  "x-user-id": "hans",
  "x-user-role": "admin",
  "x-user-email": "hans@houseofv.com",
}

async function postKioskRequest(request: import("@playwright/test").APIRequestContext) {
  const payload = {
    type: "stock_order",
    employeeId: "lucky",
    employeeName: "Lucky",
    data: { itemName: "E2E test item", quantity: 1 },
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request.post("/api/kiosk/requests", {
        headers: hansHeaders,
        data: payload,
      })
      if (response.ok()) {
        return response
      }
      if (attempt === 2) return response
    } catch (error) {
      if (attempt === 2) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error("Failed to create kiosk request")
}

test.describe("Kiosk approval flow", () => {
  // Viewing the (auth-gated) approvals page requires a signed-in admin session.
  // The local password login this used was removed by the Auth.js v5 + Mystira
  // OIDC migration (PR #62); a live/mocked IdP is needed — baton 7ad9342d +
  // /team-testing.
  test.fixme("Hans can view approvals page (requires Mystira OIDC session)", async () => {})

  test("POST kiosk request creates request when authenticated", async ({ request }) => {
    test.setTimeout(60000) // Double the timeout for this test
    const req = await postKioskRequest(request)
    expect(req.ok()).toBeTruthy()
    const body = await req.json()
    expect(body.success).toBe(true)
    expect(body.request).toBeDefined()
    expect(body.request.status).toBe("pending")
  })
})
