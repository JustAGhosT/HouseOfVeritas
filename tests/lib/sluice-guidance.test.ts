import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generateTaskGuidanceWithSluice } from "@/lib/integrations/sluice"

const fetchMock = vi.fn<typeof fetch>()

const draft = {
  kind: "procedure",
  locale: "af",
  title: "Herstel die vensterbank",
  summary: "Herstel die beskadigde pleister.",
  materials: ["Sement"],
  tools: ["Troffel"],
  safety: ["Dra oogbeskerming"],
  steps: [
    {
      order: 1,
      title: "Berei voor",
      instruction: "Verwyder los materiaal.",
      visualCue: "Die rand moet skoon en vas wees.",
    },
  ],
}

describe("Sluice task guidance", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("SLUICE_BASE_URL", "https://sluice.example")
    vi.stubEnv("SLUICE_API_KEY", "test-virtual-key")
    vi.stubEnv("SLUICE_GUIDANCE_MODEL", "cheap-long-context")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("routes multimodal guidance through Sluice with governance metadata", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(draft) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )

    const result = await generateTaskGuidanceWithSluice({
      taskId: "42",
      title: "Repair window sill",
      description: "Keep the drainage opening clear.",
      imageBase64: "cGhvdG8=",
      imageMimeType: "image/jpeg",
      locale: "af",
    })

    expect(result?.title).toBe("Herstel die vensterbank")
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://sluice.example/v1/chat/completions")
    const body = JSON.parse(String(options?.body)) as {
      model: string
      metadata: Record<string, string>
    }
    expect(body.model).toBe("cheap-long-context")
    expect(body.metadata).toMatchObject({
      consumer: "house-of-veritas",
      capability: "task-guidance-vision",
      task_id: "42",
    })
  })

  it("fails closed when the Sluice virtual key is missing", async () => {
    vi.stubEnv("SLUICE_API_KEY", "")

    const result = await generateTaskGuidanceWithSluice({
      taskId: "42",
      title: "Repair window sill",
      description: "Keep the drainage opening clear.",
      imageBase64: "cGhvdG8=",
      imageMimeType: "image/jpeg",
      locale: "en",
    })

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
