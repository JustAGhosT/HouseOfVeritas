"use client"

import { ErrorBoundary } from "@/components/error-boundary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api-client"
import { logger } from "@/lib/logger"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Banknote,
  Bell,
  Check,
  CheckCircle,
  ClipboardList,
  Clock,
  History,
  Home,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  ScanLine,
  ShoppingCart,
  Smartphone,
  User,
  Wrench,
  XCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

interface KioskUser {
  id: string
  name: string
  role: string
  clockedIn: boolean
  lastClockTime?: string
}

interface ScannedItem {
  id: string
  name: string
  currentStock: number
  unit: string
  location: string
  barcode: string
}

interface Task {
  id: string
  title: string
  priority: string
  status: string
  dueDate?: string
  description?: string
}

interface StockRequest {
  itemName: string
  quantity: number
  urgency: "normal" | "urgent"
  notes: string
}

interface AdvanceRequest {
  amount: number
  reason: string
  repaymentPlan: string
}

interface IssueReport {
  assetName: string
  issueType: "broken" | "maintenance" | "safety" | "other"
  description: string
  location: string
}

interface RequestHistory {
  id: string
  type: "stock_order" | "salary_advance" | "issue_report"
  data: Record<string, any>
  timestamp: string
  status: "pending" | "approved" | "rejected" | "completed"
  reviewedBy?: string
  reviewedAt?: string
  notes?: string
}

