import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError, apiFetch } from "@/lib/api-client"
import { buildRecipeGuidanceDraft } from "@/lib/recipe-guidance-builder"
import { planRecipeGuidanceMedia } from "@/lib/recipe-guidance-media"
import { parseRecipeGuidanceDocument, type RecipeGuidanceDocument } from "@/lib/recipe-guidance"
import type { RecipeRecord } from "@/lib/recipes"
import { PublishedRecipeGuidance } from "@/components/recipes/published-recipe-guidance"
import { RecipeGuidanceDocumentView } from "@/components/recipes/recipe-guidance-document-view"
import { RecipeGuidanceWorkspace } from "@/components/recipes/recipe-guidance-workspace"
import uiFlowFixture from "@/tests/fixtures/recipe-guidance/ui-flow.json"

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>()
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

const recipe: RecipeRecord = {
  id: "recipe-ui-test",
  status: "published",
  ownerUserId: "hans",
  audienceUserIds: ["hans", "irma"],
  titleEn: "Garden stew",
  titleAf: "Tuinbredie",
  summaryEn: "A simple seasonal stew.",
  summaryAf: "’n Eenvoudige seisoenbredie.",
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 30,
  category: "Dinner",
  cuisine: "South African",
  image: {
    url: "https://example.com/stew.jpg",
    source: "Example library",
    license: "CC BY 4.0",
    attributionText: "Example cook",
    retrievedAt: "2026-07-31",
  },
  ingredients: [
    {
      id: "ingredient-carrot",
      name: "Carrots",
      quantity: "2",
      unit: "whole",
      preparationNote: "sliced",
    },
  ],
  steps: [
    {
      id: "step-simmer",
      order: 1,
      instructionEn: "Simmer until tender.",
      instructionAf: "Prut tot sag.",
      timerMinutes: 30,
    },
  ],
  createdAt: "2026-07-31T08:00:00.000Z",
  updatedAt: "2026-07-31T08:00:00.000Z",
}

const draft = buildRecipeGuidanceDraft(recipe, {
  version: 1,
  createdBy: "hans",
  now: "2026-07-31T08:05:00.000Z",
})

