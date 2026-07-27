"use client"

import { useState, useEffect } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { InventoryPhotoCapture } from "@/components/inventory-photo-capture"
import { logger } from "@/lib/logger"
import { apiFetchSafe } from "@/lib/api-client"
import {
  ClipboardList,
  Clock,
  DollarSign,
  Car,
  Play,
  Pause,
  Plus,
  Upload,
  Leaf,
  Paintbrush,
  Hammer,
} from "lucide-react"

interface DashboardStats {
  dataSource?: "empty" | "demo" | "live"
  tasks?: { total: number; completed: number; inProgress: number; overdue: number }
  expenses?: { thisMonth: number; pending: number; approved: number }
}

// Grass blade SVG paths for garden background
const grassPaths = [
  "M0 100 Q5 60 10 40 Q15 60 20 100",
  "M30 100 Q35 50 40 25 Q45 50 50 100",
  "M60 100 Q65 65 70 45 Q75 65 80 100",
  "M100 100 Q105 55 110 30 Q115 55 120 100",
  "M140 100 Q145 70 150 50 Q155 70 160 100",
  "M180 100 Q185 60 190 35 Q195 60 200 100",
  "M220 100 Q225 65 230 45 Q235 65 240 100",
  "M260 100 Q265 55 270 30 Q275 55 280 100",
  "M300 100 Q305 70 310 50 Q315 70 320 100",
  "M340 100 Q345 60 350 40 Q355 60 360 100",
  "M380 100 Q385 55 390 25 Q395 55 400 100",
  "M420 100 Q425 65 430 45 Q435 65 440 100",
  "M460 100 Q465 70 470 50 Q475 70 480 100",
  "M500 100 Q505 60 510 35 Q515 60 520 100",
  "M540 100 Q545 55 550 30 Q555 55 560 100",
  "M580 100 Q585 65 590 45 Q595 65 600 100",
  "M620 100 Q625 70 630 50 Q635 70 640 100",
  "M660 100 Q665 60 670 40 Q675 60 680 100",
  "M700 100 Q705 55 710 25 Q715 55 720 100",
  "M740 100 Q745 65 750 45 Q755 65 760 100",
  "M780 100 Q785 70 790 50 Q795 70 800 100",
  "M820 100 Q825 60 830 35 Q835 60 840 100",
  "M860 100 Q865 55 870 30 Q875 55 880 100",
  "M900 100 Q905 65 910 45 Q915 65 920 100",
  "M940 100 Q945 70 950 50 Q955 70 960 100",
  "M980 100 Q985 60 990 40 Q995 60 1000 100",
  "M1020 100 Q1025 55 1030 25 Q1035 55 1040 100",
  "M1060 100 Q1065 65 1070 45 Q1075 65 1080 100",
  "M1100 100 Q1105 70 1110 50 Q1115 70 1120 100",
  "M1140 100 Q1145 60 1150 35 Q1155 60 1160 100",
  "M1180 100 Q1185 55 1190 30 Q1195 55 1200 100",
]

