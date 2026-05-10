"use client"

import { useState, useRef, useEffect } from "react"
import { useNotifications, Notification } from "@/lib/notification-context"
import { useAuth } from "@/lib/auth-context"
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  ClipboardList,
  FileText,
  DollarSign,
  AlertTriangle,
  Settings,
  ChevronRight,
  Calendar,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

const typeIcons: Record<string, any> = {
  task: ClipboardList,
  approval: CheckCheck,
  document: FileText,
  expense: DollarSign,
  alert: AlertTriangle,
  system: Settings,
  leave_balance_updated: Calendar,
}

const typeColors: Record<string, string> = {
  task: "bg-primary/20 text-primary",
  approval: "bg-secondary/20 text-secondary",
  document: "bg-secondary/20 text-secondary",
  expense: "bg-primary/20 text-primary",
  alert: "bg-destructive/20 text-destructive",
  system: "bg-muted/50 text-muted-foreground",
  leave_balance_updated: "bg-primary/20 text-primary",
}

const priorityColors: Record<string, string> = {
  high: "bg-destructive",
  medium: "bg-secondary",
  low: "bg-primary",
}

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const { getNotificationsForUser, markAsRead, markAllAsRead, clearNotification } =
    useNotifications()

  const notifications = user ? getNotificationsForUser(user.id) : []
  const unreadCount = notifications.filter((n) => !n.read).length

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const formatTime = (date: Date) => {
    try {
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return "recently"
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        data-testid="notification-bell"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-medium text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          className="absolute top-full right-0 z-50 mt-2 max-h-[500px] w-96 overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          data-testid="notification-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <h3 className="font-semibold text-white">Notifications</h3>
              <p className="text-sm text-white/50">{unreadCount} unread</p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  title="Mark all as read"
                  data-testid="mark-all-read"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                data-testid="close-notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto mb-3 h-12 w-12 text-white/20" />
                <p className="text-white/60">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={() => markAsRead(notification.id)}
                    onClear={() => clearNotification(notification.id)}
                    formatTime={formatTime}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationItem({
  notification,
  onMarkRead,
  onClear,
  formatTime,
}: {
  notification: Notification
  onMarkRead: () => void
  onClear: () => void
  formatTime: (date: Date) => string
}) {
  const Icon = typeIcons[notification.type] || Bell

  return (
    <div
      className={`group cursor-pointer p-4 transition-colors hover:bg-muted/50 ${
        !notification.read ? "bg-primary/5" : ""
      }`}
      onClick={onMarkRead}
      data-testid={`notification-${notification.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`shrink-0 rounded-lg p-2 ${typeColors[notification.type]}`}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`text-sm font-medium ${notification.read ? "text-white/70" : "text-white"}`}
            >
              {notification.title}
            </p>
            {notification.priority && (
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityColors[notification.priority]}`}
              />
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-white/50">{notification.message}</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs text-white/40">{formatTime(notification.timestamp)}</span>
            {notification.fromUser && (
              <span className="text-xs text-white/40">
                from <span className="capitalize">{notification.fromUser}</span>
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMarkRead()
              }}
              className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              title="Mark as read"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="rounded-lg p-1.5 text-foreground/40 transition-colors hover:bg-destructive/20 hover:text-destructive"
            title="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-1/2 left-0 h-8 w-1 -translate-y-1/2 rounded-r bg-primary" />
      )}
    </div>
  )
}

export default NotificationPanel