describe("recipe guidance UI", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it("keeps the browser-flow published fixture inside the document contract", () => {
    expect(parseRecipeGuidanceDocument(uiFlowFixture.document)).not.toBeNull()
  })

  it("renders bilingual canonical facts in the structured guidance reader", () => {
    render(
      <RecipeGuidanceDocumentView
        document={draft}
        recipe={recipe}
        language="both"
        heading="Preview"
      />
    )

    expect(screen.getByRole("heading", { name: "Garden stew / Tuinbredie" })).toBeInTheDocument()
    expect(screen.getByText("Carrots", { exact: false })).toBeInTheDocument()
    expect(screen.getByText("Simmer until tender.")).toBeInTheDocument()
    expect(screen.getByText("Prut tot sag.")).toBeInTheDocument()
    expect(screen.getAllByText("30 min")).toHaveLength(2)
  })

  it("loads the latest published guidance for Irma", async () => {
    const published = { ...draft, status: "published" } as RecipeGuidanceDocument
    vi.mocked(apiFetch).mockResolvedValue({
      data: { recipe, document: published },
      summary: { version: 1 },
    })

    render(<PublishedRecipeGuidance recipeId={recipe.id} language="both" />)

    expect(await screen.findByText("Irma’s kitchen view")).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith(`/api/recipes/${recipe.id}/guidance`, {
      label: "PublishedRecipeGuidance",
    })
  })

  it("previews and explicitly persists the next admin draft", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, options) => {
      if (url.endsWith("/guidance-drafts/preview")) {
        return {
          data: { recipe, document: draft },
          summary: { persisted: false, nextVersion: 1 },
        }
      }
      if (url.endsWith("/guidance-drafts") && options?.method === "POST") {
        return {
          data: { recipe, document: draft },
          summary: { persisted: true, version: 1 },
        }
      }
      if (url.endsWith("/publication-readiness")) {
        return {
          data: {
            documentId: draft.id,
            version: 1,
            status: "draft",
            ready: false,
            issues: [{ code: "status", message: "Guidance must be in review before publication" }],
          },
        }
      }
      return { data: { documents: [] }, summary: { count: 0, mode: "test" } }
    })

    const user = userEvent.setup()
    render(<RecipeGuidanceWorkspace recipe={recipe} language="both" />)

    expect(
      await screen.findByText("No guidance versions exist.", { exact: false })
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Preview next version" }))
    expect(
      await screen.findByText("This is a non-persisted preview.", { exact: false })
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Create draft" }))
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Stored version" })).toHaveValue("1")
    )
    expect(screen.getByText("Version 1 was created as a draft.")).toBeInTheDocument()
  })

  it("requires bilingual alt text before approving review-required media", async () => {
    const approved = {
      ...draft,
      mediaAssets: draft.mediaAssets.map((asset) => ({
        ...asset,
        status: "approved" as const,
        altText: { en: "Stew in a bowl", af: "Bredie in ’n bak" },
        reviewedBy: "hans",
        reviewedAt: "2026-07-31T08:06:00.000Z",
      })),
      updatedAt: "2026-07-31T08:06:00.000Z",
    }
    vi.mocked(apiFetch).mockImplementation(async (url, options) => {
      if (url.endsWith("/publication-readiness")) {
        return {
          data: {
            documentId: draft.id,
            version: 1,
            status: "draft",
            ready: false,
            issues: [{ code: "media", message: "Media review is required" }],
          },
        }
      }
      if (options?.label === "RecipeGuidanceMediaReview") {
        return { data: { document: approved } }
      }
      return { data: { documents: [draft] } }
    })

    const user = userEvent.setup()
    render(<RecipeGuidanceWorkspace recipe={recipe} language="both" />)

    const approve = await screen.findByRole("button", { name: "Approve media" })
    expect(approve).toBeDisabled()
    await user.type(screen.getByRole("textbox", { name: "English alt text" }), "Stew in a bowl")
    expect(approve).toBeDisabled()
    await user.type(screen.getByRole("textbox", { name: "Afrikaans alt text" }), "Bredie in ’n bak")
    expect(approve).toBeEnabled()
    await user.click(approve)

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        `/api/recipes/${recipe.id}/guidance-drafts/1`,
        expect.objectContaining({
          body: {
            expectedUpdatedAt: draft.updatedAt,
            mediaReview: {
              assetId: draft.mediaAssets[0]?.id,
              decision: "approve",
              altText: { en: "Stew in a bowl", af: "Bredie in ’n bak" },
            },
          },
        })
      )
    )
  })

  it("reloads the latest document when a lifecycle transition conflicts", async () => {
    let listCalls = 0
    vi.mocked(apiFetch).mockImplementation(async (url, options) => {
      if (url.startsWith("/api/uploads?")) return { files: [], total: 0 }
      if (url.endsWith("/publication-readiness")) {
        return {
          data: {
            documentId: draft.id,
            version: 1,
            status: "draft",
            ready: false,
            issues: [{ code: "status", message: "Guidance must be reviewed" }],
          },
        }
      }
      if (options?.label === "RecipeGuidanceTransition") {
        throw new ApiError("Conflict", 409, "Conflict", {
          error: "Recipe guidance changed; refresh and retry",
        })
      }
      listCalls += 1
      return { data: { documents: [draft] } }
    })

    const user = userEvent.setup()
    render(<RecipeGuidanceWorkspace recipe={recipe} language="both" />)

    await user.click(await screen.findByRole("button", { name: "Submit for review" }))

    expect(
      await screen.findByText(
        "The guidance changed. The latest version has been loaded; review it before retrying."
      )
    ).toBeInTheDocument()
    expect(listCalls).toBe(2)
    expect(apiFetch).toHaveBeenCalledWith(
      `/api/recipes/${recipe.id}/guidance-drafts/1/transitions`,
      expect.objectContaining({
        body: { action: "submit_for_review", expectedUpdatedAt: draft.updatedAt },
      })
    )
  })

  it("lets Hans remove a rejected optional media reference before saving", async () => {
    const rejected = {
      ...draft,
      mediaAssets: draft.mediaAssets.map((asset) => ({
        ...asset,
        status: "rejected" as const,
        rejectionReason: "The image does not match the recipe",
        reviewedBy: "hans",
        reviewedAt: "2026-07-31T08:06:00.000Z",
      })),
      updatedAt: "2026-07-31T08:06:00.000Z",
    }
    const hero = rejected.sections.find((section) => section.kind === "hero")!
    const saved = {
      ...rejected,
      sections: rejected.sections.map((section) =>
        section.kind === "hero" ? { ...section, blocks: [] } : section
      ),
      updatedAt: "2026-07-31T08:07:00.000Z",
    }
    vi.mocked(apiFetch).mockImplementation(async (url, options) => {
      if (url.endsWith("/publication-readiness")) {
        return {
          data: {
            documentId: rejected.id,
            version: 1,
            status: "draft",
            ready: false,
            issues: [{ code: "hero", message: "Rejected media is still referenced" }],
          },
        }
      }
      if (options?.label === "RecipeGuidanceSection") {
        return { data: { document: saved } }
      }
      return { data: { documents: [rejected] } }
    })

    const user = userEvent.setup()
    render(<RecipeGuidanceWorkspace recipe={recipe} language="both" />)

    const heroEditor = (await screen.findByRole("heading", { name: "Hero image" })).closest(
      "section"
    )
    expect(heroEditor).not.toBeNull()
    await user.click(
      within(heroEditor!).getByRole("button", { name: "Remove rejected media reference" })
    )
    await user.click(within(heroEditor!).getByRole("button", { name: "Save section" }))

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        `/api/recipes/${recipe.id}/guidance-drafts/1`,
        expect.objectContaining({
          body: {
            expectedUpdatedAt: rejected.updatedAt,
            section: { kind: "hero", applicability: hero.applicability, blocks: [] },
          },
        })
      )
    )
  })

  it("plans missing media slots from the admin workspace", async () => {
    const planned = planRecipeGuidanceMedia(draft, recipe, "2026-07-31T08:06:00.000Z")!.document
    vi.mocked(apiFetch).mockImplementation(async (url, options) => {
      if (url.startsWith("/api/uploads?")) return { files: [], total: 0 }
      if (url.endsWith("/publication-readiness")) {
        return {
          data: {
            documentId: draft.id,
            version: 1,
            status: "draft",
            ready: false,
            issues: [{ code: "media", message: "Media is not reviewed" }],
          },
        }
      }
      if (options?.label === "RecipeGuidanceMediaPlan") {
        return { data: { document: planned } }
      }
      return { data: { documents: [draft] } }
    })

    const user = userEvent.setup()
    render(<RecipeGuidanceWorkspace recipe={recipe} language="both" />)

    await user.click(await screen.findByRole("button", { name: "Plan missing media" }))

    expect(
      await screen.findByText("Missing recipe media slots were planned deterministically.")
    ).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith(
      `/api/recipes/${recipe.id}/guidance-drafts/1`,
      expect.objectContaining({
        body: {
          expectedUpdatedAt: draft.updatedAt,
          mediaPlan: { action: "create_missing" },
        },
      })
    )
  })

  it("attaches a selected private upload only after rights and attribution are supplied", async () => {
    const planned = planRecipeGuidanceMedia(draft, recipe, "2026-07-31T08:06:00.000Z")!.document
    const target = planned.mediaAssets.find((asset) => asset.status === "planned")!
    vi.mocked(apiFetch).mockImplementation(async (url, options) => {
      if (url.startsWith("/api/uploads?")) {
        return {
          files: [
            {
              id: "file_recipe_photo",
              originalName: "ingredients.jpg",
              mimeType: "image/jpeg",
              size: 512,
              uploadedBy: "hans",
              uploadedAt: "2026-07-31T08:06:30.000Z",
              url: "/api/uploads/file_recipe_photo",
            },
          ],
          total: 1,
        }
      }
      if (url.endsWith("/publication-readiness")) {
        return {
          data: {
            documentId: planned.id,
            version: 1,
            status: "draft",
            ready: false,
            issues: [{ code: "media", message: "Media is not reviewed" }],
          },
        }
      }
      if (options?.label === "RecipeGuidanceMediaAttachment") {
        return { data: { document: planned } }
      }
      return { data: { documents: [planned] } }
    })

    const user = userEvent.setup()
    render(<RecipeGuidanceWorkspace recipe={recipe} language="both" />)

    const attach = await screen.findByRole("button", { name: "Attach for review" })
    expect(attach).toBeDisabled()
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Planned or replaceable media slot" }),
      target.id
    )
    await user.type(
      screen.getByRole("textbox", { name: "Rights basis" }),
      "Estate-owned photograph"
    )
    await user.type(screen.getByRole("textbox", { name: "Attribution" }), "Photograph by Hans")
    expect(attach).toBeEnabled()
    await user.click(attach)

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        `/api/recipes/${recipe.id}/guidance-drafts/1`,
        expect.objectContaining({
          body: {
            expectedUpdatedAt: planned.updatedAt,
            mediaAttachment: {
              mediaAssetId: target.id,
              uploadId: "file_recipe_photo",
              rightsBasis: "Estate-owned photograph",
              attributionText: "Photograph by Hans",
            },
          },
        })
      )
    )
  })
})
