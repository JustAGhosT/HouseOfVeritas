"use client"

import { logger } from "@/lib/logger"
import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  className?: string
}

interface State {
  hasError: boolean
}

export class WidgetErrorBoundary extends Component<Props, State> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error("WidgetErrorBoundary caught an error", {
      error: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })
  }

  render() {
    const { className, fallback } = this.props
    if (this.state.hasError) {
      if (fallback) {
        // Wrap fallback in container with className for consistent layout
        return (
          <div className={className} role="alert">
            {fallback}
          </div>
        )
      }
      return (
        <div
          className={`rounded-lg border border-red-800/50 bg-red-900/20 p-4 ${className || ""}`}
          role="alert"
        >
          <p className="text-sm text-red-400">Failed to load widget</p>
        </div>
      )
    }
    return <div className={className}>{this.props.children}</div>
  }
}
