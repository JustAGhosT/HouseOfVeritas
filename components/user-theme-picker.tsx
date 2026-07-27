"use client"

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
  return (
    <div
      className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}
      role="radiogroup"
      aria-label="Workspace theme"
      data-testid="user-theme-picker"
    >
      {USER_THEME_OPTIONS.map((theme) => {
        const selected = value === theme.id
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(theme.id)}
            className={`focus-visible:ring-primary relative rounded-xl border p-3 text-left transition-all focus-visible:ring-2 disabled:opacity-50 ${
              selected
                ? "border-primary bg-primary/15 shadow-[0_0_24px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
            }`}
            data-testid={`user-theme-${theme.id}`}
          >
            {selected && (
              <span className="bg-primary text-primary-foreground absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            )}
            <span className="mb-3 flex gap-1" aria-hidden="true">
              {theme.swatches.map((swatch) => (
                <span
                  key={swatch}
                  className="h-6 flex-1 rounded-md"
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </span>
            <span className="block pr-6 font-medium text-white">{theme.name}</span>
            <span className="mt-1 block text-xs text-white/55">{theme.description}</span>
          </button>
        )
      })}
    </div>
  )
}
