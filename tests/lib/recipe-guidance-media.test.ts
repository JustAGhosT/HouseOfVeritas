import { describe, expect, it } from "vitest"
import { buildRecipeGuidanceDraft } from "@/lib/recipe-guidance-builder"
import {
  attachRecipeGuidanceUpload,
  planRecipeGuidanceMedia,
  reviewRecipeImageBrief,
} from "@/lib/recipe-guidance-media"
import type { RecipeRecord } from "@/lib/recipes"

const recipe: RecipeRecord = {
  id: "recipe-media",
  status: "published",
  ownerUserId: "hans",
  audienceUserIds: ["hans", "irma"],
  titleEn: "Garden stew",
  titleAf: "Tuinbredie",
  image: {
    url: "https://images.example/stew.jpg",
    source: "Example library",
    license: "CC BY 4.0",
    attributionText: "Example photographer",
    retrievedAt: "2026-07-31",
  },
  ingredients: [
    { id: "ingredient-carrot", name: "Carrots" },
    { id: "ingredient-potato", name: "Potatoes" },
  ],
  steps: [
    {
      id: "step-simmer",
      order: 1,
      instructionEn: "Simmer until tender.",
      instructionAf: "Prut tot sag.",
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

describe("recipe guidance media planning", () => {
  it("creates deterministic draft briefs and planned assets for missing section slots", () => {
    const result = planRecipeGuidanceMedia(draft, recipe, "2026-07-31T08:06:00.000Z")

    expect(result).not.toBeNull()
    expect(result?.addedAssetIds).toHaveLength(5)
    expect(result?.document.imageBriefs).toHaveLength(5)
    expect(result?.document.mediaAssets).toHaveLength(6)
    expect(result?.document.imageBriefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "ingredient_layout", status: "draft" }),
        expect.objectContaining({ role: "step", status: "draft" }),
        expect.objectContaining({ role: "serving", status: "draft" }),
        expect.objectContaining({ role: "storage", status: "draft" }),
      ])
    )
    expect(
      result?.document.sections
        .flatMap((section) => section.blocks)
        .filter((block) => block.type === "media_reference")
    ).toHaveLength(6)
  })

  it("is idempotent when every deterministic media slot already exists", () => {
    const first = planRecipeGuidanceMedia(draft, recipe, "2026-07-31T08:06:00.000Z")!
    const second = planRecipeGuidanceMedia(first.document, recipe, "2026-07-31T08:07:00.000Z")

    expect(second?.addedAssetIds).toEqual([])
    expect(second?.document.mediaAssets).toHaveLength(first.document.mediaAssets.length)
    expect(second?.document.imageBriefs).toHaveLength(first.document.imageBriefs.length)
  })

  it("reuses an existing matching brief when its media asset is missing", () => {
    const ingredients = draft.sections.find((section) => section.kind === "ingredients")!
    const existingBrief = {
      id: `${ingredients.id}:existing-brief`,
      sectionId: ingredients.id,
      role: "ingredient_layout" as const,
      status: "draft" as const,
      description: { en: "Reviewed ingredient plan", af: "Nagegane bestanddeelplan" },
      reviewedFacts: [],
      excludedContent: [],
    }

    const result = planRecipeGuidanceMedia(
      { ...draft, imageBriefs: [existingBrief] },
      recipe,
      "2026-07-31T08:06:00.000Z"
    )

    expect(
      result?.document.imageBriefs.filter((brief) => brief.id === existingBrief.id)
    ).toHaveLength(1)
    expect(result?.document.mediaAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionId: ingredients.id,
          role: "ingredient_layout",
          imageBriefId: existingBrief.id,
        }),
      ])
    )
  })

  it("attaches a private upload with server-owned provenance, hash, and restored reference", () => {
    const planned = planRecipeGuidanceMedia(draft, recipe, "2026-07-31T08:06:00.000Z")!
    const target = planned.document.mediaAssets.find((asset) => asset.status === "planned")!
    const withoutReference = {
      ...planned.document,
      sections: planned.document.sections.map((section) => ({
        ...section,
        blocks: section.blocks.filter(
          (block) => block.type !== "media_reference" || block.mediaAssetId !== target.id
        ),
      })),
    }

    const attached = attachRecipeGuidanceUpload(withoutReference, {
      mediaAssetId: target.id,
      upload: {
        id: "file_recipe_photo",
        uploadedBy: "hans",
        uploadedAt: new Date("2026-07-31T08:06:30.000Z"),
      },
      contentHash: `sha256:${"a".repeat(64)}`,
      rightsBasis: "Estate-owned photograph",
      attributionText: "Photograph by Hans",
      now: "2026-07-31T08:07:00.000Z",
    })

    expect(attached).not.toBeNull()
    expect(attached?.mediaAssets.find((asset) => asset.id === target.id)).toMatchObject({
      status: "review_required",
      source: {
        type: "uploaded",
        uploadId: "file_recipe_photo",
        uploadedBy: "hans",
        rightsBasis: "Estate-owned photograph",
        attributionText: "Photograph by Hans",
      },
      storage: {
        type: "hov",
        storageId: "file_recipe_photo",
        url: "/api/uploads/file_recipe_photo",
        contentHash: `sha256:${"a".repeat(64)}`,
      },
    })
    expect(
      attached?.sections
        .flatMap((section) => section.blocks)
        .some((block) => block.type === "media_reference" && block.mediaAssetId === target.id)
    ).toBe(true)
  })

  it("does not replace approved media through intake", () => {
    const approvedHero = {
      ...draft,
      mediaAssets: draft.mediaAssets.map((asset) => ({
        ...asset,
        status: "approved" as const,
        altText: { en: "Stew", af: "Bredie" },
        reviewedBy: "hans",
        reviewedAt: "2026-07-31T08:06:00.000Z",
      })),
    }

    expect(
      attachRecipeGuidanceUpload(approvedHero, {
        mediaAssetId: approvedHero.mediaAssets[0]!.id,
        upload: {
          id: "file_replacement",
          uploadedBy: "hans",
          uploadedAt: new Date("2026-07-31T08:06:30.000Z"),
        },
        contentHash: `sha256:${"b".repeat(64)}`,
        rightsBasis: "Estate-owned photograph",
        attributionText: "Photograph by Hans",
        now: "2026-07-31T08:07:00.000Z",
      })
    ).toBeNull()
  })

  it("edits, approves, and rejects image briefs with server-owned review evidence", () => {
    const planned = planRecipeGuidanceMedia(draft, recipe, "2026-07-31T08:06:00.000Z")!.document
    const brief = planned.imageBriefs[0]!
    const edited = reviewRecipeImageBrief(planned, {
      update: {
        action: "edit",
        briefId: brief.id,
        description: { en: "Reviewed English brief", af: "Nagegane Afrikaanse opdrag" },
        reviewedFacts: ["Canonical ingredient: carrots"],
        excludedContent: ["No text overlays"],
      },
      reviewerUserId: "ignored-for-edit",
      now: "2026-07-31T08:07:00.000Z",
    })!
    expect(edited.imageBriefs[0]).toMatchObject({
      status: "draft",
      description: { en: "Reviewed English brief", af: "Nagegane Afrikaanse opdrag" },
    })

    const approved = reviewRecipeImageBrief(edited, {
      update: { action: "approve", briefId: brief.id },
      reviewerUserId: "hans",
      now: "2026-07-31T08:08:00.000Z",
    })!
    expect(approved.imageBriefs[0]).toMatchObject({
      status: "approved",
      approvedBy: "hans",
      approvedAt: "2026-07-31T08:08:00.000Z",
    })
    expect(
      reviewRecipeImageBrief(approved, {
        update: { action: "approve", briefId: brief.id },
        reviewerUserId: "hans",
        now: "2026-07-31T08:09:00.000Z",
      })
    ).toBeNull()

    const ungrounded = reviewRecipeImageBrief(planned, {
      update: {
        action: "edit",
        briefId: brief.id,
        description: brief.description,
        reviewedFacts: [],
        excludedContent: [],
      },
      reviewerUserId: "hans",
      now: "2026-07-31T08:07:00.000Z",
    })!
    expect(
      reviewRecipeImageBrief(ungrounded, {
        update: { action: "approve", briefId: brief.id },
        reviewerUserId: "hans",
        now: "2026-07-31T08:08:00.000Z",
      })
    ).toBeNull()

    const rejected = reviewRecipeImageBrief(edited, {
      update: { action: "reject", briefId: brief.id, rejectionReason: "Unsafe composition" },
      reviewerUserId: "hans",
      now: "2026-07-31T08:08:00.000Z",
    })!
    expect(rejected.imageBriefs[0]).toMatchObject({
      status: "rejected",
      rejectedBy: "hans",
      rejectionReason: "Unsafe composition",
    })
  })
})
