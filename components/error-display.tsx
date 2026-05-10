"use client"

import { AlertTriangle, ChevronRight, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ErrorItem {
  message: string
  name?: string
  stack?: string
  digest?: string
  cause?: unknown
}

function toErrorItem(
  e: Error | { message?: string; name?: string; stack?: string; cause?: unknown }
): ErrorItem {
  return {
    message: e?.message || "Unknown error",
    name: "name" in e ? e.name : undefined,
    stack: "stack" in e ? e.stack : undefined,
    cause: "cause" in e ? e.cause : undefined,
  }
}

export function flattenErrors(error: Error & { digest?: string; errors?: unknown[] }): ErrorItem[] {
  const main = toErrorItem(error)
  if (error?.digest) main.digest = error.digest
  const items: ErrorItem[] = [main]
  const nested = error?.errors
  if (Array.isArray(nested)) {
    for (const e of nested) {
      if (e instanceof Error) {
        items.push(toErrorItem(e))
      } else if (e && typeof e === "object" && "message" in e) {
        items.push({ message: String((e as { message?: unknown }).message) })
      }
    }
  }
  return items
}

function getHelpfulTips(error: ErrorItem): string[] {
  const tips: string[] = []
  const msg = (error.message || "").toLowerCase()
  const name = (error.name || "").toLowerCase()

  if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch")) {
    tips.push("Check your internet connection and try again.")
    tips.push("The server may be temporarily unavailable.")
  }
  if (msg.includes("401") || msg.includes("unauthorized")) {
    tips.push("Your session may have expired. Try logging in again.")
  }
  if (msg.includes("403") || msg.includes("forbidden")) {
    tips.push("You may not have permission to access this resource.")
  }
  if (msg.includes("404") || msg.includes("not found")) {
    tips.push("The requested resource may have been moved or deleted.")
  }
  if (msg.includes("500") || msg.includes("internal server")) {
    tips.push("The server encountered an error. Please try again later.")
  }
  if (name.includes("chunk") || msg.includes("chunk") || msg.includes("loading")) {
    tips.push("A new version may have been deployed. Refresh the page.")
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    tips.push("The request took too long. Try again when the server is less busy.")
  }

  if (tips.length === 0) {
    tips.push("Try refreshing the page.")
    tips.push("If the problem persists, contact support with the error details below.")
  }

  return tips
}

interface ErrorDisplayProps {
  errors: ErrorItem[]
  onRetry?: () => void
  variant?: "page" | "inline"
  className?: string
}

