"use client"

import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"
import { Boxes } from "lucide-react"
import { useEffect, useState } from "react"

interface ScopedInventoryItem {
  id: string
  name: string
  label?: string
  category: string
  location: string
  photoUrl?: string
}

export function ScopedInventoryList() {
  const [items, setItems] = useState<ScopedInventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    apiFetch<{ items?: ScopedInventoryItem[] }>("/api/inventory", { label: "ScopedInventory" })
      .then((data) => {
        if (active) setItems(data?.items || [])
      })
      .catch((error) => {
        logger.error("Failed to fetch scoped inventory", {
          error: error instanceof Error ? error.message : String(error),
        })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <Boxes className="h-5 w-5 text-white/70" />
        <h2 className="font-semibold text-white">Your inventory</h2>
      </div>

      {loading ? (
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
      ) : items.length === 0 ? (
        <p className="text-sm text-white/55">No inventory linked to you yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="grid grid-cols-[64px_1fr] gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
            >
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-white/10">
                {item.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Boxes className="h-6 w-6 text-white/35" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{item.label || item.name}</p>
                <p className="truncate text-sm text-white/50">{item.location}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-white/35">
                  {item.category.replace(/_/g, " ")}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
