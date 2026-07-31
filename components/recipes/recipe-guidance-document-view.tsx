"use client"

import type {
  RecipeGuidanceBlock,
  RecipeGuidanceDocument,
  RecipeGuidanceSectionKind,
  RecipeMediaAsset,
} from "@/lib/recipe-guidance"
import type { RecipeIngredient, RecipeRecord, RecipeStep } from "@/lib/recipes"
import { CheckCircle2, Clock4, ImageOff, Info, ShieldAlert } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

export type RecipeGuidanceLanguageMode = "en" | "af" | "both"

const SECTION_LABELS: Record<RecipeGuidanceSectionKind, { en: string; af: string }> = {
  identity: { en: "Recipe overview", af: "Resep-oorsig" },
  hero: { en: "Finished dish", af: "Voltooide gereg" },
  before_start: { en: "Before you start", af: "Voor jy begin" },
  ingredients: { en: "Ingredients", af: "Bestanddele" },
  preparation: { en: "Preparation", af: "Voorbereiding" },
  cooking: { en: "Cooking", af: "Kook" },
  finish_and_serve: { en: "Finish and serve", af: "Voltooi en bedien" },
  storage_and_reheating: { en: "Storage and reheating", af: "Berging en herverhitting" },
  provenance_and_feedback: { en: "Source and feedback", af: "Bron en terugvoer" },
}

function localizedText(text: { en: string; af: string }, language: RecipeGuidanceLanguageMode) {
  if (language === "en") return <p className="whitespace-pre-line">{text.en}</p>
  if (language === "af") return <p className="whitespace-pre-line">{text.af}</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">English</p>
        <p className="whitespace-pre-line">{text.en}</p>
      </div>
      <div>
        <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">Afrikaans</p>
        <p className="whitespace-pre-line">{text.af}</p>
      </div>
    </div>
  )
}

function sectionLabel(kind: RecipeGuidanceSectionKind, language: RecipeGuidanceLanguageMode) {
  const label = SECTION_LABELS[kind]
  if (language === "en") return label.en
  if (language === "af") return label.af
  return `${label.en} / ${label.af}`
}

function ingredientLine(ingredient: RecipeIngredient) {
  return [
    ingredient.quantity,
    ingredient.unit,
    ingredient.name,
    ingredient.preparationNote ? `· ${ingredient.preparationNote}` : "",
  ]
    .filter(Boolean)
    .join(" ")
}

