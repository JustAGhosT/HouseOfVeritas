"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, RefreshCw, Loader2 } from "lucide-react"
import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"

interface Asset {
  id: number
  assetId: string
  type: string
  description?: string
  condition: string
  location: string
  checkedOutBy?: number
}

interface AssetsPageProps {
  personaId: string
  title?: string
  showAll?: boolean
}

export function AssetsPage({ personaId, title = "Assets", showAll = false }: AssetsPageProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [summary, setSummary] = useState<{
    total: number
    available: number
    checkedOut: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAssets = useCallback(async () => {
    try {
      const data = await apiFetch<{
        assets?: Asset[]
        summary?: { total: number; available: number; checkedOut: number }
      }>("/api/assets", { label: "Assets" })
      setAssets(data?.assets || [])
      setSummary(data?.summary || null)
    } catch (error) {
      logger.error("Failed to fetch assets", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Package className="h-7 w-7 text-primary" />
          {title}
        </h1>
        <p className="mt-1 text-muted-foreground">{showAll ? "All assets" : "Assets available to you"}</p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-semibold text-foreground">{summary.total}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <p className="text-sm text-secondary/80">Available</p>
              <p className="text-2xl font-semibold text-secondary">{summary.available}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <p className="text-sm text-accent/80">Checked Out</p>
              <p className="text-2xl font-semibold text-accent">{summary.checkedOut}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Asset List</CardTitle>
          <CardDescription className="text-muted-foreground">
            {assets.length} asset{assets.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No assets found.</p>
          ) : (
            <div className="space-y-3">
              {assets.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/50 p-4"
                >
                  <div>
                    <p className="font-medium text-foreground">{a.assetId || a.type}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.type} · {a.location}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-border text-foreground">
                    {a.checkedOutBy ? "Checked Out" : "Available"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Button variant="outline" className="border-border hover:bg-muted text-foreground" onClick={fetchAssets}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
