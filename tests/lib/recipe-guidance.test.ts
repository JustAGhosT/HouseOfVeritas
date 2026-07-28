import { describe, expect, it } from "vitest"
import {
  RECIPE_GUIDANCE_SECTION_KINDS,
  guidanceTimerSchema,
  parseRecipeGuidanceDocument,
  recipeHeroToReviewRequiredMedia,
  recipeImageBriefSchema,
  recipeMediaAssetSchema,
  recipeMediaStorageSchema,
} from "@/lib/recipe-guidance"
import type { RecipeRecord } from "@/lib/recipes"

const now = "2026-07-28T18:00:00.000Z"

function buildDocument() {
  return {
    id: "recipe-1:guidance:1",
    recipeId: "recipe-1",
    recipeRevisionId: `recipe-1@${now}`,
    recipeUpdatedAt: now,
    version: 1,
    status: "draft",
    ownerUserId: "hans",
    audienceUserIds: ["irma"],
    sections: RECIPE_GUIDANCE_SECTION_KINDS.map((kind) => ({
      id: `section:${kind}`,
      kind,
      applicability: "required",
      blocks: [],
    })),
    mediaAssets: [],
    imageBriefs: [],
    createdBy: "hans",
    createdAt: now,
    updatedAt: now,
  }
}

