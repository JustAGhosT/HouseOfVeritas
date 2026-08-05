/**
 * Turns a calculated batch into a step-by-step casting procedure.
 *
 * This is where the calculator stops being a number and becomes the job. The
 * output is a `GuidanceDraft` of kind "procedure", which the existing guidance
 * system binds to a task and renders on a phone at the mixer, in English or
 * Afrikaans.
 *
 * Pure: no network, no clock, no persistence. The caller binds the draft to a
 * task through `POST /api/guidance`.
 *
 * One constraint shapes the output: `timerMinutes` is capped at 1440, so the
 * seven-day cure cannot be a single timer. It is a 24-hour damp-down timer that
 * the operator restarts each day, which is the more useful reminder anyway.
 */

import type { ConcreteMixResult, MaterialId, MaterialLine } from "@/lib/concrete-mix"
import type { GuidanceDraft, GuidanceLocale, GuidanceStepDraft } from "@/lib/guidance"

/** The guidance schema's ceiling on a single timer. */
const MAX_TIMER_MINUTES = 1440
const CURE_DAYS = 7
const MAX_STEPS = 20

type Phrase = Record<GuidanceLocale, string>

function phrase(en: string, af: string): Phrase {
  return { en, af }
}

/* cspell:disable */
const COPY = {
  title: phrase("Cast {count} garden stones", "Giet {count} tuinklippe"),
  summary: phrase(
    "{mix}, {cast}, pigment at {dosage}% of cement mass. Makes {count} stones of {length} x {width} x {thickness} mm. Mix {volume} m3 in total.",
    "{mix}, {cast}, pigment teen {dosage}% van die sementmassa. Maak {count} klippe van {length} x {width} x {thickness} mm. Meng {volume} m3 in totaal."
  ),
  scopeLoad: phrase("per mixer load", "per mengerlading"),
  scopeBatch: phrase("for the whole batch", "vir die hele lading"),

  mouldsTitle: phrase("Prepare the moulds", "Berei die vorms voor"),
  mouldsInstruction: phrase(
    "Set the moulds out on a level surface and coat every face with release oil. A mould left dry will hold on to the stone and break it when you strip it.",
    "Pak die vorms op 'n gelyk oppervlak uit en smeer elke kant met losmaakolie. 'n Vorm wat droog bly, hou aan die klip vas en breek dit wanneer jy dit afslaan."
  ),
  mouldsCheck: phrase(
    "Every inside face looks wet with oil, with no dry patches in the corners.",
    "Elke binnekant lyk nat van die olie, met geen droë kolle in die hoeke nie."
  ),

  pigmentTitle: phrase("Weigh the pigment", "Weeg die pigment"),
  pigmentInstruction: phrase(
    "Weigh out {pigment} g of oxide pigment {scope}. Put it on a scale; do not measure it with a scoop or a tin.",
    "Weeg {pigment} g oksiedpigment {scope} af. Sit dit op 'n skaal; moenie dit met 'n skepper of blik meet nie."
  ),
  pigmentWarning: phrase(
    "Dosing pigment by eye is the single most common reason a batch comes out in visibly different shades. Weigh every load the same.",
    "Om pigment met die oog te doseer is verreweg die algemeenste rede waarom 'n lading in sigbaar verskillende skakerings uitkom. Weeg elke lading dieselfde."
  ),

  blendTitle: phrase("Blend the dry materials", "Meng die droë materiaal"),
  blendInstruction: phrase(
    "Turn {cement} kg of cement, {sand} kg of sand{stone} and the pigment together dry {scope}. Keep going until the colour is even right through.",
    "Meng {cement} kg sement, {sand} kg sand{stone} en die pigment droog deurmekaar {scope}. Hou aan totdat die kleur heeltemal deur egalig is."
  ),
  blendStone: phrase(" and {stone} kg of stone", " en {stone} kg klip"),
  blendCheck: phrase(
    "No streaks or darker pockets left when you turn the heap over.",
    "Geen strepe of donkerder kolle oor wanneer jy die hoop omkeer nie."
  ),
  blendWarning: phrase(
    "Wear a dust mask. Dry cement and pigment throw fine dust that you should not be breathing.",
    "Dra 'n stofmasker. Droë sement en pigment gooi fyn stof op wat jy nie moet inasem nie."
  ),

  waterWetTitle: phrase("Add the water", "Voeg die water by"),
  waterWetInstruction: phrase(
    "Add {water} litres of clean water {scope}, a little at a time. Stop at a mix that flows off the spade but does not run. Extra water past this point lightens the colour and weakens the stone.",
    "Voeg {water} liter skoon water {scope} by, bietjie vir bietjie. Hou op by 'n mengsel wat van die graaf afgly maar nie loop nie. Ekstra water hierna maak die kleur ligter en die klip swakker."
  ),
  waterDryTitle: phrase("Damp the mix down", "Maak die mengsel klam"),
  waterDryInstruction: phrase(
    "Add {water} litres of clean water {scope}. A semi-dry mix should look like damp earth, not like concrete. Squeeze a handful: it must hold its shape and not wet your palm.",
    "Voeg {water} liter skoon water {scope} by. 'n Halfdroë mengsel moet soos klam grond lyk, nie soos beton nie. Druk 'n handvol saam: dit moet sy vorm hou en nie jou handpalm natmaak nie."
  ),

  fiberTitle: phrase("Add the fiber", "Voeg die vesel by"),
  fiberInstruction: phrase(
    "Scatter the polypropylene fiber in slowly with the mixer running, so it opens up instead of balling. Give it two more minutes after the last of it goes in.",
    "Strooi die polipropileenvesel stadig in terwyl die menger loop, sodat dit oopmaak in plaas van bondel. Gee dit nog twee minute nadat die laaste ingegaan het."
  ),
  meshTitle: phrase("Cut and place the mesh", "Sny en plaas die net"),
  meshInstruction: phrase(
    "Cut the mesh about 30 mm smaller than the mould on every side so it does not touch the edge. It goes in at half depth, after the first pour and before the second.",
    "Sny die net omtrent 30 mm kleiner as die vorm aan elke kant sodat dit nie aan die rand raak nie. Dit gaan op halfdiepte in, na die eerste gietsel en voor die tweede."
  ),
  admixtureTitle: phrase("Add the admixtures", "Voeg die bymiddels by"),
  admixtureInstruction: phrase(
    "Stir the admixtures into the mixing water before it goes in, never onto the dry heap: {admixtures}.",
    "Roer die bymiddels in die mengwater in voordat dit ingaan, nooit op die droë hoop nie: {admixtures}."
  ),

  fillWetTitle: phrase("Fill and compact", "Vul en kompakteer"),
  fillWetInstruction: phrase(
    "Fill each mould in two goes. Rod or vibrate after each one until the surface goes glossy and the bubbles stop rising.",
    "Vul elke vorm in twee slae. Stamp of vibreer na elkeen totdat die oppervlak blink word en die borrels ophou opkom."
  ),
  fillDryTitle: phrase("Press and vibrate", "Pers en vibreer"),
  fillDryInstruction: phrase(
    "Heap each mould slightly over full and run it on the vibrating table under pressure until the mix settles level and the face closes up.",
    "Hoop elke vorm effens oorvol op en laat dit onder druk op die vibreertafel loop totdat die mengsel gelyk sak en die oppervlak toemaak."
  ),
  fillWarning: phrase(
    "Wear eye protection while the table or mixer is running.",
    "Dra oogbeskerming terwyl die tafel of menger loop."
  ),

  finishTitle: phrase("Finish the face", "Werk die oppervlak af"),
  finishInstruction: phrase(
    "Strike the top off level with a straight edge, then leave it alone. Working the face over and over draws cement to the surface and it dries out paler there.",
    "Stryk die bokant gelyk af met 'n reguit lat en los dit dan uit. Om die oppervlak oor en oor te werk trek sement na bo en dit droog daar ligter uit."
  ),

  stripTitle: phrase("Strip the moulds", "Slaan die vorms af"),
  stripInstruction: phrase(
    "Leave the stones in the moulds for {stripHours} hours, then turn each one out onto a flat, shaded surface. Support the whole face as it comes out; a green stone snaps easily.",
    "Los die klippe {stripHours} uur in die vorms, keer dan elkeen uit op 'n plat plek in die skaduwee. Ondersteun die hele oppervlak soos dit uitkom; 'n groen klip breek maklik."
  ),

  cureTitle: phrase("Keep them damp", "Hou hulle klam"),
  cureInstruction: phrase(
    "Wet the stones down and cover them with plastic. Do this again every day for {cureDays} days. The timer is set for the next damp-down, not for the whole cure.",
    "Maak die klippe nat en dek hulle met plastiek toe. Doen dit elke dag weer vir {cureDays} dae. Die tydhouer is vir die volgende natmaak, nie vir die hele uithardingstyd nie."
  ),
  cureWarning: phrase(
    "Stones left to dry out in the sun in the first week come out pale, chalky and weak, and nothing afterwards fixes it.",
    "Klippe wat in die eerste week in die son uitdroog, kom bleek, kalkerig en swak uit, en niks daarna maak dit reg nie."
  ),

  sealTitle: phrase("Seal the stones", "Seël die klippe"),
  sealInstruction: phrase(
    "Once they are properly dry, after about four weeks, seal them. Unsealed pigmented concrete fades in direct sun and shows white efflorescence.",
    "Sodra hulle behoorlik droog is, na omtrent vier weke, seël hulle. Ongeseëlde gekleurde beton verbleik in direkte son en wys wit uitslag."
  ),

  safetyCement: phrase(
    "Wet cement is caustic and burns skin on long contact. Wear gloves and gumboots, and rinse any splash off straight away.",
    "Nat sement is bytend en brand die vel met lang kontak. Dra handskoene en rubberstewels, en spoel enige spatsel dadelik af."
  ),
  safetyDust: phrase(
    "Dry cement and oxide pigment raise fine dust. Wear a dust mask and mix outdoors or with the doors open.",
    "Droë sement en oksiedpigment maak fyn stof. Dra 'n stofmasker en meng buite of met die deure oop."
  ),
  safetyLifting: phrase(
    "A finished stone weighs about {slabMass} kg. Move them on a barrow, and lift the heavy ones with two people.",
    "'n Klaar klip weeg omtrent {slabMass} kg. Vervoer hulle op 'n kruiwa, en tel die swaarstes met twee mense op."
  ),
  safetyMixer: phrase(
    "Never put a hand or a spade into a running mixer.",
    "Sit nooit 'n hand of 'n graaf in 'n lopende menger nie."
  ),

  toolMixer: phrase("Concrete mixer or mixing barrow", "Betonmenger of mengkruiwa"),
  toolScale: phrase(
    "Kitchen or platform scale reading to 1 g",
    "Kombuis- of platformskaal wat tot 1 g lees"
  ),
  toolMoulds: phrase("Stone moulds", "Klipvorms"),
  toolOil: phrase("Mould release oil", "Vormlosmaakolie"),
  toolTrowel: phrase("Trowel and straight edge", "Troffel en reguit lat"),
  toolTable: phrase("Vibrating table", "Vibreertafel"),
  toolBucket: phrase("Measuring bucket and watering can", "Maatemmer en gieter"),
  toolPpe: phrase(
    "Gloves, dust mask and eye protection",
    "Handskoene, stofmasker en oogbeskerming"
  ),
  toolPlastic: phrase("Plastic sheeting for curing", "Plastiek om mee uit te hard"),
} as const
/* cspell:enable */

