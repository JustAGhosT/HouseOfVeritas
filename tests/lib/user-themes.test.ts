import { describe, expect, it } from "vitest"
import { USER_THEME_OPTIONS, defaultUserThemeForColor, isUserThemeId } from "@/lib/user-themes"

describe("user themes", () => {
  it("exposes unique selectable themes", () => {
    const ids = USER_THEME_OPTIONS.map((theme) => theme.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(["sanctum", "ocean", "ember", "garden", "amethyst"])
  })

  it("validates persisted theme identifiers", () => {
    expect(isUserThemeId("garden")).toBe(true)
    expect(isUserThemeId("administrator")).toBe(false)
    expect(isUserThemeId(null)).toBe(false)
  })

  it("preserves legacy persona palettes for users without a preference", () => {
    expect(defaultUserThemeForColor("blue")).toBe("ocean")
    expect(defaultUserThemeForColor("amber")).toBe("ember")
    expect(defaultUserThemeForColor("green")).toBe("garden")
    expect(defaultUserThemeForColor("purple")).toBe("amethyst")
    expect(defaultUserThemeForColor("gray")).toBe("sanctum")
  })

  it("keeps the picker swatches aligned with accessible primary colors", () => {
    expect(USER_THEME_OPTIONS.find((theme) => theme.id === "ocean")?.swatches[0]).toBe("#2563eb")
    expect(USER_THEME_OPTIONS.find((theme) => theme.id === "amethyst")?.swatches[0]).toBe(
      "#9333ea"
    )
  })
})