describe("recipe guidance contracts", () => {
  it("accepts the canonical fixed section order", () => {
    const document = parseRecipeGuidanceDocument(buildDocument())

    expect(document?.sections.map((section) => section.kind)).toEqual(RECIPE_GUIDANCE_SECTION_KINDS)
  })

  it("rejects reordered canonical sections", () => {
    const document = buildDocument()
    ;[document.sections[0], document.sections[1]] = [document.sections[1], document.sections[0]]

    expect(parseRecipeGuidanceDocument(document)).toBeNull()
  })

  it("models exact, ranged, and seconds-based timers", () => {
    expect(guidanceTimerSchema.safeParse({ minimumSeconds: 30 }).success).toBe(true)
    expect(
      guidanceTimerSchema.safeParse({ minimumSeconds: 480, maximumSeconds: 600 }).success
    ).toBe(true)
    expect(
      guidanceTimerSchema.safeParse({ minimumSeconds: 600, maximumSeconds: 480 }).success
    ).toBe(false)
  })

  it("rejects media references outside the document", () => {
    const document = buildDocument()
    const invalidDocument = {
      ...document,
      sections: document.sections.map((section, index) =>
        index === 1
          ? {
              ...section,
              blocks: [
                {
                  id: "block:missing-hero",
                  type: "media_reference",
                  mediaAssetId: "asset:missing",
                },
              ],
            }
          : section
      ),
    }

    expect(parseRecipeGuidanceDocument(invalidDocument)).toBeNull()
  })

  it("allows a draft image brief without invented alt text", () => {
    const result = recipeImageBriefSchema.safeParse({
      id: "brief-1",
      sectionId: "section:cooking",
      role: "step",
      status: "draft",
      description: {
        en: "Show the reviewed visual state after browning.",
        af: "Wys die hersiene visuele toestand na verbruining.",
      },
    })

    expect(result.success).toBe(true)
  })

  it("requires bilingual alt text and review metadata before approval", () => {
    const result = recipeMediaAssetSchema.safeParse({
      id: "asset-1",
      sectionId: "section:hero",
      role: "hero",
      status: "approved",
      source: {
        type: "licensed",
        source: "Example library",
        license: "CC BY 4.0",
        attributionText: "Example Author, CC BY 4.0",
        retrievedAt: "2026-07-28",
      },
      storage: { type: "external", url: "https://images.example/hero.jpg" },
    })

    expect(result.success).toBe(false)
  })

  it("rejects an incomplete HTTP URL for external media storage", () => {
    const result = recipeMediaAssetSchema.safeParse({
      id: "asset-1",
      sectionId: "section:hero",
      role: "hero",
      status: "review_required",
      storage: { type: "external", url: "https://" },
    })

    expect(result.success).toBe(false)
  })

  it("rejects backslash paths that URL resolution treats as cross-origin", () => {
    expect(
      recipeMediaStorageSchema.safeParse({
        type: "hov",
        storageId: "asset-1-original",
        url: "/\\evil.example/x",
        contentHash: `sha256:${"a".repeat(64)}`,
      }).success
    ).toBe(false)
  })

  it("rejects a provider URL mislabeled as HOV-managed storage", () => {
    const result = recipeMediaAssetSchema.safeParse({
      id: "asset-1",
      sectionId: "section:hero",
      role: "hero",
      status: "approved",
      source: {
        type: "generated",
        requestId: "request-1",
        modelAlias: "recipe-image",
        generatedAt: now,
        rightsBasis: "Approved provider terms",
      },
      storage: {
        type: "hov",
        storageId: "asset-1-original",
        url: "https://provider.example/temporary.jpg",
        contentHash: `sha256:${"a".repeat(64)}`,
      },
      altText: { en: "Finished dish.", af: "Voltooide gereg." },
      reviewedBy: "hans",
      reviewedAt: now,
    })

    expect(result.success).toBe(false)
  })

  it("accepts approved generated media with an HOV storage ID and internal path", () => {
    const result = recipeMediaAssetSchema.safeParse({
      id: "asset-1",
      sectionId: "section:hero",
      imageBriefId: "brief-1",
      role: "hero",
      status: "approved",
      source: {
        type: "generated",
        requestId: "request-1",
        modelAlias: "recipe-image",
        generatedAt: now,
        rightsBasis: "Approved provider terms",
      },
      storage: {
        type: "hov",
        storageId: "asset-1-original",
        url: "/api/uploads/asset-1-original",
        contentHash: `sha256:${"a".repeat(64)}`,
      },
      altText: { en: "Finished dish.", af: "Voltooide gereg." },
      reviewedBy: "hans",
      reviewedAt: now,
    })

    expect(result.success).toBe(true)
  })

  it("retains approved-brief provenance for terminal generated media", () => {
    const result = recipeMediaAssetSchema.safeParse({
      id: "asset-1",
      sectionId: "section:hero",
      role: "hero",
      status: "rejected",
      source: {
        type: "generated",
        requestId: "request-1",
        modelAlias: "recipe-image",
        generatedAt: now,
        rightsBasis: "Approved provider terms",
      },
      rejectionReason: "The image does not match the reviewed facts.",
    })

    expect(result.success).toBe(false)
  })

  it("rejects alt text before media approval", () => {
    const result = recipeMediaAssetSchema.safeParse({
      id: "asset-1",
      sectionId: "section:hero",
      role: "hero",
      status: "review_required",
      storage: { type: "external", url: "https://images.example/hero.jpg" },
      altText: { en: "Unreviewed image.", af: "Onhersiene beeld." },
    })

    expect(result.success).toBe(false)
  })

  it("requires generated media to reference an approved matching brief", () => {
    const document = buildDocument()
    const generatedAsset = {
      id: "asset-1",
      sectionId: "section:hero",
      imageBriefId: "brief-1",
      role: "hero",
      status: "review_required",
      source: {
        type: "generated",
        requestId: "request-1",
        modelAlias: "recipe-image",
        generatedAt: now,
        rightsBasis: "Approved provider terms",
      },
      storage: { type: "external", url: "https://provider.example/preview.jpg" },
    }
    const approvedBrief = {
      id: "brief-1",
      sectionId: "section:hero",
      role: "hero",
      status: "approved",
      description: { en: "Finished dish.", af: "Voltooide gereg." },
      approvedBy: "hans",
      approvedAt: now,
    }

    expect(
      parseRecipeGuidanceDocument({
        ...document,
        mediaAssets: [generatedAsset],
        imageBriefs: [{ ...approvedBrief, role: "step" }],
      })
    ).toBeNull()
    expect(
      parseRecipeGuidanceDocument({
        ...document,
        mediaAssets: [generatedAsset],
        imageBriefs: [{ ...approvedBrief, status: "draft", approvedBy: undefined }],
      })
    ).toBeNull()
    expect(
      parseRecipeGuidanceDocument({
        ...document,
        mediaAssets: [generatedAsset],
        imageBriefs: [approvedBrief],
      })
    ).not.toBeNull()

    expect(
      parseRecipeGuidanceDocument({
        ...document,
        mediaAssets: [
          {
            id: "asset-1",
            sectionId: "section:hero",
            imageBriefId: "brief-1",
            role: "hero",
            status: "requested",
          },
        ],
        imageBriefs: [{ ...approvedBrief, status: "draft", approvedBy: undefined }],
      })
    ).toBeNull()
  })

  it("keeps media references within the asset's owning section", () => {
    const document = buildDocument()
    const invalidDocument = {
      ...document,
      sections: document.sections.map((section) =>
        section.kind === "cooking"
          ? {
              ...section,
              blocks: [
                {
                  id: "block:wrong-section",
                  type: "media_reference",
                  mediaAssetId: "asset-1",
                },
              ],
            }
          : section
      ),
      mediaAssets: [
        {
          id: "asset-1",
          sectionId: "section:hero",
          role: "hero",
          status: "review_required",
          source: {
            type: "licensed",
            source: "Example library",
            license: "CC BY 4.0",
            attributionText: "Example Author, CC BY 4.0",
            retrievedAt: "2026-07-28",
          },
          storage: { type: "external", url: "https://images.example/hero.jpg" },
        },
      ],
    }

    expect(parseRecipeGuidanceDocument(invalidDocument)).toBeNull()
  })

  it("requires review evidence and completed required sections before publication", () => {
    const document = buildDocument()
    expect(parseRecipeGuidanceDocument({ ...document, status: "published" })).toBeNull()

    const publishedDocument = {
      ...document,
      status: "published",
      reviewedBy: "hans",
      reviewedAt: now,
      publishedBy: "hans",
      publishedAt: now,
      sections: document.sections.map((section) => {
        const id = `block:${section.kind}`
        const blocks = (() => {
          switch (section.kind) {
            case "hero":
              return [{ id, type: "media_reference", mediaAssetId: "asset-1" }]
            case "before_start":
              return [
                {
                  id,
                  type: "notice",
                  noticeType: "preparation",
                  text: { en: "Prepare first.", af: "Berei eers voor." },
                },
              ]
            case "ingredients":
              return [
                {
                  id,
                  type: "ingredient_references",
                  recipeRevisionId: document.recipeRevisionId,
                  ingredientIds: ["ingredient-1"],
                },
              ]
            case "preparation":
            case "cooking":
              return [
                {
                  id,
                  type: "step_reference",
                  recipeRevisionId: document.recipeRevisionId,
                  recipeStepId: `step:${section.kind}`,
                },
              ]
            case "storage_and_reheating":
              return [
                {
                  id,
                  type: "notice",
                  noticeType: "storage",
                  text: { en: "Store safely.", af: "Berg veilig." },
                },
              ]
            default:
              return [
                {
                  id,
                  type: "text",
                  source: "reviewed",
                  text: { en: "Reviewed guidance.", af: "Hersiene leiding." },
                },
              ]
          }
        })()
        return { ...section, blocks }
      }),
      mediaAssets: [
        {
          id: "asset-1",
          sectionId: "section:hero",
          role: "hero",
          status: "approved",
          source: {
            type: "licensed",
            source: "Example library",
            license: "CC BY 4.0",
            attributionText: "Example Author, CC BY 4.0",
            retrievedAt: "2026-07-28",
          },
          storage: { type: "external", url: "https://images.example/hero.jpg" },
          altText: { en: "Finished dish.", af: "Voltooide gereg." },
          reviewedBy: "hans",
          reviewedAt: now,
        },
      ],
    }

    expect(parseRecipeGuidanceDocument(publishedDocument)).not.toBeNull()
    expect(
      parseRecipeGuidanceDocument({
        ...publishedDocument,
        sections: publishedDocument.sections.map((section) => ({
          ...section,
          blocks: [
            ...section.blocks,
            ...(section.kind === "identity"
              ? [{ id: "block:metrics", type: "metrics", servings: 4 }]
              : []),
            ...(section.kind === "cooking"
              ? [
                  {
                    id: "block:cooking-media",
                    type: "media_reference",
                    mediaAssetId: "asset-2",
                  },
                ]
              : []),
          ],
        })),
        mediaAssets: [
          ...publishedDocument.mediaAssets,
          {
            id: "asset-2",
            sectionId: "section:cooking",
            role: "step",
            status: "approved",
            source: {
              type: "licensed",
              source: "Example library",
              license: "CC BY 4.0",
              attributionText: "Example Author, CC BY 4.0",
              retrievedAt: "2026-07-28",
            },
            storage: { type: "external", url: "https://images.example/step.jpg" },
            altText: { en: "Cooking step.", af: "Kookstap." },
            reviewedBy: "hans",
            reviewedAt: now,
          },
        ],
      })
    ).not.toBeNull()
    expect(
      parseRecipeGuidanceDocument({
        ...publishedDocument,
        sections: publishedDocument.sections.map((section) => ({
          ...section,
          blocks: [{ id: `block:${section.kind}`, type: "metrics", servings: 4 }],
        })),
      })
    ).toBeNull()
  })

  it("cannot bypass foundational publication sections via applicability", () => {
    const document = buildDocument()
    const emptyPublishedDocument = {
      ...document,
      status: "published",
      reviewedBy: "hans",
      reviewedAt: now,
      publishedBy: "hans",
      publishedAt: now,
      sections: document.sections.map((section) => ({
        ...section,
        applicability: "not_applicable",
      })),
    }

    expect(parseRecipeGuidanceDocument(emptyPublishedDocument)).toBeNull()
  })

  it("rejects recipe references to a different immutable revision", () => {
    const document = buildDocument()
    const invalidDocument = {
      ...document,
      sections: document.sections.map((section) =>
        section.kind === "cooking"
          ? {
              ...section,
              blocks: [
                {
                  id: "block:cooking",
                  type: "step_reference",
                  recipeRevisionId: "recipe-1@older-revision",
                  recipeStepId: "step-1",
                },
              ],
            }
          : section
      ),
    }

    expect(parseRecipeGuidanceDocument(invalidDocument)).toBeNull()
    expect(
      parseRecipeGuidanceDocument({
        ...document,
        recipeRevisionId: "recipe-2@2026-07-01T00:00:00.000Z",
      })
    ).toBeNull()
  })

  it("rejects every unreviewed or section-inappropriate block at publication", () => {
    const document = buildDocument()
    const invalidDocument = {
      ...document,
      status: "published",
      reviewedBy: "hans",
      reviewedAt: now,
      publishedBy: "hans",
      publishedAt: now,
      sections: document.sections.map((section) => ({
        ...section,
        applicability: "optional",
        blocks:
          section.kind === "identity"
            ? [
                {
                  id: "block:identity",
                  type: "text",
                  source: "recipe",
                  text: { en: "Unreviewed.", af: "Onhersien." },
                },
              ]
            : [],
      })),
    }

    expect(parseRecipeGuidanceDocument(invalidDocument)).toBeNull()
  })

  it("preserves legacy hero provenance without fabricating approval or alt text", () => {
    const recipe = {
      id: "recipe-1",
      status: "published",
      ownerUserId: "hans",
      audienceUserIds: ["irma"],
      titleEn: "Fried rice",
      titleAf: "Gebraaide rys",
      image: {
        url: "https://images.example/hero.jpg",
        source: "Example library",
        author: "Example Author",
        license: "CC BY 4.0",
        attributionText: "Example Author, CC BY 4.0",
        retrievedAt: "2026-07-28",
      },
      ingredients: [],
      steps: [],
      createdAt: now,
      updatedAt: now,
    } satisfies RecipeRecord

    const asset = recipeHeroToReviewRequiredMedia(recipe)

    expect(asset.status).toBe("review_required")
    expect(asset.source).toMatchObject({
      type: "licensed",
      license: "CC BY 4.0",
      attributionText: "Example Author, CC BY 4.0",
    })
    expect(asset).not.toHaveProperty("altText")
    expect(recipeMediaAssetSchema.safeParse(asset).success).toBe(true)
  })

  it("normalizes a legacy relative hero URL to an internal application path", () => {
    const recipe = {
      id: "recipe-1",
      status: "published",
      ownerUserId: "hans",
      audienceUserIds: ["irma"],
      titleEn: "Fried rice",
      titleAf: "Gebraaide rys",
      image: {
        url: "images/rice.jpg",
        source: "Example library",
        license: "CC BY 4.0",
        attributionText: "Example Author, CC BY 4.0",
        retrievedAt: "2026-07-28",
      },
      ingredients: [],
      steps: [],
      createdAt: now,
      updatedAt: now,
    } satisfies RecipeRecord

    const asset = recipeHeroToReviewRequiredMedia(recipe)

    expect(asset.storage).toEqual({ type: "external", url: "/images/rice.jpg" })
    expect(recipeMediaAssetSchema.safeParse(asset).success).toBe(true)
  })

  it("marks an unsafe Windows-style legacy hero path unavailable", () => {
    const recipe = {
      id: "recipe-1",
      status: "published",
      ownerUserId: "hans",
      audienceUserIds: ["irma"],
      titleEn: "Fried rice",
      titleAf: "Gebraaide rys",
      image: {
        url: "images\\rice.jpg",
        source: "Example library",
        license: "CC BY 4.0",
        attributionText: "Example Author, CC BY 4.0",
        retrievedAt: "2026-07-28",
      },
      ingredients: [],
      steps: [],
      createdAt: now,
      updatedAt: now,
    } satisfies RecipeRecord

    const asset = recipeHeroToReviewRequiredMedia(recipe)

    expect(asset.status).toBe("unavailable")
    expect(asset).not.toHaveProperty("storage")
    expect(recipeMediaAssetSchema.safeParse(asset).success).toBe(true)
  })
})
