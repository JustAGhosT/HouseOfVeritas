"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, Play, Square, Loader2, RefreshCw } from "lucide-react"
import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"

interface TimePageProps {
  personaId: string
  title?: string
  showAll?: boolean
}

export function TimePage({ personaId, title = "Time Clock", showAll = false }: TimePageProps) {
  const [entries, setEntries] = useState<
    { id: number; date: string; clockIn?: string; clockOut?: string; employeeName?: string }[]
  >([])
  const [summary, setSummary] = useState<{
    todayClockedIn: number
    totalHoursToday: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [clockedIn, setClockedIn] = useState(false)

  const fetchTime = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (!showAll) params.set("personaId", personaId)
      const data = await apiFetch<{
        entries?: {
          id: number
          date: string
          clockIn?: string
          clockOut?: string
          employeeName?: string
        }[]
        summary?: { todayClockedIn?: number; totalHoursToday?: number } | null
      }>(`/api/time?${params}`, { label: "Time" })
      setEntries(data?.entries || [])
      const sum = data?.summary
      setSummary(
        sum
          ? { todayClockedIn: sum.todayClockedIn ?? 0, totalHoursToday: sum.totalHoursToday ?? 0 }
          : null
      )
    } catch (error) {
      logger.error("Failed to fetch time", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [personaId, showAll])

  useEffect(() => {
    fetchTime()
  }, [fetchTime])

  useEffect(() => {
    if (summary) setClockedIn(summary.todayClockedIn > 0)
  }, [summary])

  const handleClock = async () => {
    setProcessing(true)
    try {
      const body = clockedIn ? { action: "clockOut", personaId } : { action: "clockIn", personaId }
      await apiFetch("/api/time", { method: "POST", body, label: "Time" })
      await fetchTime()
    } catch (error) {
      logger.error("Clock failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setProcessing(false)
    }
  }

  const todayEntries = entries.filter((e) => e.date === new Date().toISOString().slice(0, 10))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Clock className="h-7 w-7 text-primary" />
          {title}
        </h1>
        <p className="mt-1 text-muted-foreground">{showAll ? "All time entries" : "Clock in and out"}</p>
      </div>

      {!showAll && (
        <Card className="border-border bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Today</CardTitle>
            <CardDescription className="text-muted-foreground">
              {summary?.totalHoursToday != null
                ? `${summary.totalHoursToday.toFixed(1)} hours today`
                : "Clock in to start"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="lg"
              className={
                clockedIn ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90"
              }
              onClick={handleClock}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : clockedIn ? (
                <>
                  <Square className="mr-2 h-5 w-5" />
                  Clock Out
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Clock In
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Entries</CardTitle>
          <CardDescription className="text-muted-foreground">
            {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No time entries found.</p>
          ) : (
            <div className="space-y-2">
              {entries.slice(0, 10).map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3"
                >
                  <span className="text-foreground">{e.date}</span>
                  <span className="text-muted-foreground">
                    {e.clockIn || "-"} → {e.clockOut || "-"}
                  </span>
                  {e.employeeName && showAll && (
                    <span className="text-sm text-muted-foreground/70">{e.employeeName}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Button variant="outline" className="border-border hover:bg-muted text-foreground" onClick={fetchTime}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
