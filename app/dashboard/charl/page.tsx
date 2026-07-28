"use client"

import { useState, useEffect } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { InventoryPhotoCapture } from "@/components/inventory-photo-capture"
import { logger } from "@/lib/logger"
import { apiFetchSafe } from "@/lib/api-client"
import {
  ClipboardList,
  Clock,
  Package,
  Car,
  Play,
  Pause,
  Wrench,
  Zap,
  Droplets,
  Settings,
  type LucideIcon,
} from "lucide-react"

interface DashboardStats {
  dataSource?: "empty" | "demo" | "live"
  tasks?: { total: number; completed: number; inProgress: number; overdue: number }
}

// Workshop-themed background pattern
function WorkshopPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Gear/Tool patterns */}
      <svg className="text-primary-text/5 absolute top-10 right-10 h-64 w-64" viewBox="0 0 100 100">
        <path
          d="M50 20 L55 35 L70 35 L58 45 L63 60 L50 50 L37 60 L42 45 L30 35 L45 35 Z"
          fill="currentColor"
        />
      </svg>
      <svg className="text-primary-text/5 absolute bottom-20 left-10 h-48 w-48" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" />
        <circle cx="50" cy="50" r="15" fill="currentColor" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <rect
            key={i}
            x="46"
            y="5"
            width="8"
            height="15"
            fill="currentColor"
            transform={`rotate(${angle} 50 50)`}
          />
        ))}
      </svg>
      <svg className="text-primary-text/5 absolute top-1/3 left-1/4 h-32 w-32" viewBox="0 0 100 100">
        <path d="M20 80 L30 50 L50 50 L60 20 L70 50 L90 50 L80 80 Z" fill="currentColor" />
        <rect x="45" y="50" width="10" height="40" fill="currentColor" />
      </svg>
      {/* Wrench */}
      <svg
        className="text-primary-text/5 absolute right-1/3 bottom-1/4 h-40 w-40 rotate-45"
        viewBox="0 0 100 100"
      >
        <path
          d="M15 30 Q15 15 30 15 L40 15 L35 30 L65 60 L70 55 L40 25 L45 15 L70 15 Q85 15 85 30 Q85 45 70 45 L60 45 L65 30 L35 60 L30 65 L60 95 L55 100 L25 70 L20 75 L25 100 L15 100 L15 70 Q15 55 30 55 L25 45 Q15 45 15 30 Z"
          fill="currentColor"
        />
      </svg>
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
    </div>
  )
}

function EmptyPanel({ title, action }: { title: string; action?: string }) {
  return (
    <div className="border-primary/10 bg-primary/10 flex h-full min-h-40 items-center justify-center rounded-xl border p-6 text-center">
      <div>
        <p className="text-foreground font-medium">{title}</p>
        {action && <p className="text-muted-foreground mt-2 text-sm">{action}</p>}
      </div>
    </div>
  )
}

