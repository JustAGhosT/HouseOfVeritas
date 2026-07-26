import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const verifier = resolve(process.cwd(), "scripts/verify-alpha-review-e2e.mjs")

function runFixture(name: string) {
  return spawnSync(
    process.execPath,
    [verifier, resolve(process.cwd(), "tests/fixtures/alpha-review", name)],
    { encoding: "utf8" }
  )
}

describe("alpha review operational E2E harness", () => {
  it("completes the exact synthetic workflow without external effects or evidence claims", () => {
    const result = runFixture("synthetic-complete.json")

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(JSON.parse(result.stdout)).toEqual({
      candidateId: "AER-SIM-001",
      disposition: "revise_before_more_alpha",
      eventCount: 8,
      mode: "synthetic_harness",
      packVersion: "AER-SYNTH-001-v1",
      status: "passed",
      variant: "B",
    })
  })

  it("fails closed when a run attempts live effects or evidence claims", () => {
    const result = runFixture("unsafe-live-shaped.json")

    expect(result.status).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("mode must be synthetic_harness")
  })

  it("rejects identifying fields before processing the workflow", () => {
    const result = runFixture("unsafe-pii-shaped.json")

    expect(result.status).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("prohibited key $.candidateName")
  })
})
