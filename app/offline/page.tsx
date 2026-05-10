"use client"

import { WifiOff, RefreshCw } from "lucide-react"

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] p-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/20">
          <WifiOff className="h-10 w-10 text-destructive" />
        </div>

        <h1 className="mb-2 text-2xl font-bold font-serif text-foreground">You&apos;re Offline</h1>
        <p className="mb-8 text-muted-foreground">
          It looks like you&apos;ve lost your internet connection. Some features may be limited
          until you&apos;re back online.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="h-5 w-5" />
            Try Again
          </button>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 font-medium text-foreground">Available Offline:</h3>
            <ul className="space-y-1 text-left text-sm text-muted-foreground">
              <li>• View cached dashboard data</li>
              <li>• Review saved tasks</li>
              <li>• Access downloaded documents</li>
            </ul>
          </div>
        </div>

        <p className="mt-8 text-sm text-muted-foreground/50">House of Veritas • Digital Governance Platform</p>
      </div>
    </div>
  )
}
