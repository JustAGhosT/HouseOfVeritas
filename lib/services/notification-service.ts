// Notification Service Types and Implementation
// Supports SMS (Twilio), WhatsApp (Twilio), Email, and Push notifications

import twilio from "twilio"
import { EmailClient as AcsEmailClient } from "@azure/communication-email"
import { logger } from "@/lib/logger"

let _acsEmailClient: AcsEmailClient | null | undefined
function getAcsEmailClient(): AcsEmailClient | null {
  if (_acsEmailClient !== undefined) return _acsEmailClient
  const connectionString = process.env.ACS_CONNECTION_STRING
  if (!connectionString) {
    _acsEmailClient = null
    return null
  }
  try {
    _acsEmailClient = new AcsEmailClient(connectionString)
  } catch (error) {
    logger.error("Failed to initialise ACS EmailClient", {
      error: error instanceof Error ? error.message : String(error),
    })
    _acsEmailClient = null
  }
  return _acsEmailClient
}

export type NotificationChannel = "sms" | "whatsapp" | "email" | "push" | "in_app"

export type NotificationType =
  | "approval_required"
  | "expense_approved"
  | "expense_rejected"
  | "task_assigned"
  | "task_due"
  | "document_expiry"
  | "password_reset"
  | "system_alert"
  | "daily_digest"
  | "weekly_summary"
  | "leave_balance_updated"

export interface NotificationPayload {
  type: NotificationType
  userId: string
  title: string
  message: string
  channels: NotificationChannel[]
  data?: Record<string, any>
  priority?: "low" | "medium" | "high" | "urgent"
  scheduledFor?: Date
  usePreference?: boolean // Use user's saved preference
}

export interface NotificationResult {
  channel: NotificationChannel
  success: boolean
  messageId?: string
  error?: string
  fallbackUsed?: boolean
}

export interface DeliveryStatus {
  channel: NotificationChannel
  success: boolean
  error?: string
  suggestFallback?: boolean
  fallbackOptions?: NotificationChannel[]
}

// Twilio SMS/WhatsApp Configuration
const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  fromNumber: process.env.TWILIO_PHONE_NUMBER,
  whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER,
}

// Initialize Twilio client
let twilioClient: twilio.Twilio | null = null

function getTwilioClient(): twilio.Twilio | null {
  if (!TWILIO_CONFIG.accountSid || !TWILIO_CONFIG.authToken) {
    return null
  }
  if (!twilioClient) {
    twilioClient = twilio(TWILIO_CONFIG.accountSid, TWILIO_CONFIG.authToken)
  }
  return twilioClient
}

// Check if Twilio is configured
export function isTwilioConfigured(): boolean {
  return !!(TWILIO_CONFIG.accountSid && TWILIO_CONFIG.authToken && TWILIO_CONFIG.fromNumber)
}

// User phone numbers (in production, fetch from database)
const USER_PHONES: Record<string, string> = {
  hans: "+27692381255",
  charl: "+27711488390",
  lucky: "+27794142410",
  irma: "+27711488390",
}

// User emails (in production, fetch from database)
const USER_EMAILS: Record<string, string> = {
  hans: "hans@houseofv.com",
  charl: "charl@houseofv.com",
  lucky: "lucky@houseofv.com",
  irma: "irma@houseofv.com",
}

