"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LogOut, User, Phone, Key, RotateCcw, ChevronDown, Settings, Shield } from "lucide-react"
import Image from "next/image"
import { apiFetch, ApiError } from "@/lib/api-client"
import { generateCrest } from "@/lib/design/crest"

const colorClasses: Record<string, string> = {
  blue: "bg-primary text-primary-foreground",
  amber: "bg-muted text-foreground",
  green: "bg-secondary text-secondary-foreground",
  purple: "bg-accent text-accent-foreground",
  gray: "bg-muted text-muted-foreground",
}

interface UserProfileDropdownProps {
  user: {
    id: string
    name: string
    email: string
    phone?: string
    role: string
    color?: string
    icon?: string
    photoUrl?: string
  }
  personaInfo: { name: string; role: string; color: string; icon: string }
  onLogout: () => void
  onRepeatTutorial?: () => void
  compact?: boolean
}

export function UserProfileDropdown({
  user,
  personaInfo,
  onLogout,
  onRepeatTutorial,
  compact = false,
}: UserProfileDropdownProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [phone, setPhone] = useState(user.phone || "")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (editOpen) setPhone(user.phone || "")
  }, [editOpen, user.phone])

  const color = user.color || personaInfo.color || "blue"
  const icon = user.icon || personaInfo.icon || "👤"

  const handleSaveProfile = async () => {
    setSaving(true)
    setError("")
    try {
      await apiFetch("/api/users/me", {
        method: "PATCH",
        body: { phone },
        label: "SaveProfile",
      })
      setEditOpen(false)
      router.refresh()
    } catch (err) {
      setError(
        err instanceof ApiError && typeof err.body === "object" && err.body && "error" in err.body
          ? String((err.body as { error?: string }).error)
          : "Failed to save"
      )
    } finally {
      setSaving(false)
    }
  }

  const handleSavePassword = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    setSaving(true)
    setError("")
    try {
      await apiFetch("/api/users/me/password", {
        method: "POST",
        body: { password },
        label: "SavePassword",
      })
      setPasswordOpen(false)
      setPassword("")
      setConfirmPassword("")
      router.refresh()
    } catch (err) {
      setError(
        err instanceof ApiError && typeof err.body === "object" && err.body && "error" in err.body
          ? String((err.body as { error?: string }).error)
          : "Failed to update password"
      )
    } finally {
      setSaving(false)
    }
  }

  const handleRepeatTutorial = () => {
    onRepeatTutorial?.()
    router.push(`/dashboard/${user.id}?tutorial=1`)
  }

  const crestCore = useMemo(
    () => generateCrest(user.name || personaInfo.name).core,
    [user.name, personaInfo.name]
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`flex items-center gap-3 rounded-xl p-2 transition-all ${compact ? "w-full" : ""} text-left hover:bg-muted`}
            data-testid="user-profile-trigger"
          >
            <div
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ${user.photoUrl ? "bg-transparent" : `${colorClasses[color] || colorClasses.blue}`}`}
            >
              {user.photoUrl ? (
                <Image src={user.photoUrl} alt="" fill className="object-cover" unoptimized />
              ) : (
                <span className="text-xl leading-none">{crestCore}</span>
              )}
            </div>
            <div className="hidden min-w-0 flex-1 sm:block">
              <p className="font-serif truncate text-sm font-medium text-foreground">
                {user.name || personaInfo.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user.role || personaInfo.role}</p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 border-border bg-card">
          <DropdownMenuItem
            onClick={() => router.push(`/sigil-builder`)}
            className="text-primary font-medium focus:bg-primary/20 focus:text-primary"
          >
            <Shield className="mr-2 h-4 w-4" />
            Forge Identity
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/${user.id}/settings`)}
            className="text-foreground focus:bg-muted focus:text-foreground"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setEditOpen(true)}
            className="text-foreground focus:bg-muted focus:text-foreground"
          >
            <User className="mr-2 h-4 w-4" />
            Edit profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setPasswordOpen(true)}
            className="text-foreground focus:bg-muted focus:text-foreground"
          >
            <Key className="mr-2 h-4 w-4" />
            Change password
          </DropdownMenuItem>
          {onRepeatTutorial && (
            <DropdownMenuItem
              onClick={handleRepeatTutorial}
              className="text-foreground focus:bg-muted focus:text-foreground"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Repeat tutorial
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={onLogout}
            className="text-destructive focus:bg-destructive/20 focus:text-destructive"
            data-testid="header-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update your phone number and other details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-foreground">Phone</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-2 border-border bg-muted/50"
                placeholder="+27..."
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              className="border-border hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordOpen}
        onOpenChange={(open) => {
          setPasswordOpen(open)
          if (!open) {
            setPassword("")
            setConfirmPassword("")
            setError("")
          }
        }}
      >
        <DialogContent className="border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter your new password. Must be at least 6 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-foreground">New password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 border-border bg-muted/50"
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label className="text-foreground">Confirm password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-2 border-border bg-muted/50"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPasswordOpen(false)}
              className="border-border hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePassword}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Saving..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
