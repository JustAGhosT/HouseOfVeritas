"use client"

import { useState, useEffect, useCallback } from "react"
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  ClipboardList,
  Clock,
  Filter,
  Loader2,
  BarChart3,
  TrendingUp,
  FileDown,
} from "lucide-react"
import { generatePDFReport } from "@/lib/utils/pdf-generator"
import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"

type ReportType = "expenses" | "tasks" | "time" | "all"

interface ReportData {
  reportType: string
  generatedAt: string
  data: any
}

export function ReportsPanel() {
  const [reportType, setReportType] = useState<ReportType>("expenses")
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState({ start: "", end: "" })

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: reportType })
      if (dateRange.start) params.append("startDate", dateRange.start)
      if (dateRange.end) params.append("endDate", dateRange.end)

      const data = await apiFetch<ReportData>(`/api/reports?${params}`, { label: "Reports" })
      setReportData(data)
    } catch (error) {
      logger.error("Failed to fetch report", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [reportType, dateRange])

  const downloadCSV = async () => {
    const params = new URLSearchParams({ type: reportType, format: "csv" })
    if (dateRange.start) params.append("startDate", dateRange.start)
    if (dateRange.end) params.append("endDate", dateRange.end)

    const response = await fetch(`/api/reports?${params}`)
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${reportType}-report-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const downloadPDF = () => {
    if (!reportData?.data) return

    const reportTitles: Record<string, string> = {
      expenses: "Expense Report",
      tasks: "Task Report",
      time: "Time & Attendance Report",
      all: "Comprehensive Report",
    }

    generatePDFReport({
      title: reportTitles[reportType] || "Report",
      subtitle: "House of Veritas - Estate Management",
      generatedAt: new Date(),
      data: reportData.data,
      type: reportType as any,
    })
  }

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const reportTypes = [
    { id: "expenses", label: "Expenses", icon: DollarSign, color: "text-accent" },
    { id: "tasks", label: "Tasks", icon: ClipboardList, color: "text-primary" },
    { id: "time", label: "Time Log", icon: Clock, color: "text-secondary" },
    { id: "all", label: "All Reports", icon: BarChart3, color: "text-muted-foreground" },
  ]

  return (
    <div className="space-y-6">
      {/* Report Type Selector */}
      <div className="flex flex-wrap gap-3">
        {reportTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setReportType(type.id as ReportType)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 transition-all ${
              reportType === type.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <type.icon
              className={`h-4 w-4 ${reportType === type.id ? "text-primary-foreground" : type.color}`}
            />
            {type.label}
          </button>
        ))}
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        <button
          onClick={fetchReport}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
          Generate
        </button>

        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-secondary-foreground transition-colors hover:bg-secondary/90"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>

        <button
          onClick={downloadPDF}
          disabled={!reportData}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          <FileDown className="h-4 w-4" />
          Export PDF
        </button>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          {reportType === "expenses" && reportData.data?.summary && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <SummaryCard
                title="Total Expenses"
                value={`R${reportData.data.summary.total}`}
                icon={DollarSign}
                color="purple"
              />
              <SummaryCard
                title="Approved"
                value={`R${reportData.data.summary.approved}`}
                icon={TrendingUp}
                color="green"
              />
              <SummaryCard
                title="Pending"
                value={`R${reportData.data.summary.pending}`}
                icon={Clock}
                color="amber"
              />
              <SummaryCard
                title="Count"
                value={reportData.data.summary.count}
                icon={FileText}
                color="blue"
              />
            </div>
          )}

          {reportType === "tasks" && reportData.data?.summary && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <SummaryCard
                title="Total Tasks"
                value={reportData.data.summary.total}
                icon={ClipboardList}
                color="blue"
              />
              <SummaryCard
                title="Completed"
                value={reportData.data.summary.completed}
                icon={TrendingUp}
                color="green"
              />
              <SummaryCard
                title="In Progress"
                value={reportData.data.summary.inProgress}
                icon={Clock}
                color="amber"
              />
              <SummaryCard
                title="Pending"
                value={reportData.data.summary.pending}
                icon={FileText}
                color="purple"
              />
            </div>
          )}

          {reportType === "time" && reportData.data?.summary && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <SummaryCard
                title="Total Hours"
                value={`${reportData.data.summary.totalHours}h`}
                icon={Clock}
                color="blue"
              />
              <SummaryCard
                title="Overtime"
                value={`${reportData.data.summary.totalOvertime}h`}
                icon={TrendingUp}
                color="amber"
              />
              <SummaryCard
                title="Regular"
                value={`${reportData.data.summary.regularHours}h`}
                icon={FileText}
                color="green"
              />
              <SummaryCard
                title="Days Worked"
                value={reportData.data.summary.daysWorked}
                icon={Calendar}
                color="purple"
              />
            </div>
          )}

          {/* Data Table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h3 className="font-semibold text-foreground">Detailed Report</h3>
              <p className="text-sm text-muted-foreground">
                Generated: {new Date(reportData.generatedAt).toLocaleString()}
              </p>
            </div>
            <div className="overflow-x-auto">
              <ReportTable type={reportType} data={reportData.data} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: string | number
  icon: any
  color: "blue" | "green" | "amber" | "purple"
}) {
  const colors = {
    blue: "from-primary/20 to-primary/5 border-primary/30 text-primary",
    green: "from-secondary/20 to-secondary/5 border-secondary/30 text-secondary",
    amber: "from-muted/20 to-muted/5 border-border text-muted-foreground",
    purple: "from-accent/20 to-accent/5 border-accent/30 text-accent",
  }

          return (
    <div className={`rounded-xl bg-linear-to-br p-4 ${colors[color]} border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        </div>
        <Icon className="h-8 w-8 opacity-60" />
      </div>
    </div>
  )
}

function ReportTable({ type, data }: { type: ReportType; data: any }) {
  if (type === "expenses" && data?.expenses) {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="p-4 text-left">Date</th>
            <th className="p-4 text-left">Category</th>
            <th className="p-4 text-right">Amount</th>
            <th className="p-4 text-left">Status</th>
            <th className="p-4 text-left">Submitted By</th>
          </tr>
        </thead>
        <tbody>
          {data.expenses.map((expense: any) => (
            <tr key={expense.id} className="border-b border-border/50 hover:bg-muted/50">
              <td className="p-4 text-foreground">{expense.date}</td>
              <td className="p-4 text-foreground">{expense.category}</td>
              <td className="p-4 text-right text-foreground">R{expense.amount}</td>
              <td className="p-4">
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    expense.status === "approved"
                      ? "bg-secondary/20 text-secondary"
                      : expense.status === "pending"
                        ? "bg-muted text-muted-foreground"
                        : "bg-destructive/20 text-destructive"
                  }`}
                >
                  {expense.status}
                </span>
              </td>
              <td className="p-4 text-foreground/70">{expense.submittedBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (type === "tasks" && data?.tasks) {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="p-4 text-left">Task</th>
            <th className="p-4 text-left">Assignee</th>
            <th className="p-4 text-left">Status</th>
            <th className="p-4 text-left">Priority</th>
            <th className="p-4 text-left">Completed</th>
          </tr>
        </thead>
        <tbody>
          {data.tasks.map((task: any) => (
            <tr key={task.id} className="border-b border-border/50 hover:bg-muted/50">
              <td className="p-4 text-foreground">{task.title}</td>
              <td className="p-4 text-foreground/70">{task.assignee}</td>
              <td className="p-4">
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    task.status === "completed"
                      ? "bg-secondary/20 text-secondary"
                      : task.status === "in_progress"
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {task.status}
                </span>
              </td>
              <td className="p-4">
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    task.priority === "high"
                      ? "bg-destructive/20 text-destructive"
                      : task.priority === "medium"
                        ? "bg-muted text-muted-foreground"
                        : "bg-secondary/20 text-secondary"
                  }`}
                >
                  {task.priority}
                </span>
              </td>
              <td className="p-4 text-foreground/70">{task.completedDate || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (type === "time" && data?.entries) {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="p-4 text-left">Date</th>
            <th className="p-4 text-left">User</th>
            <th className="p-4 text-left">Clock In</th>
            <th className="p-4 text-left">Clock Out</th>
            <th className="p-4 text-right">Hours</th>
            <th className="p-4 text-right">Overtime</th>
          </tr>
        </thead>
        <tbody>
          {data.entries.map((entry: any) => (
            <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/50">
              <td className="p-4 text-foreground">{entry.date}</td>
              <td className="p-4 text-foreground/70">{entry.user}</td>
              <td className="p-4 text-secondary">{entry.clockIn}</td>
              <td className="p-4 text-muted-foreground">{entry.clockOut}</td>
              <td className="p-4 text-right text-foreground">{entry.hours}h</td>
              <td className="p-4 text-right">
                {entry.overtime > 0 && <span className="text-secondary/80">+{entry.overtime}h</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return <p className="p-4 text-muted-foreground">No data available</p>
}

export default ReportsPanel
