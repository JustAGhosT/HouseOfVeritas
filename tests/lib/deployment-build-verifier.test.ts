import { describe, expect, it, vi } from "vitest"

import { verifyDeploymentBuild } from "../../scripts/verify-deployment-build.mjs"

const oldCommit = "1".repeat(40)
const expectedCommit = "2".repeat(40)

describe("deployment build verifier", () => {
  it("rejects a healthy old worker and retries until the exact commit is served", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "healthy", build: { commit: oldCommit } }))
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "healthy", build: { commit: expectedCommit } }))
      )
    const sleepImpl = vi.fn().mockResolvedValue(undefined)

    await expect(
      verifyDeploymentBuild({
        url: "https://example.test/api/health",
        expectedCommit,
        attempts: 2,
        delayMs: 1,
        fetchImpl,
        sleepImpl,
        now: () => 123,
        log: vi.fn(),
      })
    ).resolves.toBeUndefined()

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleepImpl).toHaveBeenCalledOnce()
  })

  it("uses no-store headers and a unique query parameter on every request", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "healthy", build: { commit: oldCommit } }))
      )
    const timestamps = [101, 102]

    await expect(
      verifyDeploymentBuild({
        url: "https://example.test/api/health",
        expectedCommit,
        attempts: 2,
        delayMs: 1,
        fetchImpl,
        sleepImpl: vi.fn().mockResolvedValue(undefined),
        now: () => timestamps.shift()!,
        log: vi.fn(),
      })
    ).rejects.toThrow(`Expected healthy deployment ${expectedCommit}`)

    const [firstUrl, firstOptions] = fetchImpl.mock.calls[0]
    const [secondUrl, secondOptions] = fetchImpl.mock.calls[1]
    expect(firstUrl.searchParams.get("cache_bust")).toBe("101")
    expect(secondUrl.searchParams.get("cache_bust")).toBe("102")
    expect(firstOptions).toMatchObject({
      cache: "no-store",
      headers: { "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" },
    })
    expect(secondOptions).toEqual(firstOptions)
  })

  it("fails when the endpoint is healthy but never serves the expected commit", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "healthy", build: { commit: oldCommit } }))
      )

    await expect(
      verifyDeploymentBuild({
        url: "https://example.test/api/health",
        expectedCommit,
        attempts: 1,
        delayMs: 1,
        fetchImpl,
        log: vi.fn(),
      })
    ).rejects.toThrow(`Expected healthy deployment ${expectedCommit}`)
  })
})
