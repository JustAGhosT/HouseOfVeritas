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
} from "lucide-react"
import { AiSuggestIcon } from "@/components/ui/ai-suggest-icon"
import type { Project } from "@/lib/projects"
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
  const [expandedMajor, setExpandedMajor] = useState<Set<string>>(new Set())
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
    parentId: "",
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

  const majorProjects = projects.filter((p) => p.type === "major")
  const subprojects = projects.filter((p) => p.type === "subproject")

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
          context: `Project type: ${formData.type}, Parent: ${formData.parentId || "none"}`,
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

  const resetForm = () => {
    setFormData({ name: "", description: "", type: "subproject", parentId: "", status: "planned" })
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
            <SelectItem value="major">Major Project</SelectItem>
            <SelectItem value="subproject">Subproject (Work Package)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {formData.type === "subproject" && (
        <div>
          <Label>Parent Project</Label>
          <Select
            value={formData.parentId}
            onValueChange={(v) => setFormData((p) => ({ ...p, parentId: v }))}
          >
            <SelectTrigger className="mt-1 border-white/10 bg-white/5">
              <SelectValue placeholder="Select parent" />
            </SelectTrigger>
            <SelectContent>
              {majorProjects.map((p) => (
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
          placeholder="e.g. Kitchen Cupboards"
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
            Projects
          </h1>
          <p className="mt-1 text-white/60">
            {isAdmin
              ? "Major projects and subprojects (House Revamp, Zeerust Arming, etc.)"
              : "View projects and suggest new ones"}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Dialog
              open={dialogOpen}
              onOpenChange={(o) => {
                setDialogOpen(o)
                if (!o) resetForm()
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-white/10 bg-[#0d0d12] text-white">
                <DialogHeader>
                  <DialogTitle>Add Project</DialogTitle>
                  <DialogDescription className="text-white/60">
                    Create a major project or subproject. Use a photo for AI suggestions.
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
              if (!o) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button
                variant={isAdmin ? "outline" : "default"}
                className={!isAdmin ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-white/20"}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Suggest Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-white/10 bg-[#0d0d12] text-white">
              <DialogHeader>
                <DialogTitle>Suggest a Project</DialogTitle>
                <DialogDescription className="text-white/60">
                  Propose a new project or subproject. Admins will review and approve.
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

      {isAdmin && suggestions.length > 0 && (
        <Card className="border-secondary/30 bg-secondary/10">
          <CardHeader>
            <CardTitle className="text-secondary">Pending suggestions</CardTitle>
            <CardDescription className="text-white/60">
              {suggestions.length} project suggestion{suggestions.length !== 1 ? "s" : ""} awaiting
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
          {majorProjects.map((major) => {
            const subs = subprojects.filter((s) => s.parentId === major.id)
            const isExpanded = expandedMajor.has(major.id)

            return (
              <Card key={major.id} className="border-white/10 bg-white/5">
                <CardHeader
                  className="cursor-pointer"
                  onClick={() =>
                    setExpandedMajor((prev) => {
                      const next = new Set(prev)
                      if (next.has(major.id)) next.delete(major.id)
                      else next.add(major.id)
                      return next
                    })
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {subs.length > 0 ? (
                        isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-white/60" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-white/60" />
                        )
                      ) : null}
                      <CardTitle className="text-white">{major.name}</CardTitle>
                      <Badge className={STATUS_COLORS[major.status] || STATUS_COLORS.planned}>
                        {major.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <span className="text-sm text-white/50">{subs.length} subprojects</span>
                  </div>
                  {major.description && (
                    <CardDescription className="text-white/60">{major.description}</CardDescription>
                  )}
                </CardHeader>
                {isExpanded && subs.length > 0 && (
                  <CardContent className="space-y-2 pt-0">
                    {subs.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
                      >
                        <div>
                          <p className="font-medium text-white">{sub.name}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge
                              className={STATUS_COLORS[sub.status] || STATUS_COLORS.planned}
                              variant="outline"
                            >
                              {sub.status.replace("_", " ")}
                            </Badge>
                            {sub.members?.length ? (
                              <span className="flex items-center gap-1 text-sm text-white/50">
                                <Users className="h-3 w-3" />
                                {sub.members
                                  .map((m) => PERSONA_INFO[m.userId] || m.userId)
                                  .join(", ")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {isAdmin &&
                          (() => {
                            const available = ["hans", "charl", "lucky", "irma"].filter(
                              (id) => !sub.members?.some((m) => m.userId === id)
                            )
                            if (available.length === 0)
                              return <span className="text-sm text-white/40">All assigned</span>
                            const loading = suggestMemberLoading === sub.id
                            return (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-primary hover:text-primary/80 hover:bg-primary/10"
                                  onClick={() => handleSuggestMember(sub.id, sub.name)}
                                  disabled={loading}
                                >
                                  <AiSuggestIcon loading={loading} size="md" />
                                </Button>
                                <Select
                                  onValueChange={(v) => handleAddMember(sub.id, v, "contributor")}
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
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
