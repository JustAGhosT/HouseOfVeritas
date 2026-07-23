"use client"

import { useState, useEffect, useCallback } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ScannerButton } from "@/components/barcode-scanner"
import { LabelPrintDialog } from "@/components/barcode-label-generator"
import { BatchScanDialog } from "@/components/batch-scanner"
import { InventoryPhotoCapture } from "@/components/inventory-photo-capture"
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  Package,
  ShoppingCart,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  RefreshCw,
  ScanLine,
  Printer,
  ClipboardList,
  ChevronDown,
} from "lucide-react"
import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"

const CATEGORIES = [
  { value: "building_materials", label: "Building Materials" },
  { value: "cleaning_supplies", label: "Cleaning Supplies" },
  { value: "garden_supplies", label: "Garden Supplies" },
  { value: "workshop_consumables", label: "Workshop Consumables" },
  { value: "household", label: "Household" },
  { value: "fuel", label: "Fuel" },
  { value: "other", label: "Other" },
]

const STORES = [
  { value: "cashbuild", label: "Cashbuild" },
  { value: "builders", label: "Builders Warehouse" },
  { value: "makro", label: "Makro" },
  { value: "stodels", label: "Stodels" },
]

interface InventoryItem {
  id: string
  name: string
  category: string
  unit: string
  currentStock: number
  minStock: number
  maxStock: number
  reorderPoint: number
  lastRestocked: string
  averageConsumption: number
  location: string
  supplier?: string
  barcode?: string
  unitCost: number
  totalValue: number
}

interface Alert {
  id: string
  name: string
  currentStock: number
  reorderPoint: number
  urgency: "critical" | "warning"
  estimatedDaysLeft: number | null
}

