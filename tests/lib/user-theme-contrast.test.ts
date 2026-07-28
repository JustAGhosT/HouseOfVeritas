import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { USER_THEME_IDS } from "@/lib/user-themes"

const css = readFileSync("app/globals.css", "utf8")

function luminance(hex: string) {
  const channels = hex
    .match(/[0-9a-f]{2}/gi)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    )

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(first: string, second: string) {
  const firstLuminance = luminance(first)
  const secondLuminance = luminance(second)
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  )
}

function themeVariable(themeId: string, variable: string) {
  const block = css.match(
    new RegExp(`html\\[data-user-theme="${themeId}"\\] \\{([\\s\\S]*?)\\n\\}`)
  )?.[1]
  const value = block?.match(new RegExp(`--${variable}:\\s*(#[0-9A-Fa-f]{6})`))?.[1]
  expect(value, `${themeId} defines --${variable}`).toBeTruthy()
  return value!
}

describe("user theme contrast", () => {
  it.each(USER_THEME_IDS)("keeps %s fills and dark-surface text readable", (themeId) => {
    const primary = themeVariable(themeId, "primary")
    const primaryForeground = themeVariable(themeId, "primary-foreground")
    const primaryText = themeVariable(themeId, "primary-text")

    expect(contrast(primary, primaryForeground)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(primaryText, "#0F0F12")).toBeGreaterThanOrEqual(4.5)
  })
})
