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
  retrievedAt: string
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
]
