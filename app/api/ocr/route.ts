import { NextResponse } from "next/server"

// Azure Document Intelligence / OCR Configuration
const AZURE_DOC_CONFIG = {
  endpoint: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
  apiKey: process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY,
}

// Check if Azure Document Intelligence is configured
function isAzureDocConfigured(): boolean {
  return !!(AZURE_DOC_CONFIG.endpoint && AZURE_DOC_CONFIG.apiKey)
}

const DEMO_DATA_ENABLED = process.env.ALLOW_DEMO_DATA === "true"

// OCR Result types
interface OCRResult {
  id: string
  type: "handwritten_request" | "invoice" | "receipt" | "general"
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

// Mock OCR results for demo
function mockOCRHandwrittenRequest(filename: string): OCRResult {
  return {
    id: `ocr_${Date.now()}`,
    type: "handwritten_request",
    extractedText: `Material Request - Workshop
    
Date: 20 Feb 2026
Requested by: Charl

Items needed:
1. PVC Pipe 40mm x 6m - 5 pieces
2. Elbow joints 40mm - 10 pieces  
3. PVC Cement 500ml - 2 tins
4. Teflon tape - 3 rolls
5. Gate valve 40mm - 2 pieces

Urgency: Medium
For: Pool pump repair

Signature: [Charl]`,
    confidence: 0.87,
    items: [
      { name: "PVC Pipe 40mm x 6m", quantity: 5, unit: "pieces" },
      { name: "Elbow joints 40mm", quantity: 10, unit: "pieces" },
      { name: "PVC Cement 500ml", quantity: 2, unit: "tins" },
      { name: "Teflon tape", quantity: 3, unit: "rolls" },
      { name: "Gate valve 40mm", quantity: 2, unit: "pieces" },
    ],
    processedAt: new Date().toISOString(),
    aiPowered: false,
  }
}

function mockOCRInvoice(filename: string): OCRResult {
  return {
    id: `ocr_${Date.now()}`,
    type: "invoice",
    extractedText: `CASHBUILD STELLENBOSCH
VAT No: 4850112571
Date: 18/02/2026
Invoice: CB-2026-00458

Description          Qty    Price      Total
-------------------------------------------
Cement 50kg          10    R89.95    R899.50
Sand (River) 40kg     5    R45.00    R225.00
Building Bricks     500     R1.80    R900.00
Wheelbarrow           1   R650.00    R650.00

Subtotal:                           R2,674.50
VAT (15%):                            R401.18
TOTAL:                              R3,075.68

Payment: Cash
Thank you for your business!`,
    confidence: 0.94,
    vendor: {
      name: "Cashbuild Stellenbosch",
      phone: "021 887 1234",
    },
    items: [
      { name: "Cement 50kg", quantity: 10, price: 89.95, total: 899.5 },
      { name: "Sand (River) 40kg", quantity: 5, price: 45.0, total: 225.0 },
      { name: "Building Bricks", quantity: 500, price: 1.8, total: 900.0 },
      { name: "Wheelbarrow", quantity: 1, price: 650.0, total: 650.0 },
    ],
    totals: {
      subtotal: 2674.5,
      tax: 401.18,
      total: 3075.68,
    },
    processedAt: new Date().toISOString(),
    aiPowered: false,
  }
}

function mockOCRReceipt(filename: string): OCRResult {
  return {
    id: `ocr_${Date.now()}`,
    type: "receipt",
    extractedText: `BUILDER'S WAREHOUSE
Store: Tygervalley
Date: 15/02/2026

Items:
Drill bits set         R189.00
Safety glasses          R79.00
Work gloves (3-pack)   R125.00
Cable ties 100pc        R45.00

TOTAL: R438.00
Card Payment: ****4521

Thank you!`,
    confidence: 0.91,
    vendor: {
      name: "Builder's Warehouse",
      address: "Tygervalley",
    },
    items: [
      { name: "Drill bits set", quantity: 1, total: 189.0 },
      { name: "Safety glasses", quantity: 1, total: 79.0 },
      { name: "Work gloves (3-pack)", quantity: 1, total: 125.0 },
      { name: "Cable ties 100pc", quantity: 1, total: 45.0 },
    ],
    totals: {
      total: 438.0,
    },
    processedAt: new Date().toISOString(),
    aiPowered: false,
  }
}

// Store for processed OCR results
let ocrResults: OCRResult[] = []

// POST - Process document with OCR
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const documentType = (formData.get("type") as string) || "general"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Supported: JPEG, PNG, WEBP, PDF" },
        { status: 400 }
      )
    }

    let result: OCRResult

    if (isAzureDocConfigured()) {
      // In production: Use Azure Document Intelligence
      // const client = new DocumentIntelligenceClient(...)
      // const poller = await client.beginAnalyzeDocument(...)
      // Process actual OCR result

      // For now, use mock based on type
      if (documentType === "handwritten_request") {
        result = mockOCRHandwrittenRequest(file.name)
      } else if (documentType === "invoice") {
        result = mockOCRInvoice(file.name)
      } else {
        result = mockOCRReceipt(file.name)
      }
      result.aiPowered = true
    } else if (DEMO_DATA_ENABLED) {
      // Use mock OCR
      if (documentType === "handwritten_request") {
        result = mockOCRHandwrittenRequest(file.name)
      } else if (documentType === "invoice") {
        result = mockOCRInvoice(file.name)
      } else {
        result = mockOCRReceipt(file.name)
      }
    } else {
      return NextResponse.json(
        {
          error:
            "OCR is not configured. Set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT/AZURE_DOCUMENT_INTELLIGENCE_KEY or ALLOW_DEMO_DATA=true.",
        },
        { status: 503 }
      )
    }

    ocrResults.push(result)

    return NextResponse.json({
      success: true,
      mode: isAzureDocConfigured() ? "azure" : "demo",
      result,
      note: isAzureDocConfigured()
        ? "Processed with Azure Document Intelligence"
        : "Demo mode - configure AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT for live OCR",
    })
  } catch (error) {
    return NextResponse.json({ error: "OCR processing failed" }, { status: 500 })
  }
}

// GET - List processed OCR results
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")

  let results = [...ocrResults]
  if (type) {
    results = results.filter((r) => r.type === type)
  }

  return NextResponse.json({
    results,
    total: results.length,
    configured: isAzureDocConfigured(),
  })
}
