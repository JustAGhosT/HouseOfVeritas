"use client"

import { useState, useRef, useCallback } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  ScanLine,
  Upload,
  FileText,
  Receipt,
  PenTool,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Copy,
  Download,
  ShoppingCart,
  Eye,
  Boxes,
} from "lucide-react"
import Image from "next/image"
import { apiFetch } from "@/lib/api-client"

const DOCUMENT_TYPES = [
  {
    value: "handwritten_request",
    label: "Handwritten Request",
    icon: PenTool,
    color: "text-purple-400",
  },
  { value: "invoice", label: "Invoice", icon: FileText, color: "text-blue-400" },
  { value: "receipt", label: "Receipt", icon: Receipt, color: "text-green-400" },
]

interface OCRResult {
  id: string
  type: string
  extractedText: string
  confidence: number
  structuredData?: Record<string, any>
  items?: Array<{
    name: string
    quantity?: number
    unit?: string
    price?: number
    total?: number
  }>
  totals?: {
    subtotal?: number
    tax?: number
    total?: number
  }
  vendor?: {
    name?: string
    address?: string
    phone?: string
  }
  processedAt: string
  aiPowered: boolean
}

export default function OCRPage() {
  const [selectedType, setSelectedType] = useState("invoice")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<OCRResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<OCRResult[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Import to Inventory state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importLocation, setImportLocation] = useState("Workshop Store")
  const [importCategory, setImportCategory] = useState("")
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState<{ imported: number; updated: number } | null>(
    null
  )

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Supported: JPEG, PNG, WEBP, PDF")
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10MB")
      return
    }

    setSelectedFile(file)
    setError(null)
    setResult(null)

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPreview(null)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      const input = fileInputRef.current
      if (input) {
        const dt = new DataTransfer()
        dt.items.add(file)
        input.files = dt.files
        input.dispatchEvent(new Event("change", { bubbles: true }))
      }
    }
  }, [])

  const processDocument = async () => {
    if (!selectedFile) return

    setProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("type", selectedType)

      const data = await apiFetch<{ result: OCRResult; error?: string }>("/api/ocr", {
        method: "POST",
        body: formData,
        label: "OCR",
      })

      setResult(data.result)
      setHistory((prev) => [data.result, ...prev].slice(0, 10))
    } catch (err: any) {
      setError(err.message || "Failed to process document")
    } finally {
      setProcessing(false)
    }
  }

  const clearSelection = () => {
    setSelectedFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    setImportSuccess(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatCurrency = (val?: number) => {
    if (val === undefined) return "—"
    return `R ${val.toFixed(2)}`
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-400"
    if (confidence >= 0.7) return "text-yellow-400"
    return "text-red-400"
  }

  // Import items to inventory
  const handleImportToInventory = async () => {
    if (!result?.items || result.items.length === 0) return

    setImporting(true)
    setImportSuccess(null)

    try {
      const data = await apiFetch<{
        success?: boolean
        imported?: number
        updated?: number
        error?: string
      }>("/api/inventory", {
        method: "PUT",
        body: {
          action: "import-from-ocr",
          items: result.items,
          supplier: result.vendor?.name,
          location: importLocation,
          category: importCategory || undefined,
        },
        label: "ImportFromOCR",
      })
      if (data?.success) {
        setImportSuccess({
          imported: data.imported ?? 0,
          updated: data.updated ?? 0,
        })
        setIsImportDialogOpen(false)
      } else {
        setError(data?.error || "Import failed")
      }
    } catch (err: any) {
      setError(err.message || "Import failed")
    } finally {
      setImporting(false)
    }
  }

  return (
    <DashboardLayout persona="hans">
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-white sm:text-3xl">
            <ScanLine className="h-8 w-8 text-cyan-400" />
            OCR Document Scanner
          </h1>
          <p className="mt-1 text-white/60">
            Extract text and data from invoices, receipts, and handwritten notes
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Upload Section */}
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Upload Document</CardTitle>
              <CardDescription className="text-white/60">
                Select a document type and upload an image or PDF
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Document Type Selection */}
              <div className="grid grid-cols-3 gap-2">
                {DOCUMENT_TYPES.map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.value}
                      onClick={() => setSelectedType(type.value)}
                      className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-all ${
                        selectedType === type.value
                          ? "border-blue-500 bg-white/10"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}
                      data-testid={`doc-type-${type.value}`}
                    >
                      <Icon className={`h-6 w-6 ${type.color}`} />
                      <span className="text-center text-xs text-white">{type.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* File Upload Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`relative rounded-xl border-2 border-dashed transition-all ${
                  selectedFile
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-white/20 hover:border-white/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  data-testid="file-input"
                />

                {selectedFile ? (
                  <div className="p-6 text-center">
                    {preview ? (
                      <Image
                        src={preview}
                        alt="Preview"
                        width={400}
                        height={192}
                        className="mx-auto mb-4 max-h-48 w-auto rounded-lg"
                        unoptimized
                      />
                    ) : (
                      <FileText className="mx-auto mb-4 h-16 w-16 text-blue-400" />
                    )}
                    <p className="font-medium text-white">{selectedFile.name}</p>
                    <p className="text-sm text-white/40">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        clearSelection()
                      }}
                      className="mt-2"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <Upload className="mx-auto mb-4 h-12 w-12 text-white/40" />
                    <p className="font-medium text-white">Drop file here or click to upload</p>
                    <p className="mt-1 text-sm text-white/40">
                      Supports JPEG, PNG, WEBP, PDF (max 10MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              {/* Process Button */}
              <Button
                className="w-full bg-cyan-600 hover:bg-cyan-700"
                disabled={!selectedFile || processing}
                onClick={processDocument}
                data-testid="process-btn"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ScanLine className="mr-2 h-4 w-4" />
                    Process Document
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Extracted Data</CardTitle>
              <CardDescription className="text-white/60">
                {result
                  ? "Document processed successfully"
                  : "Upload and process a document to see results"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <Tabs defaultValue="structured" className="w-full">
                  <TabsList className="w-full bg-white/5">
                    <TabsTrigger value="structured" className="flex-1">
                      Structured
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="flex-1">
                      Raw Text
                    </TabsTrigger>
                    <TabsTrigger value="items" className="flex-1">
                      Items
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="structured" className="mt-4 space-y-4">
                    {/* Confidence Score */}
                    <div className="flex items-center justify-between rounded-lg bg-white/5 p-3">
                      <span className="text-white/60">Confidence</span>
                      <span className={`font-semibold ${getConfidenceColor(result.confidence)}`}>
                        {(result.confidence * 100).toFixed(1)}%
                      </span>
                    </div>

                    {/* Vendor Info */}
                    {result.vendor && (
                      <div className="space-y-2 rounded-lg bg-white/5 p-4">
                        <p className="text-xs tracking-wider text-white/40 uppercase">Vendor</p>
                        {result.vendor.name && (
                          <p className="font-medium text-white">{result.vendor.name}</p>
                        )}
                        {result.vendor.address && (
                          <p className="text-sm text-white/60">{result.vendor.address}</p>
                        )}
                        {result.vendor.phone && (
                          <p className="text-sm text-white/60">{result.vendor.phone}</p>
                        )}
                      </div>
                    )}

                    {/* Totals */}
                    {result.totals && (
                      <div className="space-y-2 rounded-lg bg-white/5 p-4">
                        <p className="text-xs tracking-wider text-white/40 uppercase">Totals</p>
                        {result.totals.subtotal && (
                          <div className="flex justify-between">
                            <span className="text-white/60">Subtotal</span>
                            <span className="text-white">
                              {formatCurrency(result.totals.subtotal)}
                            </span>
                          </div>
                        )}
                        {result.totals.tax && (
                          <div className="flex justify-between">
                            <span className="text-white/60">VAT</span>
                            <span className="text-white">{formatCurrency(result.totals.tax)}</span>
                          </div>
                        )}
                        {result.totals.total && (
                          <div className="flex justify-between border-t border-white/10 pt-2">
                            <span className="font-medium text-white">Total</span>
                            <span className="text-lg font-bold text-white">
                              {formatCurrency(result.totals.total)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="raw" className="mt-4">
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(result.extractedText)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <pre className="max-h-[400px] overflow-y-auto rounded-lg bg-black/30 p-4 text-sm whitespace-pre-wrap text-white/80">
                        {result.extractedText}
                      </pre>
                    </div>
                  </TabsContent>

                  <TabsContent value="items" className="mt-4">
                    {result.items && result.items.length > 0 ? (
                      <div className="space-y-2">
                        {result.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-lg bg-white/5 p-3"
                          >
                            <div className="flex-1">
                              <p className="text-sm text-white">{item.name}</p>
                              {item.quantity && (
                                <p className="text-xs text-white/40">
                                  Qty: {item.quantity} {item.unit || ""}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              {item.price && (
                                <p className="text-xs text-white/60">
                                  @ {formatCurrency(item.price)}
                                </p>
                              )}
                              {item.total && (
                                <p className="font-medium text-white">
                                  {formatCurrency(item.total)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Import Success Message */}
                        {importSuccess && (
                          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                            <CheckCircle className="h-5 w-5 text-green-400" />
                            <p className="text-sm text-green-300">
                              Successfully imported {importSuccess.imported} new and updated{" "}
                              {importSuccess.updated} existing items
                            </p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-4">
                          <Button
                            variant="outline"
                            className="flex-1 border-white/10"
                            onClick={() => copyToClipboard(JSON.stringify(result.items, null, 2))}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Items
                          </Button>
                          <Button
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => setIsImportDialogOpen(true)}
                            data-testid="import-to-inventory-btn"
                          >
                            <Boxes className="mr-2 h-4 w-4" />
                            Import to Inventory
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-white/40">
                        <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
                        <p>No line items detected</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="py-12 text-center text-white/40">
                  <ScanLine className="mx-auto mb-4 h-16 w-16 opacity-30" />
                  <p>No document processed yet</p>
                  <p className="mt-1 text-sm">Upload a document to extract data</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* History Section */}
        {history.length > 0 && (
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Recent Scans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setResult(item)}
                    className="rounded-lg bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {item.type.replace(/_/g, " ")}
                      </Badge>
                      <span className={`text-xs ${getConfidenceColor(item.confidence)}`}>
                        {(item.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="truncate text-xs text-white/60">
                      {new Date(item.processedAt).toLocaleString()}
                    </p>
                    {item.totals?.total && (
                      <p className="mt-1 font-medium text-white">
                        {formatCurrency(item.totals.total)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import to Inventory Dialog */}
        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
          <DialogContent className="border-white/10 bg-[#0d0d12] text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-green-400" />
                Import Items to Inventory
              </DialogTitle>
              <DialogDescription className="text-white/60">
                Import {result?.items?.length || 0} items from the scanned document
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Vendor Info */}
              {result?.vendor?.name && (
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="mb-1 text-xs tracking-wider text-white/40 uppercase">Supplier</p>
                  <p className="font-medium text-white">{result.vendor.name}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Storage Location</Label>
                <Select value={importLocation} onValueChange={setImportLocation}>
                  <SelectTrigger className="border-white/10 bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Workshop Store">Workshop Store</SelectItem>
                    <SelectItem value="Garden Shed">Garden Shed</SelectItem>
                    <SelectItem value="Garage">Garage</SelectItem>
                    <SelectItem value="Pool House">Pool House</SelectItem>
                    <SelectItem value="Main House">Main House</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Override Category (optional)</Label>
                <Select value={importCategory} onValueChange={setImportCategory}>
                  <SelectTrigger className="border-white/10 bg-white/5">
                    <SelectValue placeholder="Auto-detect from item names" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Auto-detect</SelectItem>
                    <SelectItem value="building_materials">Building Materials</SelectItem>
                    <SelectItem value="cleaning_supplies">Cleaning Supplies</SelectItem>
                    <SelectItem value="garden_supplies">Garden Supplies</SelectItem>
                    <SelectItem value="workshop_consumables">Workshop Consumables</SelectItem>
                    <SelectItem value="household">Household</SelectItem>
                    <SelectItem value="fuel">Fuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preview Items */}
              <div className="space-y-2">
                <Label>Items to Import</Label>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {result?.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between rounded bg-white/5 p-2 text-sm">
                      <span className="text-white">{item.name}</span>
                      <span className="text-white/60">
                        {item.quantity || 1} {item.unit || "units"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImportToInventory}
                disabled={importing}
                className="bg-green-600 hover:bg-green-700"
                data-testid="confirm-import-btn"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Boxes className="mr-2 h-4 w-4" />
                    Import {result?.items?.length || 0} Items
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
