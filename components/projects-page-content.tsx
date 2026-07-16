"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  FolderKanban,
  Plus,
  Users,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ImagePlus,
  Check,
  X,
  Pencil,
} from "lucide-react"
import { AiSuggestIcon } from "@/components/ui/ai-suggest-icon"
import { getStoredScopeId } from "@/components/scope-selector"
import type { Project, ScopeKind } from "@/lib/projects"
import type { ProjectSuggestion } from "@/app/api/projects/suggestions/route"
import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"
import Image from "next/image"

const PERSONA_INFO: Record<string, string> = {
  hans: "Hans",
  charl: "Charl",
  lucky: "Lucky",
  irma: "Irma",
}

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/20 text-primary",
  on_hold: "bg-secondary/20 text-secondary",
  completed: "bg-primary/40 text-primary-foreground",
}

const ALL_SCOPES = "_all"

const SCOPE_KIND_LABELS: Record<ScopeKind, string> = {
  site: "Site",
  asset: "Asset",
  location: "Location",
}

interface ProjectsPageContentProps {
  persona: "hans" | "charl" | "lucky" | "irma"
  isAdmin: boolean
}

export function ProjectsPageContent({ persona, isAdmin }: ProjectsPageContentProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [suggestions, setSuggestions] = useState<ProjectSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false)
  const [editScopeOpen, setEditScopeOpen] = useState(false)
  const [editingScope, setEditingScope] = useState<Project | null>(null)
  const [expandedMajor, setExpandedMajor] = useState<Set<string>>(new Set())
  const [selectedScopeId, setSelectedScopeId] = useState(ALL_SCOPES)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [refineLoading, setRefineLoading] = useState(false)
  const [suggestMemberLoading, setSuggestMemberLoading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "subproject" as "major" | "subproject",
    scopeKind: "site" as ScopeKind,
    parentId: "",
    status: "planned",
  })

  const [editScopeForm, setEditScopeForm] = useState({
    name: "",
    description: "",
    scopeKind: "site" as ScopeKind,
    status: "planned",
  })

  const fetchProjects = useCallback(async () => {
    try {
      const data = await apiFetch<{ projects?: Project[] }>("/api/projects", { label: "Projects" })
      setProjects(data?.projects || [])
    } catch (error) {
      logger.error("Failed to fetch projects", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSuggestions = useCallback(async () => {
    if (!isAdmin) return
    try {
      const data = await apiFetch<{ suggestions?: ProjectSuggestion[] }>(
        "/api/projects/suggestions?status=pending",
        { label: "ProjectSuggestions" }
      )
      setSuggestions(data?.suggestions || [])
    } catch {
      setSuggestions([])
    }
  }, [isAdmin])

  useEffect(() => {
    fetchProjects()
    fetchSuggestions()
  }, [fetchProjects, fetchSuggestions])

  useEffect(() => {
    if (typeof window === "undefined") return
    setSelectedScopeId(getStoredScopeId())
    const handleScopeChange = (event: Event) => {
      const scopeId = (event as CustomEvent<{ scopeId?: string }>).detail?.scopeId
      setSelectedScopeId(scopeId || ALL_SCOPES)
    }
    window.addEventListener("hov:scope-change", handleScopeChange)
    return () => window.removeEventListener("hov:scope-change", handleScopeChange)
  }, [])

  const scopes = projects.filter((p) => p.type === "major")
  const jobs = projects.filter((p) => p.type === "subproject")
  const selectedScope = scopes.find((scope) => scope.id === selectedScopeId)
  const visibleScopes = selectedScope ? [selectedScope] : scopes

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setPhotoPreview(result)
      const base64 = result.includes(",") ? result.split(",")[1] : result
      setPhotoBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleSuggestFromPhoto = async () => {
    if (!photoBase64) return
    setAiLoading(true)
    try {
      const data = await apiFetch<{ suggested?: { name?: string; description?: string } }>(
        "/api/ai/suggest-project-from-photo",
        { method: "POST", body: { imageBase64: photoBase64 }, label: "AISuggestFromPhoto" }
      )
      if (data?.suggested) {
        setFormData((p) => ({
          ...p,
          name: data.suggested!.name ?? p.name,
          description: data.suggested!.description || p.description,
        }))
      }
    } catch (error) {
      logger.error("AI suggest from photo failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setAiLoading(false)
    }
  }

  const handleRefineDescription = async () => {
    if (!formData.name) return
    setRefineLoading(true)
    try {
      const data = await apiFetch<{ refined?: string }>("/api/ai/refine-description", {
        method: "POST",
        body: {
          title: formData.name,
          description: formData.description,
          context: `Work type: ${formData.type === "major" ? "scope" : "job"}, Scope: ${formData.parentId || "none"}`,
        },
        label: "RefineDescription",
      })
      if (data?.refined) setFormData((p) => ({ ...p, description: data.refined! }))
    } catch (error) {
      logger.error("Refine description failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setRefineLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiFetch("/api/projects", {
        method: "POST",
        body: {
          ...formData,
          parentId: formData.type === "subproject" ? formData.parentId || undefined : undefined,
        },
        label: "CreateProject",
      })
      setDialogOpen(false)
      resetForm()
      fetchProjects()
    } catch (error) {
      logger.error("Failed to create project", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleSuggest = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiFetch("/api/projects/suggestions", {
        method: "POST",
        body: {
          name: formData.name,
          description: formData.description,
          type: formData.type,
          scopeKind: formData.type === "major" ? formData.scopeKind : undefined,
          parentId: formData.type === "subproject" ? formData.parentId || undefined : undefined,
        },
        label: "SuggestProject",
      })
      setSuggestDialogOpen(false)
      resetForm()
      fetchSuggestions()
    } catch (error) {
      logger.error("Failed to suggest project", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleApproveSuggestion = async (id: string) => {
    try {
      await apiFetch(`/api/projects/suggestions/${id}`, {
        method: "PATCH",
        body: { status: "approved" },
        label: "ApproveSuggestion",
      })
      fetchSuggestions()
      fetchProjects()
    } catch (error) {
      logger.error("Failed to approve", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleRejectSuggestion = async (id: string) => {
    try {
      await apiFetch(`/api/projects/suggestions/${id}`, {
        method: "PATCH",
        body: { status: "rejected" },
        label: "RejectSuggestion",
      })
      fetchSuggestions()
    } catch (error) {
      logger.error("Failed to reject", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const openEditScope = (scope: Project) => {
    setEditingScope(scope)
    setEditScopeForm({
      name: scope.name,
      description: scope.description || "",
      scopeKind: scope.scopeKind || "site",
      status: scope.status,
    })
    setEditScopeOpen(true)
  }

  const handleUpdateScope = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingScope) return
    try {
      await apiFetch(`/api/projects/${editingScope.id}`, {
        method: "PATCH",
        body: {
          name: editScopeForm.name,
          description: editScopeForm.description || undefined,
          type: "scope",
          scopeKind: editScopeForm.scopeKind,
          status: editScopeForm.status,
        },
        label: "UpdateScope",
      })
      setEditScopeOpen(false)
      setEditingScope(null)
      fetchProjects()
    } catch (error) {
      logger.error("Failed to update scope", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "subproject",
      scopeKind: "site",
      parentId: selectedScopeId === ALL_SCOPES ? "" : selectedScopeId,
      status: "planned",
    })
    setPhotoPreview(null)
    setPhotoBase64(null)
  }

  const handleSuggestMember = async (projectId: string, projectName: string) => {
    setSuggestMemberLoading(projectId)
    try {
      const data = await apiFetch<{ suggested?: string }>("/api/ai/suggest-project-member", {
        method: "POST",
        body: { projectId, projectName },
        label: "SuggestProjectMember",
      })
      if (data?.suggested) await handleAddMember(projectId, data.suggested, "contributor")
    } catch (error) {
      logger.error("Suggest member failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSuggestMemberLoading(null)
    }
  }

  const handleAddMember = async (projectId: string, userId: string, role: string) => {
    try {
      await apiFetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        body: { userId, role },
        label: "AddProjectMember",
      })
      fetchProjects()
    } catch (error) {
      logger.error("Failed to add member", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const formFields = (
    <>
      <div className="space-y-2 rounded-lg border border-dashed border-white/20 p-4">
        <Label className="text-white/80">Suggest from photo (AI)</Label>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/20"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            Upload photo
          </Button>
          {photoPreview && (
            <Button
              type="button"
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSuggestFromPhoto}
              disabled={aiLoading}
            >
              <AiSuggestIcon loading={aiLoading} size="md" className="mr-2" />
              AI suggest
            </Button>
          )}
        </div>
        {photoPreview && (
          <div className="relative mt-2 h-24 w-24 overflow-hidden rounded bg-white/5">
            <Image src={photoPreview} alt="Preview" fill className="object-cover" unoptimized />
          </div>
        )}
      </div>
      <div>
        <Label>Type</Label>
        <Select
          value={formData.type}
          onValueChange={(v) => setFormData((p) => ({ ...p, type: v as "major" | "subproject" }))}
        >
          <SelectTrigger className="mt-1 border-white/10 bg-white/5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="major">Site, Asset or Location</SelectItem>
            <SelectItem value="subproject">Job / Work Project</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {formData.type === "major" && (
        <div>
          <Label>Scope category</Label>
          <Select
            value={formData.scopeKind}
            onValueChange={(v) => setFormData((p) => ({ ...p, scopeKind: v as ScopeKind }))}
          >
            <SelectTrigger className="mt-1 border-white/10 bg-white/5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="site">Site</SelectItem>
              <SelectItem value="asset">Asset</SelectItem>
              <SelectItem value="location">Location</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {formData.type === "subproject" && (
        <div>
          <Label>Scope</Label>
          <Select
            value={formData.parentId}
            onValueChange={(v) => setFormData((p) => ({ ...p, parentId: v }))}
          >
            <SelectTrigger className="mt-1 border-white/10 bg-white/5">
              <SelectValue placeholder="Select site, asset or location" />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <Label>Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          className="mt-1 border-white/10 bg-white/5"
          placeholder={formData.type === "major" ? "e.g. 32 Singlehurst" : "e.g. Repair bathroom"}
          required
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label>Description (optional)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-primary hover:text-primary/80"
            onClick={handleRefineDescription}
            disabled={refineLoading || !formData.name}
          >
            <AiSuggestIcon loading={refineLoading} size="sm" className="mr-1" />
            Refine with AI
          </Button>
        </div>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          className="mt-1 border-white/10 bg-white/5"
          rows={2}
        />
      </div>
      {isAdmin && (
        <div>
          <Label>Status</Label>
          <Select
            value={formData.status}
            onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}
          >
            <SelectTrigger className="mt-1 border-white/10 bg-white/5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <FolderKanban className="h-8 w-8 text-primary" />
            Work
          </h1>
          <p className="mt-1 text-white/60">
            {isAdmin
              ? "Jobs grouped by Sites, Assets & Locations."
              : "View jobs and suggest new work"}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Dialog
              open={dialogOpen}
              onOpenChange={(o) => {
                setDialogOpen(o)
                if (o && selectedScopeId !== ALL_SCOPES) {
                  setFormData((p) => ({ ...p, type: "subproject", parentId: selectedScopeId }))
                }
                if (!o) resetForm()
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Scope / Job
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-white/10 bg-[#0d0d12] text-white">
                <DialogHeader>
                  <DialogTitle>Add Scope or Job</DialogTitle>
                  <DialogDescription className="text-white/60">
                    Create a site, asset, location, or a job under one of them.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="mt-4 space-y-4">
                  {formFields}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                      Create
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Dialog
            open={suggestDialogOpen}
            onOpenChange={(o) => {
              setSuggestDialogOpen(o)
              if (o && selectedScopeId !== ALL_SCOPES) {
                setFormData((p) => ({ ...p, type: "subproject", parentId: selectedScopeId }))
              }
              if (!o) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button
                variant={isAdmin ? "outline" : "default"}
                className={!isAdmin ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-white/20"}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Suggest Work
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-white/10 bg-[#0d0d12] text-white">
              <DialogHeader>
                <DialogTitle>Suggest Work</DialogTitle>
                <DialogDescription className="text-white/60">
                  Propose a new site, asset, location, or job. Admins will review and approve.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSuggest} className="mt-4 space-y-4">
                {formFields}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSuggestDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Submit suggestion
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog
        open={editScopeOpen}
        onOpenChange={(open) => {
          setEditScopeOpen(open)
          if (!open) setEditingScope(null)
        }}
      >
        <DialogContent className="max-w-md border-white/10 bg-[#0d0d12] text-white">
          <DialogHeader>
            <DialogTitle>Edit Scope</DialogTitle>
            <DialogDescription className="text-white/60">
              Update the site, asset or location used to group jobs.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateScope} className="mt-4 space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={editScopeForm.name}
                onChange={(e) => setEditScopeForm((p) => ({ ...p, name: e.target.value }))}
                className="mt-1 border-white/10 bg-white/5"
                required
              />
            </div>
            <div>
              <Label>Scope category</Label>
              <Select
                value={editScopeForm.scopeKind}
                onValueChange={(v) => setEditScopeForm((p) => ({ ...p, scopeKind: v as ScopeKind }))}
              >
                <SelectTrigger className="mt-1 border-white/10 bg-white/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={editScopeForm.status}
                onValueChange={(v) => setEditScopeForm((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger className="mt-1 border-white/10 bg-white/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editScopeForm.description}
                onChange={(e) => setEditScopeForm((p) => ({ ...p, description: e.target.value }))}
                className="mt-1 border-white/10 bg-white/5"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditScopeOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Save scope
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {isAdmin && suggestions.length > 0 && (
        <Card className="border-secondary/30 bg-secondary/10">
          <CardHeader>
            <CardTitle className="text-secondary">Pending suggestions</CardTitle>
            <CardDescription className="text-white/60">
              {suggestions.length} work suggestion{suggestions.length !== 1 ? "s" : ""} awaiting
              review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <div>
                  <p className="font-medium text-white">{s.name}</p>
                  {s.description && <p className="mt-1 text-sm text-white/60">{s.description}</p>}
                  <p className="mt-1 text-xs text-white/40">
                    Suggested by {PERSONA_INFO[s.suggestedBy] || s.suggestedBy}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => handleApproveSuggestion(s.id)}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRejectSuggestion(s.id)}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        </div>
      ) : (
        <div className="space-y-4">
          {visibleScopes.map((scope) => {
            const scopeJobs = jobs.filter((job) => job.parentId === scope.id)
            const isExpanded = selectedScope ? true : expandedMajor.has(scope.id)

            return (
              <Card key={scope.id} className="border-white/10 bg-white/5">
                <CardHeader
                  className={selectedScope ? "" : "cursor-pointer"}
                  onClick={() => {
                    if (selectedScope) return
                    setExpandedMajor((prev) => {
                      const next = new Set(prev)
                      if (next.has(scope.id)) next.delete(scope.id)
                      else next.add(scope.id)
                      return next
                    })
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {!selectedScope && scopeJobs.length > 0 ? (
                        isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-white/60" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-white/60" />
                        )
                      ) : null}
                      <CardTitle className="text-white">{scope.name}</CardTitle>
                      <Badge className={STATUS_COLORS[scope.status] || STATUS_COLORS.planned}>
                        {scope.status.replace("_", " ")}
                      </Badge>
                      <Badge variant="outline" className="border-white/15 text-white/60">
                        {SCOPE_KIND_LABELS[scope.scopeKind || "site"]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/50">
                        {scopeJobs.length} job{scopeJobs.length !== 1 ? "s" : ""}
                      </span>
                      {isAdmin && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-white/60 hover:bg-white/10 hover:text-white"
                          onClick={(event) => {
                            event.stopPropagation()
                            openEditScope(scope)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {scope.description && (
                    <CardDescription className="text-white/60">{scope.description}</CardDescription>
                  )}
                </CardHeader>
                {isExpanded && scopeJobs.length > 0 && (
                  <CardContent className="space-y-2 pt-0">
                    {scopeJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
                      >
                        <div>
                          <p className="font-medium text-white">{job.name}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge
                              className={STATUS_COLORS[job.status] || STATUS_COLORS.planned}
                              variant="outline"
                            >
                              {job.status.replace("_", " ")}
                            </Badge>
                            {job.members?.length ? (
                              <span className="flex items-center gap-1 text-sm text-white/50">
                                <Users className="h-3 w-3" />
                                {job.members
                                  .map((m) => PERSONA_INFO[m.userId] || m.userId)
                                  .join(", ")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {isAdmin &&
                          (() => {
                            const available = ["hans", "charl", "lucky", "irma"].filter(
                              (id) => !job.members?.some((m) => m.userId === id)
                            )
                            if (available.length === 0)
                              return <span className="text-sm text-white/40">All assigned</span>
                            const loading = suggestMemberLoading === job.id
                            return (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-primary hover:text-primary/80 hover:bg-primary/10"
                                  onClick={() => handleSuggestMember(job.id, job.name)}
                                  disabled={loading}
                                >
                                  <AiSuggestIcon loading={loading} size="md" />
                                </Button>
                                <Select
                                  onValueChange={(v) => handleAddMember(job.id, v, "contributor")}
                                >
                                  <SelectTrigger className="w-36 border-white/10 bg-white/5">
                                    <SelectValue placeholder="Add member" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {available.map((id) => (
                                      <SelectItem key={id} value={id}>
                                        Add {PERSONA_INFO[id]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )
                          })()}
                      </div>
                    ))}
                  </CardContent>
                )}
                {isExpanded && scopeJobs.length === 0 && (
                  <CardContent className="pt-0">
                    <p className="rounded-lg border border-dashed border-white/10 bg-white/5 p-3 text-sm text-white/50">
                      No jobs yet for this scope.
                    </p>
                  </CardContent>
                )}
              </Card>
            )
          })}
          {visibleScopes.length === 0 && (
            <Card className="border-dashed border-white/10 bg-white/5">
              <CardContent className="py-8 text-center text-white/60">
                No Sites, Assets & Locations yet. Add a scope first, then add jobs under it.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
