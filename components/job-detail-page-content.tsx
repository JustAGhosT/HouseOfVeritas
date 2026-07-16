"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, BriefcaseBusiness, CalendarDays, ClipboardList, FileText, Hammer, Layers3, Package, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"
import type { Project } from "@/lib/projects"

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

  const fetchJob = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ project?: Project }>(`/api/projects/${projectId}`, {
        label: "JobDetail",
      })
      const loadedJob = data?.project || null
      setJob(loadedJob)

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

        <TabsContent value="areas">
          <PlaceholderCard icon={<Layers3 className="h-5 w-5" />} title="Areas / Rooms / Components" body="The next slice will add subdivisions inside this job." />
        </TabsContent>
        <TabsContent value="tasks">
          <PlaceholderCard icon={<ClipboardList className="h-5 w-5" />} title="Tasks" body="Tasks will remain job-owned and can later be grouped by area." />
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