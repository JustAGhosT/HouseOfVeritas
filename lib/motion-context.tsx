"use client"

import { createContext, ReactNode, useContext, useEffect, useState } from "react"
import { logger } from "@/lib/logger"

interface MotionContextType {
  motionEnabled: boolean
  setMotionEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void
  toggleMotion: () => void
}

const MotionContext = createContext<MotionContextType | undefined>(undefined)

const STORAGE_KEY = "hov-motion-enabled"

export function MotionProvider({ children }: { children: ReactNode }) {
  const [motionEnabled, setMotionEnabledState] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount (defer to avoid setState-in-effect warning)
  useEffect(() => {
    const apply = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved !== null) {
          setMotionEnabledState(saved === "true")
        }
      } catch (e) {
        logger.warn("Failed to read motion preference from localStorage", {
          error: e instanceof Error ? e.message : String(e),
        })
      }
      setMounted(true)
    }
    queueMicrotask(apply)
  }, [])

  const setMotionEnabled = (value: boolean | ((prev: boolean) => boolean)) => {
    setMotionEnabledState((prev) => {
      const newValue =
        typeof value === "function" ? (value as (prev: boolean) => boolean)(prev) : value
      try {
        localStorage.setItem(STORAGE_KEY, String(newValue))
      } catch (e) {
        // Silently fail if localStorage is not available (e.g., quota exceeded, private mode)
        logger.warn("Failed to save motion preference to localStorage", {
          error: e instanceof Error ? e.message : String(e),
        })
      }
      return newValue
    })
  }

  const toggleMotion = () => {
    setMotionEnabled((prev) => !prev)
  }

  // Initial render disables animations until preferences load to prevent hydration mismatch and flash
  if (!mounted) {
    return (
      <MotionContext.Provider value={{ motionEnabled: false, setMotionEnabled, toggleMotion }}>
        {children}
      </MotionContext.Provider>
    )
  }

  return (
    <MotionContext.Provider value={{ motionEnabled, setMotionEnabled, toggleMotion }}>
      {children}
    </MotionContext.Provider>
  )
}

export function useMotion() {
  const context = useContext(MotionContext)
  if (context === undefined) {
    throw new Error("useMotion must be used within a MotionProvider")
  }
  return context
}