interface ShoppingListItem {
  name: string
  currentStock: number
  orderQuantity: number
  unit: string
  estimatedCost: number
  supplier: string
  priority: "high" | "medium"
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)

  // Dialog states
  const [isConsumeDialogOpen, setIsConsumeDialogOpen] = useState(false)
  const [isRestockDialogOpen, setIsRestockDialogOpen] = useState(false)
  const [isShoppingListOpen, setIsShoppingListOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([])
  const [selectedStore, setSelectedStore] = useState("cashbuild")

  // New dialog states for barcode features
  const [isLabelPrintOpen, setIsLabelPrintOpen] = useState(false)
  const [isBatchConsumeOpen, setIsBatchConsumeOpen] = useState(false)
  const [isBatchRestockOpen, setIsBatchRestockOpen] = useState(false)
  const [isStockCountOpen, setIsStockCountOpen] = useState(false)

  // Form states
  const [consumeQuantity, setConsumeQuantity] = useState("")
  const [consumePurpose, setConsumePurpose] = useState("")
  const [restockQuantity, setRestockQuantity] = useState("")
  const [restockCost, setRestockCost] = useState("")

  const fetchInventory = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedCategory !== "all") params.append("category", selectedCategory)
      if (showLowStockOnly) params.append("lowStock", "true")

      const data = await apiFetch<{ items?: InventoryItem[]; alerts?: Alert[]; summary?: any }>(
        `/api/inventory?${params}`,
        { label: "Inventory" }
      )
      setItems(data?.items || [])
      setAlerts(data?.alerts || [])
      setSummary(data?.summary ?? null)
    } catch (error) {
      logger.error("Failed to fetch inventory", {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, showLowStockOnly])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const handleConsume = async () => {
    if (!selectedItem || !consumeQuantity) return
    try {
      await apiFetch("/api/inventory", {
        method: "POST",
        body: {
          action: "consume",
          itemId: selectedItem.id,
          quantity: parseFloat(consumeQuantity),
          usedBy: "hans",
          purpose: consumePurpose,
        },
        label: "ConsumeInventory",
      })
      fetchInventory()
      setIsConsumeDialogOpen(false)
      setConsumeQuantity("")
      setConsumePurpose("")
    } catch (error) {
      logger.error("Failed to consume", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleRestock = async () => {
    if (!selectedItem || !restockQuantity) return
    try {
      await apiFetch("/api/inventory", {
        method: "POST",
        body: {
          action: "restock",
          itemId: selectedItem.id,
          quantity: parseFloat(restockQuantity),
          unitCost: restockCost ? parseFloat(restockCost) : undefined,
        },
        label: "RestockInventory",
      })
      fetchInventory()
      setIsRestockDialogOpen(false)
      setRestockQuantity("")
      setRestockCost("")
    } catch (error) {
      logger.error("Failed to restock", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const generateShoppingList = async () => {
    try {
      const data = await apiFetch<{ success?: boolean; shoppingList?: ShoppingListItem[] }>(
        "/api/inventory",
        {
          method: "PUT",
          body: {
            action: "generate-shopping-list",
            store: selectedStore,
          },
          label: "GenerateShoppingList",
        }
      )
      if (data?.success) {
        setShoppingList(data?.shoppingList || [])
        setIsShoppingListOpen(true)
      }
    } catch (error) {
      logger.error("Failed to generate shopping list", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const getStockLevel = (item: InventoryItem) => {
    const percentage = (item.currentStock / item.maxStock) * 100
    if (item.currentStock <= item.minStock) return { color: "bg-red-500", label: "Critical" }
    if (item.currentStock <= item.reorderPoint) return { color: "bg-yellow-500", label: "Low" }
    return { color: "bg-green-500", label: "Good" }
  }

  const formatCurrency = (val?: number) => {
    if (val === undefined) return "—"
    return `R ${val.toLocaleString()}`
  }

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle barcode scan result
  const handleBarcodeItemFound = (item: InventoryItem) => {
    setSelectedItem(item)
    // Could auto-open consume or restock dialog based on context
  }

  // Handle batch scan completion
  const handleBatchComplete = () => {
    fetchInventory()
    setIsBatchConsumeOpen(false)
    setIsBatchRestockOpen(false)
    setIsStockCountOpen(false)
  }

  return (
    <DashboardLayout persona="hans">
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-white sm:text-3xl">
              <Boxes className="h-8 w-8 text-green-400" />
              Inventory Management
            </h1>
            <p className="mt-1 text-white/60">Track stock levels and manage consumption</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Scan Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  <ScanLine className="mr-2 h-4 w-4" />
                  Scan
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-white/10 bg-[#0d0d12]">
                <DropdownMenuItem
                  onClick={() => setIsStockCountOpen(true)}
                  className="cursor-pointer text-white"
                >
                  <ClipboardList className="mr-2 h-4 w-4 text-blue-400" />
                  Stock Count
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsBatchConsumeOpen(true)}
                  className="cursor-pointer text-white"
                >
                  <ArrowDown className="mr-2 h-4 w-4 text-orange-400" />
                  Batch Consume
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsBatchRestockOpen(true)}
                  className="cursor-pointer text-white"
                >
                  <ArrowUp className="mr-2 h-4 w-4 text-green-400" />
                  Batch Restock
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Print Labels Button */}
            <Button
              variant="outline"
              onClick={() => setIsLabelPrintOpen(true)}
              className="border-white/10"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print Labels
            </Button>

            <Button
              variant="outline"
              onClick={generateShoppingList}
              className="border-white/10"
              data-testid="shopping-list-btn"
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Shopping List
            </Button>
          </div>
        </div>

        <InventoryPhotoCapture
          persona="hans"
          tone="blue"
          defaultCategory={selectedCategory === "all" ? "workshop_consumables" : selectedCategory}
          defaultLocation="Workshop Store"
          onSaved={fetchInventory}
        />

        {/* Alerts Banner */}
        {alerts.length > 0 && (
          <Card className="border-red-500/30 bg-red-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 shrink-0 text-red-400" />
                <div className="flex-1">
                  <p className="font-semibold text-red-300">Low Stock Alerts</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {alerts.map((alert) => (
                      <Badge
                        key={alert.id}
                        variant={alert.urgency === "critical" ? "destructive" : "outline"}
                        className={
                          alert.urgency === "warning" ? "border-yellow-500 text-yellow-400" : ""
                        }
                      >
                        {alert.name} ({alert.currentStock} left)
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-blue-500/20 p-3">
                    <Package className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white/60">Total Items</p>
                    <p className="text-2xl font-bold text-white">{summary.totalItems}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-green-500/20 p-3">
                    <Boxes className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white/60">Total Value</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(summary.totalValue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-yellow-500/20 p-3">
                    <AlertTriangle className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white/60">Low Stock</p>
                    <p className="text-2xl font-bold text-white">{summary.lowStockCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-red-500/20 p-3">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white/60">Critical</p>
                    <p className="text-2xl font-bold text-white">{summary.criticalCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="border-white/10 bg-white/5">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  placeholder="Search inventory..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-white/10 bg-white/5 pl-10"
                  data-testid="inventory-search-input"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full border-white/10 bg-white/5 sm:w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={showLowStockOnly ? "default" : "outline"}
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={showLowStockOnly ? "bg-red-600 hover:bg-red-700" : "border-white/10"}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Low Stock Only
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-500/30 border-t-green-500" />
          </div>
        ) : (
          <Card className="overflow-hidden border-white/10 bg-white/5">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/60">Item</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/60">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/60">
                      Stock Level
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/60">
                      Location
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-white/60">Value</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-white/60">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const stockLevel = getStockLevel(item)
                    const percentage = Math.min((item.currentStock / item.maxStock) * 100, 100)
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-white/5 hover:bg-white/3"
                        data-testid={`inventory-row-${item.id}`}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-white">{item.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-white/40">{item.supplier || "—"}</p>
                              {item.barcode && (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-xs text-white/30"
                                >
                                  <ScanLine className="mr-1 h-3 w-3" />
                                  {item.barcode}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="capitalize">
                            {item.category.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-40">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-sm text-white">
                                {item.currentStock} / {item.maxStock} {item.unit}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-xs ${stockLevel.color === "bg-red-500" ? "border-red-500 text-red-400" : stockLevel.color === "bg-yellow-500" ? "border-yellow-500 text-yellow-400" : "border-green-500 text-green-400"}`}
                              >
                                {stockLevel.label}
                              </Badge>
                            </div>
                            <Progress value={percentage} className={`h-2 ${stockLevel.color}`} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-white/60">{item.location}</td>
                        <td className="px-6 py-4 text-white">{formatCurrency(item.totalValue)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/10"
                              onClick={() => {
                                setSelectedItem(item)
                                setIsConsumeDialogOpen(true)
                              }}
                              data-testid={`consume-${item.id}`}
                            >
                              <ArrowDown className="mr-1 h-3 w-3" />
                              Use
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => {
                                setSelectedItem(item)
                                setIsRestockDialogOpen(true)
                              }}
                              data-testid={`restock-${item.id}`}
                            >
                              <ArrowUp className="mr-1 h-3 w-3" />
                              Restock
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Consume Dialog */}
        <Dialog open={isConsumeDialogOpen} onOpenChange={setIsConsumeDialogOpen}>
          <DialogContent className="border-white/10 bg-[#0d0d12] text-white">
            <DialogHeader>
              <DialogTitle>Record Consumption</DialogTitle>
              <DialogDescription className="text-white/60">{selectedItem?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Quantity ({selectedItem?.unit})</Label>
                <Input
                  type="number"
                  value={consumeQuantity}
                  onChange={(e) => setConsumeQuantity(e.target.value)}
                  max={selectedItem?.currentStock}
                  className="border-white/10 bg-white/5"
                  data-testid="consume-quantity-input"
                />
                <p className="text-xs text-white/40">
                  Available: {selectedItem?.currentStock} {selectedItem?.unit}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Input
                  value={consumePurpose}
                  onChange={(e) => setConsumePurpose(e.target.value)}
                  placeholder="e.g. Pool maintenance, Fence repair"
                  className="border-white/10 bg-white/5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConsumeDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConsume}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="confirm-consume-btn"
              >
                Record Usage
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Restock Dialog */}
        <Dialog open={isRestockDialogOpen} onOpenChange={setIsRestockDialogOpen}>
          <DialogContent className="border-white/10 bg-[#0d0d12] text-white">
            <DialogHeader>
              <DialogTitle>Restock Item</DialogTitle>
              <DialogDescription className="text-white/60">{selectedItem?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Quantity to Add ({selectedItem?.unit})</Label>
                <Input
                  type="number"
                  value={restockQuantity}
                  onChange={(e) => setRestockQuantity(e.target.value)}
                  className="border-white/10 bg-white/5"
                  data-testid="restock-quantity-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost (R) - Optional</Label>
                <Input
                  type="number"
                  value={restockCost}
                  onChange={(e) => setRestockCost(e.target.value)}
                  placeholder={`Current: R ${selectedItem?.unitCost}`}
                  className="border-white/10 bg-white/5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRestockDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRestock}
                className="bg-green-600 hover:bg-green-700"
                data-testid="confirm-restock-btn"
              >
                Add Stock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Shopping List Dialog */}
        <Dialog open={isShoppingListOpen} onOpenChange={setIsShoppingListOpen}>
          <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto border-white/10 bg-[#0d0d12] text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-green-400" />
                Generated Shopping List
              </DialogTitle>
              <DialogDescription className="text-white/60">
                Items that need restocking based on current levels
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger className="w-[200px] border-white/10 bg-white/5">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {STORES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={generateShoppingList}
                  className="border-white/10"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>

              {shoppingList.length === 0 ? (
                <div className="py-8 text-center text-white/40">
                  <Boxes className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>All items are sufficiently stocked!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shoppingList.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg bg-white/5 p-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{item.name}</p>
                          {item.priority === "high" && (
                            <Badge variant="destructive" className="text-xs">
                              Urgent
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-white/40">
                          Order: {item.orderQuantity} {item.unit} • Current: {item.currentStock}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-white">
                          {formatCurrency(item.estimatedCost)}
                        </p>
                        <a
                          href={`https://www.${selectedStore}.co.za/search?q=${encodeURIComponent(item.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-end gap-1 text-sm text-blue-400 hover:text-blue-300"
                        >
                          Search <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <p className="text-white/60">Total Estimated Cost</p>
                    <p className="text-xl font-bold text-white">
                      {formatCurrency(shoppingList.reduce((sum, i) => sum + i.estimatedCost, 0))}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Label Print Dialog */}
        <LabelPrintDialog
          items={items}
          open={isLabelPrintOpen}
          onOpenChange={setIsLabelPrintOpen}
        />

        {/* Batch Scan Dialogs */}
        <BatchScanDialog
          mode="stockcount"
          open={isStockCountOpen}
          onOpenChange={setIsStockCountOpen}
          onComplete={handleBatchComplete}
        />
        <BatchScanDialog
          mode="consume"
          open={isBatchConsumeOpen}
          onOpenChange={setIsBatchConsumeOpen}
          onComplete={handleBatchComplete}
        />
        <BatchScanDialog
          mode="restock"
          open={isBatchRestockOpen}
          onOpenChange={setIsBatchRestockOpen}
          onComplete={handleBatchComplete}
        />
      </div>
    </DashboardLayout>
  )
}
