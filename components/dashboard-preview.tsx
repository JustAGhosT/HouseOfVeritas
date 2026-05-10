"use client"

import { apiFetchSafe } from "@/lib/api-client"
import { useLoginModal } from "@/lib/login-modal-context"
import { useMotion } from "@/lib/motion-context"
import { motion, useInView } from "framer-motion"
import { AlertCircle, CheckCircle2, Clock, TrendingUp } from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface ContractorData {
  contractors: Array<{
    name: string
    project: string
    progress: number
    totalPaid: number
    remaining: number
  }>
  summary?: {
    totalPaid: number
    totalRemaining: number
    averageProgress: number
  }
}

const EMPTY_CONTRACTORS: ContractorData = {
  contractors: [],
  summary: { totalPaid: 0, totalRemaining: 0, averageProgress: 0 },
}

function ContractorMilestones({ motionEnabled }: { motionEnabled: boolean }) {
  const [data, setData] = useState<ContractorData | null>(null)

  useEffect(() => {
    apiFetchSafe<ContractorData>("/api/contractors", EMPTY_CONTRACTORS, {
      label: "Contractors",
    }).then((d) => setData(Array.isArray(d?.contractors) ? d : EMPTY_CONTRACTORS))
  }, [])

  if (!data) return <div className="text-sm text-muted-foreground">Loading...</div>

  const contractors = Array.isArray(data.contractors) ? data.contractors : []
  return (
    <div className="space-y-4">
      {contractors.length === 0 && <div className="text-sm text-muted-foreground">—</div>}
      {contractors.map((contractor, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">{contractor.name}</div>
              <div className="text-xs text-muted-foreground">{contractor.project}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-foreground">
                {(contractor.progress)}% Complete
              </div>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${contractor.progress}%` }}
              transition={motionEnabled ? { duration: 1, delay: i * 0.2 } : { duration: 0 }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-muted-foreground">
              Paid: R{(contractor.totalPaid / 1000).toFixed(1)}k
            </span>
            <span className="text-muted-foreground">
              Remaining: R{(contractor.remaining / 1000).toFixed(1)}k
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function QuickStats({ motionEnabled }: { motionEnabled: boolean }) {
  const [stats, setStats] = useState<{
    tasksCompleted: number
    tasksTotal: number
    docsExpiringSoon: number
    budgetUsed: number
  } | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetchSafe<{ budget?: { percentage?: number } }>("/api/stats", {}, { label: "Stats" }),
      apiFetchSafe<{ summary?: { completed?: number; total?: number } }>(
        "/api/tasks",
        {},
        { label: "Tasks" }
      ),
      apiFetchSafe<Array<{ expiryDays?: number }>>("/api/documents", [], { label: "Documents" }),
    ]).then(([statsData, tasksData, docsData]) => {
      const tasksSummary = tasksData?.summary
      const docs = Array.isArray(docsData) ? docsData : []
      setStats({
        tasksCompleted: tasksSummary?.completed ?? 0,
        tasksTotal: tasksSummary?.total ?? 0,
        docsExpiringSoon: docs.filter((d) => (d?.expiryDays ?? 999) < 60).length,
        budgetUsed: statsData?.budget?.percentage ?? 0,
      })
    })
  }, [])

  if (!stats) return null

  const metrics = [
    {
      icon: CheckCircle2,
      label: "Tasks Completed",
      value: `${stats.tasksCompleted}/${stats.tasksTotal}`,
      color: "text-primary",
    },
    {
      icon: AlertCircle,
      label: "Docs Expiring Soon",
      value: stats.docsExpiringSoon,
      color: "text-accent",
    },
    {
      icon: TrendingUp,
      label: "Budget Used",
      value: `${stats.budgetUsed}%`,
      color: "text-secondary",
    },
    {
      icon: Clock,
      label: "Hours This Week",
      value: "86.5",
      color: "text-primary",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {metrics.map((metric, i) => {
        const Icon = metric.icon
        return (
          <motion.div
            key={i}
            initial={motionEnabled ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={motionEnabled ? { delay: i * 0.1 } : { duration: 0 }}
            className="rounded-lg border border-border bg-card p-4"
          >
            <Icon className={`h-5 w-5 ${metric.color} mb-2`} />
            <div className="mb-1 text-2xl font-bold text-primary">{metric.value}</div>
            <div className="text-xs text-muted-foreground">{metric.label}</div>
          </motion.div>
        )
      })}
    </div>
  )
}

function DocumentExpiry() {
  const [docs, setDocs] = useState<any[]>([])

  useEffect(() => {
    apiFetchSafe<unknown[]>("/api/documents", [], { label: "Documents" }).then((data) =>
      setDocs(Array.isArray(data) ? data.slice(0, 5) : [])
    )
  }, [])

  return (
    <div className="space-y-2">
      {docs.map((doc, i) => (
        <div key={i} className="flex items-center justify-between rounded bg-muted/50 p-2">
          <div className="flex gap-3">
            <div
              className={`h-2 w-2 rounded-full mt-1.5 ${
                doc.expiryDays < 15
                  ? "bg-accent"
                  : doc.expiryDays < 30
                    ? "bg-primary"
                    : "bg-secondary"
              }`}
            />
            <span className="text-sm text-foreground">{doc.name}</span>
          </div>
          <span className="text-xs text-muted-foreground">{doc.expiryDays}d</span>
        </div>
      ))}
    </div>
  )
}

export function DashboardPreview() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const { openLoginModal } = useLoginModal()
  const { motionEnabled } = useMotion()

  // Dummy roles for demonstration
  const roles = [
    { id: "owner", label: "Owner", desc: "Full financial and operational oversight" },
    { id: "project_manager", label: "Project Manager", desc: "Track project progress and tasks" },
    { id: "accountant", label: "Accountant", desc: "Manage invoices and budget" },
  ]
  const [activeRole, setActiveRole] = useState("owner")

  return (
    <section id="dashboard" className="bg-background px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={motionEnabled ? { duration: 0.6 } : { duration: 0 }}
          className="mb-16 text-center"
        >
          <div className="mb-4 inline-flex items-center rounded-full bg-secondary/10 px-3 py-1 text-sm font-medium text-secondary ring-1 ring-inset ring-secondary/20">
            Live Preview
          </div>
          <h2
            className="font-serif mb-4 text-3xl font-bold text-foreground sm:text-4xl"
          >
            Experience the Platform
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Switch between roles to see how House of Veritas adapts to different responsibilities,
            providing exactly what each team member needs.
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          initial={motionEnabled ? { opacity: 0, y: 40 } : { opacity: 1, y: 0 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={motionEnabled ? { duration: 0.8, delay: 0.2 } : { duration: 0 }}
          className="relative rounded-3xl border border-border bg-linear-to-br from-card to-background p-8 shadow-2xl"
        >
          {/* Dashboard Header */}
          <div className="mb-8 flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-2xl font-bold text-foreground">Overview Dashboard</h3>
              <p className="text-sm text-muted-foreground">Real-time operational metrics</p>
            </div>
            <div className="flex gap-2">
              <span className="status-badge-parchment">
                <span className="pulse-glow h-1.5 w-1.5 rounded-full bg-primary" />
                All Systems Operational
              </span>
            </div>
          </div>

          {/* Dashboard Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* View selectors */}
            <div className="space-y-2">
              <div className="mb-4 px-4">
                <h4 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                  Select View
                </h4>
              </div>
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setActiveRole(role.id as typeof activeRole)}
                  className={`w-full rounded-xl px-4 py-3 text-left transition-all ${
                    activeRole === role.id
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <div className="font-serif font-medium">{role.label}</div>
                  <div className={`text-xs ${activeRole === role.id ? "text-primary-foreground/80" : "text-muted-foreground/60"}`}>
                    {role.desc}
                  </div>
                </button>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Quick Stats
              </h4>
              <QuickStats motionEnabled={motionEnabled} />
            </div>

            {/* Contractor Milestones */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Contractor Milestones
              </h4>
              <ContractorMilestones motionEnabled={motionEnabled} />
            </div>

            {/* Document Expiry */}
            <div className="space-y-4 lg:col-span-3">
              <h4 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Document Expiry Tracking
              </h4>
              <DocumentExpiry />
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-6">
            <button
              onClick={openLoginModal}
              className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
            >
              View Full Dashboard
            </button>
            <button
              onClick={openLoginModal}
              className="cursor-pointer rounded-lg bg-muted px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/80"
            >
              Export Report
            </button>
            <button
              onClick={openLoginModal}
              className="cursor-pointer rounded-lg bg-muted px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/80"
            >
              Manage Alerts
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
