import { describe, expect, it } from "vitest"
import { productionSessionCookies } from "../e2e/helpers/production-session"

describe("productionSessionCookies", () => {
  it("preserves the single-cookie environment contract", () => {
    expect(
      productionSessionCookies("admin", {
        POST_DEPLOY_ADMIN_SESSION: "single-token",
      })
    ).toEqual([{ name: "__Secure-authjs.session-token", value: "single-token" }])
  })

  it("uses a configured single-cookie name", () => {
    expect(
      productionSessionCookies("operator", {
        POST_DEPLOY_OPERATOR_SESSION: "single-token",
        POST_DEPLOY_OPERATOR_SESSION_COOKIE_NAME: "authjs.session-token",
      })
    ).toEqual([{ name: "authjs.session-token", value: "single-token" }])
  })

  it("returns every supplied Auth.js session chunk", () => {
    expect(
      productionSessionCookies("admin", {
        POST_DEPLOY_ADMIN_SESSION_COOKIES: JSON.stringify([
          { name: "__Secure-authjs.session-token.0", value: "chunk-zero" },
          { name: "__Secure-authjs.session-token.1", value: "chunk-one" },
        ]),
      })
    ).toEqual([
      { name: "__Secure-authjs.session-token.0", value: "chunk-zero" },
      { name: "__Secure-authjs.session-token.1", value: "chunk-one" },
    ])
  })

  it("prefers the chunked contract when both forms are present", () => {
    expect(
      productionSessionCookies("operator", {
        POST_DEPLOY_OPERATOR_SESSION: "unused-single-token",
        POST_DEPLOY_OPERATOR_SESSION_COOKIES: JSON.stringify([
          { name: "__Secure-authjs.session-token.0", value: "chunk-zero" },
        ]),
      })
    ).toEqual([{ name: "__Secure-authjs.session-token.0", value: "chunk-zero" }])
  })

  it("rejects malformed or empty chunked input without exposing values", () => {
    expect(() =>
      productionSessionCookies("admin", {
        POST_DEPLOY_ADMIN_SESSION_COOKIES: "not-json",
      })
    ).toThrow("POST_DEPLOY_ADMIN_SESSION_COOKIES must be a valid JSON array.")

    expect(() =>
      productionSessionCookies("admin", {
        POST_DEPLOY_ADMIN_SESSION_COOKIES: "[]",
      })
    ).toThrow("POST_DEPLOY_ADMIN_SESSION_COOKIES must contain at least one cookie.")
  })

  it("rejects unrelated and duplicate cookie names", () => {
    expect(() =>
      productionSessionCookies("admin", {
        POST_DEPLOY_ADMIN_SESSION_COOKIES: JSON.stringify([
          { name: "unrelated-cookie", value: "not-logged" },
        ]),
      })
    ).toThrow("must use __Secure-authjs.session-token or a numeric chunk suffix")

    expect(() =>
      productionSessionCookies("admin", {
        POST_DEPLOY_ADMIN_SESSION_COOKIES: JSON.stringify([
          { name: "__Secure-authjs.session-token.0", value: "chunk-zero" },
          { name: "__Secure-authjs.session-token.0", value: "chunk-zero-again" },
        ]),
      })
    ).toThrow("must not contain duplicate cookie names")
  })
})