/* cspell:disable */
const MATERIAL_NAMES: Record<MaterialId, Phrase> = {
  cement: phrase("cement", "sement"),
  sand: phrase("sand", "sand"),
  stone: phrase("stone", "klip"),
  water: phrase("clean water", "skoon water"),
  pigment: phrase("oxide pigment", "oksiedpigment"),
  fiber: phrase("polypropylene micro-fiber", "polipropileen mikrovesel"),
  mesh: phrase("welded reinforcing mesh", "gelaste bewapeningsnet"),
  plasticizer: phrase("plasticizer", "plastiseerder"),
  waterproofer: phrase("integral waterproofer", "integrale waterdigmaker"),
}

/** Only the unit nouns need translating; the numbers and symbols carry over. */
const UNIT_WORDS: Record<string, Phrase> = {
  bags: phrase("bags", "sakke"),
  sheets: phrase("sheets", "velle"),
  litres: phrase("litres", "liter"),
}
/* cspell:enable */

function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  )
}

function translateUnit(unit: string, locale: GuidanceLocale): string {
  let translated = unit
  for (const [word, phrases] of Object.entries(UNIT_WORDS)) {
    translated = translated.replace(word, phrases[locale])
  }
  return translated
}

function materialEntry(line: MaterialLine, locale: GuidanceLocale): string {
  const name = MATERIAL_NAMES[line.material][locale]
  return `${line.purchaseQuantity} ${translateUnit(line.purchaseUnit, locale)} - ${name}`
}

