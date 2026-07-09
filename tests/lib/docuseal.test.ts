import { describe, it, expect, beforeEach } from "vitest"
import {
  isDocuSealConfigured,
  getTemplates,
  createSubmission,
  getSubmissionStatus,
} from "@/lib/services/docuseal"

describe("docuseal service", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  describe("isDocuSealConfigured", () => {
    it("returns false when DOCUSEAL_API_KEY is unset", () => {
      delete process.env.DOCUSEAL_API_KEY
      expect(isDocuSealConfigured()).toBe(false)
    })

    it("returns true when DOCUSEAL_API_KEY is set", () => {
      process.env.DOCUSEAL_API_KEY = "test-key"
      expect(isDocuSealConfigured()).toBe(true)
    })
  })

  describe("getTemplates (empty fallback)", () => {
    it("returns empty templates when not configured and demo data is disabled", async () => {
      delete process.env.DOCUSEAL_API_KEY
      const templates = await getTemplates()
      expect(Array.isArray(templates)).toBe(true)
      expect(templates).toHaveLength(0)
    })
  })

  describe("createSubmission (empty fallback)", () => {
    it("returns null when not configured and demo data is disabled", async () => {
      delete process.env.DOCUSEAL_API_KEY
      const submission = await createSubmission({
        templateId: "tpl_1",
        recipients: [{ email: "test@example.com", name: "Test", role: "signer" }],
      })
      expect(submission).toBeNull()
    })
  })

  describe("getSubmissionStatus (empty fallback)", () => {
    it("returns null when not configured and demo data is disabled", async () => {
      delete process.env.DOCUSEAL_API_KEY
      const status = await getSubmissionStatus("sub_123")
      expect(status).toBeNull()
    })
  })
})
