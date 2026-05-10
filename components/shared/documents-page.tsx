"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, RefreshCw, Loader2, ExternalLink } from "lucide-react"
import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"

interface Document {
  id: number
  name: string
  type: string
  status: string
  lastReview: string
  nextReview: string
  expiryDays: number
  responsible: string
  signatories: string[]
  signedBy: string[]
  urgency: string
}

interface DocumentsPageProps {
  personaId: string
  personaName: string
  title?: string
}

export function DocumentsPage({ personaId, personaName, title = "Documents" }: DocumentsPageProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await apiFetch<Document[] | { documents?: Document[] }>("/api/documents", {
        label: "Documents",
      })
      const docs = Array.isArray(data)
        ? data
        : (data as { documents?: Document[] })?.documents || []
      const relevant = docs.filter(
        (d) =>
          d.signatories?.includes(personaName) ||
          d.responsible === personaName ||
          d.signedBy?.includes(personaName)
      )
      setDocuments(relevant.length ? relevant : docs)
    } catch (error) {
      logger.error("Failed to fetch documents", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [personaName])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const getUrgencyColor = (u: string) => {
    if (u === "red" || u === "orange") return "bg-destructive/20 text-destructive"
    if (u === "yellow") return "bg-accent/20 text-accent"
    return "bg-secondary/20 text-secondary"
  }

  const formatDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
      : "-"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <FileText className="h-7 w-7 text-primary" />
          {title}
        </h1>
        <p className="mt-1 text-muted-foreground">Documents you are responsible for or have signed</p>
      </div>

      <Card className="border-border bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Document List</CardTitle>
          <CardDescription className="text-muted-foreground">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No documents found.</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/50 p-4 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{doc.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-border text-muted-foreground">
                        {doc.type}
                      </Badge>
                      <Badge className={getUrgencyColor(doc.urgency)}>{doc.status}</Badge>
                      <span className="text-sm text-muted-foreground/70">
                        Next review: {formatDate(doc.nextReview)}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-5 w-5 shrink-0 text-muted-foreground/30" />
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Button variant="outline" className="border-border hover:bg-muted text-foreground" onClick={fetchDocuments}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
