"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, BriefcaseBusiness, CalendarDays, ClipboardList, FileText, Hammer, Layers3, Package, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"
import type { Project } from "@/lib/projects"
import type { JobArea, JobAreaKind } from "@/app/api/projects/[id]/areas/route"
import type { GroupedJobTask } from "@/app/api/projects/[id]/task-groups/route"

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/20 text-primary",
  on_hold: "bg-secondary/20 text-secondary",
  completed: "bg-primary/40 text-primary-foreground",
}

const PERSONA_INFO: Record<string, string> = {
  hans: "Hans",
  charl: "Charl",
  lucky: "Lucky",
  irma: "Irma",
}

interface JobDetailPageContentProps {
  persona: "hans" | "charl" | "lucky" | "irma"
  projectId: string
}

export function JobDetailPageContent({ persona, projectId }: JobDetailPageContentProps) {
  const [job, setJob] = useState<Project | null>(null)
  const [scope, setScope] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [areas, setAreas] = useState<JobArea[]>([])
  const [tasks, setTasks] = useState<GroupedJobTask[]>([])
  const [areaForm, setAreaForm] = useState({
    name: "",
    kind: "area" as JobAreaKind,
    notes: "",
  })
  const [taskForm, setTaskForm] = useState({
    title: "",
    areaId: "_none",
    groupName: "",
    priority: "Medium",
  })

  const fetchJob = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ project?: Project }>(`/api/projects/${projectId}`, {
        label: "JobDetail",
      })
      const loadedJob = data?.project || null
      setJob(loadedJob)

      if (loadedJob?.type === "subproject") {
        const areasData = await apiFetch<{ areas?: JobArea[] }>(`/api/projects/${loadedJob.id}/areas`, {
          label: "JobAreas",
        })
        setAreas(areasData?.areas || [])
        const tasksData = await apiFetch<{ tasks?: GroupedJobTask[] }>(
          `/api/projects/${loadedJob.id}/task-groups?projectName=${encodeURIComponent(loadedJob.name)}`,
          { label: "JobTasks" }
        )
        setTasks(tasksData?.tasks || [])
      } else {
        setAreas([])
        setTasks([])
      }

      if (loadedJob?.parentId) {
        const scopeData = await apiFetch<{ project?: Project }>(`/api/projects/${loadedJob.parentId}`, {
          label: "JobScope",
        })
        setScope(scopeData?.project || null)
      } else {
        setScope(null)
      }
    } catch (error) {
      logger.error("Failed to fetch job detail", {
        error: error instanceof Error ? error.message : String(error),
        projectId,
      })
      setJob(null)
      setScope(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  const refreshTasks = async (currentJob: Project) => {
    const tasksData = await apiFetch<{ tasks?: GroupedJobTask[] }>(
      `/api/projects/${currentJob.id}/task-groups?projectName=${encodeURIComponent(currentJob.name)}`,
      { label: "JobTasks" }
    )
    setTasks(tasksData?.tasks || [])
  }

  const handleCreateTask = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!job || !taskForm.title.trim()) return

    try {
      await apiFetch(`/api/projects/${job.id}/task-groups`, {
        method: "POST",
        body: {
          title: taskForm.title,
          projectName: job.name,
          areaId: taskForm.areaId === "_none" ? undefined : taskForm.areaId,
          groupName: taskForm.groupName || undefined,
          priority: taskForm.priority,
        },
        label: "CreateJobTask",
      })
      setTaskForm({ title: "", areaId: "_none", groupName: "", priority: "Medium" })
      await refreshTasks(job)
    } catch (error) {
      logger.error("Failed to create grouped task", {
        error: error instanceof Error ? error.message : String(error),
        projectId: job.id,
      })
    }
  }
  const handleCreateArea = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!job || !areaForm.name.trim()) return

    try {
      await apiFetch(`/api/projects/${job.id}/areas`, {
        method: "POST",
        body: {
          name: areaForm.name,
          kind: areaForm.kind,
          notes: areaForm.notes || undefined,
        },
        label: "CreateJobArea",
      })
      setAreaForm({ name: "", kind: "area", notes: "" })
      const areasData = await apiFetch<{ areas?: JobArea[] }>(`/api/projects/${job.id}/areas`, {
        label: "JobAreas",
      })
      setAreas(areasData?.areas || [])
    } catch (error) {
      logger.error("Failed to create job area", {
        error: error instanceof Error ? error.message : String(error),
        projectId: job.id,
      })
    }
  }
  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading job...</div>
  }

  if (!job || job.type !== "subproject") {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" className="border-border text-foreground hover:bg-muted">
          <Link href={`/dashboard/${persona}/projects`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Work
          </Link>
        </Button>
        <Card className="border-dashed border-border bg-card/80">
          <CardContent className="py-10 text-center text-muted-foreground">
            Job not found or this item is a scope, not a job.
          </CardContent>
        </Card>
      </div>
    )
  }

  const memberNames = job.members?.map((member) => PERSONA_INFO[member.userId] || member.userId) || []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Button asChild variant="outline" className="border-border text-foreground hover:bg-muted">
            <Link href={`/dashboard/${persona}/projects`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Work
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <BriefcaseBusiness className="h-8 w-8 text-primary" />
              {job.name}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {scope ? `${scope.name} job workspace` : "Job workspace"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={STATUS_COLORS[job.status] || STATUS_COLORS.planned}>
            {job.status.replace("_", " ")}
          </Badge>
          {scope && (
            <Badge variant="outline" className="border-primary/30 text-primary/80">
              {scope.name}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card/80">
          <CardContent className="flex items-center gap-3 pt-4">
            <Layers3 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Scope</p>
              <p className="font-medium text-foreground">{scope?.name || "Unassigned"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/80">
          <CardContent className="flex items-center gap-3 pt-4">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Team</p>
              <p className="font-medium text-foreground">
                {memberNames.length ? memberNames.join(", ") : "No team assigned"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/80">
          <CardContent className="flex items-center gap-3 pt-4">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Timeline</p>
              <p className="font-medium text-foreground">{job.startDate || "Not scheduled"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="border border-border bg-card/80">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="areas">Areas</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="labour">Labour</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="border-border bg-card/80">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>{job.description || "No notes recorded for this job yet."}</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="areas" className="space-y-4">
          <Card className="border-border bg-card/80">
            <CardHeader>
              <CardTitle>Areas / Rooms / Components</CardTitle>
              <CardDescription>Break this job into physical or logical work areas.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateArea} className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={areaForm.name}
                    onChange={(event) => setAreaForm((form) => ({ ...form, name: event.target.value }))}
                    placeholder="e.g. Bathroom, front axle, coach 2"
                    className="mt-1 border-border bg-background"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={areaForm.kind}
                    onValueChange={(value) => setAreaForm((form) => ({ ...form, kind: value as JobAreaKind }))}
                  >
                    <SelectTrigger className="mt-1 border-border bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="room">Room</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                      <SelectItem value="component">Component</SelectItem>
                      <SelectItem value="zone">Zone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Add area
                  </Button>
                </div>
                <div className="md:col-span-3">
                  <Label>Notes</Label>
                  <Textarea
                    value={areaForm.notes}
                    onChange={(event) => setAreaForm((form) => ({ ...form, notes: event.target.value }))}
                    className="mt-1 border-border bg-background"
                    rows={2}
                  />
                </div>
              </form>
            </CardContent>
          </Card>

          {areas.length === 0 ? (
            <PlaceholderCard icon={<Layers3 className="h-5 w-5" />} title="No areas yet" body="Add the first room, area, component or zone for this job." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {areas.map((area) => (
                <Card key={area.id} className="border-border bg-card/80">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{area.name}</p>
                        {area.notes && <p className="mt-1 text-sm text-muted-foreground">{area.notes}</p>}
                      </div>
                      <Badge variant="outline" className="border-border text-muted-foreground">
                        {area.kind}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="tasks" className="space-y-4">
          <Card className="border-border bg-card/80">
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>Tasks stay owned by this job and can be grouped by area.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTask} className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto]">
                <div>
                  <Label>Task</Label>
                  <Input
                    value={taskForm.title}
                    onChange={(event) => setTaskForm((form) => ({ ...form, title: event.target.value }))}
                    placeholder="e.g. Remove old basin"
                    className="mt-1 border-border bg-background"
                  />
                </div>
                <div>
                  <Label>Area</Label>
                  <Select
                    value={taskForm.areaId}
                    onValueChange={(value) => setTaskForm((form) => ({ ...form, areaId: value }))}
                  >
                    <SelectTrigger className="mt-1 border-border bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">No area</SelectItem>
                      {areas.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={taskForm.priority}
                    onValueChange={(value) => setTaskForm((form) => ({ ...form, priority: value }))}
                  >
                    <SelectTrigger className="mt-1 border-border bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Add task
                  </Button>
                </div>
                <div className="md:col-span-4">
                  <Label>Task group</Label>
                  <Input
                    value={taskForm.groupName}
                    onChange={(event) => setTaskForm((form) => ({ ...form, groupName: event.target.value }))}
                    placeholder="e.g. Plumbing, Prep, Finishing"
                    className="mt-1 border-border bg-background"
                  />
                </div>
              </form>
            </CardContent>
          </Card>

          {tasks.length === 0 ? (
            <PlaceholderCard icon={<ClipboardList className="h-5 w-5" />} title="No tasks yet" body="Add the first job task and optionally place it in an area or task group." />
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const area = areas.find((item) => item.id === task.areaId)
                return (
                  <Card key={task.id} className="border-border bg-card/80">
                    <CardContent className="flex items-center justify-between gap-4 pt-4">
                      <div>
                        <p className="font-medium text-foreground">{task.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-border text-muted-foreground">
                            {task.status}
                          </Badge>
                          <Badge className="bg-accent/20 text-accent">{task.priority}</Badge>
                          {area && <span className="text-sm text-muted-foreground">{area.name}</span>}
                          {task.groupName && <span className="text-sm text-muted-foreground">{task.groupName}</span>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="materials">
          <PlaceholderCard icon={<Package className="h-5 w-5" />} title="Materials / Parts" body="Materials and parts will support allocations across jobs in a later slice." />
        </TabsContent>
        <TabsContent value="labour">
          <PlaceholderCard icon={<Hammer className="h-5 w-5" />} title="Labour" body="Labour will support split allocations instead of strict job ownership." />
        </TabsContent>
        <TabsContent value="documents">
          <PlaceholderCard icon={<FileText className="h-5 w-5" />} title="Documents" body="Photos, quotes, approvals and completion records will attach here." />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PlaceholderCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Card className="border-dashed border-border bg-card/80">
      <CardContent className="flex items-start gap-3 py-8">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
      </CardContent>
    </Card>
  )
}