// Garden/Nature-themed background pattern
function GardenPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Leaf patterns */}
      <svg className="text-primary/5 absolute top-10 right-10 h-64 w-64" viewBox="0 0 100 100">
        <path
          d="M50 10 Q80 30 70 60 Q60 80 50 90 Q40 80 30 60 Q20 30 50 10 Z"
          fill="currentColor"
        />
        <path d="M50 20 L50 85" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
      <svg className="text-primary/5 absolute bottom-20 left-10 h-48 w-48" viewBox="0 0 100 100">
        <ellipse cx="50" cy="40" rx="30" ry="35" fill="currentColor" />
        <path d="M50 75 L50 95" stroke="currentColor" strokeWidth="3" />
        <path d="M50 40 Q30 50 20 70" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M50 40 Q70 50 80 70" stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
      {/* Flower */}
      <svg className="text-primary/5 absolute top-1/3 left-1/4 h-32 w-32" viewBox="0 0 100 100">
        {[0, 72, 144, 216, 288].map((angle, i) => (
          <ellipse
            key={i}
            cx="50"
            cy="30"
            rx="12"
            ry="20"
            fill="currentColor"
            transform={`rotate(${angle} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="12" fill="currentColor" />
      </svg>
      {/* Tree */}
      <svg className="text-primary/5 absolute right-1/4 bottom-1/4 h-40 w-40" viewBox="0 0 100 100">
        <polygon points="50,10 80,50 65,50 85,80 15,80 35,50 20,50" fill="currentColor" />
        <rect x="45" y="80" width="10" height="15" fill="currentColor" />
      </svg>
      {/* Grass blades */}
      <div className="absolute right-0 bottom-0 left-0 h-32 opacity-10">
        <svg className="h-full w-full" viewBox="0 0 1200 100" preserveAspectRatio="none">
          {grassPaths.map((d, i) => (
            <path key={i} d={d} stroke="#10b981" strokeWidth="2" fill="none" />
          ))}
        </svg>
      </div>
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
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

export default function LuckyDashboard() {
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
  const expenses = stats?.expenses ?? { thisMonth: 0, pending: 0, approved: 0 }

  return (
    <DashboardLayout persona="lucky">
      {/* Persona-specific background */}
      <div className="from-primary/10 to-secondary/10 fixed inset-0 -z-10 bg-linear-to-br via-[#0a0a0f]" />
      <GardenPattern />

      {/* Time Clock Banner */}
      <div
        className="border-primary/30 from-primary/30 to-secondary/20 relative mb-8 overflow-hidden rounded-2xl border bg-linear-to-r p-6 backdrop-blur-sm"
        data-testid="time-clock-banner"
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjAgNSBRMzAgMTUgMjUgMjUgUTIwIDM1IDIwIDM1IFEyMCAzNSAxNSAyNSBRMTAgMTUgMjAgNSBaIiBmaWxsPSJyZ2JhKDE2LDE4NSwxMjksMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-4">
            <div className="border-primary/30 from-primary/30 to-secondary/30 flex h-16 w-16 items-center justify-center rounded-xl border bg-linear-to-br">
              <Clock className="text-primary h-8 w-8" />
            </div>
            <div>
              <p className="text-sm text-green-200/60">Today&apos;s Work Time</p>
              <p className="text-foreground font-mono text-4xl font-bold" data-testid="clock-time">
                {clockTime}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="mr-4 hidden text-right md:block">
              <p className="text-sm text-green-200/60">Clocked in at</p>
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
                  : "border-primary/30 bg-primary/20 text-primary hover:bg-primary/30"
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

      {/* Specialty Tags & Weather */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <span className="border-primary/30 bg-primary/20 text-primary flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium">
            <Leaf className="h-4 w-4" /> Gardening
          </span>
          <span className="flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-400">
            <Paintbrush className="h-4 w-4" /> Painting
          </span>
          <span className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-400">
            <Hammer className="h-4 w-4" /> Manual Labour
          </span>
        </div>
        <div className="border-primary/20 bg-primary/15 flex items-center gap-3 rounded-xl border px-4 py-2">
          <div>
            <p className="text-foreground font-medium">{stats?.dataSource ?? "empty"}</p>
            <p className="text-muted-foreground text-xs">Data mode</p>
          </div>
        </div>
      </div>

      <InventoryPhotoCapture
        persona="lucky"
        tone="green"
        defaultCategory="garden_supplies"
        defaultLocation="Yard"
      />

      {/* Stats Row */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div
          className="border-primary/20 bg-primary/10 rounded-xl border p-4 backdrop-blur-sm"
          data-testid="stat-tasks"
        >
          <p className="text-sm text-green-200/60">Active Tasks</p>
          <p className="text-foreground text-2xl font-bold">{tasks.total}</p>
          <p className="text-primary text-sm">{tasks.completed} completed</p>
        </div>
        <div
          className="border-primary/20 bg-primary/10 rounded-xl border p-4 backdrop-blur-sm"
          data-testid="stat-hours"
        >
          <p className="text-sm text-green-200/60">Hours This Week</p>
          <p className="text-foreground text-2xl font-bold">0</p>
          <p className="text-muted-foreground text-sm">No time records</p>
        </div>
        <div
          className="border-primary/20 bg-primary/10 rounded-xl border p-4 backdrop-blur-sm"
          data-testid="stat-expenses"
        >
          <p className="text-sm text-green-200/60">Monthly Expenses</p>
          <p className="text-foreground text-2xl font-bold">
            R{expenses.thisMonth.toLocaleString()}
          </p>
          <p className="text-sm text-amber-400">{expenses.pending} pending approval</p>
        </div>
        <div
          className="border-primary/20 bg-primary/10 rounded-xl border p-4 backdrop-blur-sm"
          data-testid="stat-leave"
        >
          <p className="text-sm text-green-200/60">Leave Balance</p>
          <p className="text-foreground text-2xl font-bold">—</p>
          <p className="text-muted-foreground text-sm">No leave sync</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        {/* Weekly Hours */}
        <div
          className="border-primary/20 bg-primary/10 rounded-2xl border p-6 backdrop-blur-sm lg:col-span-2"
          data-testid="weekly-hours-chart"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-foreground font-semibold">Weekly Hours</h3>
              <p className="text-muted-foreground text-sm">Hours worked per day</p>
            </div>
            <div className="text-right">
              <p className="text-foreground text-2xl font-bold">0h</p>
              <p className="text-muted-foreground text-sm">No records</p>
            </div>
          </div>
          <div className="h-64">
            <EmptyPanel
              title="No weekly hours"
              action="Clock records will populate this chart after time tracking is connected."
            />
          </div>
        </div>

        {/* Task Type Distribution */}
        <div
          className="border-primary/20 bg-primary/10 rounded-2xl border p-6 backdrop-blur-sm"
          data-testid="task-type-chart"
        >
          <h3 className="text-foreground mb-2 font-semibold">Task Types</h3>
          <p className="text-muted-foreground mb-4 text-sm">This month&apos;s work</p>
          <div className="h-48">
            <EmptyPanel
              title="No task-type data"
              action="Task categories will appear once live work records exist."
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Tasks */}
        <div
          className="border-primary/20 bg-primary/10 overflow-hidden rounded-2xl border backdrop-blur-sm"
          data-testid="my-tasks"
        >
          <div className="border-primary/20 flex items-center justify-between border-b p-6">
            <div className="flex items-center gap-3">
              <ClipboardList className="text-primary h-5 w-5" />
              <div>
                <h3 className="text-foreground font-semibold">My Tasks</h3>
                <p className="text-muted-foreground text-sm">Today&apos;s garden work</p>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-4">
            <EmptyPanel
              title="No assigned tasks"
              action="Live garden and maintenance tasks will appear here."
            />
          </div>
        </div>

        {/* Expenses */}
        <div
          className="border-primary/20 bg-primary/10 overflow-hidden rounded-2xl border backdrop-blur-sm"
          data-testid="my-expenses"
        >
          <div className="border-primary/20 flex items-center justify-between border-b p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="text-primary h-5 w-5" />
              <div>
                <h3 className="text-foreground font-semibold">My Expenses</h3>
                <p className="text-muted-foreground text-sm">Recent submissions</p>
              </div>
            </div>
            <button
              className="border-primary/30 bg-primary/20 text-primary hover:bg-primary/30 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
              data-testid="new-expense-btn"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>
          <div className="space-y-3 p-4">
            <EmptyPanel
              title="No expenses submitted"
              action="Expense submissions will appear here after live records exist."
            />
          </div>
          <div className="border-primary/20 border-t p-4">
            <button
              className="border-primary/30 hover:border-primary/50 hover:text-foreground flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-green-200/60 transition-colors"
              data-testid="upload-receipt-btn"
            >
              <Upload className="h-4 w-4" />
              Upload Receipt
            </button>
          </div>
        </div>

        {/* Expenses Trend Chart */}
        <div
          className="border-primary/20 bg-primary/10 rounded-2xl border p-6 backdrop-blur-sm"
          data-testid="expenses-trend-chart"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-foreground font-semibold">Expenses This Month</h3>
              <p className="text-muted-foreground text-sm">Approved vs Pending</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="bg-primary h-3 w-3 rounded-full" />
                <span className="text-green-200/60">Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="text-green-200/60">Pending</span>
              </div>
            </div>
          </div>
          <div className="h-48">
            <EmptyPanel
              title="No monthly expense trend"
              action="Approved and pending expenses will appear after submissions exist."
            />
          </div>
        </div>

        {/* Vehicles */}
        <div
          className="border-primary/20 bg-primary/10 overflow-hidden rounded-2xl border backdrop-blur-sm"
          data-testid="vehicle-log"
        >
          <div className="border-primary/20 flex items-center justify-between border-b p-6">
            <div className="flex items-center gap-3">
              <Car className="text-primary h-5 w-5" />
              <div>
                <h3 className="text-foreground font-semibold">Vehicles</h3>
                <p className="text-muted-foreground text-sm">Coming soon</p>
              </div>
            </div>
            <span className="border-primary/30 bg-primary/20 text-primary rounded-full border px-3 py-1 text-sm font-medium">
              Coming soon
            </span>
          </div>
          <div className="p-4">
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