export function ErrorDisplay({ errors, onRetry, variant = "page", className }: ErrorDisplayProps) {
  const isPage = variant === "page"

  return (
    <div
      className={cn(
        "flex flex-col relative overflow-hidden",
        isPage
          ? "min-h-screen items-center justify-center bg-obsidian p-6"
          : "min-h-[200px] rounded-sm border border-veritasCrimson/20 bg-veritasCrimson/5 p-6 glass-morphism-dark",
        className
      )}
    >
      {isPage && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-secondary/10 rounded-full blur-[120px] opacity-30" />
          <div className="absolute inset-0 bg-linear-to-b from-transparent via-obsidian/40 to-obsidian" />
        </div>
      )}

      <div className={cn("text-center z-10", isPage ? "w-full max-w-2xl" : "w-full")}>
        <div
          className={cn(
            "mb-6 inline-flex items-center justify-center rounded-sm border border-veritasCrimson/30 bg-veritasCrimson/20 shadow-[0_0_30px_rgba(139,30,45,0.2)]",
            isPage ? "h-20 w-20" : "mb-4 h-12 w-12"
          )}
        >
          <AlertTriangle className={cn("text-veritasCrimson shadow-lg", isPage ? "h-10 w-10" : "h-6 w-6")} />
        </div>
        
        {isPage && (
          <p className="ceremonial-text text-[10px] text-veritasCrimson mb-4 tracking-[0.6em] font-bold">SYSTEM FALSIFICATION</p>
        )}
        
        <h1 className={cn("mb-4 font-serif font-bold text-parchment text-shadow-sm", isPage ? "text-4xl tracking-tight" : "text-lg")}>
          Ritual Interrupted
        </h1>
        <p className="mb-8 manuscript-body text-parchment/60 italic leading-relaxed">
          {errors.length === 1
            ? errors[0]?.message || "An unexpected rift has appeared in the sanctum."
            : `Multiple disturbances (${errors.length}) have compromised the registry.`}
        </p>

        {errors.length > 1 && (
          <div className="mb-8 p-4 rounded-sm border border-veritasCrimson/10 bg-black/20 text-left">
            <p className="ceremonial-text text-[10px] text-veritasCrimson mb-3 font-bold uppercase tracking-widest">Compromised Assets:</p>
            <ul className="space-y-2 manuscript-body text-sm text-parchment/60">
              {errors.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-veritasCrimson tracking-tighter">✦</span>
                  {e.message || "Unknown disturbance"}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-8 space-y-4 text-left">
          {errors.map((error, idx) => (
            <ErrorDetails key={idx} error={error} index={idx} total={errors.length} />
          ))}
        </div>

        {errors.length > 0 && (
          <div className="mb-10 text-left p-6 border-l-2 border-sigilGold/20 bg-sigilGold/[0.02]">
            <p className="ceremonial-text text-[10px] text-sigilGold mb-4 font-bold tracking-[0.2em]">Archival Suggestions:</p>
            <ul className="space-y-3 manuscript-body text-sm text-parchment/50">
              {getHelpfulTips(errors[0]).map((tip, i) => (
                <li key={i} className="flex gap-3">
                  <ChevronRight className="h-4 w-4 text-sigilGold/40 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {onRetry && (
          <Button 
            onClick={onRetry} 
            className="shimmer-btn bg-veritasCrimson text-parchment hover:bg-veritasCrimson/90 ceremonial-text text-xs tracking-widest font-bold px-8 py-6 rounded-sm" 
            size={isPage ? "lg" : "sm"}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Recite the Oath
          </Button>
        )}
      </div>

      {isPage && (
        <div className="absolute bottom-8 text-center w-full">
          <p className="ceremonial-text text-[8px] text-sigilGold/10 tracking-[0.5em]">
            RITUAL INTEGRITY PROTOCOL NO. 814
          </p>
        </div>
      )}
    </div>
  )
}

function ErrorDetails({ error, index, total }: { error: ErrorItem; index: number; total: number }) {
  const hasDetails =
    error.stack || error.name || error.digest || (error.cause && String(error.cause))

  if (!hasDetails) return null

  return (
    <details className="group overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-white/80 hover:bg-white/5">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        <span>
          {total > 1 ? `Error ${index + 1}: ` : ""}
          {error.name || "Error"} — {error.message?.slice(0, 60)}
          {error.message && error.message.length > 60 ? "…" : ""}
        </span>
      </summary>
      <div className="space-y-3 px-4 pt-1 pb-4 text-sm">
        {error.name && (
          <div>
            <span className="text-white/50">Type: </span>
            <code className="text-red-300">{error.name}</code>
          </div>
        )}
        {error.digest && (
          <div>
            <span className="text-white/50">Digest: </span>
            <code className="font-mono text-xs text-white/70">{error.digest}</code>
          </div>
        )}
        {error.cause != null && (
          <div>
            <span className="text-white/50">Cause: </span>
            <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-2 text-xs text-white/70">
              {String(error.cause)}
            </pre>
          </div>
        )}
        {error.stack && (
          <div>
            <span className="text-white/50">Stack trace:</span>
            <pre className="mt-1 max-h-48 overflow-x-auto overflow-y-auto rounded bg-black/30 p-3 font-mono text-xs break-words whitespace-pre-wrap text-white/60">
              {error.stack}
            </pre>
          </div>
        )}
      </div>
    </details>
  )
}