export default function CharlDashboard() {
  const [isClockRunning, setIsClockRunning] = useState(false)
  const [clockTime, setClockTime] = useState("00:00:00")
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    apiFetchSafe<DashboardStats | null>("/api/stats", null, { label: "Stats" })
      .then((data) => setStats(data))
      .catch((err) =>
        logger.error("Failed to fetch stats", {
          error: err instanceof Error ? err.message : String(err),
        })
      )
  }, [])

  useEffect(() => {
    if (!isClockRunning) return
    const interval = setInterval(() => {
      setClockTime((prev) => {
        const [h, m, s] = prev.split(":").map(Number)
        let newS = s + 1
        let newM = m
        let newH = h
        if (newS >= 60) {
          newS = 0
          newM++
        }
        if (newM >= 60) {
          newM = 0
          newH++
        }
        return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}:${String(newS).padStart(2, "0")}`
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isClockRunning])

  const tasks = stats?.tasks ?? { total: 0, completed: 0, inProgress: 0, overdue: 0 }

  return (
    <DashboardLayout persona="charl">
      {/* Persona-specific background */}
      <div className="from-primary/10 to-secondary/10 fixed inset-0 -z-10 bg-linear-to-br via-[#0a0a0f]" />
      <WorkshopPattern />

      {/* Time Clock Banner */}
      <div
        className="border-primary/30 from-primary/30 to-secondary/20 relative mb-8 overflow-hidden rounded-2xl border bg-linear-to-r p-6 backdrop-blur-sm"
        data-testid="time-clock-banner"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjAgMTBMMjIgMTVIMjhMMjMgMTlMMjUgMjVMMjAgMjFMMTUgMjVMMTcgMTlMMTIgMTVIMThMMjAgMTBaIiBmaWxsPSJyZ2JhKDI0NSwxNTgsMTEsMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-4">
            <div className="border-primary/30 from-primary/30 to-secondary/30 flex h-16 w-16 items-center justify-center rounded-xl border bg-linear-to-br">
              <Clock className="text-primary-text h-8 w-8" />
            </div>
            <div>
              <p className="text-sm text-amber-200/60">Today&apos;s Work Time</p>
              <p className="text-foreground font-mono text-4xl font-bold" data-testid="clock-time">
                {clockTime}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="mr-4 hidden text-right md:block">
              <p className="text-sm text-amber-200/60">Clocked in at</p>
              <p className="text-foreground font-medium">
                {isClockRunning ? "Manual session" : "Not clocked in"}
              </p>
            </div>
            <button
              onClick={() => setIsClockRunning(!isClockRunning)}
              data-testid="clock-toggle"
              className={`flex items-center gap-2 rounded-xl border px-6 py-3 font-medium transition-colors ${
                isClockRunning
                  ? "border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "border-green-500/30 bg-green-500/20 text-green-400 hover:bg-green-500/30"
              } `}
            >
              {isClockRunning ? (
                <>
                  <Pause className="h-5 w-5" />
                  Clock Out
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  Clock In
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Specialty Tags */}
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="border-primary/30 bg-primary/20 text-primary-text flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium">
          <Zap className="h-4 w-4" /> Electrician
        </span>
        <span className="flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-400">
          <Droplets className="h-4 w-4" /> Plumber
        </span>
        <span className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/20 px-3 py-1.5 text-sm font-medium text-green-400">
          <Wrench className="h-4 w-4" /> Tinkerer
        </span>
        <span className="flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/20 px-3 py-1.5 text-sm font-medium text-purple-400">
          <Settings className="h-4 w-4" /> Magicman
        </span>
      </div>

      <InventoryPhotoCapture persona="charl" tone="amber" />

      {/* Stats Row */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div
          className="border-primary/20 bg-primary/10 rounded-xl border p-4 backdrop-blur-sm"
          data-testid="stat-tasks"
        >
          <p className="text-sm text-amber-200/60">Active Tasks</p>
          <p className="text-foreground text-2xl font-bold">{tasks.total}</p>
          <p className="text-primary-text text-sm">{tasks.completed} completed</p>
        </div>
        <div
          className="border-primary/20 bg-primary/10 rounded-xl border p-4 backdrop-blur-sm"
          data-testid="stat-hours"
        >
          <p className="text-sm text-amber-200/60">Hours This Week</p>
          <p className="text-foreground text-2xl font-bold">0</p>
          <p className="text-muted-foreground text-sm">No time records</p>
        </div>
        <div
          className="border-primary/20 bg-primary/10 rounded-xl border p-4 backdrop-blur-sm"
          data-testid="stat-assets"
        >
          <p className="text-sm text-amber-200/60">Assets Checked</p>
          <p className="text-foreground text-2xl font-bold">0</p>
          <p className="text-muted-foreground text-sm">No live checkout data</p>
        </div>
        <div
          className="border-primary/20 bg-primary/10 rounded-xl border p-4 backdrop-blur-sm"
          data-testid="stat-leave"
        >
          <p className="text-sm text-amber-200/60">Leave Balance</p>
          <p className="text-foreground text-2xl font-bold">—</p>
          <p className="text-muted-foreground text-sm">No leave sync</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        {/* Weekly Task Completion */}
        <div
          className="border-primary/20 bg-primary/10 rounded-2xl border p-6 backdrop-blur-sm lg:col-span-2"
          data-testid="weekly-tasks-chart"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-foreground font-semibold">Weekly Task Progress</h3>
              <p className="text-muted-foreground text-sm">Completed vs Assigned</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="bg-primary h-3 w-3 rounded-full" />
                <span className="text-amber-200/60">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-primary/30 h-3 w-3 rounded-full" />
                <span className="text-amber-200/60">Assigned</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <EmptyPanel
              title="No weekly task history"
              action="Assigned and completed task history will appear after live task records exist."
            />
          </div>
        </div>

        {/* Skills Distribution */}
        <div
          className="border-primary/20 bg-primary/10 rounded-2xl border p-6 backdrop-blur-sm"
          data-testid="skills-chart"
        >
          <h3 className="text-foreground mb-2 font-semibold">Skills Distribution</h3>
          <p className="text-muted-foreground mb-4 text-sm">Task types this month</p>
          <div className="h-48">
            <EmptyPanel
              title="No task-type data"
              action="Skill distribution will appear once tasks are categorized."
            />
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Tasks */}
        <div
          className="border-primary/20 bg-primary/10 overflow-hidden rounded-2xl border backdrop-blur-sm"
          data-testid="my-tasks"
        >
          <div className="border-primary/20 flex items-center justify-between border-b p-6">
            <div className="flex items-center gap-3">
              <ClipboardList className="text-primary-text h-5 w-5" />
              <div>
                <h3 className="text-foreground font-semibold">My Tasks</h3>
                <p className="text-muted-foreground text-sm">Today&apos;s assignments</p>
              </div>
            </div>
            <span className="border-primary/30 bg-primary/20 text-primary-text rounded-full border px-3 py-1 text-sm">
              {tasks.total} tasks
            </span>
          </div>
          <div className="max-h-96 space-y-3 overflow-y-auto p-4">
            <EmptyPanel
              title="No assigned tasks"
              action="Live task assignments will appear here."
            />
          </div>
        </div>

        {/* Assets */}
        <div
          className="border-primary/20 bg-primary/10 overflow-hidden rounded-2xl border backdrop-blur-sm"
          data-testid="workshop-assets"
        >
          <div className="border-primary/20 flex items-center justify-between border-b p-6">
            <div className="flex items-center gap-3">
              <Package className="text-primary-text h-5 w-5" />
              <div>
                <h3 className="text-foreground font-semibold">Workshop Assets</h3>
                <p className="text-muted-foreground text-sm">Equipment status</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            <EmptyPanel
              title="No workshop asset data"
              action="Equipment checkouts will appear after asset records are connected."
            />
          </div>
        </div>

        {/* Vehicles */}
        <div
          className="border-primary/20 bg-primary/10 overflow-hidden rounded-2xl border backdrop-blur-sm lg:col-span-2"
          data-testid="vehicle-log"
        >
          <div className="border-primary/20 flex items-center justify-between border-b p-6">
            <div className="flex items-center gap-3">
              <Car className="text-primary-text h-5 w-5" />
              <div>
                <h3 className="text-foreground font-semibold">Vehicles</h3>
                <p className="text-muted-foreground text-sm">Coming soon</p>
              </div>
            </div>
            <span className="border-primary/30 bg-primary/20 text-primary-text rounded-full border px-3 py-1 text-sm font-medium">
              Coming soon
            </span>
          </div>
          <div className="p-6">
            <EmptyPanel
              title="Vehicles are coming soon"
              action="Trip logging, mileage, fuel, and compliance checks are not active yet."
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
