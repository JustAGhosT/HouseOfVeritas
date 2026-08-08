import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generateTaskGuidanceWithSluice } from "@/lib/integrations/sluice"

/**
 * Guards the Sluice request-metadata contract (ADR 10, raised to MUST by ADR 17).
 *
 * This exists because the contract was silently violated for months: the call sent
 * `consumer`/`capability` instead of `app`/`agent`, which the gateway reads as an
 * untagged request. Nothing failed — there is no build error for sending the wrong
 * key name, and `(none)` in a rollup only looks wrong to someone already suspicious.
 * Once ADR 17 enforcement is switched on, the same mistake returns HTTP 400 on every
 * guidance request instead.
 *
 * The other guidance tests mock `@/lib/integrations/sluice` wholesale, so none of
 * them exercises the request this module actually builds. This one stubs `fetch` and
 * asserts on the outgoing body.
 */

const ONE_PIXEL_JPEG_BASE64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAA=="

// `app`, `agent`, `workflow` and `stage` become Prometheus label values, so ADR 10
// requires lowercase kebab-case: stable, one token per dimension, no version numbers.
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/

function guidanceParams(overrides: Record<string, unknown> = {}) {
  return {
    taskId: "42",
    title: "Repair window sill",
    description: "The plaster is crumbling under the window.",
    imageBase64: ONE_PIXEL_JPEG_BASE64,
    imageMimeType: "image/jpeg",
    locale: "en" as const,
    ...overrides,
  }
}

function sentMetadata(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return JSON.parse(String(init.body)).metadata as Record<string, unknown>
}

describe("Sluice request metadata (ADR 10 / ADR 17)", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.SLUICE_BASE_URL = "https://litellm.sluice.example"
    process.env.SLUICE_API_KEY = "sk-test"
    delete process.env.SLUICE_GATEWAY_URL
    delete process.env.SLUICE_GUIDANCE_MODEL

    // The body is built before the response is read, so the reply only has to be
    // well-formed enough not to throw — these tests assert on the request.
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "not json" } }] }),
    })
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.SLUICE_BASE_URL
    delete process.env.SLUICE_API_KEY
    delete process.env.SLUICE_GUIDANCE_MODEL
  })

  it("sends the required app and agent fields", async () => {
    await generateTaskGuidanceWithSluice(guidanceParams())

    const metadata = sentMetadata(fetchMock)
    expect(metadata.app).toBe("house-of-veritas")
    expect(metadata.agent).toBe("task-guidance-vision")
  })

  it("does not send the superseded consumer/capability names", async () => {
    await generateTaskGuidanceWithSluice(guidanceParams())

    const metadata = sentMetadata(fetchMock)
    expect(metadata).not.toHaveProperty("consumer")
    expect(metadata).not.toHaveProperty("capability")
    expect(metadata).not.toHaveProperty("task_id")
  })

  it("keeps every Prometheus-labelled field kebab-case", async () => {
    await generateTaskGuidanceWithSluice(guidanceParams())

    const metadata = sentMetadata(fetchMock)
    for (const field of ["app", "agent", "workflow", "stage"] as const) {
      // Assert the type before the shape: `String(undefined)` is "undefined", which
      // matches the kebab pattern, so a missing field would pass a regex-only check.
      expect(typeof metadata[field], `${field} must be present`).toBe("string")
      expect(metadata[field] as string).toMatch(KEBAB_CASE)
    }
  })

  it("reports stage as a workflow phase, not the deploy environment", async () => {
    await generateTaskGuidanceWithSluice(guidanceParams())
    expect(sentMetadata(fetchMock).stage).toBe("ungrounded")

    fetchMock.mockClear()
    await generateTaskGuidanceWithSluice(
      guidanceParams({
        knowledge: { text: "curated", refs: [{ slug: "copper-pipe-condensation-wall-damp" }] },
      })
    )
    const grounded = sentMetadata(fetchMock)
    expect(grounded.stage).toBe("grounded")
    expect(grounded.grounded_by).toBe("copper-pipe-condensation-wall-damp")
  })

  it("carries the task id as request_id, which stays out of Prometheus labels", async () => {
    await generateTaskGuidanceWithSluice(guidanceParams({ taskId: "task-98765" }))
    expect(sentMetadata(fetchMock).request_id).toBe("task-98765")
  })

  it("keeps route_hint in step with an overridden model", async () => {
    process.env.SLUICE_GUIDANCE_MODEL = "cheap-fast"
    await generateTaskGuidanceWithSluice(guidanceParams())

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe("cheap-fast")
    expect(body.metadata.route_hint).toBe("cheap-fast")
  })
})