export default function KioskPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<KioskUser | null>(null)
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [successMessage, setSuccessMessage] = useState("")

  // Timeout refs for cleanup
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Modal states
  const [showScanner, setShowScanner] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const [showItemAction, setShowItemAction] = useState(false)
  const [showStockRequest, setShowStockRequest] = useState(false)
  const [showAdvanceRequest, setShowAdvanceRequest] = useState(false)
  const [showIssueReport, setShowIssueReport] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showNotificationPrefs, setShowNotificationPrefs] = useState(false)
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null)
  const [actionType, setActionType] = useState<"consume" | "restock">("consume")
  const [quantity, setQuantity] = useState("1")
  const [purpose, setPurpose] = useState("")
  const [tasks, setTasks] = useState<Task[]>([])
  const [actionSuccess, setActionSuccess] = useState(false)
  const [requestHistory, setRequestHistory] = useState<RequestHistory[]>([])
  const [notificationPref, setNotificationPref] = useState<"sms" | "whatsapp" | "email">("sms")

  // Form states
  const [stockRequest, setStockRequest] = useState<StockRequest>({
    itemName: "",
    quantity: 1,
    urgency: "normal",
    notes: "",
  })
  const [advanceRequest, setAdvanceRequest] = useState<AdvanceRequest>({
    amount: 0,
    reason: "",
    repaymentPlan: "1month",
  })
  const [issueReport, setIssueReport] = useState<IssueReport>({
    assetName: "",
    issueType: "maintenance",
    description: "",
    location: "",
  })

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
        errorTimeoutRef.current = null
      }
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
        successTimeoutRef.current = null
      }
    }
  }, [])

  // Show error toast with auto-clear
  const showError = (message: string) => {
    // Clear any existing timeout before creating a new one
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current)
    }
    setError(message)
    errorTimeoutRef.current = setTimeout(() => setError(""), 5000)
  }

  // Simple PIN-based login for kiosk
  const handlePinLogin = async () => {
    setLoading(true)
    setError("")

    // PIN mapping (in production, this would be a secure API call)
    const pinMap: Record<string, KioskUser> = {
      "1234": { id: "charl", name: "Charl", role: "Workshop Operator", clockedIn: false },
      "5678": { id: "lucky", name: "Lucky", role: "Gardener", clockedIn: false },
      "9012": { id: "irma", name: "Irma", role: "Household", clockedIn: false },
      "0000": { id: "hans", name: "Hans", role: "Administrator", clockedIn: false },
    }

    await new Promise((r) => setTimeout(r, 500)) // Simulate API call

    const user = pinMap[pin]
    if (user) {
      // In production, clockedIn status would come from the API response
      // For demo, users start as clocked out and toggle via handleClockInOut
      setCurrentUser({ ...user, clockedIn: false })
      setPin("")
    } else {
      showError("Invalid PIN")
    }
    setLoading(false)
  }

  const handleClockInOut = async () => {
    if (!currentUser) return
    setLoading(true)

    try {
      await apiFetch("/api/time", {
        method: "POST",
        body: {
          action: currentUser.clockedIn ? "clockOut" : "clockIn",
          employeeId: currentUser.id,
        },
        label: "ClockInOut",
      })

      setCurrentUser({
        ...currentUser,
        clockedIn: !currentUser.clockedIn,
        lastClockTime: new Date().toISOString(),
      })
    } catch (err) {
      logger.error("Clock error", { error: err instanceof Error ? err.message : String(err) })
    }
    setLoading(false)
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setPin("")
  }

  const handleBarcodeScanned = async (code: string) => {
    try {
      const data = await apiFetch<{
        items?: Array<{
          id: string
          name: string
          currentStock: number
          unit: string
          location?: string
        }>
      }>(`/api/inventory?barcode=${encodeURIComponent(code)}`, { label: "InventoryLookup" })
      if (data?.items && data.items.length > 0) {
        const item = data.items[0]
        setScannedItem({ ...item, barcode: code, location: item.location ?? "" })
        setShowScanner(false)
        setShowItemAction(true)
      } else {
        showError("Item not found")
      }
    } catch (err) {
      showError("Scan failed")
    }
  }

  const handleItemAction = async () => {
    if (!scannedItem || !currentUser) return
    setLoading(true)

    try {
      const parsedQuantity = parseFloat(quantity)
      const safeQuantity = Number.isFinite(parsedQuantity) ? Math.max(1, parsedQuantity) : 1

      await apiFetch("/api/inventory", {
        method: "POST",
        body: {
          action: actionType,
          itemId: scannedItem.id,
          quantity: safeQuantity,
          usedBy: currentUser.id,
          purpose: purpose || `Kiosk ${actionType}`,
        },
        label: "InventoryAction",
      })

      setActionSuccess(true)
      setTimeout(() => {
        setShowItemAction(false)
        setScannedItem(null)
        setQuantity("1")
        setPurpose("")
        setActionSuccess(false)
      }, 2000)
    } catch (err) {
      showError("Action failed")
    }
    setLoading(false)
  }

  const fetchTasks = async () => {
    if (!currentUser) return
    try {
      const data = await apiFetch<{ tasks?: Task[] }>(`/api/tasks?assignee=${currentUser.id}`, {
        label: "Tasks",
      })
      setTasks(data?.tasks || [])
    } catch (err) {
      logger.error("Failed to fetch tasks", {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const openTasks = () => {
    fetchTasks()
    setShowTasks(true)
  }

  // Fetch request history
  const fetchRequestHistory = async () => {
    if (!currentUser) return
    try {
      const data = await apiFetch<{ requests?: RequestHistory[] }>(
        `/api/kiosk/requests?employeeId=${currentUser.id}`,
        { label: "KioskRequests" }
      )
      setRequestHistory(data?.requests || [])
    } catch (err) {
      logger.error("Failed to fetch request history", {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const openHistory = () => {
    fetchRequestHistory()
    setShowHistory(true)
  }

  // Fetch notification preference
  const fetchNotificationPref = async () => {
    if (!currentUser) return
    try {
      const data = await apiFetch<{ preference?: { preferredChannel?: string } }>(
        `/api/notifications/preferences?userId=${currentUser.id}`,
        { label: "NotificationPref" }
      )
      if (data?.preference?.preferredChannel) {
        setNotificationPref(data.preference.preferredChannel as "email" | "sms" | "whatsapp")
      }
    } catch (err) {
      logger.error("Failed to fetch notification pref", {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Save notification preference
  const saveNotificationPref = async (channel: "sms" | "whatsapp" | "email") => {
    if (!currentUser) return
    // Short-circuit if preference is already set to the requested channel
    if (notificationPref === channel) {
      setShowNotificationPrefs(false)
      return
    }
    setLoading(true)
    try {
      await apiFetch("/api/notifications/preferences", {
        method: "POST",
        body: {
          userId: currentUser.id,
          preferredChannel: channel,
          fallbackOrder:
            channel === "sms"
              ? ["sms", "whatsapp", "email"]
              : channel === "whatsapp"
                ? ["whatsapp", "sms", "email"]
                : ["email", "sms", "whatsapp"],
        },
        label: "SaveNotificationPref",
      })
      setNotificationPref(channel)
      setShowNotificationPrefs(false)
      showSuccess(`Notifications will be sent via ${channel.toUpperCase()}`)
    } catch (err) {
      logger.error("Failed to save notification pref", {
        error: err instanceof Error ? err.message : String(err),
      })
      showError("Failed to save preference")
    }
    setLoading(false)
  }

  const openNotificationPrefs = () => {
    fetchNotificationPref()
    setShowNotificationPrefs(true)
  }

  // Mark task as complete
  const completeTask = async (taskId: string) => {
    try {
      await apiFetch("/api/tasks", {
        method: "PATCH",
        body: {
          taskId,
          updates: { status: "completed" },
        },
        label: "CompleteTask",
      })
      fetchTasks() // Refresh tasks
      showSuccess("Task marked as complete!")
    } catch (err) {
      logger.error("Failed to complete task", {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Submit stock request
  const submitStockRequest = async () => {
    if (!currentUser || !stockRequest.itemName) return
    // Validate and clamp quantity to at least 1
    const validQuantity = Math.max(1, stockRequest.quantity || 1)
    if (stockRequest.quantity !== validQuantity) {
      setStockRequest((s) => ({ ...s, quantity: validQuantity }))
    }
    setLoading(true)
    try {
      const requestData = { ...stockRequest, quantity: validQuantity }
      await apiFetch("/api/kiosk/requests", {
        method: "POST",
        body: {
          type: "stock_order",
          employeeId: currentUser.id,
          employeeName: currentUser.name,
          data: requestData,
          timestamp: new Date().toISOString(),
        },
        label: "SubmitStockRequest",
      })
      setShowStockRequest(false)
      setStockRequest({ itemName: "", quantity: 1, urgency: "normal", notes: "" })
      showSuccess("Stock request submitted!")
    } catch (err) {
      logger.error("Failed to submit stock request", {
        error: err instanceof Error ? err.message : String(err),
      })
      showError("Failed to submit request")
    }
    setLoading(false)
  }

  // Submit salary advance request
  const submitAdvanceRequest = async () => {
    if (!currentUser || advanceRequest.amount < 100) return
    setLoading(true)
    try {
      await apiFetch("/api/kiosk/requests", {
        method: "POST",
        body: {
          type: "salary_advance",
          employeeId: currentUser.id,
          employeeName: currentUser.name,
          data: advanceRequest,
          timestamp: new Date().toISOString(),
        },
        label: "SubmitAdvanceRequest",
      })
      setShowAdvanceRequest(false)
      setAdvanceRequest({ amount: 0, reason: "", repaymentPlan: "1month" })
      showSuccess("Advance request submitted for approval!")
    } catch (err) {
      logger.error("Failed to submit advance request", {
        error: err instanceof Error ? err.message : String(err),
      })
      showError("Failed to submit request")
    }
    setLoading(false)
  }

  // Submit issue report
  const submitIssueReport = async () => {
    if (!currentUser || !issueReport.assetName || !issueReport.description) return
    setLoading(true)
    try {
      await apiFetch("/api/kiosk/requests", {
        method: "POST",
        body: {
          type: "issue_report",
          employeeId: currentUser.id,
          employeeName: currentUser.name,
          data: issueReport,
          timestamp: new Date().toISOString(),
        },
        label: "SubmitIssueReport",
      })
      setShowIssueReport(false)
      setIssueReport({ assetName: "", issueType: "maintenance", description: "", location: "" })
      showSuccess("Issue reported successfully!")
    } catch (err) {
      logger.error("Failed to submit issue report", {
        error: err instanceof Error ? err.message : String(err),
      })
      showError("Failed to submit report")
    }
    setLoading(false)
  }

  // Show success message
  const showSuccess = (message: string) => {
    // Clear any existing timeout before creating a new one
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current)
    }
    setSuccessMessage(message)
    successTimeoutRef.current = setTimeout(() => setSuccessMessage(""), 3000)
  }

  // PIN Entry Screen
  if (!currentUser) {
    return (
      <ErrorBoundary>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
          <div className="w-full max-w-sm space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary/80 border border-primary/30 shadow-lg">
                <span className="font-serif text-3xl font-bold text-primary-foreground">HV</span>
              </div>
              <h1 className="font-serif text-2xl font-bold text-foreground">House of Veritas</h1>
              <p className="text-muted-foreground">Employee Kiosk</p>
            </div>

            {/* Clock Display */}
            <div className="text-center">
              <p className="font-mono text-5xl text-foreground">
                {currentTime.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-muted-foreground">
                {currentTime.toLocaleDateString("en-ZA", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>

            {/* PIN Entry */}
            <Card className="border-border bg-card/80 backdrop-blur-sm shadow-xl">
              <CardContent className="space-y-4 pt-6">
                <p className="text-center text-foreground/80">Enter your PIN to clock in</p>

                <Input
                  id="pin-input"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="h-16 border-border bg-background text-center text-3xl tracking-widest text-foreground focus:border-primary/50 focus:ring-primary/20"
                  autoFocus
                  aria-label="PIN code"
                />

                {error && <p className="text-center text-sm text-destructive">{error}</p>}

                {/* Number Pad */}
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((num, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      className={`h-16 border-border text-2xl text-foreground hover:bg-muted ${num === "" ? "invisible" : ""}`}
                      onClick={() => {
                        if (num === "⌫") {
                          setPin((p) => p.slice(0, -1))
                        } else if (typeof num === "number") {
                          setPin((p) => (p + num).slice(0, 4))
                        }
                      }}
                      disabled={num === ""}
                      aria-label={num === "⌫" ? "Backspace" : undefined}
                    >
                      {num}
                    </Button>
                  ))}
                </div>

                <Button
                  className="h-14 w-full bg-primary text-primary-foreground text-lg hover:bg-primary/90 transition-all font-medium"
                  onClick={handlePinLogin}
                  disabled={pin.length !== 4 || loading}
                >
                  {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary-foreground/50" /> : "Enter"}
                </Button>
              </CardContent>
            </Card>

            {/* Admin Link */}
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground hover:bg-background/50"
              onClick={() => router.push("/login")}
            >
              <Home className="mr-2 h-4 w-4" />
              Admin Login
            </Button>
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  // Main Kiosk Interface
  return (
    <ErrorBoundary>
      <div className="flex min-h-screen flex-col bg-background p-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/80 border border-primary/30">
              <User className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{currentUser.name}</p>
              <p className="text-sm text-muted-foreground">{currentUser.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              onClick={openNotificationPrefs}
              data-testid="kiosk-notification-settings"
            >
              <Bell className="h-5 w-5" />
            </Button>
            <div className="text-right">
              <p className="font-mono text-3xl text-foreground">
                {currentTime.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <Badge className={currentUser.clockedIn ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}>
                {currentUser.clockedIn ? "Clocked In" : "Clocked Out"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Success Toast */}
        {successMessage && (
          <div
            role="alert"
            className="animate-in fade-in slide-in-from-top fixed top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-secondary px-6 py-3 text-secondary-foreground shadow-lg border border-secondary/50"
          >
            <CheckCircle className="h-5 w-5" />
            {successMessage}
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div
            role="alert"
            className="animate-in fade-in slide-in-from-top fixed top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-destructive px-6 py-3 text-destructive-foreground shadow-lg border border-destructive/50"
          >
            <XCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* Main Actions Grid - 3 columns on larger screens */}
        <div className="mx-auto grid w-full max-w-2xl flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
          {/* Clock In/Out */}
          <Button
            data-testid="kiosk-clock-btn"
            className={`flex h-32 flex-col gap-2 text-base sm:h-36 sm:text-lg transition-all border ${
              currentUser.clockedIn
                ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/30"
                : "bg-secondary/10 text-secondary hover:bg-secondary/20 border-secondary/30"
            }`}
            onClick={handleClockInOut}
            disabled={loading}
          >
            <Clock className="h-10 w-10" />
            {currentUser.clockedIn ? "Clock Out" : "Clock In"}
          </Button>

          {/* Scan Item */}
          <Button
            data-testid="kiosk-scan-btn"
            className="flex h-32 flex-col gap-2 bg-primary text-primary-foreground text-base hover:bg-primary/90 sm:h-36 sm:text-lg border border-primary/20"
            onClick={() => setShowScanner(true)}
          >
            <ScanLine className="h-10 w-10" />
            Scan Item
          </Button>

          {/* Use Stock */}
          <Button
            data-testid="kiosk-use-stock-btn"
            className="flex h-32 flex-col gap-2 bg-accent text-accent-foreground text-base hover:bg-accent/90 sm:h-36 sm:text-lg border border-accent/20"
            onClick={() => {
              setActionType("consume")
              setShowScanner(true)
            }}
          >
            <ArrowDown className="h-10 w-10" />
            Use Stock
          </Button>

          {/* My Tasks */}
          <Button
            data-testid="kiosk-tasks-btn"
            className="flex h-32 flex-col gap-2 bg-card text-foreground border border-border text-base hover:bg-muted hover:border-primary/50 transition-all sm:h-36 sm:text-lg shadow-sm"
            onClick={openTasks}
          >
            <ClipboardList className="h-10 w-10 text-primary" />
            My Tasks
          </Button>

          {/* Request Stock Order */}
          <Button
            data-testid="kiosk-order-stock-btn"
            className="flex h-32 flex-col gap-2 bg-card text-foreground border border-border text-base hover:bg-muted hover:border-primary/50 transition-all sm:h-36 sm:text-lg shadow-sm"
            onClick={() => setShowStockRequest(true)}
          >
            <ShoppingCart className="h-10 w-10 text-secondary" />
            Order Stock
          </Button>

          {/* Request Advance */}
          <Button
            data-testid="kiosk-advance-btn"
            className="flex h-32 flex-col gap-2 bg-card text-foreground border border-border text-base hover:bg-muted hover:border-primary/50 transition-all sm:h-36 sm:text-lg shadow-sm"
            onClick={() => setShowAdvanceRequest(true)}
          >
            <Banknote className="h-10 w-10 text-accent" />
            Ask Advance
          </Button>

          {/* Report Issue */}
          <Button
            data-testid="kiosk-report-issue-btn"
            className="flex h-32 flex-col gap-2 bg-card text-foreground border border-border text-base hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-all sm:h-36 sm:text-lg shadow-sm group"
            onClick={() => setShowIssueReport(true)}
          >
            <Wrench className="h-10 w-10 text-destructive group-hover:text-destructive" />
            Report Issue
          </Button>

          {/* My Requests History */}
          <Button
            data-testid="kiosk-history-btn"
            className="col-span-2 flex h-32 flex-col gap-2 bg-muted text-foreground border border-border text-base hover:bg-muted/80 transition-all sm:col-span-1 sm:h-36 sm:text-lg"
            onClick={openHistory}
          >
            <History className="h-10 w-10 text-muted-foreground" />
            My Requests
          </Button>
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          className="mt-6 h-14 border-border text-foreground hover:bg-muted text-lg shadow-sm"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-5 w-5" />
          Sign Out
        </Button>

        {/* Scanner Dialog */}
        <Dialog open={showScanner} onOpenChange={setShowScanner}>
          <DialogContent className="max-w-lg border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-primary" />
                Scan Barcode
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex aspect-video items-center justify-center rounded-lg bg-muted/50 border border-border">
                <div className="text-center">
                  <ScanLine className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                  <p className="text-muted-foreground">Camera scanner initializing...</p>
                  <p className="mt-2 text-sm text-muted-foreground">Or enter barcode manually:</p>
                </div>
              </div>
              <Input
                aria-label="Barcode number"
                placeholder="Enter barcode number"
                className="h-14 border-border bg-background text-center text-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value) {
                    handleBarcodeScanned(e.currentTarget.value)
                  }
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                {/* Quick test barcodes */}
                {["6001234567890", "6001234567891", "6001234567892"].map((code) => (
                  <Button
                    key={code}
                    variant="outline"
                    className="border-border text-sm hover:bg-muted"
                    onClick={() => handleBarcodeScanned(code)}
                  >
                    Test: {code.slice(-4)}
                  </Button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Item Action Dialog */}
        <Dialog open={showItemAction} onOpenChange={setShowItemAction}>
          <DialogContent className="max-w-lg border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle>
                {actionSuccess ? (
                  <span className="flex items-center gap-2 text-secondary">
                    <CheckCircle className="h-5 w-5" />
                    Success!
                  </span>
                ) : (
                  scannedItem?.name
                )}
              </DialogTitle>
            </DialogHeader>

            {actionSuccess ? (
              <div className="py-8 text-center">
                <CheckCircle className="mx-auto mb-4 h-20 w-20 text-secondary" />
                <p className="text-xl text-foreground">
                  {actionType === "consume" ? "Usage recorded" : "Stock added"}
                </p>
              </div>
            ) : (
              scannedItem && (
                <div className="space-y-4">
                  {/* Item Info */}
                  <div className="space-y-2 rounded-lg bg-muted p-4 border border-border">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Stock</span>
                      <span className="font-semibold text-foreground">
                        {scannedItem.currentStock} {scannedItem.unit}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location</span>
                      <span className="text-foreground">{scannedItem.location}</span>
                    </div>
                  </div>

                  {/* Action Type Selection */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      className={`h-16 ${actionType === "consume" ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-background text-foreground border border-border hover:bg-muted"}`}
                      onClick={() => setActionType("consume")}
                    >
                      <ArrowDown className="mr-2 h-5 w-5" />
                      Use
                    </Button>
                    <Button
                      className={`h-16 ${actionType === "restock" ? "bg-secondary text-secondary-foreground hover:bg-secondary/90" : "bg-background text-foreground border border-border hover:bg-muted"}`}
                      onClick={() => setActionType("restock")}
                    >
                      <ArrowUp className="mr-2 h-5 w-5" />
                      Add
                    </Button>
                  </div>

                  {/* Quantity */}
                  <div className="space-y-2">
                    <p className="text-muted-foreground">Quantity ({scannedItem.unit})</p>
                    <div className="flex gap-2">
                      {[1, 2, 5, 10].map((q) => (
                        <Button
                          key={q}
                          variant={quantity === String(q) ? "default" : "outline"}
                          className={`h-14 flex-1 text-xl ${quantity === String(q) ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border text-foreground hover:bg-muted"}`}
                          onClick={() => setQuantity(String(q))}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(Math.max(1, parseFloat(e.target.value) || 1).toString())
                      }
                      className="h-14 border-border bg-background text-center text-xl"
                    />
                  </div>

                  {/* Purpose (for consume) */}
                  {actionType === "consume" && (
                    <Input
                      placeholder="Purpose (optional)"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="h-14 border-border bg-background"
                    />
                  )}
                </div>
              )
            )}

            {!actionSuccess && (
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowItemAction(false)}
                  className="border-border text-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleItemAction}
                  disabled={loading}
                  className={actionType === "consume" ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-secondary text-secondary-foreground hover:bg-secondary/90"}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-current" />
                  ) : actionType === "consume" ? (
                    <>
                      <ArrowDown className="mr-2 h-5 w-5" />
                      Record Usage
                    </>
                  ) : (
                    <>
                      <ArrowUp className="mr-2 h-5 w-5" />
                      Add Stock
                    </>
                  )}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Tasks Dialog */}
        <Dialog open={showTasks} onOpenChange={setShowTasks}>
          <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                My Tasks
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No tasks assigned</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <Card key={task.id} className="border-border bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-medium text-foreground ${task.status === "completed" ? "line-through opacity-50" : ""}`}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {task.description}
                            </p>
                          )}
                          {task.dueDate && (
                            <p className="mt-1 text-sm text-muted-foreground/80">Due: {task.dueDate}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge
                            className={
                              task.priority === "high"
                                ? "bg-destructive text-destructive-foreground hover:bg-destructive"
                                : task.priority === "medium"
                                  ? "bg-accent text-accent-foreground hover:bg-accent"
                                  : "bg-muted-foreground text-background hover:bg-muted-foreground"
                            }
                          >
                            {task.priority}
                          </Badge>
                          {task.status !== "completed" && (
                            <Button
                              size="sm"
                              className="h-8 w-8 bg-secondary p-0 hover:bg-secondary/90 text-secondary-foreground"
                              onClick={() => completeTask(task.id)}
                              data-testid={`complete-task-${task.id}`}
                              aria-label={`Complete task ${task.title}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Stock Request Dialog */}
        <Dialog open={showStockRequest} onOpenChange={setShowStockRequest}>
          <DialogContent className="max-w-md border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-secondary" />
                Request Stock Order
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Submit a request for stock that needs to be ordered
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="stock-item-name">Item Name *</Label>
                <Input
                  id="stock-item-name"
                  value={stockRequest.itemName}
                  onChange={(e) => setStockRequest((s) => ({ ...s, itemName: e.target.value }))}
                  placeholder="e.g., Pool chlorine, Cement bags"
                  className="border-border bg-background"
                  data-testid="stock-item-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock-quantity">Quantity</Label>
                  <Input
                    id="stock-quantity"
                    type="number"
                    value={stockRequest.quantity}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value)
                      const safeValue = isNaN(parsed) ? 1 : Math.max(1, parsed)
                      setStockRequest((s) => ({ ...s, quantity: safeValue }))
                    }}
                    min="1"
                    className="border-border bg-background"
                    data-testid="stock-quantity-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <Select
                    value={stockRequest.urgency}
                    onValueChange={(v: "normal" | "urgent") =>
                      setStockRequest((s) => ({ ...s, urgency: v }))
                    }
                  >
                    <SelectTrigger className="border-border bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={stockRequest.notes}
                  onChange={(e) => setStockRequest((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Any additional details..."
                  className="min-h-[80px] border-border bg-background"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowStockRequest(false)}
                className="border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                onClick={submitStockRequest}
                disabled={loading || !stockRequest.itemName}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                data-testid="submit-stock-request-btn"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-current" /> : "Submit Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Salary Advance Dialog */}
        <Dialog open={showAdvanceRequest} onOpenChange={setShowAdvanceRequest}>
          <DialogContent className="max-w-md border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-accent" />
                Request Salary Advance
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Submit a request for a salary advance (requires approval)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="advance-amount">Amount (R) *</Label>
                <Input
                  id="advance-amount"
                  type="number"
                  value={advanceRequest.amount || ""}
                  onChange={(e) =>
                    setAdvanceRequest((a) => ({ ...a, amount: parseFloat(e.target.value) || 0 }))
                  }
                  placeholder="Enter amount"
                  min="100"
                  step="100"
                  className="h-14 border-border bg-background text-xl"
                  data-testid="advance-amount-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="advance-reason">Reason *</Label>
                <Textarea
                  id="advance-reason"
                  value={advanceRequest.reason}
                  onChange={(e) => setAdvanceRequest((a) => ({ ...a, reason: e.target.value }))}
                  placeholder="Please explain why you need the advance..."
                  className="min-h-[100px] border-border bg-background"
                  data-testid="advance-reason-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="advance-repayment">Repayment Plan</Label>
                <Select
                  value={advanceRequest.repaymentPlan}
                  onValueChange={(v) => setAdvanceRequest((a) => ({ ...a, repaymentPlan: v }))}
                >
                  <SelectTrigger id="advance-repayment" className="border-border bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1month">Full deduction next month</SelectItem>
                    <SelectItem value="2months">Split over 2 months</SelectItem>
                    <SelectItem value="3months">Split over 3 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm text-accent-foreground">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                Advances are subject to approval by management and will be deducted from future
                salary.
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAdvanceRequest(false)}
                className="border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                onClick={submitAdvanceRequest}
                disabled={loading || advanceRequest.amount < 100 || !advanceRequest.reason}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                data-testid="submit-advance-request-btn"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-current" /> : "Submit Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Report Issue Dialog */}
        <Dialog open={showIssueReport} onOpenChange={setShowIssueReport}>
          <DialogContent className="max-w-md border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-destructive" />
                Report Issue / Maintenance
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Report a broken item or maintenance issue
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="issue-asset-name">Asset / Item Name *</Label>
                <Input
                  id="issue-asset-name"
                  value={issueReport.assetName}
                  onChange={(e) => setIssueReport((i) => ({ ...i, assetName: e.target.value }))}
                  placeholder="e.g., Pool pump, Gate motor, Lawnmower"
                  className="border-border bg-background"
                  data-testid="issue-asset-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issue-type">Issue Type</Label>
                  <Select
                    value={issueReport.issueType}
                    onValueChange={(v: "broken" | "maintenance" | "safety" | "other") =>
                      setIssueReport((i) => ({ ...i, issueType: v }))
                    }
                  >
                    <SelectTrigger id="issue-type" className="border-border bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="broken">Broken / Not Working</SelectItem>
                      <SelectItem value="maintenance">Needs Maintenance</SelectItem>
                      <SelectItem value="safety">Safety Hazard</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issue-location">Location</Label>
                  <Input
                    id="issue-location"
                    value={issueReport.location}
                    onChange={(e) => setIssueReport((i) => ({ ...i, location: e.target.value }))}
                    placeholder="e.g., Pool area"
                    className="border-border bg-background"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue-description">Description *</Label>
                <Textarea
                  id="issue-description"
                  value={issueReport.description}
                  onChange={(e) => setIssueReport((i) => ({ ...i, description: e.target.value }))}
                  placeholder="Describe the issue in detail..."
                  className="min-h-[100px] border-border bg-background"
                  data-testid="issue-description-input"
                />
              </div>
              {issueReport.issueType === "safety" && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mr-2 inline h-4 w-4" />
                  Safety hazards are flagged as high priority and will be reviewed immediately.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowIssueReport(false)}
                className="border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                onClick={submitIssueReport}
                disabled={loading || !issueReport.assetName || !issueReport.description}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="submit-issue-report-btn"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-current" /> : "Report Issue"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request History Dialog */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                My Requests
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Track the status of your submitted requests
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 space-y-3 overflow-y-auto pr-2">
              {requestHistory.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <History className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No requests submitted yet</p>
                  <p className="mt-1 text-sm">
                    Your stock orders, advance requests, and issue reports will appear here
                  </p>
                </div>
              ) : (
                requestHistory.map((request) => (
                  <Card key={request.id} className="border-border bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div
                            className={`rounded-lg p-2 ${
                              request.type === "stock_order"
                                ? "bg-secondary/20"
                                : request.type === "salary_advance"
                                  ? "bg-accent/20"
                                  : "bg-destructive/20"
                            }`}
                          >
                            {request.type === "stock_order" ? (
                              <ShoppingCart className="h-5 w-5 text-secondary" />
                            ) : request.type === "salary_advance" ? (
                              <Banknote className="h-5 w-5 text-accent" />
                            ) : (
                              <Wrench className="h-5 w-5 text-destructive" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {request.type === "stock_order"
                                  ? "Stock Order"
                                  : request.type === "salary_advance"
                                    ? "Salary Advance"
                                    : "Issue Report"}
                              </span>
                              <Badge
                                className={`text-xs ${
                                  request.status === "pending"
                                    ? "bg-accent text-accent-foreground hover:bg-accent"
                                    : request.status === "approved"
                                      ? "bg-secondary text-secondary-foreground hover:bg-secondary"
                                      : request.status === "rejected"
                                        ? "bg-destructive text-destructive-foreground hover:bg-destructive"
                                        : "bg-primary text-primary-foreground hover:bg-primary"
                                }`}
                              >
                                {request.status === "pending"
                                  ? "Pending"
                                  : request.status === "approved"
                                    ? "Approved"
                                    : request.status === "rejected"
                                      ? "Rejected"
                                      : "Completed"}
                              </Badge>
                            </div>
                            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                              {request.type === "stock_order" &&
                                `${request.data.quantity}x ${request.data.itemName}`}
                              {request.type === "salary_advance" &&
                                `R ${request.data.amount?.toLocaleString()}`}
                              {request.type === "issue_report" &&
                                `${request.data.assetName} - ${request.data.issueType}`}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground/80">
                              {new Date(request.timestamp).toLocaleDateString("en-ZA", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            {request.notes && request.status !== "pending" && (
                              <div
                                className={`mt-2 rounded p-2 text-xs border ${
                                  request.status === "approved"
                                    ? "bg-secondary/10 text-secondary border-secondary/20"
                                    : "bg-destructive/10 text-destructive border-destructive/20"
                                }`}
                              >
                                <span className="font-medium flex items-center gap-1 mb-1">
                                  {request.status === "approved" ? (
                                    <CheckCircle className="h-3 w-3" />
                                  ) : (
                                    <XCircle className="h-3 w-3" />
                                  )}
                                  Note from Reviewer:
                                </span>
                                {request.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setShowHistory(false)}
                className="w-full border-border text-foreground hover:bg-muted"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Notification Preferences Dialog */}
        <Dialog open={showNotificationPrefs} onOpenChange={setShowNotificationPrefs}>
          <DialogContent className="max-w-md border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification Preferences
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Choose how you want to receive notifications when your requests are processed
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {/* SMS Option */}
              <button
                onClick={() => saveNotificationPref("sms")}
                disabled={loading}
                className={`flex w-full items-center gap-4 rounded-xl border p-4 transition-all ${
                  notificationPref === "sms"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/30 hover:bg-muted"
                }`}
                data-testid="pref-sms"
              >
                <div
                  className={`rounded-lg p-3 ${notificationPref === "sms" ? "bg-primary/20" : "bg-muted"}`}
                >
                  <Smartphone className={`h-6 w-6 ${notificationPref === "sms" ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">SMS</p>
                  <p className="text-sm text-muted-foreground">Receive text messages</p>
                </div>
                {notificationPref === "sms" && <CheckCircle className="h-5 w-5 text-primary" />}
              </button>

              {/* WhatsApp Option */}
              <button
                onClick={() => saveNotificationPref("whatsapp")}
                disabled={loading}
                className={`flex w-full items-center gap-4 rounded-xl border p-4 transition-all ${
                  notificationPref === "whatsapp"
                    ? "border-secondary bg-secondary/10"
                    : "border-border hover:border-secondary/30 hover:bg-muted"
                }`}
                data-testid="pref-whatsapp"
              >
                <div
                  className={`rounded-lg p-3 ${notificationPref === "whatsapp" ? "bg-secondary/20" : "bg-muted"}`}
                >
                  <MessageSquare className={`h-6 w-6 ${notificationPref === "whatsapp" ? "text-secondary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">WhatsApp</p>
                  <p className="text-sm text-muted-foreground">Receive WhatsApp messages</p>
                </div>
                {notificationPref === "whatsapp" && (
                  <CheckCircle className="h-5 w-5 text-secondary" />
                )}
              </button>

              {/* Email Option */}
              <button
                onClick={() => saveNotificationPref("email")}
                disabled={loading}
                className={`flex w-full items-center gap-4 rounded-xl border p-4 transition-all ${
                  notificationPref === "email"
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-accent/30 hover:bg-muted"
                }`}
                data-testid="pref-email"
              >
                <div
                  className={`rounded-lg p-3 ${notificationPref === "email" ? "bg-accent/20" : "bg-muted"}`}
                >
                  <Mail className={`h-6 w-6 ${notificationPref === "email" ? "text-accent" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground">Receive email notifications</p>
                </div>
                {notificationPref === "email" && (
                  <CheckCircle className="h-5 w-5 text-accent" />
                )}
              </button>
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <p>If delivery fails, we&apos;ll automatically try the next option in order:</p>
              <p className="mt-1 font-medium text-foreground/80">
                {notificationPref === "sms" && "SMS → WhatsApp → Email"}
                {notificationPref === "whatsapp" && "WhatsApp → SMS → Email"}
                {notificationPref === "email" && "Email → SMS → WhatsApp"}
              </p>
            </div>
            <DialogFooter className="mt-2">
              <Button
                variant="outline"
                onClick={() => setShowNotificationPrefs(false)}
                className="w-full border-border text-foreground hover:bg-muted"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-current" /> : "Done"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  )
}
