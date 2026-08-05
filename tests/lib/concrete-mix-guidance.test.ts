import { describe, it, expect } from "vitest"
import { calculateConcreteMix, validateConcreteMixInput } from "@/lib/concrete-mix"
import type { ConcreteMixResult } from "@/lib/concrete-mix"
import { concreteMixToGuidanceDraft } from "@/lib/concrete-mix-guidance"
import {
  GUIDANCE_LOCALES,
  hasGuidanceSafetyBoundaries,
  parseGuidanceDraft,
  type GuidanceLocale,
} from "@/lib/guidance"

function batch(body: Record<string, unknown> = {}): ConcreteMixResult {
  const validation = validateConcreteMixInput({
    presetId: "square-400",
    slabCount: 50,
    wastePercent: 0,
    ...body,
  })
  if (!validation.ok) throw new Error(validation.error)
  return calculateConcreteMix(validation.value)
}

function draft(body: Record<string, unknown> = {}, locale: GuidanceLocale = "en") {
  return concreteMixToGuidanceDraft(batch(body), locale)
}

function stepTitles(body: Record<string, unknown> = {}): string[] {
  return draft(body).steps.map((step) => step.title)
}

describe("concreteMixToGuidanceDraft schema conformance", () => {
  it.each(GUIDANCE_LOCALES)("produces a draft the guidance schema accepts in %s", (locale) => {
    expect(parseGuidanceDraft(draft({}, locale))).not.toBeNull()
  })

  it("satisfies the safety boundary rule the guidance API enforces", () => {
    for (const locale of GUIDANCE_LOCALES) {
      const built = draft({}, locale)
      expect(built.safety.length).toBeGreaterThan(0)
      expect(hasGuidanceSafetyBoundaries(built)).toBe(true)
    }
  })

  it("stays inside the step and timer ceilings on the busiest batch", () => {
    const busiest = draft({
      mixDesignId: "paver-30",
      castMethodId: "dry",
      reinforcement: "mesh",
      admixtures: ["plasticizer", "waterproofer"],
      mixerCapacityM3: 0.15,
    })

    expect(busiest.steps.length).toBeLessThanOrEqual(20)
    for (const step of busiest.steps) {
      expect(step.title.length).toBeLessThanOrEqual(120)
      expect(step.instruction.length).toBeLessThanOrEqual(1500)
      if (step.timerMinutes !== undefined) {
        expect(step.timerMinutes).toBeGreaterThan(0)
        expect(step.timerMinutes).toBeLessThanOrEqual(1440)
      }
    }
    expect(parseGuidanceDraft(busiest)).not.toBeNull()
  })

  it("numbers the steps from one without gaps", () => {
    const built = draft()

    expect(built.steps.map((step) => step.order)).toEqual(
      built.steps.map((_step, index) => index + 1)
    )
  })

  it("is a procedure, not a recipe, and carries no recipe provenance", () => {
    const built = draft()

    expect(built.kind).toBe("procedure")
    expect(built.sourceRecipeId).toBeUndefined()
    expect(built.sourceRecipeRevisionId).toBeUndefined()
  })
})