function timerText(minimumSeconds: number, maximumSeconds?: number) {
  const format = (seconds: number) =>
    seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} sec`
  return maximumSeconds && maximumSeconds !== minimumSeconds
    ? `${format(minimumSeconds)}–${format(maximumSeconds)}`
    : format(minimumSeconds)
}

function assetUrl(asset: RecipeMediaAsset) {
  return asset.status === "approved" ? asset.storage?.url : undefined
}

function GuidanceMedia({
  asset,
  language,
}: {
  asset: RecipeMediaAsset
  language: RecipeGuidanceLanguageMode
}) {
  const url = assetUrl(asset)
  if (!url || !asset.altText) {
    return (
      <div className="border-border bg-muted/30 text-muted-foreground flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-sm">
        <ImageOff className="h-4 w-4" />
        Media is not available in this published version.
      </div>
    )
  }

  const alt =
    language === "af"
      ? asset.altText.af
      : language === "en"
        ? asset.altText.en
        : `${asset.altText.en} / ${asset.altText.af}`

  return (
    <figure className="space-y-2">
      <Image
        src={url}
        alt={alt}
        width={960}
        height={540}
        className="border-border max-h-[28rem] w-full rounded-xl border object-cover"
      />
      {asset.source?.type === "licensed" && (
        <figcaption className="text-muted-foreground text-xs">
          {asset.source.attributionText} · {asset.source.license}
        </figcaption>
      )}
    </figure>
  )
}

function GuidanceBlock({
  block,
  recipe,
  document,
  language,
  checkedIngredients,
  toggleIngredient,
}: {
  block: RecipeGuidanceBlock
  recipe: RecipeRecord
  document: RecipeGuidanceDocument
  language: RecipeGuidanceLanguageMode
  checkedIngredients: Record<string, boolean>
  toggleIngredient: (ingredientId: string) => void
}) {
  if (block.type === "text") {
    return (
      <div className="text-foreground text-sm leading-6">{localizedText(block.text, language)}</div>
    )
  }

  if (block.type === "notice") {
    const Icon =
      block.noticeType === "safety" || block.noticeType === "allergen" ? ShieldAlert : Info
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
          <Icon className="h-4 w-4" />
          {block.noticeType.replaceAll("_", " ")}
        </p>
        <div className="text-sm leading-6">{localizedText(block.text, language)}</div>
      </div>
    )
  }

  if (block.type === "metrics") {
    return (
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {block.servings !== undefined && (
          <div className="bg-muted/40 rounded-lg p-3">
            <dt className="text-muted-foreground">Servings</dt>
            <dd className="text-foreground mt-1 font-semibold">{block.servings}</dd>
          </div>
        )}
        {block.prepMinutes !== undefined && (
          <div className="bg-muted/40 rounded-lg p-3">
            <dt className="text-muted-foreground">Preparation</dt>
            <dd className="text-foreground mt-1 font-semibold">{block.prepMinutes} min</dd>
          </div>
        )}
        {block.cookMinutes !== undefined && (
          <div className="bg-muted/40 rounded-lg p-3">
            <dt className="text-muted-foreground">Cooking</dt>
            <dd className="text-foreground mt-1 font-semibold">{block.cookMinutes} min</dd>
          </div>
        )}
      </dl>
    )
  }

  if (block.type === "ingredient_references") {
    const ingredientsById = new Map(
      recipe.ingredients.map((ingredient) => [ingredient.id, ingredient])
    )
    return (
      <ul className="space-y-2">
        {block.ingredientIds.map((ingredientId) => {
          const ingredient = ingredientsById.get(ingredientId)
          if (!ingredient) return null
          return (
            <li key={ingredient.id}>
              <label className="border-border flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(checkedIngredients[ingredient.id])}
                  onChange={() => toggleIngredient(ingredient.id)}
                  className="mt-0.5 h-4 w-4"
                />
                <span
                  className={
                    checkedIngredients[ingredient.id] ? "text-muted-foreground line-through" : ""
                  }
                >
                  {ingredientLine(ingredient)}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    )
  }

  if (block.type === "step_reference") {
    const step = recipe.steps.find((candidate) => candidate.id === block.recipeStepId)
    if (!step) return null
    return <GuidanceStep step={step} block={block} language={language} />
  }

  const asset = document.mediaAssets.find((candidate) => candidate.id === block.mediaAssetId)
  return asset ? <GuidanceMedia asset={asset} language={language} /> : null
}

function GuidanceStep({
  step,
  block,
  language,
}: {
  step: RecipeStep
  block: Extract<RecipeGuidanceBlock, { type: "step_reference" }>
  language: RecipeGuidanceLanguageMode
}) {
  const text = {
    en: step.instructionEn,
    af: step.instructionAf,
  }
  return (
    <div className="border-border rounded-xl border p-4">
      <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
        Step {step.order}
      </p>
      <div className="text-sm leading-6">{localizedText(text, language)}</div>
      {block.timer && (
        <p className="text-muted-foreground mt-3 inline-flex items-center gap-2 text-xs">
          <Clock4 className="h-3.5 w-3.5" />
          {timerText(block.timer.minimumSeconds, block.timer.maximumSeconds)}
        </p>
      )}
    </div>
  )
}

export function RecipeGuidanceDocumentView({
  document,
  recipe,
  language,
  heading,
}: {
  document: RecipeGuidanceDocument
  recipe: RecipeRecord
  language: RecipeGuidanceLanguageMode
  heading?: string
}) {
  const [ingredientChecks, setIngredientChecks] = useState<{
    recipeId: string
    values: Record<string, boolean>
  }>({ recipeId: recipe.id, values: {} })
  const checkedIngredients = ingredientChecks.recipeId === recipe.id ? ingredientChecks.values : {}

  return (
    <article
      className="border-border bg-card overflow-hidden rounded-2xl border"
      data-testid="recipe-guidance-document"
    >
      <header className="border-border bg-primary/5 border-b p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
              {heading ?? "Kitchen guidance"}
            </p>
            <h2 className="text-foreground mt-2 text-2xl font-semibold sm:text-3xl">
              {language === "af"
                ? recipe.titleAf
                : language === "en"
                  ? recipe.titleEn
                  : `${recipe.titleEn} / ${recipe.titleAf}`}
            </h2>
          </div>
          <span className="border-border bg-background rounded-full border px-3 py-1 text-xs font-medium uppercase">
            v{document.version} · {document.status.replace("_", " ")}
          </span>
        </div>
        {document.status === "published" && (
          <p className="mt-3 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Reviewed and published for this recipe revision
          </p>
        )}
      </header>

      <div className="divide-border divide-y">
        {document.sections
          .filter((section) => section.applicability !== "not_applicable")
          .map((section) => (
            <section key={section.id} className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-foreground text-lg font-semibold">
                  {sectionLabel(section.kind, language)}
                </h3>
                {section.applicability === "optional" && (
                  <span className="text-muted-foreground text-xs uppercase">Optional</span>
                )}
              </div>
              {section.blocks.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No reviewed guidance in this section.
                </p>
              ) : (
                <div className="space-y-4">
                  {section.blocks.map((block) => (
                    <GuidanceBlock
                      key={block.id}
                      block={block}
                      recipe={recipe}
                      document={document}
                      language={language}
                      checkedIngredients={checkedIngredients}
                      toggleIngredient={(ingredientId) =>
                        setIngredientChecks((current) => ({
                          recipeId: recipe.id,
                          values: {
                            ...(current.recipeId === recipe.id ? current.values : {}),
                            [ingredientId]: !(
                              current.recipeId === recipe.id && current.values[ingredientId]
                            ),
                          },
                        }))
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
      </div>
    </article>
  )
}
