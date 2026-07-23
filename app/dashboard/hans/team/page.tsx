"use client"

import { useState, useEffect, useCallback } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  RefreshCw,
  UserCheck,
  UserX,
  Loader2,
  Edit,
  XCircle,
  UserPlus,
  Briefcase,
  Send,
  Copy,
} from "lucide-react"
import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"
import type { UserWithManagement, UserStatus, OnboardingStatus } from "@/lib/user-management"
import type { UserRole } from "@/lib/users"
import { EmployeesPage } from "@/components/shared/employees-page"

const STATUS_LABELS: Record<UserStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  onboarding: "Onboarding",
  offboarding: "Offboarding",
  offboarded: "Offboarded",
}

const ONBOARDING_LABELS: Record<OnboardingStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  operator: "Operator",
  resident: "Resident",
  employee: "Employee",
}

export default function HansTeamPage() {
  const [users, setUsers] = useState<UserWithManagement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserWithManagement | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editForm, setEditForm] = useState<Partial<UserWithManagement>>({})
  const [processing, setProcessing] = useState(false)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<{
    userId: string
    inviteLink: string
    channels?: string[]
  } | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiFetch<{ users?: UserWithManagement[] }>("/api/users", {
        label: "Users",
      })
      setUsers(data?.users || [])
    } catch (error) {
      logger.error("Failed to fetch users", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleOnboard = async (user: UserWithManagement) => {
    setProcessing(true)
    try {
      await apiFetch(`/api/users/${user.id}/onboard`, { method: "POST", label: "Onboard" })
      await fetchUsers()
    } catch (error) {
      logger.error("Onboard failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleInvite = async (user: UserWithManagement) => {
    setInvitingId(user.id)
    setInviteResult(null)
    try {
      const result = await apiFetch<{
        inviteLink?: string
        channels?: string[]
      }>(`/api/users/${user.id}/invite`, { method: "POST", label: "Invite" })
      if (result.inviteLink) {
        setInviteResult({
          userId: user.id,
          inviteLink: result.inviteLink,
          channels: result.channels,
        })
      }
      await fetchUsers()
    } catch (error) {
      logger.error("Invite failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setInvitingId(null)
    }
  }

  const handleOffboard = async (user: UserWithManagement, complete = false) => {
    setProcessing(true)
    try {
      await apiFetch(`/api/users/${user.id}/offboard`, {
        method: "POST",
        body: { complete },
        label: "Offboard",
      })
      await fetchUsers()
    } catch (error) {
      logger.error("Offboard failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedUser) return
    setProcessing(true)
    try {
      await apiFetch(`/api/users/${selectedUser.id}`, {
        method: "PATCH",
        body: editForm,
        label: "UpdateUser",
      })
      setShowEditDialog(false)
      setSelectedUser(null)
      await fetchUsers()
    } catch (error) {
      logger.error("Update failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setProcessing(false)
    }
  }

  const openEdit = (user: UserWithManagement) => {
    setSelectedUser(user)
    setEditForm({
      email: user.email,
      status: user.status,
      role: user.role,
      responsibilities: user.responsibilities || [],
    })
    setShowEditDialog(true)
  }

  const getStatusBadge = (status: UserStatus) => {
    const colors: Record<UserStatus, string> = {
      active: "bg-green-500",
      inactive: "bg-gray-500",
      onboarding: "bg-amber-500",
      offboarding: "bg-orange-500",
      offboarded: "bg-red-500",
    }
    return <Badge className={colors[status]}>{STATUS_LABELS[status]}</Badge>
  }

  return (
    <DashboardLayout persona="hans">
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <Users className="h-7 w-7" />
            Team
          </h1>
          <p className="mt-1 text-white/60">
            Platform users (auth, roles, onboarding) and HR roster (employees from Baserow).
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="border border-white/10 bg-white/5">
            <TabsTrigger value="users" className="data-[state=active]:bg-white/10">
              <UserPlus className="mr-2 h-4 w-4" />
              Platform Users
            </TabsTrigger>
            <TabsTrigger value="employees" className="data-[state=active]:bg-white/10">
              <Briefcase className="mr-2 h-4 w-4" />
              HR Roster
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            {inviteResult && (
              <Card className="border-blue-500/30 bg-blue-950/30">
                <CardContent className="space-y-3 pt-6">
                  <div>
                    <p className="font-medium text-blue-100">Invite link ready</p>
                    <p className="text-sm text-blue-100/60">
                      Send this link directly if email or SMS delivery is unavailable.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      readOnly
                      value={inviteResult.inviteLink}
                      className="border-blue-500/20 bg-black/25 text-blue-50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="border-blue-500/30 text-blue-100"
                      onClick={() => navigator.clipboard.writeText(inviteResult.inviteLink)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                  {inviteResult.channels && (
                    <p className="text-xs text-blue-100/45">
                      Channels attempted: {inviteResult.channels.join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border-white/10 bg-[#0d0d12]/80">
              <CardHeader>
                <CardTitle className="text-white">Platform Users</CardTitle>
                <CardDescription className="text-white/60">
                  Auth accounts, roles, onboarding, offboarding
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-white/40" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-blue-500/20 to-purple-500/20 text-2xl">
                            {user.icon}
                          </div>
                          <div>
                            <p className="font-medium text-white">{user.name}</p>
                            <p className="text-sm text-white/50">{user.email}</p>
                            <div className="mt-1 flex items-center gap-2">
                              {getStatusBadge(user.status)}
                              <Badge variant="outline" className="border-white/20 text-white/70">
                                {ROLE_LABELS[user.role]}
                              </Badge>
                              {user.onboardingStatus !== "completed" && (
                                <Badge className="bg-amber-500/80">
                                  {ONBOARDING_LABELS[user.onboardingStatus]}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/10"
                            onClick={() => openEdit(user)}
                          >
                            <Edit className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                          {user.onboardingStatus !== "completed" && user.id !== "hans" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-blue-500/50 text-blue-400"
                                onClick={() => handleInvite(user)}
                                disabled={!!invitingId}
                              >
                                {invitingId === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="mr-1 h-4 w-4" />
                                )}
                                Send Invite
                              </Button>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleOnboard(user)}
                                disabled={processing}
                              >
                                <UserCheck className="mr-1 h-4 w-4" />
                                Complete Onboarding
                              </Button>
                            </>
                          )}
                          {user.status === "active" && user.id !== "hans" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-orange-500/50 text-orange-400"
                              onClick={() => handleOffboard(user)}
                              disabled={processing}
                            >
                              <UserX className="mr-1 h-4 w-4" />
                              Initiate Offboarding
                            </Button>
                          )}
                          {user.status === "offboarding" && user.id !== "hans" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleOffboard(user, true)}
                              disabled={processing}
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              Complete Offboarding
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <Button variant="outline" className="border-white/10" onClick={fetchUsers}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="employees">
            <EmployeesPage embedded />
          </TabsContent>
        </Tabs>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md border-white/10 bg-[#0d0d12] text-white">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription className="text-white/60">
                Update contact details, status, role, and responsibilities.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-white/80">Email</Label>
                <Input
                  type="email"
                  className="border-white/10 bg-white/5"
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <Label className="text-white/80">Status</Label>
                <Select
                  value={editForm.status || "active"}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as UserStatus }))}
                >
                  <SelectTrigger className="border-white/10 bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as UserStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/80">Role</Label>
                <Select
                  value={editForm.role || "employee"}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as UserRole }))}
                >
                  <SelectTrigger className="border-white/10 bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/80">Responsibilities (comma-separated)</Label>
                <Input
                  className="border-white/10 bg-white/5"
                  value={(editForm.responsibilities || []).join(", ")}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      responsibilities: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="e.g. Gardening, Workshop, Documents"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
