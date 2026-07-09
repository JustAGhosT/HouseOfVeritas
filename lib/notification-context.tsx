"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"

export interface Notification {
  id: string
  type: "task" | "approval" | "document" | "expense" | "alert" | "system" | "leave_balance_updated"
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionUrl?: string
  userId: string // Target user
  fromUser?: string // Who triggered it
  priority?: "low" | "medium" | "high"
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearNotification: (id: string) => void
  clearAll: () => void
  getNotificationsForUser: (userId: string) => Notification[]
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

const STORAGE_KEY = "hov_notifications"

const initialNotifications: Notification[] = []

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    if (typeof window === "undefined") return initialNotifications
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        return parsed.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) }))
      } catch {
        return initialNotifications
      }
    }
    return initialNotifications
  })

  // Save to localStorage when notifications change
  useEffect(() => {
    if (notifications.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
    }
  }, [notifications])

  const addNotification = useCallback(
    (notification: Omit<Notification, "id" | "timestamp" | "read">) => {
      const newNotification: Notification = {
        ...notification,
        id: Date.now().toString(),
        timestamp: new Date(),
        read: false,
      }
      setNotifications((prev) => [newNotification, ...prev])
    },
    []
  )

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const getNotificationsForUser = useCallback(
    (userId: string) => {
      // Hans can see all notifications, others only see their own
      if (userId === "hans") {
        return notifications.filter((n) => n.userId === "hans")
      }
      return notifications.filter((n) => n.userId === userId)
    },
    [notifications]
  )

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll,
        getNotificationsForUser,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}
