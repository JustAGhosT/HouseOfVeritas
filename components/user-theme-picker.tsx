"use client"

import { useRef, type KeyboardEvent } from "react"
import { Check } from "lucide-react"
import { USER_THEME_OPTIONS, type UserThemeId } from "@/lib/user-themes"

interface UserThemePickerProps {
  value: UserThemeId
  onChange: (themeId: UserThemeId) => void
  disabled?: boolean
  compact?: boolean
}

export function UserThemePicker({
  value,
  onChange,
  disabled = false,
  compact = false,
}: UserThemePickerProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % USER_THEME_OPTIONS.length
        break
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + USER_THEME_OPTIONS.length) % USER_THEME_OPTIONS.length
        break
      case "Home":
        nextIndex = 0
        break
      case "End":
        nextIndex = USER_THEME_OPTIONS.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    const nextTheme = USER_THEME_OPTIONS[nextIndex]
    onChange(nextTheme.id)
    optionRefs.current[nextIndex]?.focus()
  }

  return (
    <div
      className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-5"}
      role="radiogroup"
      aria-label="Workspace theme"
      data-testid="user-theme-picker"
    >
      {USER_THEME_OPTIONS.map((theme, index) => {
        const selected = value === theme.id
        return (
          <button
            key={theme.id}
            ref={(element) => {
              optionRefs.current[index] = element
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-describedby={`user-theme-${theme.id}-description`}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(theme.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`group focus-visible:ring-primary relative min-h-36 overflow-hidden rounded-2xl border p-3 text-left transition-all duration-200 focus-visible:ring-2 disabled:opacity-50 ${
              selected
                ? "border-primary bg-primary/12 ring-primary/30 -translate-y-0.5 shadow-[0_16px_40px_color-mix(in_srgb,var(--primary)_16%,transparent)] ring-1"
                : "border-border/80 bg-card/70 hover:border-primary/45 hover:bg-card hover:-translate-y-0.5"
            }`}
            data-testid={`user-theme-${theme.id}`}
          >
            {selected && (
              <span className="bg-primary text-primary-foreground absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold tracking-wide uppercase">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Selected
              </span>
            )}
            <span
              className="border-border/70 bg-background/40 mb-4 flex h-12 gap-1 overflow-hidden rounded-xl border p-1"
              aria-hidden="true"
            >
              {theme.swatches.map((swatch) => (
                <span
                  key={swatch}
                  className="flex-1 rounded-lg transition-transform duration-200 group-hover:scale-y-105"
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </span>
            <span className="text-foreground block pr-6 font-semibold">{theme.name}</span>
            <span
              id={`user-theme-${theme.id}-description`}
              className="text-muted-foreground mt-1 block text-xs leading-relaxed"
            >
              {theme.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}
