"use client"

import { useEffect, useState } from "react"
import { Wifi, WifiOff } from "lucide-react"
import { apiFetchSafe } from "@/lib/api-client"

export function ConnectionStatus() {
  const [status, setStatus] = useState<"connected" | "demo" | "empty" | "error" | "loading">(
    "loading"
  )

  useEffect(() => {
    async function check() {
      try {
        const data = await apiFetchSafe<{ dataSource?: string } | null>("/api/stats", null, {
          label: "Stats",
        })
        setStatus(
          !data
            ? "error"
            : data.dataSource === "live"
              ? "connected"
              : data.dataSource === "demo"
                ? "demo"
                : "empty"
        )
      } catch {
        setStatus("error")
      }
    }
    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [])

  if (status === "loading") return null

  if (status === "connected") return null
  if (status === "empty") return null

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
        status === "demo"
          ? "border border-amber-500/20 bg-amber-500/10 text-amber-400"
          : "border border-red-500/20 bg-red-500/10 text-red-400"
      }`}
    >
      {status === "error" ? (
        <>
          <WifiOff className="h-3 w-3" />
          Services Offline
        </>
      ) : (
        <>
          <Wifi className="h-3 w-3" />
          Demo Mode
        </>
      )}
    </div>
  )
}
