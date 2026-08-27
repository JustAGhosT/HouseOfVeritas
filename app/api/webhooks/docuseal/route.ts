import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { routeToInngest } from "@/lib/workflows"
import { logger } from "@/lib/logger"

function validateSignature(body: string, signature: string, secret: string): boolean {
  const isDev = process.env.NODE_ENV === "development"

  if (!secret) {
    if (!isDev) {
      logger.error(
        "DocuSeal webhook: DOCUSEAL_WEBHOOK_SECRET is not set in a non-development environment"
      )
      return false
    }

    logger.warn(
      "DocuSeal webhook: skipping signature validation because DOCUSEAL_WEBHOOK_SECRET is not set in development"
    )
    return true
  }

  if (!secret || !signature) return false
  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex")
    const sigBuf = Buffer.from(signature, "hex")
    const expBuf = Buffer.from(expected, "hex")
    if (sigBuf.length !== expBuf.length) return false
    return timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

function validatedProduct(metadata: unknown): string | undefined {
  if (metadata === undefined) return undefined
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Invalid product metadata")
  }

  const product = (metadata as Record<string, unknown>).product
  if (product === undefined) return undefined
  if (typeof product !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(product)) {
    throw new Error("Invalid product metadata")
  }

  return product
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const headerName = process.env.DOCUSEAL_WEBHOOK_HEADER || "X-DocuSeal-Signature"
    const signature =
      request.headers.get(headerName) || request.headers.get("X-DocuSeal-Signature") || ""
    const secret = process.env.DOCUSEAL_WEBHOOK_SECRET || ""

    if (!validateSignature(body, signature, secret)) {
      logger.warn("DocuSeal webhook: invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const payload = JSON.parse(body) as {
      event_type?: string
      data?: {
        id?: string
        template?: { name?: string }
        submitters?: Array<{ email?: string }>
        documents?: Array<{ url?: string }>
        completed_at?: string
        metadata?: unknown
      }
    }

    const eventType = payload.event_type || ""
    const data = payload.data || {}

    if (eventType === "submission.completed") {
      const templateName = data.template?.name || ""
      const documents = data.documents || []
      const documentUrl = documents[0]?.url || ""
      const submitters = data.submitters || []
      const submitterEmails = submitters.map((s) => s.email || "").filter(Boolean)
      const product = validatedProduct(data.metadata)

      await routeToInngest({
        name: "house-of-veritas/docuseal.submission.completed",
        data: {
          submissionId: String(data.id || ""),
          templateName,
          documentUrl,
          completedAt: data.completed_at || new Date().toISOString(),
          submitterEmails,
          product,
        },
      })
    }

    return NextResponse.json({
      success: true,
      actions: [],
      message: `Event ${eventType} acknowledged`,
    })
  } catch (error) {
    logger.error("DocuSeal webhook error", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
}