interface StepSeed {
  title: Phrase
  instruction: string
  visualCue?: string
  check?: string
  warning?: string
  timerMinutes?: number
}

function toStep(seed: StepSeed, order: number, locale: GuidanceLocale): GuidanceStepDraft {
  return {
    order,
    title: seed.title[locale],
    instruction: seed.instruction,
    check: seed.check,
    warning: seed.warning,
    timerMinutes: seed.timerMinutes,
    timer: seed.timerMinutes === undefined ? undefined : { minimumSeconds: seed.timerMinutes * 60 },
  }
}

/**
 * Builds the casting procedure for a calculated batch.
 *
 * Quantities are stated per mixer load when the batch carries a mixer plan,
 * because that is what actually gets weighed out, and for the whole batch
 * otherwise.
 */
export function concreteMixToGuidanceDraft(
  result: ConcreteMixResult,
  locale: GuidanceLocale
): GuidanceDraft {
  const t = (key: keyof typeof COPY, vars: Record<string, string | number> = {}) =>
    format(COPY[key][locale], vars)

  const load = result.mixerPlan?.fullLoad
  const scope = load ? COPY.scopeLoad[locale] : COPY.scopeBatch[locale]
  const required = (material: MaterialId): number =>
    result.materials.find((line) => line.material === material)?.requiredQuantity ?? 0

  const cementKg = load ? load.cementKg : required("cement")
  const sandKg = load ? load.sandKg : required("sand")
  const stoneKg = load ? load.stoneKg : required("stone")
  const waterLitres = load ? load.waterLitres : required("water")
  const pigmentGrams = load ? load.pigmentGrams : Math.round(result.pigment.totalKg * 1000)

  const isDry = result.castMethod.id === "dry"
  const seeds: StepSeed[] = [
    {
      title: COPY.mouldsTitle,
      instruction: t("mouldsInstruction"),
      check: t("mouldsCheck"),
    },
    {
      title: COPY.pigmentTitle,
      instruction: t("pigmentInstruction", { pigment: pigmentGrams, scope }),
      warning: t("pigmentWarning"),
    },
    {
      title: COPY.blendTitle,
      instruction: t("blendInstruction", {
        cement: cementKg,
        sand: sandKg,
        scope,
        stone: stoneKg > 0 ? t("blendStone", { stone: stoneKg }) : "",
      }),
      check: t("blendCheck"),
      warning: t("blendWarning"),
    },
    {
      title: isDry ? COPY.waterDryTitle : COPY.waterWetTitle,
      instruction: isDry
        ? t("waterDryInstruction", { water: waterLitres, scope })
        : t("waterWetInstruction", { water: waterLitres, scope }),
    },
  ]

  if (result.reinforcement === "fiber") {
    seeds.push({ title: COPY.fiberTitle, instruction: t("fiberInstruction") })
  }
  if (result.reinforcement === "mesh") {
    seeds.push({ title: COPY.meshTitle, instruction: t("meshInstruction") })
  }
  if (result.admixtures.length > 0) {
    seeds.push({
      title: COPY.admixtureTitle,
      instruction: t("admixtureInstruction", {
        admixtures: result.admixtures
          .map((admixture) => MATERIAL_NAMES[admixture][locale])
          .join(", "),
      }),
    })
  }

  seeds.push(
    {
      title: isDry ? COPY.fillDryTitle : COPY.fillWetTitle,
      instruction: isDry ? t("fillDryInstruction") : t("fillWetInstruction"),
      warning: t("fillWarning"),
    },
    { title: COPY.finishTitle, instruction: t("finishInstruction") },
    {
      title: COPY.stripTitle,
      instruction: t("stripInstruction", { stripHours: result.castMethod.stripHours }),
      // stripHours never exceeds 24, so this always fits the timer ceiling.
      timerMinutes: Math.min(result.castMethod.stripHours * 60, MAX_TIMER_MINUTES),
    },
    {
      title: COPY.cureTitle,
      instruction: t("cureInstruction", { cureDays: CURE_DAYS }),
      warning: t("cureWarning"),
      timerMinutes: MAX_TIMER_MINUTES,
    },
    { title: COPY.sealTitle, instruction: t("sealInstruction") }
  )

  const tools = [
    COPY.toolMixer[locale],
    COPY.toolScale[locale],
    COPY.toolMoulds[locale],
    COPY.toolOil[locale],
    COPY.toolTrowel[locale],
    COPY.toolBucket[locale],
    COPY.toolPpe[locale],
    COPY.toolPlastic[locale],
  ]
  if (isDry) tools.splice(1, 0, COPY.toolTable[locale])

  return {
    kind: "procedure",
    locale,
    title: t("title", { count: result.batch.slabCount }),
    summary: t("summary", {
      mix: result.mixDesign.label,
      cast: result.castMethod.label,
      dosage: result.pigment.dosagePercent,
      count: result.batch.slabCount,
      length: result.slab.dimensions.lengthMm,
      width: result.slab.dimensions.widthMm,
      thickness: result.slab.dimensions.thicknessMm,
      volume: result.batch.mixedVolumeM3,
    }),
    materials: result.materials.map((line) => materialEntry(line, locale)),
    tools,
    safety: [
      t("safetyCement"),
      t("safetyDust"),
      t("safetyLifting", { slabMass: result.slab.massKg }),
      t("safetyMixer"),
    ],
    steps: seeds.slice(0, MAX_STEPS).map((seed, index) => toStep(seed, index + 1, locale)),
  }
}