describe("concreteMixToGuidanceDraft content", () => {
  it("states the pigment per mixer load when the batch has a mixer plan", () => {
    const withMixer = draft({ mixerCapacityM3: 0.15 })
    const withoutMixer = draft()

    // One 0.15 m3 load carries 3 375 g; the whole batch carries 7 200 g.
    expect(withMixer.steps[1].instruction).toContain("3375 g")
    expect(withMixer.steps[1].instruction).toContain("per mixer load")
    expect(withoutMixer.steps[1].instruction).toContain("7200 g")
    expect(withoutMixer.steps[1].instruction).toContain("for the whole batch")
  })

  it("warns about weighing on the pigment step, which is the batch's weak point", () => {
    const built = draft()
    const pigmentStep = built.steps.find((step) => step.title === "Weigh the pigment")

    expect(pigmentStep?.warning).toContain("by eye")
    expect(pigmentStep?.instruction).toContain("do not measure it with a scoop")
  })

  it("mentions stone only for a mix that has any", () => {
    expect(stepTitles()).toContain("Blend the dry materials")
    expect(draft().steps[2].instruction).not.toContain("kg of stone")
    expect(draft({ mixDesignId: "paver-25" }).steps[2].instruction).toContain("kg of stone")
  })

  it("swaps the wet steps for the dry ones and adds the vibrating table", () => {
    const wet = draft()
    const dry = draft({ castMethodId: "dry" })

    expect(stepTitles()).toContain("Add the water")
    expect(dry.steps.map((step) => step.title)).toContain("Damp the mix down")
    expect(dry.steps.map((step) => step.title)).toContain("Press and vibrate")
    expect(dry.tools).toContain("Vibrating table")
    expect(wet.tools).not.toContain("Vibrating table")
  })

  it("adds a step for fiber, for mesh and for admixtures only when they are used", () => {
    expect(stepTitles()).not.toContain("Add the fiber")
    expect(stepTitles({ reinforcement: "fiber" })).toContain("Add the fiber")
    expect(stepTitles({ reinforcement: "mesh" })).toContain("Cut and place the mesh")
    expect(stepTitles({ admixtures: ["plasticizer"] })).toContain("Add the admixtures")
    expect(stepTitles({ reinforcement: "fiber" })).not.toContain("Cut and place the mesh")
  })

  it("names the admixtures actually chosen", () => {
    const built = draft({ admixtures: ["plasticizer", "waterproofer"] })
    const step = built.steps.find((entry) => entry.title === "Add the admixtures")

    expect(step?.instruction).toContain("plasticizer")
    expect(step?.instruction).toContain("integral waterproofer")
  })

  it("times the strip to the cast method", () => {
    const wetStrip = draft().steps.find((step) => step.title === "Strip the moulds")
    const dryStrip = draft({ castMethodId: "dry" }).steps.find(
      (step) => step.title === "Strip the moulds"
    )

    expect(wetStrip?.timerMinutes).toBe(1440)
    expect(dryStrip?.timerMinutes).toBe(60)
    expect(dryStrip?.timer).toEqual({ minimumSeconds: 3600 })
  })

  it("sets the cure timer to one day and says the cure runs longer", () => {
    const cure = draft().steps.find((step) => step.title === "Keep them damp")

    // The schema caps a timer at 1440 minutes, so a 7 day cure cannot be one.
    expect(cure?.timerMinutes).toBe(1440)
    expect(cure?.instruction).toContain("7 days")
    expect(cure?.instruction).toContain("not for the whole cure")
  })

  it("lists what to buy, not what the mix consumes", () => {
    const built = draft()

    expect(built.materials).toContain("3 50 kg bags - cement")
    expect(built.materials).toContain("8 kg - oxide pigment")
  })

  it("summarizes the mix, colour and slab size", () => {
    const built = draft({ colorIntensityId: "dark" })

    expect(built.title).toBe("Cast 50 garden stones")
    expect(built.summary).toContain("Garden stone mortar")
    expect(built.summary).toContain("8% of cement mass")
    expect(built.summary).toContain("400 x 400 x 40 mm")
  })

  it("puts the finished stone's real weight in the lifting warning", () => {
    const built = draft()

    expect(built.safety.some((entry) => entry.includes("13.75 kg"))).toBe(true)
  })
})

describe("concreteMixToGuidanceDraft localization", () => {
  it("translates every step, tool and safety line into Afrikaans", () => {
    const english = draft({}, "en")
    const afrikaans = draft({}, "af")

    expect(afrikaans.locale).toBe("af")
    expect(afrikaans.title).not.toBe(english.title)
    expect(afrikaans.steps).toHaveLength(english.steps.length)

    for (let index = 0; index < english.steps.length; index += 1) {
      expect(afrikaans.steps[index].title).not.toBe(english.steps[index].title)
      expect(afrikaans.steps[index].instruction).not.toBe(english.steps[index].instruction)
    }
    for (let index = 0; index < english.safety.length; index += 1) {
      expect(afrikaans.safety[index]).not.toBe(english.safety[index])
    }
    for (let index = 0; index < english.tools.length; index += 1) {
      expect(afrikaans.tools[index]).not.toBe(english.tools[index])
    }
  })

  it("keeps the numbers identical across locales", () => {
    const english = draft({ mixerCapacityM3: 0.15 }, "en")
    const afrikaans = draft({ mixerCapacityM3: 0.15 }, "af")

    expect(afrikaans.steps[1].instruction).toContain("3375 g")
    expect(english.steps[1].instruction).toContain("3375 g")
    expect(afrikaans.steps.map((step) => step.timerMinutes)).toEqual(
      english.steps.map((step) => step.timerMinutes)
    )
  })

  /* cspell:disable-next-line */
  it("translates the material names and the unit nouns", () => {
    const afrikaans = draft({}, "af")

    /* cspell:disable */
    expect(afrikaans.materials).toContain("3 50 kg sakke - sement")
    expect(afrikaans.materials).toContain("8 kg - oksiedpigment")
    /* cspell:enable */
  })

  it("leaves no untranslated placeholder in either locale", () => {
    for (const locale of GUIDANCE_LOCALES) {
      const built = draft({ reinforcement: "mesh", admixtures: ["plasticizer"] }, locale)
      const allText = [
        built.title,
        built.summary,
        ...built.safety,
        ...built.tools,
        ...built.steps.flatMap((step) => [step.title, step.instruction, step.check, step.warning]),
      ]
        .filter(Boolean)
        .join(" ")

      expect(allText).not.toMatch(/\{\w+\}/)
    }
  })
})
