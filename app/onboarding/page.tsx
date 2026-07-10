"use client"

import { ErrorBoundary } from "@/components/error-boundary"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RESPONSIBILITIES } from "@/lib/access-config"
import { apiFetch, apiFetchSafe } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { logger } from "@/lib/logger"
import { useLoginModal } from "@/lib/login-modal-context"
import {
  ArrowRight,
  Bell,
  Camera,
  CheckCircle,
  ChevronDown,
  FileSignature,
  Loader2,
  Shield,
  User,
  Users,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  operator: "Operator",
  resident: "Resident",
  employee: "Employee",
}

const ROLES = ["operator", "employee", "resident"] as const

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { openLoginModal } = useLoginModal()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [authError, setAuthError] = useState(false)
  const [fetchedUser, setFetchedUser] = useState<{
    id: string
    name: string
    role: string
    responsibilities?: string[]
  } | null>(null)

  const profileUser = fetchedUser ?? user

  // Open login modal when auth is required (but not when auth error is already handled)
  useEffect(() => {
    if (!isAuthenticated && !authError) {
      openLoginModal()
    }
  }, [isAuthenticated, openLoginModal, authError])
  const [confirmedRole, setConfirmedRole] = useState(false)
  const [confirmedResponsibilities, setConfirmedResponsibilities] = useState(false)
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<Set<string>>(new Set())
  const [roleRequestOpen, setRoleRequestOpen] = useState(false)
  const [requestedRole, setRequestedRole] = useState("")
  const [roleRequestSent, setRoleRequestSent] = useState(false)
  const [documentsSigned, setDocumentsSigned] = useState(false)
  const [onboardingDocs, setOnboardingDocs] = useState<{ id: string; name: string }[]>([])
  const [signingDoc, setSigningDoc] = useState<string | null>(null)
  const [photoUploaded, setPhotoUploaded] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState({ email: true, sms: false, push: true })
  const [twoFaEnabled, setTwoFaEnabled] = useState(false)

  useEffect(() => {
    apiFetchSafe<{
      user?: {
        id: string
        name: string
        role: string
        responsibilities?: string[]
        onboardingStatus?: string
      }
    } | null>("/api/users/me", null, { label: "UsersMe" })
      .then((data) => {
        if (data?.user) {
          const u = data.user as {
            id: string
            name: string
            role: string
            responsibilities?: string[]
          }
          setFetchedUser(u)
          setSelectedResponsibilities(new Set(u.responsibilities || []))
          setLoading(false)
          if (data.user.onboardingStatus === "completed") {
            router.push(`/dashboard/${data.user.id}`)
          }
        }
      })
      .catch((err) => {
        // Extract status from error response
        const status =
          err?.status ?? err?.response?.status ?? (err instanceof Response ? err.status : undefined)
        logger.error("Failed to fetch onboarding user", {
          error: err instanceof Error ? err.message : String(err),
          status,
        })
        const isAuthError = status === 401 || status === 403
        if (isAuthError) {
          setAuthError(true)
          setLoading(false) // Stop loading immediately
          openLoginModal()
        } else {
          setError(err instanceof Error ? err : new Error("Failed to fetch user"))
          setLoading(false)
        }
      })
  }, [router, openLoginModal, isAuthenticated])

  useEffect(() => {
    if (!profileUser) return
    apiFetchSafe<{ documents?: { id: string; name: string }[] }>(
      "/api/onboarding/documents",
      { documents: [] },
      { label: "OnboardingDocs" }
    ).then((data) => setOnboardingDocs(data?.documents || []))
  }, [profileUser])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      await apiFetch("/api/users/me/photo", {
        method: "POST",
        body: formData,
        label: "UploadPhoto",
      })
      setPhotoUploaded(true)
    } finally {
      setUploadingPhoto(false)
      e.target.value = ""
    }
  }

  const handleSaveNotifPrefs = () => {
    localStorage.setItem("hov_notif_prefs", JSON.stringify(notifPrefs))
  }

  const handleSignDocument = async (templateId: string) => {
    setSigningDoc(templateId)
    try {
      const data = await apiFetch<{
        submissionId?: string
        signingUrl?: string
      }>("/api/onboarding/documents", {
        method: "POST",
        body: { templateId },
        label: "SignDocument",
      })
      if (data?.submissionId) {
        setDocumentsSigned(true)
      }
      if (data?.signingUrl) {
        window.open(data.signingUrl, "_blank", "noopener,noreferrer")
      }
    } finally {
      setSigningDoc(null)
    }
  }

  const handleSubmitRoleRequest = async () => {
    if (!requestedRole.trim()) return
    try {
      await apiFetch("/api/users/me/onboarding-feedback", {
        method: "POST",
        body: { roleChangeRequest: requestedRole },
        label: "RoleRequest",
      })
      setRoleRequestSent(true)
    } catch {
      setRoleRequestSent(false)
    }
  }

  const handleSaveResponsibilities = async () => {
    try {
      await apiFetch("/api/users/me/onboarding-feedback", {
        method: "POST",
        body: { responsibilities: Array.from(selectedResponsibilities) },
        label: "Responsibilities",
      })
    } catch {
      // ignore
    }
  }

  const toggleResponsibility = (r: string) => {
    setSelectedResponsibilities((prev) => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return next
    })
  }

  const handleStartTutorial = async () => {
    if (!profileUser?.id) return
    await handleSaveResponsibilities()
    try {
      await apiFetch("/api/users/me/onboard", { method: "POST", label: "Onboard" })
      router.push(`/dashboard/${profileUser.id}?tutorial=1`)
    } catch {
      router.push(`/dashboard/${profileUser.id}?tutorial=1`)
    }
  }

  const handleClose = () => {
    router.push(`/dashboard/${profileUser?.id || ""}`)
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black/60 p-4">
        <div
          className="rounded-lg border border-red-800/50 bg-red-900/20 p-6 text-center"
          role="alert"
          aria-live="polite"
        >
          <p className="mb-2 text-red-400">Unable to load onboarding</p>
          <p className="mb-4 text-sm text-red-300/70">Please try again.</p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="border-red-800/50"
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (loading || !profileUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black/60">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <Card className="relative max-h-[90vh] w-full max-w-lg overflow-hidden border-white/20 bg-[#0d0d12] shadow-2xl">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 pr-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20">
                  <Users className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Welcome to House of Veritas</CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2 text-white/70">
                    <User className="h-4 w-4" />
                    {profileUser.name}
                  </CardDescription>
                </div>
              </div>
              <p className="mt-2 text-sm text-white/50">
                Please confirm your role and responsibilities to complete onboarding.
              </p>
            </CardHeader>

            <CardContent className="space-y-6 pb-8">
              <div>
                <p className="mb-2 text-sm font-medium text-white/80">Your assigned role</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-white/10 px-3 py-1.5 text-white">
                    {ROLE_LABELS[profileUser.role] || profileUser.role}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
                    onClick={() => setRoleRequestOpen(!roleRequestOpen)}
                  >
                    Request different role
                    <ChevronDown
                      className={`ml-1 h-4 w-4 transition-transform ${roleRequestOpen ? "rotate-180" : ""}`}
                    />
                  </Button>
                </div>
                {roleRequestOpen && (
                  <div className="mt-3 space-y-2">
                    <select
                      value={requestedRole}
                      onChange={(e) => setRequestedRole(e.target.value)}
                      className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white"
                      title="Select role to request"
                      aria-label="Select role to request"
                    >
                      <option value="">Select role to request</option>
                      {ROLES.filter((r) => r !== profileUser.role).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={handleSubmitRoleRequest}
                      disabled={!requestedRole || roleRequestSent}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {roleRequestSent ? "Request sent" : "Submit request"}
                    </Button>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Checkbox
                    id="confirm-role"
                    checked={confirmedRole}
                    onCheckedChange={(v) => setConfirmedRole(!!v)}
                  />
                  <Label htmlFor="confirm-role" className="cursor-pointer text-sm text-white/70">
                    I confirm this is my correct role
                  </Label>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-white/80">
                  Your responsibilities (select to accept, deselect to deny)
                </p>
                <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                  {RESPONSIBILITIES.map((r) => (
                    <label
                      key={r}
                      className="flex cursor-pointer items-center gap-2 text-sm text-white/80"
                    >
                      <Checkbox
                        checked={selectedResponsibilities.has(r)}
                        onCheckedChange={() => toggleResponsibility(r)}
                      />
                      {r}
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Checkbox
                    id="confirm-resp"
                    checked={confirmedResponsibilities}
                    onCheckedChange={(v) => {
                      setConfirmedResponsibilities(!!v)
                      if (v) handleSaveResponsibilities()
                    }}
                  />
                  <Label htmlFor="confirm-resp" className="cursor-pointer text-sm text-white/70">
                    I confirm I understand my responsibilities
                  </Label>
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white/80">
                  <Camera className="h-4 w-4" />
                  Profile photo
                </p>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="hidden"
                  id="profile-photo-input"
                />
                <label
                  htmlFor="profile-photo-input"
                  className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                >
                  {uploadingPhoto
                    ? "Uploading..."
                    : photoUploaded
                      ? "Photo uploaded ✓"
                      : "Take photo or upload"}
                </label>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white/80">
                  <Bell className="h-4 w-4" />
                  Notification preferences
                </p>
                <div className="space-y-2">
                  {(["email", "sms", "push"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={notifPrefs[k]}
                        onChange={(e) => setNotifPrefs((p) => ({ ...p, [k]: e.target.checked }))}
                        className="rounded"
                      />
                      {k === "email" ? "Email" : k === "sms" ? "SMS" : "Push notifications"}
                    </label>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveNotifPrefs}
                    className="mt-2 border-white/20"
                  >
                    Save preferences
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white/80">
                  <Shield className="h-4 w-4" />
                  Two-factor authentication (optional)
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTwoFaEnabled(true)}
                  disabled={twoFaEnabled}
                  className="border-white/20"
                >
                  {twoFaEnabled ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Skip for now
                    </span>
                  ) : (
                    "I'll set up 2FA later"
                  )}
                </Button>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white/80">
                  <FileSignature className="h-4 w-4" />
                  Sign initial documents
                </p>
                {onboardingDocs.length > 0 ? (
                  <div className="space-y-2">
                    {onboardingDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-lg bg-white/5 p-2"
                      >
                        <span className="text-white/80">{doc.name}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSignDocument(doc.id)}
                          disabled={!!signingDoc}
                          className="border-white/20"
                        >
                          {signingDoc === doc.id ? "Sending..." : "Sign"}
                        </Button>
                      </div>
                    ))}
                    {documentsSigned && (
                      <p className="flex items-center gap-1 text-sm text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        Signature request sent
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-white/40 italic">
                    No documents required for your role.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleClose} className="border-white/20">
                  Complete later
                </Button>
                <Button
                  onClick={handleStartTutorial}
                  disabled={!confirmedRole || !confirmedResponsibilities}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Start Guided Tour
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>
    </ErrorBoundary>
  )
}
