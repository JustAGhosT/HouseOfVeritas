/**
 * Bank API integration stub for outbound payments.
 * Used for payroll, reimbursements, loans/advances, and contractor payments.
 *
 * Configure BANK_API_URL and BANK_API_KEY to enable. When not configured,
 * submitPayment logs the attempted payment and returns a failure.
 *
 * Sends Idempotency-Key header (payment.reference or derived key) so the bank
 * API can deduplicate retries. The bank API should support this header.
 */

import { logger } from "@/lib/logger"

export interface PaymentRequest {
  recipientId: string
  recipientName: string
  amount: number
  currency: string
  reference: string
  type: "payroll" | "reimbursement" | "loan" | "contractor"
}

export interface PaymentResult {
  success: boolean
  transactionId?: string
  message?: string
}

function isConfigured(): boolean {
  return !!(process.env.BANK_API_URL && process.env.BANK_API_KEY)
}

export async function submitPayment(payment: PaymentRequest): Promise<PaymentResult> {
  if (!isConfigured()) {
    logger.info("Bank API not configured, payment logged only", {
      recipientId: payment.recipientId,
      amount: payment.amount,
      type: payment.type,
      reference: payment.reference,
    })
    return {
      success: false,
      message: "Bank API is not configured; payment was not submitted",
    }
  }

  const idempotencyKey =
    payment.reference?.trim() ||
    `${payment.type}-${payment.recipientId}-${payment.amount}-${payment.currency}`

  try {
    const response = await fetch(`${process.env.BANK_API_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BANK_API_KEY}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payment),
    })

    if (!response.ok) {
      const text = await response.text()
      logger.error("Bank API payment failed", {
        status: response.status,
        body: text,
        reference: payment.reference,
      })
      return {
        success: false,
        message: `Bank API error: ${response.status}`,
      }
    }

    const data = (await response.json()) as { transactionId?: string }
    return {
      success: true,
      transactionId: data.transactionId ?? `bank-${Date.now()}`,
    }
  } catch (error) {
    logger.error("Bank API request failed", {
      error: error instanceof Error ? error.message : String(error),
      reference: payment.reference,
    })
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
