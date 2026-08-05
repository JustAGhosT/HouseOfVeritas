import { knowledgeEntrySchema, type KnowledgeEntry } from "@/lib/knowledge/types"

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
          check: "Have you decided: condensation (intermittent, weather-driven) or leak (constant)?",
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
          warning: "Do not re-plaster until the wall has dried and the moisture source is resolved.",
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
  return parsed.data as KnowledgeEntry
})
