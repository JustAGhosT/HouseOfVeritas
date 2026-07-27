export const USER_THEME_IDS = ["sanctum", "ocean", "ember", "garden", "amethyst"] as const

export type UserThemeId = (typeof USER_THEME_IDS)[number]

export interface UserThemeOption {
  id: UserThemeId
  name: string
  description: string
  swatches: readonly [string, string, string]
}

export const USER_THEME_OPTIONS: readonly UserThemeOption[] = [
  {
    id: "sanctum",
    name: "Sanctum Gold",
    description: "The classic House of Veritas palette.",
    swatches: ["#d4af37", "#4b2e83", "#8b1e2d"],
  },
  {
    id: "ocean",
    name: "Ocean Blue",
    description: "A calm blue and cyan workspace.",
    swatches: ["#3b82f6", "#06b6d4", "#6366f1"],
  },
  {
    id: "ember",
    name: "Ember",
    description: "Warm amber and orange accents.",
    swatches: ["#f59e0b", "#f97316", "#eab308"],
  },
  {
    id: "garden",
    name: "Garden",
    description: "Natural green and teal tones.",
    swatches: ["#22c55e", "#14b8a6", "#84cc16"],
  },
  {
    id: "amethyst",
    name: "Amethyst",
    description: "Rich purple and rose accents.",
    swatches: ["#a855f7", "#ec4899", "#8b5cf6"],
  },
] as const

export function isUserThemeId(value: unknown): value is UserThemeId {
  return typeof value === "string" && USER_THEME_IDS.some((themeId) => themeId === value)
}

export function defaultUserThemeForColor(color?: string | null): UserThemeId {
  switch (color) {
    case "blue":
      return "ocean"
    case "amber":
      return "ember"
    case "green":
      return "garden"
    case "purple":
      return "amethyst"
    default:
      return "sanctum"
  }
}
