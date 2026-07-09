"use client"

import { useState, useEffect } from "react"
import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"
import {
  Fingerprint,
  ScanFace,
  Clock,
  UserCheck,
  UserX,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  MapPin,
  Smartphone,
} from "lucide-react"

interface EmployeeStatus {
  employeeId: string
  employeeName: string
  status: "working" | "completed" | "not_clocked_in"
  clockIn: string | null
  clockOut: string | null
  hoursWorked: number
}

interface ClockRecord {
  id: string
  employeeId: string
  employeeName: string
  type: "clock_in" | "clock_out"
  method: string
  timestamp: string
  location: string
  verified: boolean
}

interface BiometricData {
  mode: "demo" | "empty" | "live"
  date: string
  records: ClockRecord[]
  employeeStatus: EmployeeStatus[]
  summary: {
    totalRecords: number
    clockIns: number
    clockOuts: number
  }
}

export function BiometricTimeClockPanel() {
  const [data, setData] = useState<BiometricData | null>(null)
  const [loading, setLoading] = useState(true)
  const [clocking, setClocking] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await apiFetch<BiometricData>("/api/biometric", { label: "Biometric" })
      setData(result)
    } catch (error) {
      logger.error("Failed to fetch biometric data", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Auto-refresh every minute
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleClockAction = async (employeeId: string, action: "clock_in" | "clock_out") => {
    setClocking(employeeId)
    try {
      const result = await apiFetch<{ success?: boolean }>("/api/biometric", {
        method: "POST",
        body: { action, employeeId, method: "fingerprint", location: "Dashboard" },
        label: "Biometric",
      })
      if (result?.success) fetchData()
    } catch (error) {
      logger.error("Clock action failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setClocking(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-purple-500/20 p-2">
            <Fingerprint className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">Biometric Time Clock</h2>
            <p className="text-sm text-white/50">
              {data?.mode === "live"
                ? "Biometric devices connected"
                : data?.mode === "demo"
                  ? "Demo Mode - Simulated biometrics"
                  : "Biometric devices not configured"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="rounded-lg bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Refresh time clock data"
          title="Refresh time clock data"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Mode Alert */}
      {data?.mode === "demo" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Using simulated biometrics. Configure BIOMETRIC_API_KEY for hardware integration.
          </span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-green-500/30 bg-linear-to-br from-green-600/20 to-green-600/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Currently Working</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {data?.employeeStatus.filter((e) => e.status === "working").length || 0}
              </p>
            </div>
            <UserCheck className="h-8 w-8 text-green-400 opacity-60" />
          </div>
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-linear-to-br from-blue-600/20 to-blue-600/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Completed Today</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {data?.employeeStatus.filter((e) => e.status === "completed").length || 0}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-blue-400 opacity-60" />
          </div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-linear-to-br from-amber-600/20 to-amber-600/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Not Clocked In</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {data?.employeeStatus.filter((e) => e.status === "not_clocked_in").length || 0}
              </p>
            </div>
            <UserX className="h-8 w-8 text-amber-400 opacity-60" />
          </div>
        </div>
        <div className="rounded-xl border border-purple-500/30 bg-linear-to-br from-purple-600/20 to-purple-600/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Total Records</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {data?.summary.totalRecords || 0}
              </p>
            </div>
            <Clock className="h-8 w-8 text-purple-400 opacity-60" />
          </div>
        </div>
      </div>

      {/* Employee Status Grid */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 p-4">
          <h3 className="font-semibold text-white">Employee Status</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
          {data?.employeeStatus.map((emp) => (
            <div
              key={emp.employeeId}
              className={`rounded-xl border p-4 transition-all ${
                emp.status === "working"
                  ? "border-green-500/30 bg-green-500/10"
                  : emp.status === "completed"
                    ? "border-blue-500/30 bg-blue-500/10"
                    : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-white">{emp.employeeName}</h4>
                  <p
                    className={`mt-1 text-sm ${
                      emp.status === "working"
                        ? "text-green-400"
                        : emp.status === "completed"
                          ? "text-blue-400"
                          : "text-white/50"
                    }`}
                  >
                    {emp.status === "working"
                      ? `Working • ${emp.hoursWorked.toFixed(1)}h`
                      : emp.status === "completed"
                        ? `Done • ${emp.hoursWorked.toFixed(1)}h`
                        : "Not clocked in"}
                  </p>
                </div>
                <div
                  className={`rounded-lg p-2 ${
                    emp.status === "working"
                      ? "bg-green-500/20"
                      : emp.status === "completed"
                        ? "bg-blue-500/20"
                        : "bg-white/10"
                  }`}
                >
                  {emp.status === "working" ? (
                    <UserCheck className="h-4 w-4 text-green-400" />
                  ) : emp.status === "completed" ? (
                    <CheckCircle className="h-4 w-4 text-blue-400" />
                  ) : (
                    <UserX className="h-4 w-4 text-white/40" />
                  )}
                </div>
              </div>

              {/* Time info */}
              {emp.clockIn && (
                <div className="mt-3 space-y-1 text-xs text-white/50">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">In:</span>
                    {new Date(emp.clockIn).toLocaleTimeString()}
                  </div>
                  {emp.clockOut && (
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400">Out:</span>
                      {new Date(emp.clockOut).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex gap-2">
                {emp.status === "not_clocked_in" && (
                  <button
                    onClick={() => handleClockAction(emp.employeeId, "clock_in")}
                    disabled={clocking === emp.employeeId}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                  >
                    {clocking === emp.employeeId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Fingerprint className="h-4 w-4" />
                    )}
                    Clock In
                  </button>
                )}
                {emp.status === "working" && (
                  <button
                    onClick={() => handleClockAction(emp.employeeId, "clock_out")}
                    disabled={clocking === emp.employeeId}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                  >
                    {clocking === emp.employeeId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Fingerprint className="h-4 w-4" />
                    )}
                    Clock Out
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Records */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 p-4">
          <h3 className="font-semibold text-white">Today&apos;s Records</h3>
        </div>
        <div className="divide-y divide-white/5">
          {data?.records.slice(0, 10).map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between p-4 transition-colors hover:bg-white/5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg p-2 ${
                    record.type === "clock_in" ? "bg-green-500/20" : "bg-amber-500/20"
                  }`}
                >
                  {record.method === "fingerprint" ? (
                    <Fingerprint
                      className={`h-4 w-4 ${record.type === "clock_in" ? "text-green-400" : "text-amber-400"}`}
                    />
                  ) : (
                    <ScanFace
                      className={`h-4 w-4 ${record.type === "clock_in" ? "text-green-400" : "text-amber-400"}`}
                    />
                  )}
                </div>
                <div>
                  <p className="font-medium text-white">{record.employeeName}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-white/50">
                    <span
                      className={record.type === "clock_in" ? "text-green-400" : "text-amber-400"}
                    >
                      {record.type === "clock_in" ? "Clocked In" : "Clocked Out"}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {record.location}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/70">
                  {new Date(record.timestamp).toLocaleTimeString()}
                </p>
                <p className="mt-0.5 text-xs text-white/40 capitalize">{record.method}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default BiometricTimeClockPanel
