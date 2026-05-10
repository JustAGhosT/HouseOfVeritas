"use client"

import { useState, useEffect, useCallback } from "react"
import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"
import {
  AlertTriangle,
  Car,
  Wrench,
  TrendingUp,
  Calendar,
  DollarSign,
  Loader2,
  RefreshCw,
  Sparkles,
  ChevronRight,
  CalendarPlus,
  CheckCircle,
} from "lucide-react"

interface Prediction {
  assetId: string
  assetName: string
  prediction: string
  urgency: "high" | "medium" | "low"
  estimatedCost: number
  recommendedAction: string
  dueDate: string
}

interface MaintenanceData {
  success: boolean
  generatedAt: string
  aiPowered: boolean
  predictions: Prediction[]
  insights: string[]
  urgentItems: Prediction[]
  costForecast: { month: string; estimated: number }[]
}

export function PredictiveMaintenancePanel() {
  const [data, setData] = useState<MaintenanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [scheduling, setScheduling] = useState(false)
  const [filter, setFilter] = useState<"all" | "vehicle" | "equipment">("all")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = filter !== "all" ? `?type=${filter}` : ""
      const result = await apiFetch<MaintenanceData>(`/api/ai/maintenance${params}`, {
        label: "MaintenancePredictions",
      })
      setData(result)
    } catch (error) {
      logger.error("Failed to fetch maintenance predictions", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [filter])

  const autoScheduleMaintenance = async () => {
    setScheduling(true)
    try {
      const result = await apiFetch<{
        success?: boolean
        scheduledCount?: number
        calendarEventsCreated?: number
      }>("/api/maintenance/schedule", {
        method: "POST",
        body: { action: "auto-schedule" },
        label: "AutoScheduleMaintenance",
      })
      if (result?.success) {
        alert(
          `Scheduled ${result.scheduledCount} maintenance items and created ${result.calendarEventsCreated} calendar events!`
        )
      }
    } catch (error) {
      logger.error("Failed to auto-schedule", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setScheduling(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const urgencyColors = {
    high: "bg-destructive/20 text-destructive border-destructive/30",
    medium: "bg-secondary/20 text-secondary border-secondary/30",
    low: "bg-primary/20 text-primary border-primary/30",
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return <div className="py-12 text-center text-white/50">Failed to load maintenance data</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-secondary/20 p-2">
            <Sparkles className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Predictive Maintenance</h2>
            <p className="text-sm text-white/50">
              {data.aiPowered ? "AI-Powered Analysis" : "Standard Analysis"} • Updated{" "}
              {new Date(data.generatedAt).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            aria-label="Filter by asset type"
          >
            <option value="all">All Assets</option>
            <option value="vehicle">Vehicles</option>
            <option value="equipment">Equipment</option>
          </select>

          <button
            onClick={autoScheduleMaintenance}
            disabled={scheduling}
            className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {scheduling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="h-4 w-4" />
            )}
            Auto-Schedule
          </button>

          <button
            onClick={fetchData}
            className="rounded-lg bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Refresh maintenance data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Urgent Items Alert */}
      {data.urgentItems.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="font-semibold text-destructive">
              {data.urgentItems.length} Urgent Item{data.urgentItems.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {data.urgentItems.map((item) => (
              <div key={item.assetId} className="flex items-center justify-between text-sm">
                <span className="text-white">{item.assetName}</span>
                <span className="text-destructive">{item.recommendedAction}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard
          title="Assets Analyzed"
          value={data.predictions.length}
          icon={Wrench}
          color="blue"
        />
        <SummaryCard
          title="Urgent Items"
          value={data.urgentItems.length}
          icon={AlertTriangle}
          color="red"
        />
        <SummaryCard
          title="Avg Est. Cost"
          value={`R${Math.round(data.predictions.reduce((sum, p) => sum + p.estimatedCost, 0) / data.predictions.length)}`}
          icon={DollarSign}
          color="purple"
        />
        <SummaryCard
          title="Next Month"
          value={`R${data.costForecast[0]?.estimated || 0}`}
          icon={Calendar}
          color="green"
        />
      </div>

      {/* AI Insights */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
          <TrendingUp className="h-4 w-4 text-primary" />
          Key Insights
        </h3>
        <ul className="space-y-2">
          {data.insights.map((insight, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-white/70">
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {insight}
            </li>
          ))}
        </ul>
      </div>

      {/* Predictions Table */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 p-4">
          <h3 className="font-semibold text-white">Maintenance Predictions</h3>
        </div>
        <div className="divide-y divide-white/5">
          {data.predictions.map((prediction) => (
            <div key={prediction.assetId} className="p-4 transition-colors hover:bg-white/5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-lg p-2 ${
                      prediction.assetName.includes("Toyota") ||
                      prediction.assetName.includes("Ford")
                        ? "bg-primary/20 text-primary"
                        : "bg-secondary/20 text-secondary"
                    }`}
                  >
                    {prediction.assetName.includes("Toyota") ||
                    prediction.assetName.includes("Ford") ? (
                      <Car className="h-4 w-4" />
                    ) : (
                      <Wrench className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{prediction.assetName}</h4>
                    <p className="mt-1 text-sm text-white/60">{prediction.prediction}</p>
                    <p className="mt-2 text-xs text-white/40">
                      Action: {prediction.recommendedAction}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`inline-block rounded-full border px-2 py-1 text-xs ${urgencyColors[prediction.urgency]}`}
                  >
                    {prediction.urgency}
                  </span>
                  <p className="mt-2 text-sm text-white/60">R{prediction.estimatedCost}</p>
                  <p className="text-xs text-white/40">Due: {prediction.dueDate}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Forecast */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-4 font-semibold text-white">6-Month Cost Forecast</h3>
        <div className="flex h-32 items-end gap-2">
          {data.costForecast.map((forecast, index) => {
            const maxCost = Math.max(...data.costForecast.map((f) => f.estimated))
            const height = (forecast.estimated / maxCost) * 100
            return (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg bg-linear-to-t from-primary to-primary/40 transition-all hover:from-primary/90 hover:to-primary/30"
                  style={{ height: `${height}%` }}
                />
                <span className="text-xs text-white/40">{forecast.month.split(" ")[0]}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex justify-between text-sm">
          <span className="text-white/50">Total Forecast:</span>
          <span className="font-semibold text-white">
            R{data.costForecast.reduce((sum, f) => sum + f.estimated, 0).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: string | number
  icon: any
  color: "blue" | "red" | "purple" | "green"
}) {
  const colors = {
    blue: "from-primary/20 to-primary/5 border-primary/30 text-primary",
    red: "from-destructive/20 to-destructive/5 border-destructive/30 text-destructive",
    purple: "from-secondary/20 to-secondary/5 border-secondary/30 text-secondary",
    green: "from-accent/20 to-accent/5 border-accent/30 text-accent",
  }

  return (
    <div className={`rounded-xl bg-linear-to-br p-4 ${colors[color]} border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/60">{title}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
        </div>
        <Icon className="h-8 w-8 opacity-60" />
      </div>
    </div>
  )
}

export default PredictiveMaintenancePanel
