import { describe, it, expect, vi, afterEach } from "vitest"
import { buildEndSessionUrl, resolveEndSessionEndpoint } from "@/lib/auth/federated-logout"

describe("buildEndSessionUrl", () => {
  it("appends id_token_hint and post_logout_redirect_uri", () => {
    const url = buildEndSessionUrl({
      endSessionEndpoint: "https://idp.example.com/connect/endsession",
      idToken: "the-id-token",
      postLogoutRedirectUri: "https://app.example.com",
    })
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe("https://idp.example.com/connect/endsession")
    expect(parsed.searchParams.get("id_token_hint")).toBe("the-id-token")
    expect(parsed.searchParams.get("post_logout_redirect_uri")).toBe("https://app.example.com")
  })

  it("url-encodes the redirect uri", () => {
    const url = buildEndSessionUrl({
      endSessionEndpoint: "https://idp.example.com/connect/endsession",
      idToken: "t",
      postLogoutRedirectUri: "https://app.example.com/login?next=/dashboard",
    })
    // The raw query string must not contain an unencoded nested "?".
    expect(url).toContain("post_logout_redirect_uri=https%3A%2F%2Fapp.example.com%2Flogin")
    // ...but it round-trips back to the original value when parsed.
    expect(new URL(url).searchParams.get("post_logout_redirect_uri")).toBe(
      "https://app.example.com/login?next=/dashboard"
    )
  })

  it("preserves an existing query string on the endpoint", () => {
    const url = buildEndSessionUrl({
      endSessionEndpoint: "https://idp.example.com/connect/endsession?foo=bar",
      idToken: "t",
      postLogoutRedirectUri: "https://app.example.com",
    })
    const parsed = new URL(url)
    expect(parsed.searchParams.get("foo")).toBe("bar")
    expect(parsed.searchParams.get("id_token_hint")).toBe("t")
  })
})

describe("resolveEndSessionEndpoint", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses the discovered end_session_endpoint when discovery succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          end_session_endpoint: "https://idp.example.com/custom/logout",
        }),
      }))
    )
    // Unique issuer per test to avoid the module-level cache leaking across tests.
    const endpoint = await resolveEndSessionEndpoint("https://discover-success.example.com")
    expect(endpoint).toBe("https://idp.example.com/custom/logout")
  })

  it("falls back to /connect/endsession when discovery omits the field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    )
    const endpoint = await resolveEndSessionEndpoint("https://discover-nofield.example.com")
    expect(endpoint).toBe("https://discover-nofield.example.com/connect/endsession")
  })

  it("falls back to /connect/endsession when discovery is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down")
      })
    )
    const endpoint = await resolveEndSessionEndpoint("https://discover-fail.example.com")
    expect(endpoint).toBe("https://discover-fail.example.com/connect/endsession")
  })

  it("trims a trailing slash from the issuer in the fallback path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    )
    const endpoint = await resolveEndSessionEndpoint("https://discover-trailing.example.com/")
    expect(endpoint).toBe("https://discover-trailing.example.com/connect/endsession")
  })
})
