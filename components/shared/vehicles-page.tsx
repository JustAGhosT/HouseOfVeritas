"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Car, RefreshCw, Loader2 } from "lucide-react"
import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"

interface VehicleLog {
  id: number
  dateOut: string
  dateIn?: string
  driverName?: string
  vehicleName?: string
  distance?: number
}

interface VehiclesPageProps {
  personaId: string
  title?: string
  showAll?: boolean
}

export function VehiclesPage({
  personaId,
  title = "Vehicle Log",
  showAll = false,
}: VehiclesPageProps) {
  const [logs, setLogs] = useState<VehicleLog[]>([])
  const [summary, setSummary] = useState<{ total: number; totalDistance: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (!showAll) params.set("personaId", personaId)
      const data = await apiFetch<{
        logs?: VehicleLog[]
        summary?: { total: number; totalDistance: number }
      }>(`/api/vehicles?${params}`, { label: "Vehicles" })
      setLogs(data?.logs || [])
      setSummary(data?.summary || null)
    } catch (error) {
      logger.error("Failed to fetch vehicles", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [personaId, showAll])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Car className="h-7 w-7 text-primary" />
          {title}
        </h1>
        <p className="mt-1 text-muted-foreground">{showAll ? "All vehicle logs" : "Your vehicle usage"}</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Trips</p>
              <p className="text-2xl font-semibold text-foreground">{summary.total}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Distance</p>
              <p className="text-2xl font-semibold text-foreground">
                {summary.totalDistance?.toLocaleString() || 0} km
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Vehicle Log</CardTitle>
          <CardDescription className="text-muted-foreground">
            {logs.length} log{logs.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No vehicle logs found.</p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/50 p-4"
                >
                  <div>
                    <p className="font-medium text-foreground">{log.vehicleName || "Vehicle"}</p>
                    <p className="text-sm text-muted-foreground">
                      {log.dateOut} → {log.dateIn || "In progress"}
                      {log.driverName && showAll && ` · ${log.driverName}`}
                    </p>
                  </div>
                  {log.distance != null && <span className="text-muted-foreground">{log.distance} km</span>}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Button variant="outline" className="border-border hover:bg-muted text-foreground" onClick={fetchLogs}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
