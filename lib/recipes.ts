export type RecipeStatus = "draft" | "published" | "archived"

export interface RecipeIngredient {
  id: string
  quantity?: string | number
  unit?: string
  name: string
  preparationNote?: string
  section?: string
}

export interface RecipeStep {
  id: string
  order: number
  instructionEn: string
  instructionAf: string
  timerMinutes?: number
  section?: string
}

export interface RecipeImageMetadata {
  url: string
  source: string
  author?: string
  license: string
  attributionText: string
  retrievedAt?: string
}

export interface RecipeRecord {
  id: string
  status: RecipeStatus
  ownerUserId: string
  audienceUserIds: string[]
  titleEn: string
  summaryEn?: string
  titleAf: string
  summaryAf?: string
  servings?: number
  prepMinutes?: number
  cookMinutes?: number
  cuisine?: string
  category?: string
  image: RecipeImageMetadata
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  createdAt: string
  updatedAt: string
}

export interface RecipeMealInstance {
  id: string
  recipeId: string
  recipeTitleEn: string
  recipeTitleAf: string
  mealName?: string
  residentUserIds: string[]
  servedBy?: string
  servedAt: string
  ratingTaskIds: number[]
  ratingTaskAssignments?: Array<{
    residentUserId: string
    taskId: number
  }>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface RecipeRating {
  id: string
  recipeId: string
  mealInstanceId: string
  residentUserId: string
  score: 1 | 2 | 3 | 4 | 5
  comment?: string
  taskId?: number
  submittedBy: string
  submittedAt: string
}

export interface RecipeRatingSummary {
  recipeId: string
  averageScore: number
  totalRatings: number
  totalMeals: number
}

export interface RecipeCreatePayload {
  status?: RecipeStatus
  audienceUserIds?: string[]
  titleEn: string
  summaryEn?: string
  titleAf: string
  summaryAf?: string
  servings?: number
  prepMinutes?: number
  cookMinutes?: number
  cuisine?: string
  category?: string
  image: RecipeImageMetadata
  ingredients: Array<{
    id?: string
    quantity?: string | number
    unit?: string
    name: string
    preparationNote?: string
    section?: string
  }>
  steps: Array<{
    id?: string
    order?: number
    instructionEn: string
    instructionAf: string
    timerMinutes?: number
    section?: string
  }>
}

export const KNOWN_RECIPE_STATUSES: RecipeStatus[] = ["draft", "published", "archived"]
export const DEFAULT_RECIPE_AUDIENCE_IDS = ["hans", "irma"]
export const RATING_RECIPE_RECIPIENTS = ["hans", "irma"] as const

export const TASK_RECIPIENT_TO_BASEROW_ID: Record<string, number> = {
  hans: 1,
  charl: 2,
  lucky: 3,
  irma: 4,
}

export const RESIDENT_AUDIENCE_HINTS: Record<string, string[]> = {
  hans: ["hans", "demo-user-1"],
  charl: ["charl", "demo-user-2"],
  irma: ["irma", "demo-user-3"],
  lucky: ["lucky", "demo-user-4"],
}

export function getExpandedAudienceAliases(userId: string): string[] {
  const normalizedUserId = userId.toLowerCase().trim()
  const matchedPersona = Object.entries(RESIDENT_AUDIENCE_HINTS).find(([, aliases]) =>
    aliases.map((alias) => alias.toLowerCase()).includes(normalizedUserId)
  )

  if (!matchedPersona) return [normalizedUserId]

  const [persona, aliases] = matchedPersona
  return [normalizedUserId, persona, ...aliases.map((alias) => alias.toLowerCase())]
}

export function isRecipeAudienceMatch(audienceUserIds: string[], userId: string): boolean {
  const candidateIds = getExpandedAudienceAliases(userId)
  const normalizedAudience = audienceUserIds.map((value) => value.toLowerCase().trim())
  return (
    normalizedAudience.length === 0 ||
    normalizedAudience.some((value) => candidateIds.includes(value))
  )
}

export function normalizeRecipeAudienceUserIds(audienceUserIds: unknown): string[] {
  if (!Array.isArray(audienceUserIds) || audienceUserIds.length === 0) {
    return [...DEFAULT_RECIPE_AUDIENCE_IDS]
  }

  return [
    ...new Set(
      audienceUserIds
        .map((value) => String(value).trim().toLowerCase())
        .filter((value) => value.length > 0)
    ),
  ]
}

export function resolveTaskRecipientPersona(userId: string): string | undefined {
  const normalizedUserId = userId.toLowerCase().trim()
  if (Object.keys(TASK_RECIPIENT_TO_BASEROW_ID).includes(normalizedUserId)) return normalizedUserId

  const match = Object.entries(RESIDENT_AUDIENCE_HINTS).find(([, aliases]) =>
    aliases.map((alias) => alias.toLowerCase()).includes(normalizedUserId)
  )
  return match?.[0]
}

export const SAMPLE_RECIPES: RecipeCreatePayload[] = [
  {
    status: "published",
    audienceUserIds: ["hans", "irma"],
    titleEn: "Mushroom & Egg Fried Rice (Budget-Friendly)",
    summaryEn:
      "A fast, filling fried rice with mushrooms and eggs that works with simple pantry staples.",
    titleAf: "Swam- en eierbrasnoedels (begroting)",
    summaryAf:
      "'n Vinnige, bevredigende fried rice met sampioene en eiers wat goed werk met eenvoudige kombuisbestellings.",
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    cuisine: "Family",
    category: "Main",
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/6/6f/Chinese_fried_rice_1.jpg",
      source: "Wikimedia Commons",
      author: "Commons Contributor",
      license: "CC BY-SA 4.0",
      attributionText: "Image sourced from Wikimedia Commons",
      retrievedAt: "2026-07-24",
    },
    ingredients: [
      { name: "Uncooked rice", quantity: "2", unit: "cups" },
      { name: "Mushrooms", quantity: "250", unit: "g" },
      { name: "Onions", quantity: "2", unit: "large, diced" },
      { name: "Eggs", quantity: 6 },
      { name: "Garlic", quantity: "3-4", unit: "cloves, minced" },
      { name: "Cooking oil", quantity: "3-4", unit: "tablespoons" },
      { name: "Salt", quantity: "to taste" },
      { name: "Black pepper", quantity: "to taste" },
      { name: "Paprika", quantity: "to taste (optional)" },
      { name: "Curry powder", quantity: "to taste (optional)" },
      { name: "Soy sauce", quantity: "1-2", unit: "tablespoons (optional)" },
    ],
    steps: [
      {
        order: 1,
        instructionEn:
          "Cook the rice according to the package instructions. For the best fried rice, spread it out to cool completely or refrigerate overnight.",
        instructionAf:
          "Kook die rys volgens die pakketinstruksies. Vir die beste fried rice, versprei dit uit om heeltemal af te koel of sit dit oornag in die yskas.",
      },
      {
        order: 2,
        instructionEn: "Beat the eggs with a pinch of salt. Fry as a soft scramble and set aside.",
        instructionAf:
          "Klop die eiers met 'n knippie sout. Braai dit as 'n sagte scramble en sit dit op die kant.",
      },
      {
        order: 3,
        instructionEn:
          "Brown onions for 5 to 8 minutes. Add mushrooms and cook until their moisture has evaporated and they develop a brown colour.",
        instructionAf:
          "Braai die uie vir 5 tot 8 minute tot goudbruin. Voeg dan sampioene by en kook dit tot die vog verdamp en dit mooi bruin kleur kry.",
      },
      {
        order: 4,
        instructionEn: "Add garlic and cook another 30 seconds.",
        instructionAf: "Voeg knoffel by en kook nog 30 sekondes.",
      },
      {
        order: 5,
        instructionEn:
          "Add cooled rice. Break up clumps and fry for 4 to 5 minutes until heated through and lightly crisp.",
        instructionAf:
          "Voeg die afgekoelde rys by. Breek klonte uitmekaar en braai vir 4 tot 5 minute totdat dit warm is en effens bros word.",
      },
      {
        order: 6,
        instructionEn:
          "Season with salt, black pepper, optional paprika, optional curry powder, and optional soy sauce. Return scrambled eggs and fold gently through.",
        instructionAf:
          "Sout, swartpeper, opsionele paprika, opsionele kerriepoeier en opsionele sojasous by. Voeg die scramble daarna weer by en vou dit versigtig in.",
      },
    ],
  },
  {
    status: "published",
    audienceUserIds: ["hans", "irma"],
    titleEn: "Sampioen-, Spek- en Uie-Sous vir Mieliepap",
    summaryEn:
      "A rich mushroom sauce with bacon and onions that scales well for serving with mieliepap.",
    titleAf: "Sampioen-, Spek- en Uie-Sous vir Mieliepap",
    summaryAf:
      "'n Ryk sampioen- en speksous met uie en knoffel vir mieliepap met eenvoudige begrotingsaanpassings.",
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    cuisine: "Family",
    category: "Sauce",
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/8/8b/Mushroom_sauce.jpg",
      source: "Wikimedia Commons",
      author: "Commons Contributor",
      license: "CC BY-SA 4.0",
      attributionText: "Image sourced from Wikimedia Commons",
      retrievedAt: "2026-07-24",
    },
    ingredients: [
      { name: "Fresh mushrooms", quantity: "200", unit: "g, sliced" },
      { name: "Onion", quantity: 1, unit: "large, sliced" },
      { name: "Bacon or bacon bits", quantity: "50-100", unit: "g" },
      { name: "Garlic", quantity: 2, unit: "cloves, finely chopped" },
      { name: "Flour", quantity: 1, unit: "tablespoon" },
      { name: "Beef or chicken stock", quantity: "1 to 1.5", unit: "cups" },
      { name: "Soy sauce", quantity: 1, unit: "teaspoon" },
      { name: "Worcestershire sauce", quantity: 1, unit: "teaspoon" },
      { name: "Smoked paprika", quantity: 1, unit: "teaspoon" },
      { name: "Salt", quantity: "to taste" },
      { name: "Black pepper", quantity: "to taste" },
      { name: "Marmite or Bovril", quantity: 1, unit: "teaspoon (optional)" },
      { name: "Peas", quantity: "1/2 cup (optional)" },
      { name: "Spinach", quantity: "1 cup (optional)" },
    ],
    steps: [
      {
        order: 1,
        instructionEn: "Heat a large pan over medium heat and fry the bacon until lightly crispy.",
        instructionAf:
          "Verhit 'n groot pan oor medium hitte en braai die spek totdat dit liggies bros is.",
      },
      {
        order: 2,
        instructionEn: "Remove the bacon and keep it; reserve the rendered bacon fat in the pan.",
        instructionAf: "Verwyder die spek en hou dit eenkant. Laat die spekvet vir die pan oor.",
      },
      {
        order: 3,
        instructionEn:
          "Add onion and slowly braise for 10 to 15 minutes until golden and lightly caramelised.",
        instructionAf:
          "Voeg die ui by en braai stadig vir 10 tot 15 minute tot dit goudbruin en effens gekaramelliseer is.",
      },
      {
        order: 4,
        instructionEn:
          "Add mushrooms and cook until the moisture has evaporated and they begin to brown well.",
        instructionAf:
          "Voeg die sampioene by en braai dit totdat die vloeistof verdamp en dit begin bruin.",
      },
      {
        order: 5,
        instructionEn: "Add garlic and cook for 30 seconds.",
        instructionAf: "Voeg knoffel by en kook vir omtrent 30 sekondes.",
      },
      {
        order: 6,
        instructionEn: "Stir in flour and cook for about 1 minute.",
        instructionAf: "Roer die meel in en laat vir omtrent 1 minuut gaar word.",
      },
      {
        order: 7,
        instructionEn:
          "Slowly add stock while stirring to avoid clumps. Return bacon and simmer 5 to 10 minutes on low heat.",
        instructionAf:
          "Giet die aftreksel stadig by terwyl jy roer om klonte te voorkom. Plaas die spek terug en laat prut vir 5 tot 10 minute.",
      },
      {
        order: 8,
        instructionEn:
          "Add soy sauce, Worcestershire sauce, optional Marmite/Bovril. Adjust salt and flavour at the end.",
        instructionAf:
          "Voeg sojasous, Worcestersaus en, indien gebruik, Marmite/Bovril by. Pas sout en geur aan om laaste.",
      },
      {
        order: 9,
        instructionEn:
          "Optionally fold in peas or spinach for extra nutrition. Serve with mieliepap.",
        instructionAf:
          "Opsioneel: voeg ertjies of spinasie by vir meer voeding. Bedien saam met mieliepap.",
      },
    ],
  },
  {
    status: "published",
    audienceUserIds: ["hans", "irma"],
    titleEn: "Spaghetti Bolognese (Savoury Mince)",
    summaryEn:
      "A weeknight mince sauce from oil, onions, carrot, tomatoes, and spice. Serve over spaghetti tonight, or over rice tomorrow.",
    titleAf: "Spaghetti Bolognese (Smaaklike Mince)",
    summaryAf:
      "'n Weeksaand-mincesous van olie, uie, wortel, tamaties en speserye. Bedien vanand oor spaghetti, of more oor rys.",
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 35,
    cuisine: "Family",
    category: "Main",
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Spaghetti_bolognese.jpg",
      source: "Wikimedia Commons",
      author: "Noblige",
      license: "CC BY-SA 2.5",
      attributionText: "Noblige, CC BY-SA 2.5, via Wikimedia Commons",
      retrievedAt: "2026-08-14",
    },
    ingredients: [
      { name: "Cooking oil", quantity: "2-3", unit: "tablespoons" },
      { name: "Onions", quantity: "2", unit: "large, diced" },
      { name: "Carrot", quantity: 1, unit: "grated or finely diced" },
      { name: "Beef mince", quantity: "500", unit: "g" },
      { name: "Ripe tomatoes", quantity: "3-4", unit: "chopped" },
      { name: "Salt", quantity: "to taste" },
      { name: "Black pepper", quantity: "to taste" },
      { name: "Mixed herbs, paprika, or curry powder", quantity: "to taste" },
      { name: "Spaghetti", quantity: "400", unit: "g" },
      { name: "Uncooked rice", quantity: "optional", unit: "for leftover sauce" },
      { name: "Garlic", quantity: "2", unit: "cloves, minced (optional)" },
      { name: "Water or stock", quantity: "a splash", unit: "as needed" },
    ],
    steps: [
      {
        order: 1,
        timerMinutes: 8,
        instructionEn:
          "Heat the oil in a wide pan over medium heat. Soften the diced onions for 5 to 8 minutes.",
        instructionAf:
          "Verhit die olie in 'n wye pan oor medium hitte. Braai die gekapte uie sag vir 5 tot 8 minute.",
      },
      {
        order: 2,
        timerMinutes: 3,
        instructionEn:
          "Add the carrot and optional garlic. Cook for 2 to 3 minutes until the carrot starts to soften.",
        instructionAf:
          "Voeg die wortel en opsionele knoffel by. Kook 2 tot 3 minute totdat die wortel begin sag word.",
      },
      {
        order: 3,
        timerMinutes: 8,
        instructionEn:
          "Add the mince. Break it up and brown it well so it catches a little colour.",
        instructionAf:
          "Voeg die mince by. Breek dit fyn en braai dit mooi bruin totdat dit 'n bietjie kleur vat.",
      },
      {
        order: 4,
        timerMinutes: 2,
        instructionEn:
          "Add the chopped tomatoes, salt, pepper, and spice. Add a splash of water or stock if the pan looks dry.",
        instructionAf:
          "Voeg die gekapte tamaties, sout, peper en speserye by. Voeg 'n slukkie water of aftreksel by as die pan droog lyk.",
      },
      {
        order: 5,
        timerMinutes: 25,
        instructionEn:
          "Simmer 20 to 30 minutes so the carrot melts into the sauce. Taste and adjust the seasoning.",
        instructionAf:
          "Laat 20 tot 30 minute prut sodat die wortel in die sous smelt. Proe en pas die geur aan.",
      },
      {
        order: 6,
        timerMinutes: 10,
        instructionEn: "Boil the spaghetti in salted water until just tender. Drain.",
        instructionAf: "Kook die spaghetti in gesoute water tot net sag. Dreineer.",
      },
      {
        order: 7,
        instructionEn:
          "Serve the mince sauce over spaghetti. Keep leftover sauce for rice the next day.",
        instructionAf:
          "Bedien die mincesous oor spaghetti. Hou oorskiet sous vir rys die volgende dag.",
      },
    ],
  },
  {
    status: "published",
    audienceUserIds: ["hans", "irma"],
    titleEn: "Bacon, Sausage and Sirloin Skillet",
    summaryEn:
      "One-pan supper: bacon and sausage first, then potato and the chopped veg. Three tomatoes only wet the pan. Sirloin goes in last.",
    titleAf: "Spek-, Wors- en Sirloinpan",
    summaryAf:
      "Eenpan-aandete: eers spek en wors, dan aartappel en die gekapte groente. Drie tamaties maak die pan net nat. Sirloin gaan laaste in.",
    servings: 3,
    prepMinutes: 15,
    cookMinutes: 25,
    cuisine: "Family",
    category: "Main",
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Bacon%2C_sausage%2C_eggs_and_hash_browns.jpg",
      source: "Wikimedia Commons",
      author: "anokarina",
      license: "CC BY-SA 2.0",
      attributionText: "anokarina, CC BY-SA 2.0, via Wikimedia Commons",
      retrievedAt: "2026-08-14",
    },
    ingredients: [
      { name: "Bacon", quantity: "200", unit: "g" },
      { name: "Sausage", quantity: "2-3", unit: "pieces" },
      { name: "Sirloin", quantity: "300-400", unit: "g" },
      { name: "Potatoes", quantity: "3-4", unit: "medium, diced" },
      { name: "Onion", quantity: "1-2", unit: "diced" },
      { name: "Carrot", quantity: 1, unit: "diced" },
      { name: "Green pepper", quantity: 1, unit: "diced" },
      { name: "Ripe tomatoes", quantity: 3, unit: "chopped" },
      { name: "Salt", quantity: "to taste" },
      { name: "Black pepper", quantity: "to taste" },
      { name: "Mixed herbs or paprika", quantity: "to taste" },
    ],
    steps: [
      {
        order: 1,
        timerMinutes: 8,
        instructionEn: "Fry the bacon and sausage in a wide pan. Push them to one side.",
        instructionAf: "Braai die spek en wors in 'n wye pan. Skuif hulle eenkant toe.",
      },
      {
        order: 2,
        timerMinutes: 10,
        instructionEn: "Add the diced potatoes to the fat. Cook until they start to brown.",
        instructionAf: "Voeg die blokkies aartappel in die vet. Braai totdat dit begin bruin word.",
      },
      {
        order: 3,
        timerMinutes: 8,
        instructionEn:
          "Add the onion, carrot, and green pepper. When they soften, add the three chopped tomatoes and spice. The tomatoes only wet the pan; they will not make a pot of sauce.",
        instructionAf:
          "Voeg die ui, wortel en groentepeper by. As dit sag is, voeg die drie gekapte tamaties en speserye by. Die tamaties maak die pan net nat; dit word nie 'n pot sous nie.",
      },
      {
        order: 4,
        timerMinutes: 6,
        instructionEn:
          "Make a gap and cook the sirloin for the last few minutes. Rest it briefly, then slice and serve from the pan.",
        instructionAf:
          "Maak spasie en kook die sirloin die laaste paar minute. Laat dit kort rus, sny dit dan en bedien uit die pan.",
      },
    ],
  },
  {
    status: "published",
    audienceUserIds: ["hans", "irma"],
    titleEn: "Smoky Boerewors, Bacon and Tomato Rice Pot",
    summaryEn:
      "A filling one-pot meal that uses the vegetables before they spoil. Keep the sirloin, potatoes, and spaghetti for another meal.",
    titleAf: "Rookagtige Boerewors-, Spek- en Tamatie-ryspot",
    summaryAf:
      "'n Vol eenpot-maal wat die groente gebruik voordat dit bederf. Hou die sirloin, aartappels en spaghetti vir 'n ander ete.",
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 40,
    cuisine: "Family",
    category: "Main",
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/f/f7/Chicken_and_andouille_sausage_jambalaya.jpg",
      source: "Wikimedia Commons",
      author: "Jessica Rossi",
      license: "CC BY-SA 2.0",
      attributionText: "Jessica Rossi, CC BY-SA 2.0, via Wikimedia Commons",
      retrievedAt: "2026-08-14",
    },
    ingredients: [
      { name: "Boerewors", quantity: "300-500", unit: "g" },
      { name: "Bacon", quantity: "3-5", unit: "strips, chopped" },
      { name: "Uncooked rice", quantity: "1.5", unit: "cups" },
      { name: "Ripe tomatoes", quantity: 3, unit: "diced or grated" },
      { name: "Onions", quantity: 2, unit: "chopped" },
      { name: "Carrot", quantity: 1, unit: "grated or finely diced" },
      { name: "Green pepper", quantity: 1, unit: "chopped" },
      { name: "Water", quantity: "2.5-3", unit: "cups" },
      { name: "Cooking oil", quantity: "optional", unit: "only if the bacon is very lean" },
      { name: "Salt", quantity: "to taste" },
      { name: "Black pepper", quantity: "to taste" },
      { name: "Paprika", quantity: "1", unit: "teaspoon (optional)" },
      { name: "Curry powder", quantity: "0.5", unit: "teaspoon (optional)" },
      { name: "Garlic", quantity: "optional" },
      { name: "Chilli", quantity: "optional" },
      { name: "Stock cube", quantity: "optional" },
      { name: "Worcestershire sauce or chutney", quantity: "1", unit: "tablespoon (optional)" },
    ],
    steps: [
      {
        order: 1,
        timerMinutes: 10,
        instructionEn:
          "Brown the whole boerewors coil over medium-high heat for 8 to 10 minutes, both sides, until nearly cooked. Remove it and let it rest. Do not cut it before browning, or it will lose more juice.",
        instructionAf:
          "Braai die hele boerewors-kring 8 tot 10 minute oor medium-hoë hitte, beide kante, tot byna gaar. Verwyder dit en laat rus. Moenie dit sny voor die braai nie, anders verloor dit meer sap.",
      },
      {
        order: 2,
        timerMinutes: 4,
        instructionEn:
          "Add the chopped bacon to the same pot over medium heat. Cook 3 to 4 minutes until it releases some fat and begins to brown. Add a little oil only if the bacon is very lean.",
        instructionAf:
          "Voeg die gekapte spek in dieselfde pot oor medium hitte. Kook 3 tot 4 minute totdat dit vet los en begin bruin. Voeg net 'n bietjie olie by as die spek baie maer is.",
      },
      {
        order: 3,
        timerMinutes: 8,
        instructionEn:
          "Add the onions and cook about 3 minutes. Add the carrot and green pepper and cook another 4 to 5 minutes.",
        instructionAf:
          "Voeg die uie by en kook ongeveer 3 minute. Voeg die wortel en groentepeper by en kook nog 4 tot 5 minute.",
      },
      {
        order: 4,
        timerMinutes: 5,
        instructionEn:
          "Add the tomatoes, black pepper, paprika, and any garlic, curry powder, chilli, or a tablespoon of Worcestershire sauce or chutney. Cook until the tomatoes soften and become slightly saucy.",
        instructionAf:
          "Voeg die tamaties, swartpeper, paprika en enige knoffel, kerriepoeier, rissie of 'n eetlepel Worcestershire of blatjang by. Kook totdat die tamaties sag word en 'n bietjie sous vorm.",
      },
      {
        order: 5,
        timerMinutes: 1,
        instructionEn: "Stir in the uncooked rice and coat it thoroughly in the tomato mixture for about 1 minute.",
        instructionAf: "Roer die rou rys in en bedek dit deeglik met die tamatiemengsel vir ongeveer 1 minuut.",
      },
      {
        order: 6,
        timerMinutes: 2,
        instructionEn:
          "Add 2.5 cups water and a stock cube if available. Use closer to 3 cups if the rice normally needs a lot of water. Taste the liquid before adding salt — the bacon, boerewors, and stock may already be salty.",
        instructionAf:
          "Voeg 2.5 koppies water en 'n aftrekselblokkie by indien beskikbaar. Gebruik nader aan 3 koppies as die rys gewoonlik baie water nodig het. Proe die vloeistof voor sout — die spek, wors en aftreksel kan al sout wees.",
      },
      {
        order: 7,
        timerMinutes: 15,
        instructionEn:
          "Bring to a boil, cover, then reduce to low heat for 15 minutes. Do not keep stirring, because that can make the rice mushy.",
        instructionAf:
          "Bring tot kookpunt, sit die deksel op, en sit dan op lae hitte vir 15 minute. Moenie aanhou roer nie, anders word die rys pap.",
      },
      {
        order: 8,
        timerMinutes: 8,
        instructionEn:
          "Slice the browned boerewors into thick rounds and place them on top of the rice. Cover again and cook 5 to 8 minutes until the rice is tender and the boerewors is fully cooked. If the rice is still firm after the liquid is absorbed, add 1/4 cup hot water, cover, and cook another 5 minutes.",
        instructionAf:
          "Sny die gebraaide boerewors in dik skywe en sit dit bo-op die rys. Sit weer die deksel op en kook 5 tot 8 minute totdat die rys sag is en die wors gaar is. As die rys nog stewig is nadat die vloeistof opgetrek het, voeg 1/4 koppie warm water by, sit die deksel op, en kook nog 5 minute.",
      },
      {
        order: 9,
        timerMinutes: 5,
        instructionEn: "Turn the heat off and leave the pot covered for 5 minutes, then gently fluff the rice.",
        instructionAf: "Sit die hitte af en laat die pot 5 minute toegemaak staan. Pluis dan die rys sagkens.",
      },
    ],
  },
  {
    status: "published",
    audienceUserIds: ["hans", "irma"],
    titleEn: "Loaded Bacon, Tomato and Cheddar Potato Bake",
    summaryEn:
      "Bacon as the meat, three salted tomatoes, green pepper, and cheddar layered with thin potatoes. Save the boerewors and sirloin.",
    titleAf: "Gelaaide Spek-, Tamatie- en Cheddar-aartappelbraai",
    summaryAf:
      "Spek as die vleis, drie gesoute tamaties, groentepeper en cheddar in lae met dun aartappels. Hou die boerewors en sirloin.",
    servings: 4,
    prepMinutes: 25,
    cookMinutes: 50,
    cuisine: "Family",
    category: "Main",
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/4/40/Tartiflette_reblochon.jpg",
      source: "Wikimedia Commons",
      author: "Rémi Guillot",
      license: "CC BY-SA 3.0",
      attributionText: "Rémi Guillot, CC BY-SA 3.0, via Wikimedia Commons",
      retrievedAt: "2026-08-14",
    },
    ingredients: [
      { name: "Potatoes", quantity: "4-6", unit: "medium, sliced 3-4 mm thick" },
      { name: "Bacon", quantity: "150-250", unit: "g, chopped" },
      { name: "Ripe tomatoes", quantity: 3, unit: "sliced" },
      { name: "Onion", quantity: 1, unit: "chopped" },
      { name: "Green pepper", quantity: 1, unit: "sliced or chopped" },
      { name: "Cheddar", quantity: "generous", unit: "grated" },
      { name: "Water or stock", quantity: "2-3", unit: "tablespoons, only if the potatoes look dry" },
      { name: "Salt", quantity: "light", unit: "the bacon and cheddar are salty" },
      { name: "Black pepper", quantity: "to taste" },
      { name: "Paprika, garlic, mixed herbs, or chilli", quantity: "optional" },
    ],
    steps: [
      {
        order: 1,
        timerMinutes: 10,
        instructionEn:
          "Heat the oven to 190°C. Lightly salt the sliced tomatoes and leave them on a plate for 5 to 10 minutes. Pour off the excess liquid so the bake does not become watery.",
        instructionAf:
          "Verhit die oond tot 190°C. Sout die gesnyde tamaties liggies en laat 5 tot 10 minute op 'n bord. Gooi die oortollige vloeistof af sodat die bak nie waterig word nie.",
      },
      {
        order: 2,
        timerMinutes: 8,
        instructionEn:
          "Slice 4 to 6 medium potatoes into thin rounds, about 3 to 4 mm. Boil in salted water for 6 to 8 minutes until they begin to soften but do not fall apart. Drain well.",
        instructionAf:
          "Sny 4 tot 6 medium aartappels in dun skywe, ongeveer 3 tot 4 mm. Kook 6 tot 8 minute in gesoute water totdat hulle begin sag word maar nie uitmekaar val nie. Dreineer goed.",
      },
      {
        order: 3,
        timerMinutes: 10,
        instructionEn:
          "Fry the bacon over medium heat for 3 to 4 minutes. Add the onion and green pepper and cook another 5 to 6 minutes, until the onion softens and the bacon begins browning. Season with black pepper and optional paprika, garlic, mixed herbs, or a little chilli. Go lightly on salt.",
        instructionAf:
          "Braai die spek 3 tot 4 minute oor medium hitte. Voeg die ui en groentepeper by en kook nog 5 tot 6 minute totdat die ui sag is en die spek begin bruin. Geur met swartpeper en opsionele paprika, knoffel, gemengde kruie of 'n bietjie rissie. Wees spaarsamig met sout.",
      },
      {
        order: 4,
        instructionEn:
          "In a greased oven dish, layer half the potatoes, half the bacon mixture, half the tomatoes, and a layer of grated cheddar. Repeat with the remaining potatoes, bacon mixture, tomatoes, and a generous final cheddar layer. Press down gently. Add only 2 to 3 tablespoons of water or stock around the edge if the potatoes look dry.",
        instructionAf:
          "In 'n gesmeerde oondskottel, laag helfte van die aartappels, helfte van die spekmengsel, helfte van die tamaties en 'n laag gerasperde cheddar. Herhaal met die res en eindig met 'n ruim cheddar-laag. Druk sag. Voeg net 2 tot 3 eetlepels water of aftreksel om die rand by as die aartappels droog lyk.",
      },
      {
        order: 5,
        timerMinutes: 30,
        instructionEn: "Cover with foil or a lid. Bake at 190°C for 25 to 30 minutes.",
        instructionAf: "Bedek met foelie of 'n deksel. Bak 25 tot 30 minute by 190°C.",
      },
      {
        order: 6,
        timerMinutes: 20,
        instructionEn:
          "Remove the cover and bake another 15 to 20 minutes, until the potatoes are tender and the cheddar is browned. Let it stand 5 to 10 minutes before serving so it firms up.",
        instructionAf:
          "Verwyder die deksel en bak nog 15 tot 20 minute totdat die aartappels sag is en die cheddar bruin is. Laat 5 tot 10 minute staan voor bediening sodat dit styf word.",
      },
    ],
  },
  {
    status: "published",
    audienceUserIds: ["hans", "irma"],
    titleEn: "Cheesy Bacon, Tomato and Pepper Spaghetti",
    summaryEn:
      "The strongest cheddar combination: bacon for flavour, tomato for sauce, vegetables for bulk, and cheese stirred through off the boil.",
    titleAf: "Kaasagtige Spek-, Tamatie- en Peper-spaghetti",
    summaryAf:
      "Die sterkste cheddar-kombinasie: spek vir geur, tamatie vir sous, groente vir volume, en kaas deurgeroer van die kook af.",
    servings: 4,
    prepMinutes: 15,
    cookMinutes: 25,
    cuisine: "Family",
    category: "Main",
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/7/7a/Bucatini_%28amatriciana_rossa%29.jpg",
      source: "Wikimedia Commons",
      author: "stu_spivack",
      license: "CC BY-SA 2.0",
      attributionText: "stu_spivack, CC BY-SA 2.0, via Wikimedia Commons",
      retrievedAt: "2026-08-14",
    },
    ingredients: [
      { name: "Spaghetti", quantity: "400", unit: "g" },
      { name: "Bacon", quantity: "150-250", unit: "g, chopped" },
      { name: "Ripe tomatoes", quantity: "2-3", unit: "chopped or grated" },
      { name: "Onion", quantity: 1, unit: "chopped" },
      { name: "Green pepper", quantity: 1, unit: "chopped" },
      { name: "Carrot", quantity: 1, unit: "finely grated" },
      { name: "Cheddar", quantity: "a generous handful", unit: "grated" },
      { name: "Pasta water", quantity: "0.5", unit: "cup, reserved" },
      { name: "Black pepper", quantity: "to taste" },
      { name: "Paprika or mixed herbs", quantity: "optional" },
    ],
    steps: [
      {
        order: 1,
        timerMinutes: 10,
        instructionEn: "Boil the spaghetti until just tender. Reserve about 1/2 cup pasta water, then drain.",
        instructionAf: "Kook die spaghetti tot net sag. Hou ongeveer 1/2 koppie pastawater, dreineer dan.",
      },
      {
        order: 2,
        timerMinutes: 5,
        instructionEn: "Fry the chopped bacon until browned.",
        instructionAf: "Braai die gekapte spek tot bruin.",
      },
      {
        order: 3,
        timerMinutes: 5,
        instructionEn: "Add the chopped onion and green pepper. Fry for 5 minutes.",
        instructionAf: "Voeg die gekapte ui en groentepeper by. Braai 5 minute.",
      },
      {
        order: 4,
        timerMinutes: 2,
        instructionEn: "Add the grated carrot and cook for another 2 minutes.",
        instructionAf: "Voeg die gerasperde wortel by en kook nog 2 minute.",
      },
      {
        order: 5,
        timerMinutes: 10,
        instructionEn:
          "Add the tomatoes, black pepper, and paprika or mixed herbs if available. Simmer 8 to 10 minutes until thick.",
        instructionAf:
          "Voeg die tamaties, swartpeper en paprika of gemengde kruie by indien beskikbaar. Prut 8 tot 10 minute tot dik.",
      },
      {
        order: 6,
        timerMinutes: 3,
        instructionEn:
          "Add the spaghetti and enough pasta water to loosen the sauce. Turn the heat low and stir through a generous handful of grated cheddar. Do not boil hard after adding the cheese, or it may turn oily.",
        instructionAf:
          "Voeg die spaghetti en genoeg pastawater by om die sous los te maak. Sit die hitte laag en roer 'n ruim handvol gerasperde cheddar deur. Moenie hard kook nadat die kaas by is nie, anders word dit olierig.",
      },
    ],
  },
  {
    status: "published",
    audienceUserIds: ["hans", "irma"],
    titleEn: "Boerewors, Potato and Cheddar Skillet",
    summaryEn:
      "A heavier rustic meal: browned boerewors, fried potatoes, onion, pepper, tomato, and melted cheddar. Bacon is optional.",
    titleAf: "Boerewors-, Aartappel- en Cheddarpan",
    summaryAf:
      "'n Swarter, rustieke ete: gebraaide boerewors, gebraaide aartappels, ui, peper, tamatie en gesmelte cheddar. Spek is opsioneel.",
    servings: 4,
    prepMinutes: 20,
    cookMinutes: 30,
    cuisine: "Family",
    category: "Main",
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/3/3f/Italian_Sausage_in_the_Iron_Skillet_%282489944971%29.jpg",
      source: "Wikimedia Commons",
      author: "Ryan Snyder",
      license: "CC BY 2.0",
      attributionText: "Ryan Snyder, CC BY 2.0, via Wikimedia Commons",
      retrievedAt: "2026-08-14",
    },
    ingredients: [
      { name: "Boerewors", quantity: "300-500", unit: "g" },
      { name: "Potatoes", quantity: "4-6", unit: "diced small" },
      { name: "Onion", quantity: 1, unit: "chopped" },
      { name: "Green pepper", quantity: 1, unit: "chopped" },
      { name: "Ripe tomatoes", quantity: "1-2", unit: "diced" },
      { name: "Bacon", quantity: "optional", unit: "chopped" },
      { name: "Cheddar", quantity: "generous", unit: "grated" },
      { name: "Black pepper", quantity: "to taste" },
      { name: "Paprika, garlic, chilli, Worcestershire sauce, or chutney", quantity: "optional" },
    ],
    steps: [
      {
        order: 1,
        timerMinutes: 8,
        instructionEn: "Dice the potatoes into small cubes and parboil for 6 to 8 minutes. Drain well.",
        instructionAf: "Sny die aartappels in klein blokkies en voorkook 6 tot 8 minute. Dreineer goed.",
      },
      {
        order: 2,
        timerMinutes: 10,
        instructionEn: "Brown the boerewors whole, remove it, then slice it.",
        instructionAf: "Braai die boerewors heel, verwyder dit, en sny dit dan.",
      },
      {
        order: 3,
        timerMinutes: 4,
        instructionEn: "Fry chopped bacon in the same pan, if using.",
        instructionAf: "Braai gekapte spek in dieselfde pan, indien gebruik.",
      },
      {
        order: 4,
        timerMinutes: 8,
        instructionEn: "Add the potatoes and fry until browned.",
        instructionAf: "Voeg die aartappels by en braai tot bruin.",
      },
      {
        order: 5,
        timerMinutes: 6,
        instructionEn: "Add the onion and green pepper. Cook until softened.",
        instructionAf: "Voeg die ui en groentepeper by. Kook tot sag.",
      },
      {
        order: 6,
        timerMinutes: 8,
        instructionEn:
          "Add the diced tomato and the sliced boerewors. Season, cover, and cook for about 8 minutes. Good with paprika, garlic, chilli, Worcestershire sauce, or chutney.",
        instructionAf:
          "Voeg die gekapte tamatie en die gesnyde boerewors by. Geur, sit die deksel op, en kook ongeveer 8 minute. Werk goed met paprika, knoffel, rissie, Worcestershire of blatjang.",
      },
      {
        order: 7,
        timerMinutes: 3,
        instructionEn: "Scatter cheddar over the top, cover again, and let it melt.",
        instructionAf: "Strooi cheddar oor die bokant, sit weer die deksel op, en laat dit smelt.",
      },
    ],
  },
  {
    status: "published",
    audienceUserIds: ["hans", "irma"],
    titleEn: "Cheesy Boerewors and Tomato Pasta Bake",
    summaryEn:
      "Thicker than the stove-top spaghetti: underdone pasta, boerewors, tomato sauce, and cheddar baked at 200°C. No oven: melt the cheddar in a covered pan on very low heat.",
    titleAf: "Kaasagtige Boerewors- en Tamatie-pastabak",
    summaryAf:
      "Dikker as die stoofspaghetti: halfgaar pasta, boerewors, tamatiesous en cheddar by 200°C. Sonder oond: smelt die cheddar in 'n toemaakpan op baie lae hitte.",
    servings: 4,
    prepMinutes: 20,
    cookMinutes: 35,
    cuisine: "Family",
    category: "Main",
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Lasagne_-_stonesoup.jpg",
      source: "Wikimedia Commons",
      author: "jules / stonesoup",
      license: "CC BY 2.0",
      attributionText: "jules / stonesoup, CC BY 2.0, via Wikimedia Commons",
      retrievedAt: "2026-08-14",
    },
    ingredients: [
      { name: "Spaghetti", quantity: "400", unit: "g" },
      { name: "Boerewors", quantity: "300-500", unit: "g" },
      { name: "Ripe tomatoes", quantity: "3-4", unit: "chopped" },
      { name: "Onion", quantity: 1, unit: "chopped" },
      { name: "Green pepper", quantity: 1, unit: "chopped" },
      { name: "Cheddar", quantity: "generous", unit: "grated" },
      { name: "Black pepper", quantity: "to taste" },
      { name: "Paprika or mixed herbs", quantity: "optional" },
    ],
    steps: [
      {
        order: 1,
        timerMinutes: 8,
        instructionEn: "Cook the spaghetti slightly underdone. Drain.",
        instructionAf: "Kook die spaghetti tot net ondergaar. Dreineer.",
      },
      {
        order: 2,
        timerMinutes: 10,
        instructionEn: "Brown the boerewors, then slice it.",
        instructionAf: "Braai die boerewors, sny dit dan.",
      },
      {
        order: 3,
        timerMinutes: 6,
        instructionEn: "Fry the onion and green pepper.",
        instructionAf: "Braai die ui en groentepeper.",
      },
      {
        order: 4,
        timerMinutes: 10,
        instructionEn: "Add the chopped tomatoes and seasoning. Simmer into a thick sauce.",
        instructionAf: "Voeg die gekapte tamaties en geur by. Prut tot 'n dik sous.",
      },
      {
        order: 5,
        instructionEn: "Mix the pasta, sauce, and boerewors together.",
        instructionAf: "Meng die pasta, sous en boerewors saam.",
      },
      {
        order: 6,
        timerMinutes: 20,
        instructionEn:
          "Place in an oven dish, cover with grated cheddar, and bake at 200°C for 15 to 20 minutes. Without an oven, put everything in a large pan, add the cheddar, cover, and melt it over very low heat.",
        instructionAf:
          "Sit in 'n oondskottel, bedek met gerasperde cheddar, en bak 15 tot 20 minute by 200°C. Sonder oond: sit alles in 'n groot pan, voeg die cheddar by, sit die deksel op, en smelt dit op baie lae hitte.",
      },
    ],
  },
  {
    status: "published",
    audienceUserIds: ["hans", "irma"],
    titleEn: "Sirloin, Onion and Pepper Rice Bowls",
    summaryEn:
      "Quick-fried sliced sirloin over rice with onion, pepper, carrot, and tomato. Cheddar is optional, not central.",
    titleAf: "Sirloin-, Ui- en Peper-ryskomme",
    summaryAf:
      "Vinnig gebraaide gesnyde sirloin oor rys met ui, peper, wortel en tamatie. Cheddar is opsioneel, nie die hoofsaak nie.",
    servings: 3,
    prepMinutes: 15,
    cookMinutes: 25,
    cuisine: "Family",
    category: "Main",
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/8/83/Mongolian_Beef_with_rice_and_noodles.jpg",
      source: "Wikimedia Commons",
      author: "Craig Dugas",
      license: "CC BY-SA 2.0",
      attributionText: "Craig Dugas, CC BY-SA 2.0, via Wikimedia Commons",
      retrievedAt: "2026-08-14",
    },
    ingredients: [
      { name: "Sirloin", quantity: "300-400", unit: "g, sliced thin across the grain" },
      { name: "Uncooked rice", quantity: "1.5", unit: "cups" },
      { name: "Onion", quantity: 1, unit: "sliced" },
      { name: "Green pepper", quantity: 1, unit: "sliced" },
      { name: "Carrot", quantity: 1, unit: "sliced" },
      { name: "Ripe tomato", quantity: 1, unit: "diced" },
      { name: "Cheddar", quantity: "optional", unit: "a little grated" },
      { name: "Black pepper", quantity: "to taste" },
      { name: "Garlic, paprika, chilli, or Worcestershire sauce", quantity: "optional" },
    ],
    steps: [
      {
        order: 1,
        timerMinutes: 15,
        instructionEn: "Cook the rice separately.",
        instructionAf: "Kook die rys apart.",
      },
      {
        order: 2,
        timerMinutes: 3,
        instructionEn:
          "Slice the sirloin thinly across the grain. Fry it quickly over high heat, then remove it before it overcooks.",
        instructionAf:
          "Sny die sirloin dun oor die graan. Braai dit vinnig oor hoë hitte en verwyder dit voordat dit oorkook.",
      },
      {
        order: 3,
        timerMinutes: 6,
        instructionEn: "Fry the sliced onion, pepper, and carrot.",
        instructionAf: "Braai die gesnyde ui, peper en wortel.",
      },
      {
        order: 4,
        timerMinutes: 3,
        instructionEn:
          "Add the diced tomato and a small splash of water. Return the steak and cook for only another minute. Best with black pepper, garlic, paprika, chilli, or Worcestershire sauce.",
        instructionAf:
          "Voeg die gekapte tamatie en 'n klein slukkie water by. Sit die steak terug en kook net nog 'n minuut. Werk die beste met swartpeper, knoffel, paprika, rissie of Worcestershire.",
      },
      {
        order: 5,
        instructionEn: "Serve over rice with a little grated cheddar if you want it.",
        instructionAf: "Bedien oor rys met 'n bietjie gerasperde cheddar indien jy wil.",
      },
    ],
  },
]

export function normalizeRecipeTitleKey(title: string): string {
  return title.trim().toLowerCase()
}

export function findMissingSampleRecipes(
  existingRecipes: Array<{ titleEn?: string }>
): RecipeCreatePayload[] {
  const existingTitles = new Set(
    existingRecipes
      .map((recipe) => normalizeRecipeTitleKey(recipe.titleEn ?? ""))
      .filter((title) => title.length > 0)
  )

  return SAMPLE_RECIPES.filter(
    (recipe) => !existingTitles.has(normalizeRecipeTitleKey(recipe.titleEn))
  )
}
