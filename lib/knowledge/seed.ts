import { assertPublishable } from "@/lib/knowledge/publication"
import {
  knowledgeEntrySchema,
  type KnowledgeEntry,
  type KnowledgeReview,
} from "@/lib/knowledge/types"

/**
 * Recorded Tier-0 review shared by the EN and AF copper-pipe entries — same
 * content, same judgements, so one record rather than two divergent copies.
 *
 * Why each gate passes:
 *  - statutory_competence: fitting pipe lagging is not reserved work; the entry
 *    routes a suspected leak to a plumber rather than describing a repair.
 *  - irreversible_harm: no live services, height, gas or hot work.
 *  - verifiable_ground_truth: materials cite product classes and bore sizes
 *    (closed-cell Class O, 15mm/22mm) rather than invented figures.
 *  - commercial_neutrality: three suppliers listed as availability with scope
 *    notes, none ranked or recommended.
 *  - data_boundary: no address, person or photograph of the estate.
 *  - diagnosis_before_action: step 1 is the dry-and-watch test, with a warning
 *    against insulating before it is answered.
 */
const COPPER_PIPE_REVIEW: KnowledgeReview = {
  profileId: "strict",
  gateResults: {
    statutory_competence: "pass",
    irreversible_harm: "pass",
    verifiable_ground_truth: "pass",
    commercial_neutrality: "pass",
    data_boundary: "pass",
    diagnosis_before_action: "pass",
  },
  reviewedBy: "hov-editorial-1",
  reviewedAt: "2026-08-06T00:00:00.000Z",
}

/**
 * Curated seed knowledge, versioned in git so it is available without a
 * datastore and reviewable via normal code review. Author new entries here (or,
 * later, in the knowledge repository store) rather than embedding facts in
 * prompts or components.
 *
 * Locale note: seeds are English-first. Afrikaans ("af") variants are the
 * obvious next content task for resident-facing personas.
 */