// Send SMS via Twilio
export async function sendSMS(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getTwilioClient()

  if (!client || !TWILIO_CONFIG.fromNumber) {
    logger.info("Twilio not configured, simulating SMS", { to })
    logger.debug("SMS simulated", { to, message })
    return {
      success: true,
      messageId: `sim_sms_${Date.now()}`,
    }
  }

  try {
    logger.info("Sending SMS via Twilio", { to })
    const result = await client.messages.create({
      body: message,
      from: TWILIO_CONFIG.fromNumber,
      to: to,
    })
    logger.info("SMS sent successfully", { sid: result.sid })
    return { success: true, messageId: result.sid }
  } catch (error) {
    logger.error("SMS Error", { error: error instanceof Error ? error.message : String(error) })
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code: number }).code
        : undefined
    if (code === 21608 || code === 21211 || code === 21614) {
      logger.info("Twilio error, simulating delivery", { code, to })
      return { success: true, messageId: `test_sms_${Date.now()}`, error: `Twilio: ${code}` }
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// Send WhatsApp via Twilio
export async function sendWhatsApp(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getTwilioClient()

  if (!client || !TWILIO_CONFIG.whatsappNumber) {
    logger.info("Twilio WhatsApp not configured, simulating", { to })
    logger.debug("WhatsApp simulated", { to, message })
    return {
      success: true,
      messageId: `sim_wa_${Date.now()}`,
    }
  }

  try {
    // WhatsApp numbers need whatsapp: prefix
    const whatsappTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`
    const whatsappFrom = TWILIO_CONFIG.whatsappNumber.startsWith("whatsapp:")
      ? TWILIO_CONFIG.whatsappNumber
      : `whatsapp:${TWILIO_CONFIG.whatsappNumber}`

    logger.info("Sending WhatsApp via Twilio", { to: whatsappTo })
    const result = await client.messages.create({
      body: message,
      from: whatsappFrom,
      to: whatsappTo,
    })
    logger.info("WhatsApp sent successfully", { sid: result.sid })
    return { success: true, messageId: result.sid }
  } catch (error) {
    logger.error("WhatsApp Error", {
      error: error instanceof Error ? error.message : String(error),
    })
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code: number }).code
        : undefined
    if (code) {
      logger.info("Twilio WhatsApp error, simulating delivery", { code, to })
      return { success: true, messageId: `test_wa_${Date.now()}`, error: `Twilio: ${code}` }
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// Send Email via Azure Communication Services. When ACS isn't configured the
// call is a no-op success — that keeps test envs (and local dev without an
// ACS resource) from failing notification flows that include an email step.
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  html?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getAcsEmailClient()
  const sender = process.env.EMAIL_FROM || "alerts@nexamesh.ai"

  if (!client) {
    logger.info("Email simulated (ACS_CONNECTION_STRING not set)", { to, subject })
    return { success: true, messageId: `email_${Date.now()}` }
  }

  try {
    const poller = await client.beginSend({
      senderAddress: sender,
      recipients: { to: [{ address: to }] },
      content: {
        subject,
        plainText: body,
        ...(html ? { html } : {}),
      },
    })
    const result = await poller.pollUntilDone()
    if (result.status === "Succeeded") {
      return { success: true, messageId: result.id }
    }
    const message = `ACS send finished with status=${result.status}`
    logger.error(message, { to, subject })
    return { success: false, error: message }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error("ACS email send failed", { to, subject, error: message })
    return { success: false, error: message }
  }
}

// Fetch user's notification preference from database
async function getUserPreference(userId: string): Promise<{
  preferredChannel: NotificationChannel
  fallbackOrder: NotificationChannel[]
  phoneNumber?: string
  whatsappNumber?: string
  email?: string
} | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/notifications/preferences?userId=${userId}`
    )
    if (response.ok) {
      const data = await response.json()
      return data.preference
    }
  } catch (error) {
    logger.error("Failed to fetch user preference", {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  return null
}

// Main notification dispatcher with preference support
export async function sendNotification(
  payload: NotificationPayload
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = []
  const userPhone = USER_PHONES[payload.userId]
  const userEmail = USER_EMAILS[payload.userId] || `${payload.userId}@houseofv.com`

  // Get user preference if requested
  let channels = payload.channels
  let preference: Awaited<ReturnType<typeof getUserPreference>> = null

  if (payload.usePreference) {
    preference = await getUserPreference(payload.userId)
    if (preference?.preferredChannel) {
      const preferred = preference.preferredChannel
      channels = [preferred, ...(preference.fallbackOrder || []).filter((c) => c !== preferred)]
    }
  }

  for (const channel of channels) {
    let result: NotificationResult

    switch (channel) {
      case "sms":
        const phoneForSms = preference?.phoneNumber || userPhone
        if (phoneForSms) {
          const smsResult = await sendSMS(phoneForSms, `${payload.title}\n${payload.message}`)
          result = { channel: "sms", ...smsResult }
        } else {
          result = { channel: "sms", success: false, error: "No phone number for user" }
        }
        break

      case "whatsapp":
        const phoneForWa = preference?.whatsappNumber || preference?.phoneNumber || userPhone
        if (phoneForWa) {
          const waResult = await sendWhatsApp(phoneForWa, `*${payload.title}*\n${payload.message}`)
          result = { channel: "whatsapp", ...waResult }
        } else {
          result = { channel: "whatsapp", success: false, error: "No WhatsApp number for user" }
        }
        break

      case "email":
        const emailForUser = preference?.email || userEmail
        const emailResult = await sendEmail(emailForUser, payload.title, payload.message)
        result = { channel: "email", ...emailResult }
        break

      case "push":
        // Push notification would be handled by service worker
        logger.info("Push notification simulated", { title: payload.title })
        result = { channel: "push", success: true, messageId: `push_${Date.now()}` }
        break

      case "in_app":
        // In-app notifications are handled by the real-time system
        result = { channel: "in_app", success: true, messageId: `inapp_${Date.now()}` }
        break

      default:
        result = { channel, success: false, error: "Unknown channel" }
    }

    results.push(result)

    // If using preferences and first channel succeeds, don't try fallbacks
    if (payload.usePreference && result.success && !result.error) {
      break
    }
  }

  return results
}

// Send notification with automatic fallback on failure
export async function sendNotificationWithFallback(payload: NotificationPayload): Promise<{
  results: NotificationResult[]
  deliveryStatus: DeliveryStatus
  fallbackSuggestion?: {
    message: string
    options: NotificationChannel[]
  }
}> {
  const results = await sendNotification({ ...payload, usePreference: true })

  // Check if primary delivery succeeded
  const primaryResult = results[0]
  const success = primaryResult?.success && !primaryResult?.error

  // Build delivery status
  const deliveryStatus: DeliveryStatus = {
    channel: primaryResult?.channel || payload.channels[0],
    success,
    error: primaryResult?.error,
    suggestFallback: !success,
  }

  // If failed, suggest fallback options
  let fallbackSuggestion
  if (!success) {
    const triedChannels = results.map((r) => r.channel)
    const remainingChannels = (["sms", "whatsapp", "email"] as NotificationChannel[]).filter(
      (c) => !triedChannels.includes(c)
    )

    if (remainingChannels.length > 0) {
      fallbackSuggestion = {
        message: `Didn't receive via ${primaryResult?.channel}? Try another option:`,
        options: remainingChannels,
      }
      deliveryStatus.fallbackOptions = remainingChannels
    }
  }

  return { results, deliveryStatus, fallbackSuggestion }
}

// Notification templates
export const NOTIFICATION_TEMPLATES: Record<
  NotificationType,
  (data: any) => { title: string; message: string }
> = {
  approval_required: (data) => ({
    title: "Approval Required",
    message: `${data.type} from ${data.submittedBy} requires your approval: ${data.description || "View details in dashboard"}`,
  }),

  expense_approved: (data) => ({
    title: "Expense Approved",
    message: `Your expense "${data.description}" for R${data.amount} has been approved.`,
  }),

  expense_rejected: (data) => ({
    title: "Expense Rejected",
    message: `Your expense "${data.description}" has been rejected. Reason: ${data.reason || "Contact admin for details"}`,
  }),

  task_assigned: (data) => ({
    title: "New Task Assigned",
    message: `You have been assigned: "${data.title}". Due: ${data.dueDate || "See dashboard"}`,
  }),

  leave_balance_updated: (data) => ({
    title: "Leave Balance Updated",
    message: `Your annual leave is now ${data.newBalance?.toFixed?.(1) ?? data.newBalance} days (+${data.accrued?.toFixed?.(1) ?? data.accrued} this month).`,
  }),

  task_due: (data) => ({
    title: "Task Due Soon",
    message: `Task "${data.title}" is due ${data.dueIn}. Please complete it on time.`,
  }),

  document_expiry: (data) => ({
    title: "Document Expiring",
    message: `Document "${data.documentName}" expires in ${data.daysLeft} days. Please review and renew.`,
  }),

  password_reset: (data) => ({
    title: "Password Reset",
    message: `Your temporary password is: ${data.tempPassword}. Please change it after logging in.`,
  }),

  system_alert: (data) => ({
    title: data.alertTitle || "System Alert",
    message: data.alertMessage || "Please check the dashboard for important updates.",
  }),

  daily_digest: (data) => ({
    title: "Daily Summary",
    message: `Today: ${data.tasksCompleted} tasks done, ${data.tasksPending} pending. ${data.notifications} new notifications.`,
  }),

  weekly_summary: (data) => ({
    title: "Weekly Report",
    message: `This week: ${data.totalHours}h worked, ${data.expensesTotal} expenses, ${data.tasksCompleted} tasks completed.`,
  }),
}

// Helper to send templated notifications
export async function sendTemplatedNotification(
  type: NotificationType,
  userId: string,
  data: Record<string, any>,
  channels: NotificationChannel[] = ["in_app"]
): Promise<NotificationResult[]> {
  const template = NOTIFICATION_TEMPLATES[type]
  const { title, message } = template(data)

  return sendNotification({
    type,
    userId,
    title,
    message,
    channels,
    data,
  })
}
