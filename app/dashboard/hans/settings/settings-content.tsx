"use client"

import { useState, useEffect } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { UserThemePicker } from "@/components/user-theme-picker"
import { useI18n, LanguageSelector } from "@/lib/i18n/context"
import { usePWA } from "@/lib/hooks/use-pwa"
import { useAuth } from "@/lib/auth-context"
import { apiFetch, apiFetchSafe } from "@/lib/api-client"
import { defaultUserThemeForColor, isUserThemeId, type UserThemeId } from "@/lib/user-themes"
import {
  User,
  Globe,
  Bell,
  Smartphone,
  Shield,
  Package,
  Plus,
  X,
  Save,
  CheckCircle,
  Trash2,
  Download,
  Palette,
} from "lucide-react"

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-1 py-1">
      <div className="min-w-0">
        <p className="text-foreground font-medium">{label}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`focus-visible:ring-ring focus-visible:ring-offset-background relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 ${
          checked ? "border-primary bg-primary" : "border-border bg-muted"
        }`}
        aria-label={`${label}: ${checked ? "on" : "off"}`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full shadow-sm transition-transform ${
            checked ? "bg-primary-foreground left-6" : "bg-muted-foreground left-1"
          }`}
        />
      </button>
    </div>
  )
}

export function SettingsPageContent({ persona }: { persona: "hans" | "charl" | "lucky" | "irma" }) {
  const { user, refresh } = useAuth()
  const { t } = useI18n()
  const { isInstalled, canInstall, installApp, requestNotificationPermission } = usePWA()
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    dailyDigest: true,
    weeklyReport: false,
    darkMode: true,
  })
  const [storageOptions, setStorageOptions] = useState<string[]>([])
  const [newStorageOption, setNewStorageOption] = useState("")
  const [storageOptionsSaved, setStorageOptionsSaved] = useState(false)
  const [themeOverride, setThemeOverride] = useState<UserThemeId | null>(null)
  const [saveError, setSaveError] = useState(false)
  const persistedTheme = isUserThemeId(user?.themeId)
    ? user.themeId
    : defaultUserThemeForColor(user?.color)
  const selectedTheme = themeOverride ?? persistedTheme

  useEffect(() => {
    if (themeOverride) {
      document.documentElement.dataset.userTheme = themeOverride
    }

    return () => {
      document.documentElement.dataset.userTheme = persistedTheme
    }
  }, [persistedTheme, themeOverride])

  useEffect(() => {
    apiFetchSafe<{ options?: string[] }>(
      "/api/settings/storage-options",
      { options: [] },
      { label: "StorageOptions" }
    ).then((d) => setStorageOptions(d?.options || []))
  }, [])

  const handleSave = async () => {
    setSaveError(false)
    localStorage.setItem("hov_settings", JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    try {
      await apiFetch("/api/users/me", {
        method: "PATCH",
        body: { themeId: selectedTheme },
        label: "SaveTheme",
      })
      await refresh()
      setThemeOverride(null)
    } catch {
      setSaveError(true)
    }
  }

  const handleEnablePush = async () => {
    const granted = await requestNotificationPermission()
    if (granted) setSettings((prev) => ({ ...prev, pushNotifications: true }))
  }

  const handleAddStorageOption = () => {
    const v = newStorageOption.trim()
    if (v && !storageOptions.includes(v)) {
      setStorageOptions((prev) => [...prev, v])
      setNewStorageOption("")
    }
  }

  const handleRemoveStorageOption = (opt: string) => {
    setStorageOptions((prev) => prev.filter((o) => o !== opt))
  }

  const handleSaveStorageOptions = async () => {
    try {
      await apiFetch("/api/settings/storage-options", {
        method: "POST",
        body: { options: storageOptions },
        label: "SaveStorageOptions",
      })
      setStorageOptionsSaved(true)
      setTimeout(() => setStorageOptionsSaved(false), 3000)
    } catch {
      // ignore
    }
  }

  const isAdmin = persona === "hans"

  return (
    <DashboardLayout persona={persona}>
      <div className="mx-auto max-w-6xl space-y-6 pb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-primary-text text-xs font-semibold tracking-[0.18em] uppercase">
              Workspace preferences
            </p>
            <h1 className="text-foreground mt-1 text-3xl font-bold tracking-tight">
              {t("nav.settings")}
            </h1>
            <p className="text-muted-foreground mt-1">
              Personalise your workspace without changing your role or access.
            </p>
          </div>
          <span className="border-border bg-card/70 text-muted-foreground inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-xs">
            Signed in as {user?.role || "member"}
          </span>
        </div>

        <div className="border-primary/25 bg-card/80 overflow-hidden rounded-3xl border shadow-[0_24px_70px_color-mix(in_srgb,var(--primary)_8%,transparent)] backdrop-blur-sm">
          <div className="border-border/70 from-primary/10 flex items-center gap-3 border-b bg-linear-to-r via-transparent to-transparent p-5 sm:p-6">
            <div className="bg-primary/15 text-primary-text flex h-10 w-10 items-center justify-center rounded-xl">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-foreground font-semibold">Appearance</h2>
              <p className="text-muted-foreground text-sm">
                Preview a palette instantly. Save when it feels right.
              </p>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <UserThemePicker value={selectedTheme} onChange={setThemeOverride} />
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <div className="border-border/80 bg-card/75 overflow-hidden rounded-2xl border backdrop-blur-sm">
            <div className="border-border/70 flex items-center gap-3 border-b p-5">
              <User className="text-primary-text h-5 w-5" />
              <h2 className="text-foreground font-semibold">{t("settings.profile")}</h2>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="settings-name"
                    className="text-muted-foreground mb-2 block text-sm"
                  >
                    Name
                  </label>
                  <input
                    id="settings-name"
                    type="text"
                    value={user?.name || ""}
                    disabled
                    className="border-border bg-muted/55 text-muted-foreground w-full rounded-xl border px-4 py-3"
                  />
                </div>
                <div>
                  <label
                    htmlFor="settings-email"
                    className="text-muted-foreground mb-2 block text-sm"
                  >
                    Email
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="border-border bg-muted/55 text-muted-foreground w-full rounded-xl border px-4 py-3"
                  />
                </div>
                <div>
                  <label
                    htmlFor="settings-role"
                    className="text-muted-foreground mb-2 block text-sm"
                  >
                    Role
                  </label>
                  <input
                    id="settings-role"
                    type="text"
                    value={user?.role || ""}
                    disabled
                    className="border-border bg-muted/55 text-muted-foreground w-full rounded-xl border px-4 py-3"
                  />
                </div>
                <div>
                  <label
                    htmlFor="settings-phone"
                    className="text-muted-foreground mb-2 block text-sm"
                  >
                    Phone
                  </label>
                  <input
                    id="settings-phone"
                    type="tel"
                    value={user?.phone || ""}
                    disabled
                    className="border-border bg-muted/55 text-muted-foreground w-full rounded-xl border px-4 py-3"
                  />
                </div>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="border-border/80 bg-card/75 overflow-hidden rounded-2xl border backdrop-blur-sm">
              <div className="border-border/70 flex items-center gap-3 border-b p-5">
                <Package className="text-primary-text h-5 w-5" />
                <h2 className="text-foreground font-semibold">Asset Storage Options</h2>
              </div>
              <div className="space-y-4 p-6">
                <p className="text-muted-foreground text-sm">
                  Manage storage locations for assets (kitchen, storeroom, garage, etc.).
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="new-storage-option" className="sr-only">
                    New storage option
                  </label>
                  <input
                    id="new-storage-option"
                    type="text"
                    value={newStorageOption}
                    onChange={(e) => setNewStorageOption(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), handleAddStorageOption())
                    }
                    placeholder="e.g. basement"
                    className="border-input bg-background/60 text-foreground placeholder:text-muted-foreground flex-1 rounded-xl border px-4 py-2"
                  />
                  <button
                    onClick={handleAddStorageOption}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {storageOptions.map((opt) => (
                    <span
                      key={opt}
                      className="border-border bg-muted/70 text-foreground inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
                    >
                      {opt}
                      <button
                        onClick={() => handleRemoveStorageOption(opt)}
                        className="hover:bg-background rounded p-0.5"
                        aria-label={`Remove ${opt}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  onClick={handleSaveStorageOptions}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-xl px-4 py-2 font-medium transition-colors"
                >
                  {storageOptionsSaved ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Storage Options
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <div className="border-border/80 bg-card/75 overflow-hidden rounded-2xl border backdrop-blur-sm">
            <div className="border-border/70 flex items-center gap-3 border-b p-5">
              <Globe className="text-primary-text h-5 w-5" />
              <h2 className="text-foreground font-semibold">{t("settings.language")}</h2>
            </div>
            <div className="p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-foreground font-medium">Display Language</p>
                  <p className="text-muted-foreground text-sm">Choose your preferred language</p>
                </div>
                <LanguageSelector />
              </div>
            </div>
          </div>

          <div className="border-border/80 bg-card/75 row-span-2 overflow-hidden rounded-2xl border backdrop-blur-sm">
            <div className="border-border/70 flex items-center gap-3 border-b p-5">
              <Bell className="text-primary-text h-5 w-5" />
              <h2 className="text-foreground font-semibold">{t("settings.notifications")}</h2>
            </div>
            <div className="space-y-4 p-6">
              <ToggleSetting
                label="Email Notifications"
                description="Receive updates via email"
                checked={settings.emailNotifications}
                onChange={(val) => setSettings((prev) => ({ ...prev, emailNotifications: val }))}
              />
              <ToggleSetting
                label="SMS Notifications"
                description="Receive urgent alerts via SMS"
                checked={settings.smsNotifications}
                onChange={(val) => setSettings((prev) => ({ ...prev, smsNotifications: val }))}
              />
              <ToggleSetting
                label="Push Notifications"
                description="Receive browser/app notifications"
                checked={settings.pushNotifications}
                onChange={(val) =>
                  val
                    ? handleEnablePush()
                    : setSettings((prev) => ({ ...prev, pushNotifications: false }))
                }
              />
              <ToggleSetting
                label="Daily Digest"
                description="Receive a daily summary"
                checked={settings.dailyDigest}
                onChange={(val) => setSettings((prev) => ({ ...prev, dailyDigest: val }))}
              />
              <ToggleSetting
                label="Weekly Report"
                description="Receive a weekly report"
                checked={settings.weeklyReport}
                onChange={(val) => setSettings((prev) => ({ ...prev, weeklyReport: val }))}
              />
            </div>
          </div>

          <div className="border-border/80 bg-card/75 overflow-hidden rounded-2xl border backdrop-blur-sm">
            <div className="border-border/70 flex items-center gap-3 border-b p-5">
              <Smartphone className="text-primary-text h-5 w-5" />
              <h2 className="text-foreground font-semibold">App Settings</h2>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-foreground font-medium">Install App</p>
                  <p className="text-muted-foreground text-sm">
                    {isInstalled ? "App is installed" : "Install for offline access"}
                  </p>
                </div>
                {isInstalled ? (
                  <span className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    Installed
                  </span>
                ) : canInstall ? (
                  <button
                    onClick={installApp}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-xl px-4 py-2 font-medium transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Install
                  </button>
                ) : (
                  <span className="text-muted-foreground text-sm">Not available</span>
                )}
              </div>
              <ToggleSetting
                label="Dark Mode"
                description="Use dark theme"
                checked={settings.darkMode}
                onChange={(val) => setSettings((prev) => ({ ...prev, darkMode: val }))}
              />
            </div>
          </div>

          <div className="border-border/80 bg-card/75 overflow-hidden rounded-2xl border backdrop-blur-sm">
            <div className="border-border/70 flex items-center gap-3 border-b p-5">
              <Shield className="h-5 w-5 text-red-400" />
              <h2 className="text-foreground font-semibold">Security</h2>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-muted-foreground text-sm">
                Change password and clear data from the profile dropdown (top right).
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground font-medium">Clear Local Data</p>
                  <p className="text-muted-foreground text-sm">
                    Remove cached data from this device
                  </p>
                </div>
                <button className="flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-red-400 transition-colors hover:bg-red-500/30">
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-border bg-background/90 sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl border p-3 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-end">
          {saved && (
            <span className="flex items-center gap-2 text-green-400">
              <CheckCircle className="h-4 w-4" />
              Settings saved
            </span>
          )}
          {saveError && (
            <span className="text-sm text-red-400" role="alert">
              Local settings saved, but your theme could not be synced. Please try again.
            </span>
          )}
          <button
            onClick={handleSave}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold transition-colors"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}