const rawSeed: KnowledgeEntry[] = [
  {
    slug: "copper-pipe-condensation-wall-damp",
    domain: "maintenance",
    status: "published",
    review: COPPER_PIPE_REVIEW,
    symptoms: [
      "wall damp",
      "damp patch",
      "blistering paint",
      "blistering plaster",
      "sweating pipe",
      "wet copper pipe",
      "condensation on pipe",
      "green corrosion on pipe",
      "verdigris",
      "mould near pipe",
      "damp worse in winter",
    ],
    keywords: [
      "copper",
      "pipe",
      "condensation",
      "damp",
      "wall",
      "blistering",
      "verdigris",
      "corrosion",
      "dewpoint",
      "lagging",
      "insulation",
      "frost",
      "cold",
      "hot",
      "drain",
    ],
    assetTypes: ["plumbing", "wall", "pipework"],
    personaHints: ["charl", "hans"],
    suppliers: [
      {
        name: "Builders Warehouse",
        note: "Thermaflex / polyethylene pipe lagging in the plumbing & geyser aisle",
      },
      {
        name: "Cashbuild",
        note: "Zip-on pipe insulation 15mm/22mm x 2m",
      },
      {
        name: "Insulpro / Aerothane / LVB",
        note: "Armaflex closed-cell (vapour-barrier) foam — best for condensation; by quote",
      },
    ],
    guidance: {
      kind: "troubleshooting",
      locale: "en",
      title: "Copper pipe condensation causing wall damp",
      summary:
        "A cold copper pipe whose surface drops below the air's dew point will condense water ('sweat'), which soaks into plaster and brick and shows as damp patches, blistering paint and mould — often below or beside the pipe run. A nearby hot or drain pipe makes it worse by adding warm, humid air. This is seasonal, peaking in the coldest weeks. Persistent green corrosion (verdigris) means the copper has been wet a long time and can also signal a slow leak, which must be ruled out before insulating.",
      materials: [
        "Closed-cell elastomeric pipe insulation (Armaflex / Class O) sized to pipe bore (15mm or 22mm)",
        "Alternative: polyethylene zip-on pipe lagging (Thermaflex-type)",
        "Foam contact adhesive or insulation tape to seal the slit and joins airtight",
        "Mould treatment / fungicidal wash",
      ],
      tools: ["Tape measure", "Sharp knife", "Cloth (to dry the pipe)", "Damp meter (optional)"],
      safety: [
        "Confirm the pipe is condensing and not leaking before you insulate — lagging over a weep or pinhole traps water against the copper, hides the leak and accelerates corrosion.",
        "Heavy verdigris suggests long-term wetting; if unsure, have a plumber inspect for a pinhole or weeping joint.",
        "If the cold pipe is reaching frost point in an exposed cavity, also consider freeze risk.",
      ],
      steps: [
        {
          order: 1,
          title: "Confirm condensation vs leak (dry-and-watch test)",
          instruction:
            "Dry the pipe completely, then watch it. If beads return within minutes-to-hours with no tap or appliance running, it is condensation. If it re-wets at a joint or stays constantly wet regardless of weather, treat it as a leak and fix the pipe before doing anything else.",
          check:
            "Have you decided: condensation (intermittent, weather-driven) or leak (constant)?",
          warning:
            "Do not insulate or foam over the pipe until this is answered — sealing in a leak makes it worse and invisible.",
        },
        {
          order: 2,
          title: "Insulate the cold pipe first",
          instruction:
            "Fit closed-cell foam lagging over the cold copper. Snap the slit tube over the pipe, then glue or tape the slit closed along its whole length so humid air cannot reach the copper. Butt lengths tightly and seal every join. Carry the lagging right up to bends and where the pipe enters the wall — gaps are where sweating restarts.",
          visualCue: "No bare copper visible; slit sealed; no gaps at ends or bends.",
          check: "Is the cold pipe fully and airtightly encased?",
        },
        {
          order: 3,
          title: "Insulate the hot pipe too",
          instruction:
            "Lag the hot/warm pipe as well. It does not condense itself, but bare it warms the cavity air and raises its moisture capacity, which then dumps onto the cold pipe. Insulating it removes that humidity source and saves heat.",
          check: "Is the hot pipe lagged?",
        },
        {
          order: 4,
          title: "Check the drain pipe joints",
          instruction:
            "The drain/waste pipe carries warm humid water and can weep at joints, feeding cavity humidity. Confirm its joints are sound and dry. Fix any weeping joint rather than insulating over it.",
          check: "Are the drain joints dry and sound?",
        },
        {
          order: 5,
          title: "Reduce humidity and ventilate",
          instruction:
            "Improve extraction/ventilation in the room so there is less water vapour available to condense in the wall cavity in the first place.",
        },
        {
          order: 6,
          title: "Dry, treat and make good",
          instruction:
            "Once the source is fixed, let the wall dry fully, treat any mould with a fungicidal wash, then re-plaster and redecorate the blistered area. Doing this before the pipe is sealed will just blister again next winter.",
          warning:
            "Do not re-plaster until the wall has dried and the moisture source is resolved.",
        },
      ],
    },
  },
  {
    slug: "copper-pipe-condensation-wall-damp-af",
    domain: "maintenance",
    status: "published",
    review: COPPER_PIPE_REVIEW,
    symptoms: [
      "muur klam",
      "klam kol",
      "blase in die verf",
      "blase in die pleister",
      "sweetpyp",
      "nat koperpyp",
      "kondensasie op pyp",
      "groen korrosie op pyp",
      "kopergroen",
      "muf naby pyp",
      "klam erger in winter",
    ],
    keywords: [
      "koper",
      "pyp",
      "kondensasie",
      "klam",
      "muur",
      "blase",
      "kopergroen",
      "korrosie",
      "doupunt",
      "isolasie",
      "vries",
      "koud",
      "warm",
      "afvoer",
    ],
    assetTypes: ["plumbing", "wall", "pipework"],
    personaHints: ["charl", "hans"],
    suppliers: [
      {
        name: "Builders Warehouse",
        note: "Thermaflex / poliëtileen-pypisolasie in die loodgieter- en geiser-afdeling",
      },
      {
        name: "Cashbuild",
        note: "Rits-op pypisolasie 15mm/22mm x 2m",
      },
      {
        name: "Insulpro / Aerothane / LVB",
        note: "Armaflex geslote-sel (dampversperring) skuim — beste vir kondensasie; op kwotasie",
      },
    ],
    guidance: {
      kind: "troubleshooting",
      locale: "af",
      title: "Koperpyp-kondensasie wat muurklam veroorsaak",
      summary:
        "'n Koue koperpyp waarvan die oppervlak onder die lug se doupunt daal, sal water kondenseer ('sweet'), wat in pleister en baksteen intrek en as klam kolle, blase in die verf en muf wys — dikwels onder of langs die pyplopie. 'n Nabygeleë warm- of afvoerpyp maak dit erger deur warm, klam lug by te voeg. Dit is seisoenaal en is op sy ergste in die koudste weke. Aanhoudende groen korrosie (kopergroen) beteken die koper is lank reeds nat en kan ook op 'n stadige lek dui, wat uitgeskakel moet word voordat jy isoleer.",
      materials: [
        "Geslote-sel elastomeriese pypisolasie (Armaflex / Klas O) volgens pypboring (15mm of 22mm)",
        "Alternatief: poliëtileen rits-op pypisolasie (Thermaflex-tipe)",
        "Skuim-kontakgom of isolasieband om die snit en laste lugdig te seël",
        "Muf-behandeling / swamdodende was",
      ],
      tools: ["Maatband", "Skerp mes", "Lap (om die pyp droog te maak)", "Klammeter (opsioneel)"],
      safety: [
        "Bevestig dat die pyp kondenseer en nie lek nie voordat jy isoleer — isolasie oor 'n lek of speldgat vang water teen die koper vas, versteek die lek en versnel korrosie.",
        "Swaar kopergroen dui op langtermyn-natheid; as jy onseker is, laat 'n loodgieter vir 'n speldgat of lekkende las inspekteer.",
        "As die koue pyp vriespunt in 'n blootgestelde holte bereik, oorweeg ook vriesrisiko.",
      ],
      steps: [
        {
          order: 1,
          title: "Bevestig kondensasie teenoor lek (droogmaak-en-kyk-toets)",
          instruction:
            "Maak die pyp heeltemal droog en kyk dan daarna. As druppels binne minute tot ure terugkeer sonder dat 'n kraan of toestel loop, is dit kondensasie. As dit by 'n las nat word of aanhoudend nat bly ongeag die weer, hanteer dit as 'n lek en herstel die pyp voordat jy enigiets anders doen.",
          check: "Het jy besluit: kondensasie (wisselvallig, weer-gedrewe) of lek (aanhoudend)?",
          warning:
            "Moenie die pyp isoleer of toeskuim voordat dit beantwoord is nie — om 'n lek toe te seël maak dit erger en onsigbaar.",
        },
        {
          order: 2,
          title: "Isoleer eers die koue pyp",
          instruction:
            "Sit geslote-sel skuimisolasie oor die koue koper. Klik die gesnyde buis oor die pyp en gom of plak dan die snit oor sy hele lengte toe sodat klam lug nie by die koper kan kom nie. Stoot lengtes styf teen mekaar en seël elke las. Neem die isolasie reg tot by draaie en waar die pyp die muur ingaan — gapings is waar sweet weer begin.",
          visualCue:
            "Geen kaal koper sigbaar nie; snit geseël; geen gapings by punte of draaie nie.",
          check: "Is die koue pyp ten volle en lugdig toegemaak?",
        },
        {
          order: 3,
          title: "Isoleer die warm pyp ook",
          instruction:
            "Isoleer die warm pyp ook. Dit kondenseer nie self nie, maar kaal verhit dit die holte se lug en verhoog sy vogkapasiteit, wat dan op die koue pyp neersak. Om dit te isoleer verwyder daardie vogbron en spaar hitte.",
          check: "Is die warm pyp geïsoleer?",
        },
        {
          order: 4,
          title: "Kontroleer die afvoerpyp se laste",
          instruction:
            "Die afvoerpyp dra warm, klam water en kan by laste syfer, wat holte-vog voed. Bevestig dat sy laste heel en droog is. Herstel enige lekkende las eerder as om daaroor te isoleer.",
          check: "Is die afvoerlaste droog en heel?",
        },
        {
          order: 5,
          title: "Verminder vog en ventileer",
          instruction:
            "Verbeter uitlaat/ventilasie in die vertrek sodat daar minder waterdamp beskikbaar is om in die eerste plek in die muurholte te kondenseer.",
        },
        {
          order: 6,
          title: "Droog, behandel en herstel",
          instruction:
            "Sodra die bron reggemaak is, laat die muur heeltemal droog word, behandel enige muf met 'n swamdodende was, en pleister en verf dan die geblaasde area oor. As jy dit doen voordat die pyp geseël is, sal dit net volgende winter weer blaas.",
          warning: "Moenie oorpleister voordat die muur droog is en die vogbron opgelos is nie.",
        },
      ],
    },
  },
]

/** Validated at module load so a malformed seed fails fast in CI, not at runtime. */
export const KNOWLEDGE_SEED: KnowledgeEntry[] = rawSeed.map((entry, index) => {
  const parsed = knowledgeEntrySchema.safeParse(entry)
  if (!parsed.success) {
    throw new Error(
      `Invalid knowledge seed at index ${index} (${entry.slug}): ${parsed.error.message}`
    )
  }
  const validated = parsed.data as KnowledgeEntry
  // Schema conformance is not enough: a published entry must also clear the
  // Tier-0 gates it recorded. Failing here means the seed cannot even import,
  // so an ungated entry fails CI rather than reaching a user.
  assertPublishable(validated)
  return validated
})
