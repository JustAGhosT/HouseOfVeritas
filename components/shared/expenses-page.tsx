"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DollarSign, RefreshCw, Loader2, Plus, Sparkles } from "lucide-react"
import { AiSuggestIcon } from "@/components/ui/ai-suggest-icon"
import { logger } from "@/lib/logger"
import { apiFetch, apiFetchSafe } from "@/lib/api-client"

const EXPENSE_CATEGORIES = [
  "Materials",
  "Supplies",
  "Fuel",
  "Tools",
  "Services",
  "Maintenance",
  "Other",
]

interface Expense {
  id: number
  category: string
  amount: number
  vendor?: string
  date: string
  approvalStatus: string
  requesterName?: string
}

interface ExpensesPageProps {
  personaId: string
  title?: string
  showAll?: boolean
}

export function ExpensesPage({
  personaId,
  title = "Expenses",
  showAll = false,
}: ExpensesPageProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary] = useState<{
    total: number
    pending: number
    approved: number
    totalAmount: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [formData, setFormData] = useState({
    category: "Supplies",
    amount: "",
    vendor: "",
    date: new Date().toISOString().split("T")[0],
    project: "",
    notes: "",
  })
  const [projectOptions, setProjectOptions] = useState<string[]>([])

  const fetchExpenses = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (!showAll) params.set("personaId", personaId)
      const data = await apiFetch<{
        expenses?: Expense[]
        summary?: { total: number; pending: number; approved: number; totalAmount: number } | null
      }>(`/api/expenses?${params}`, { label: "Expenses" })
      setExpenses(data?.expenses || [])
      setSummary(data?.summary || null)
    } catch (error) {
      logger.error("Failed to fetch expenses", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [personaId, showAll])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  useEffect(() => {
    apiFetchSafe<{ projects?: { name: string }[] }>(
      "/api/projects",
      { projects: [] },
      { label: "Projects" }
    ).then((d) => setProjectOptions((d?.projects || []).map((p) => p.name)))
  }, [])

  const getStatusColor = (s: string) => {
    if (s === "Approved") return "bg-secondary/20 text-secondary"
    if (s === "Rejected") return "bg-destructive/20 text-destructive"
    return "bg-accent/20 text-accent"
  }

  const handleSuggestCategory = async () => {
    setSuggesting(true)
    try {
      const data = await apiFetchSafe<{ suggested?: string }>(
        "/api/ai/suggest-expense-category",
        {},
        {
          method: "POST",
          body: { vendor: formData.vendor, description: formData.notes },
          label: "AI Suggest",
        }
      )
      if (data?.suggested) setFormData((p) => ({ ...p, category: data.suggested ?? p.category }))
    } finally {
      setSuggesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.amount) return
    setSubmitting(true)
    try {
      await apiFetch("/api/expenses", {
        method: "POST",
        body: {
          personaId,
          category: formData.category,
          amount: parseFloat(formData.amount),
          vendor: formData.vendor || undefined,
          date: formData.date,
          project: formData.project || undefined,
          notes: formData.notes || undefined,
        },
        label: "Expenses",
      })
      setAddOpen(false)
      setFormData({
        category: "Supplies",
        amount: "",
        vendor: "",
        date: new Date().toISOString().split("T")[0],
        project: "",
        notes: "",
      })
      fetchExpenses()
    } catch (error) {
      logger.error("Failed to submit expense", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <DollarSign className="h-7 w-7 text-primary" />
            {title}
          </h1>
          <p className="mt-1 text-muted-foreground">{showAll ? "All expenses" : "Your expense requests"}</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Submit an expense for approval.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <Label>Category</Label>
                <div className="mt-1 flex gap-2">
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
                  >
                    <SelectTrigger className="flex-1 border-border bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleSuggestCategory}
                    disabled={suggesting}
                    className="shrink-0 border-border"
                    title="Suggest category with AI"
                  >
                    <AiSuggestIcon loading={suggesting} size="md" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Amount (R)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                  className="mt-1 border-border bg-background"
                  required
                />
              </div>
              <div>
                <Label>Vendor</Label>
                <Input
                  value={formData.vendor}
                  onChange={(e) => setFormData((p) => ({ ...p, vendor: e.target.value }))}
                  className="mt-1 border-border bg-background"
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                  className="mt-1 border-border bg-background"
                />
              </div>
              <div>
                <Label>Project (optional)</Label>
                <Select
                  value={formData.project || "_none"}
                  onValueChange={(v) =>
                    setFormData((p) => ({ ...p, project: v === "_none" ? "" : v }))
                  }
                >
                  <SelectTrigger className="mt-1 border-border bg-background">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {projectOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                  className="mt-1 border-border bg-background"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="border-border hover:bg-muted text-foreground" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !formData.amount}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-semibold text-foreground">
                R{summary.totalAmount?.toLocaleString() || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <p className="text-sm text-accent/80">Pending</p>
              <p className="text-2xl font-semibold text-accent">{summary.pending}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <p className="text-sm text-secondary/80">Approved</p>
              <p className="text-2xl font-semibold text-secondary">{summary.approved}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Expense List</CardTitle>
          <CardDescription className="text-muted-foreground">
            {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : expenses.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No expenses found.</p>
          ) : (
            <div className="space-y-3">
              {expenses.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/50 p-4"
                >
                  <div>
                    <p className="font-medium text-foreground">{e.category}</p>
                    <p className="text-sm text-muted-foreground">
                      {e.date} · {e.vendor || "-"}
                      {e.requesterName && showAll && ` · ${e.requesterName}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">R{e.amount?.toLocaleString()}</span>
                    <Badge className={getStatusColor(e.approvalStatus)}>{e.approvalStatus}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <Button variant="outline" className="border-border hover:bg-muted text-foreground" onClick={fetchExpenses}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
