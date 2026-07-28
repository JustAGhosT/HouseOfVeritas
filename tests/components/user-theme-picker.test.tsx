import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { UserThemePicker } from "@/components/user-theme-picker"
import type { UserThemeId } from "@/lib/user-themes"

function ControlledThemePicker() {
  const [theme, setTheme] = useState<UserThemeId>("sanctum")
  return <UserThemePicker value={theme} onChange={setTheme} />
}

describe("UserThemePicker", () => {
  it("uses roving focus and arrow keys for its radio options", async () => {
    const user = userEvent.setup()
    render(<ControlledThemePicker />)

    const radios = screen.getAllByRole("radio")
    expect(radios[0]).toHaveAttribute("tabindex", "0")
    expect(radios[1]).toHaveAttribute("tabindex", "-1")

    radios[0].focus()
    await user.keyboard("{ArrowRight}")

    expect(radios[1]).toHaveFocus()
    expect(radios[1]).toHaveAttribute("aria-checked", "true")
    expect(radios[0]).toHaveAttribute("tabindex", "-1")
    expect(radios[1]).toHaveAttribute("tabindex", "0")

    await user.keyboard("{End}")
    expect(radios[radios.length - 1]).toHaveFocus()
    expect(radios[radios.length - 1]).toHaveAttribute("aria-checked", "true")
  })
})
