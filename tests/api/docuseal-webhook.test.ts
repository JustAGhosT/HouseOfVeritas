import { createHmac } from "crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

const inngestEvents: Array<{ name: string; data: Record<string, unknown> }> = []

vi.mock("@/lib/workflows", () => ({
  routeToInngest: vi.fn(async (event: { name: string; data: Record<string, unknown> }) => {
    inngestEvents.push(event)
  }),
}))

import { POST } from "@/app/api/webhooks/docuseal/route"

const secret = "docuseal-webhook-test-secret"

function signedRequest(payload: unknown) {
  const body = JSON.stringify(payload)
  const signature = createHmac("sha256", secret).update(body).digest("hex")

  return new Request("http://localhost/api/webhooks/docuseal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-DocuSeal-Signature": signature,
    },
    body,
  })
}

beforeEach(() => {
  inngestEvents.length = 0
  process.env.DOCUSEAL_WEBHOOK_SECRET = secret
  delete process.env.DOCUSEAL_WEBHOOK_HEADER
})

describe("POST /api/webhooks/docuseal", () => {
  it("preserves valid product metadata in the workflow event", async () => {
    const response = await POST(
      signedRequest({
        event_type: "submission.completed",
        data: {
          id: 42,
          template: { name: "Property Charter" },
          submitters: [{ email: "signer@example.com" }],
          documents: [{ url: "https://example.test/document.pdf" }],
          completed_at: "2026-08-28T00:00:00.000Z",
          metadata: { product: "house-of-veritas" },
        },
      })
    )

    expect(response.status).toBe(200)
    expect(inngestEvents).toHaveLength(1)
    expect(inngestEvents[0]).toMatchObject({
      name: "house-of-veritas/docuseal.submission.completed",
      data: { product: "house-of-veritas" },
    })
  })

  it("rejects a non-lowercase product identifier", async () => {
    const response = await POST(
      signedRequest({
        event_type: "submission.completed",
        data: {
          id: 43,
          metadata: { product: "HouseOfVeritas" },
        },
      })
    )

    expect(response.status).toBe(400)
    expect(inngestEvents).toHaveLength(0)
  })
})
