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
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white">{label}</p>
        <p className="text-sm text-white/50">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-12 rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-white/20"}`}
        aria-label={`${label}: ${checked ? "on" : "off"}`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "left-7" : "left-1"}`}
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
    apiFetchSafe<{ options?: string[] }>(
      "/api/settings/storage-options",
      { options: [] },
      { label: "StorageOptions" }
    ).then((d) => setStorageOptions(d?.options || []))
  }, [])

  const handleSave = async () => {
    setSaveError(false)
    try {
      await apiFetch("/api/users/me", {
        method: "PATCH",
        body: { themeId: selectedTheme },
        label: "SaveTheme",
      })
      localStorage.setItem("hov_settings", JSON.stringify(settings))
      await refresh()
      setThemeOverride(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
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
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("settings.profile")}</h1>
          <p className="mt-1 text-white/60">Manage your account settings and preferences</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 border-b border-white/10 p-6">
            <Palette className="text-primary h-5 w-5" />
            <div>
              <h2 className="font-semibold text-white">Appearance</h2>
              <p className="text-sm text-white/50">Choose your personal workspace colours.</p>
            </div>
          </div>
          <div className="p-6">
            <UserThemePicker
              value={selectedTheme}
              onChange={(themeId) => {
                setThemeOverride(themeId)
                document.documentElement.dataset.userTheme = themeId
              }}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 border-b border-white/10 p-6">
            <User className="h-5 w-5 text-blue-400" />
            <h2 className="font-semibold text-white">{t("settings.profile")}</h2>
          </div>
          <div className="space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="settings-name" className="mb-2 block text-sm text-white/60">
                  Name
                </label>
                <input
                  id="settings-name"
                  type="text"
                  value={user?.name || ""}
                  disabled
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white/60"
                />
              </div>
              <div>
                <label htmlFor="settings-email" className="mb-2 block text-sm text-white/60">
                  Email
                </label>
                <input
                  id="settings-email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white/60"
                />
              </div>
              <div>
                <label htmlFor="settings-role" className="mb-2 block text-sm text-white/60">
                  Role
                </label>
                <input
                  id="settings-role"
                  type="text"
                  value={user?.role || ""}
                  disabled
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white/60"
                />
              </div>
              <div>
                <label htmlFor="settings-phone" className="mb-2 block text-sm text-white/60">
                  Phone
                </label>
                <input
                  id="settings-phone"
                  type="tel"
                  value={user?.phone || ""}
                  disabled
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white/60"
                />
              </div>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-3 border-b border-white/10 p-6">
              <Package className="h-5 w-5 text-amber-400" />
              <h2 className="font-semibold text-white">Asset Storage Options</h2>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm text-white/60">
                Manage storage locations for assets (kitchen, storeroom, garage, etc.).
              </p>
              <div className="flex gap-2">
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
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-white/40"
                />
                <button
                  onClick={handleAddStorageOption}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {storageOptions.map((opt) => (
                  <span
                    key={opt}
                    className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm text-white"
                  >
                    {opt}
                    <button
                      onClick={() => handleRemoveStorageOption(opt)}
                      className="rounded p-0.5 hover:bg-white/20"
                      aria-label={`Remove ${opt}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={handleSaveStorageOptions}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
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

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 border-b border-white/10 p-6">
            <Globe className="h-5 w-5 text-green-400" />
            <h2 className="font-semibold text-white">{t("settings.language")}</h2>
          </div>
          <div className="p-6">
            <div className="flex justify-between">
              <div>
                <p className="text-white">Display Language</p>
                <p className="text-sm text-white/50">Choose your preferred language</p>
              </div>
              <LanguageSelector />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 border-b border-white/10 p-6">
            <Bell className="h-5 w-5 text-amber-400" />
            <h2 className="font-semibold text-white">{t("settings.notifications")}</h2>
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

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 border-b border-white/10 p-6">
            <Smartphone className="h-5 w-5 text-purple-400" />
            <h2 className="font-semibold text-white">App Settings</h2>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex justify-between">
              <div>
                <p className="text-white">Install App</p>
                <p className="text-sm text-white/50">
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
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  Install
                </button>
              ) : (
                <span className="text-sm text-white/40">Not available</span>
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

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 border-b border-white/10 p-6">
            <Shield className="h-5 w-5 text-red-400" />
            <h2 className="font-semibold text-white">Security</h2>
          </div>
          <div className="space-y-4 p-6">
            <p className="text-sm text-white/60">
              Change password and clear data from the profile dropdown (top right).
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white">Clear Local Data</p>
                <p className="text-sm text-white/50">Remove cached data from this device</p>
              </div>
              <button className="flex items-center gap-2 rounded-lg bg-red-500/20 px-4 py-2 text-red-400 transition-colors hover:bg-red-500/30">
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          {saved && (
            <span className="flex items-center gap-2 text-green-400">
              <CheckCircle className="h-4 w-4" />
              Settings saved
            </span>
          )}
          {saveError && (
            <span className="text-sm text-red-400" role="alert">
              Settings could not be saved. Please try again.
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}
