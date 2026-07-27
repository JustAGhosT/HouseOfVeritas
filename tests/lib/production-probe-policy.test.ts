import { describe, expect, it } from "vitest"
import { productionProbePolicy } from "../e2e/helpers/production-probe-policy"

describe("productionProbePolicy", () => {
  it("disables retries and tracing for legitimate production sessions", () => {
    expect(productionProbePolicy(true, true)).toEqual({
      retries: 0,
      trace: "off",
    })
  })

  it("preserves retry tracing for ordinary CI E2E tests", () => {
    expect(productionProbePolicy(false, true)).toEqual({
      retries: 2,
      trace: "on-first-retry",
    })
  })

  it("does not retry ordinary local E2E tests", () => {
    expect(productionProbePolicy(false, false)).toEqual({
      retries: 0,
      trace: "on-first-retry",
    })
  })
})
