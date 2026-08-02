import { afterEach, describe, expect, it, vi } from "vitest"

async function loadProvider() {
  vi.resetModules()
  const { default: config } = await import("@/auth.config")
  const provider = config.providers.find(
    (candidate) => typeof candidate !== "function" && candidate.id === "mystira"
  )
  if (!provider || typeof provider === "function") {
    throw new Error("Mystira OIDC provider is missing")
  }
  return provider
}

describe("Mystira OIDC provider configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("uses the canonical issuer authorization endpoint by default", async () => {
    vi.stubEnv("MYSTIRA_OIDC_ISSUER", "https://identity.example.test")
    vi.stubEnv("MYSTIRA_OIDC_AUTHORIZATION_ENDPOINT", "")

    const provider = await loadProvider()

    expect(provider.authorization).toEqual({
      url: "https://identity.example.test/connect/authorize",
      params: { scope: "openid profile email offline_access" },
    })
    expect(provider.issuer).toBe("https://identity.example.test")
  })

  it("can keep the issuer canonical while using an HOV browser endpoint", async () => {
    vi.stubEnv("MYSTIRA_OIDC_ISSUER", "https://identity.mystira.app")
    vi.stubEnv(
      "MYSTIRA_OIDC_AUTHORIZATION_ENDPOINT",
      "https://login.hov.neuralliquid.ai/connect/authorize"
    )

    const provider = await loadProvider()

    expect(provider.authorization).toMatchObject({
      url: "https://login.hov.neuralliquid.ai/connect/authorize",
    })
    expect(provider.issuer).toBe("https://identity.mystira.app")
    expect(provider.checks).toEqual(["pkce", "state"])
  })

  it("does not throw at module load for a malformed issuer", async () => {
    vi.stubEnv("MYSTIRA_OIDC_ISSUER", "not-an-absolute-url")
    vi.stubEnv("MYSTIRA_OIDC_AUTHORIZATION_ENDPOINT", "")

    const provider = await loadProvider()

    expect(provider.authorization).toMatchObject({
      url: "http://localhost:5262/connect/authorize",
    })
    expect(provider.issuer).toBe("not-an-absolute-url")
  })

  it("rejects an unsafe authorization endpoint and falls back to the issuer", async () => {
    vi.stubEnv("MYSTIRA_OIDC_ISSUER", "https://identity.example.test")
    vi.stubEnv(
      "MYSTIRA_OIDC_AUTHORIZATION_ENDPOINT",
      "https://identity.example.test@evil.example/connect/authorize?redirect=1"
    )

    const provider = await loadProvider()

    expect(provider.authorization).toMatchObject({
      url: "https://identity.example.test/connect/authorize",
    })
  })
})
