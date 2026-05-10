"use client"

import { useState } from "react"
import { useRealTime, useEmitEvent } from "@/lib/hooks/use-realtime"
import { useAuth } from "@/lib/auth-context"
import { useNotifications } from "@/lib/notification-context"
import { RealTimeEvent } from "@/lib/realtime/event-store"
import { logger } from "@/lib/logger"
import {
  Wifi,
  WifiOff,
  Activity,
  Bell,
  CheckCircle,
  Clock,
  DollarSign,
  ClipboardList,
  AlertTriangle,
  X,
} from "lucide-react"

interface RealTimeProviderProps {
  children: React.ReactNode
}

// Event type icons and colors
const eventConfig: Record<string, { icon: any; color: string; label: string }> = {
  task_created: { icon: ClipboardList, color: "text-secondary", label: "New Task" },
  task_updated: { icon: ClipboardList, color: "text-primary", label: "Task Updated" },
  task_completed: { icon: CheckCircle, color: "text-primary", label: "Task Completed" },
  expense_created: { icon: DollarSign, color: "text-secondary", label: "New Expense" },
  expense_approved: { icon: DollarSign, color: "text-primary", label: "Expense Approved" },
  expense_rejected: { icon: DollarSign, color: "text-destructive", label: "Expense Rejected" },
  clock_in: { icon: Clock, color: "text-primary", label: "Clocked In" },
  clock_out: { icon: Clock, color: "text-secondary", label: "Clocked Out" },
  notification: { icon: Bell, color: "text-secondary", label: "Notification" },
  approval_required: { icon: AlertTriangle, color: "text-accent", label: "Approval Required" },
  system_alert: { icon: AlertTriangle, color: "text-destructive", label: "System Alert" },
}

export function RealTimeIndicator() {
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const [showToast, setShowToast] = useState(false)
  const [toastEvent, setToastEvent] = useState<RealTimeEvent | null>(null)

  const handleEvent = (event: RealTimeEvent) => {
    // Show toast for important events
    if (
      [
        "approval_required",
        "system_alert",
        "task_created",
        "expense_approved",
        "expense_rejected",
      ].includes(event.type)
    ) {
      setToastEvent(event)
      setShowToast(true)

      // Auto-hide after 5 seconds
      setTimeout(() => setShowToast(false), 5000)

      // Also add to notifications
      if (event.type !== "system_alert") {
        addNotification({
          type: event.type.includes("task")
            ? "task"
            : event.type.includes("expense")
              ? "expense"
              : "system",
          title: eventConfig[event.type]?.label || "Update",
          message: event.data?.title || event.data?.message || JSON.stringify(event.data),
          userId: user?.id || "hans",
          priority: event.type === "approval_required" ? "high" : "medium",
        })
      }
    }
  }

  const { isConnected, lastEvent, events } = useRealTime({
    userId: user?.id || "hans",
    onEvent: handleEvent,
    onConnect: () => logger.info("Real-time connected"),
    onDisconnect: () => logger.info("Real-time disconnected"),
  })

  const config = toastEvent ? eventConfig[toastEvent.type] : null
  const ToastIcon = config?.icon || Activity

  return (
    <>
      {/* Connection Status Indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs ${
            isConnected ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
          }`}
          title={
            isConnected ? "Real-time updates active" : "Disconnected - attempting to reconnect"
          }
        >
          {isConnected ? (
            <>
              <Wifi className="h-3 w-3" />
              <span className="hidden sm:inline">Live</span>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span className="hidden sm:inline">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && toastEvent && (
        <div className="animate-in slide-in-from-bottom-5 fade-in fixed right-4 bottom-4 z-50 duration-300">
          <div className="max-w-sm rounded-xl border border-white/10 bg-[#0d0d12] p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className={`rounded-lg bg-white/5 p-2 ${config?.color}`}>
                <ToastIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">{config?.label || "Update"}</p>
                <p className="mt-1 line-clamp-2 text-sm text-white/60">
                  {toastEvent.data?.title || toastEvent.data?.message || "New update received"}
                </p>
                <p className="mt-2 text-xs text-white/40">Just now</p>
              </div>
              <button
                onClick={() => setShowToast(false)}
                className="rounded-lg p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Activity Feed Component for dashboards
export function RealTimeActivityFeed({ maxItems = 5 }: { maxItems?: number }) {
  const { user } = useAuth()
  const { events } = useRealTime({
    userId: user?.id || "hans",
  })

  const recentEvents = events.slice(0, maxItems)

  if (recentEvents.length === 0) {
    return (
      <div className="py-8 text-center text-white/40">
        <Activity className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p className="text-sm">No recent activity</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {recentEvents.map((event) => {
        const config = eventConfig[event.type] || {
          icon: Activity,
          color: "text-white/60",
          label: "Event",
        }
        const Icon = config.icon

        return (
          <div
            key={event.id}
            className="flex items-start gap-3 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10"
          >
            <div className={`rounded-lg bg-white/5 p-2 ${config.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{config.label}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-white/50">
                {event.data?.title || event.data?.message || event.data?.name || "Activity"}
              </p>
            </div>
            <span className="text-xs whitespace-nowrap text-white/30">
              {formatTimeAgo(event.timestamp)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffSec < 60) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  return new Date(date).toLocaleDateString()
}

export default RealTimeIndicator
