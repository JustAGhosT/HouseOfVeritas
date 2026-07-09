import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/rbac"

// Google Calendar OAuth configuration
const GOOGLE_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback`
    : "http://localhost:3000/api/calendar/callback",
}

// Check if Google Calendar is configured
export function isGoogleConfigured(): boolean {
  return !!(GOOGLE_CONFIG.clientId && GOOGLE_CONFIG.clientSecret)
}

const DEMO_DATA_ENABLED = process.env.ALLOW_DEMO_DATA === "true"

// Mock calendar events (when Google is not configured)
const MOCK_EVENTS = [
  {
    id: "evt_1",
    summary: "Monthly garden maintenance",
    description: "Routine garden maintenance - Lucky",
    start: { dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
    end: {
      dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
    },
    status: "confirmed",
    colorId: "2",
  },
  {
    id: "evt_2",
    summary: "Vehicle service - Hilux",
    description: "Full service at Toyota Stellenbosch - Charl",
    start: { dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() },
    end: {
      dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
    },
    status: "confirmed",
    colorId: "4",
  },
  {
    id: "evt_3",
    summary: "Document review - Employment contracts",
    description: "Annual contract review with Irma",
    start: { dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
    end: {
      dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
    },
    status: "confirmed",
    colorId: "7",
  },
  {
    id: "evt_4",
    summary: "Pool pump inspection",
    description: "Check filter pressure and motor temperature",
    start: { dateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() },
    end: {
      dateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(),
    },
    status: "confirmed",
    colorId: "5",
  },
  {
    id: "evt_5",
    summary: "Guest arrival - prepare guest house",
    description: "Deep clean and stock supplies",
    start: { date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
    end: { date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
    status: "confirmed",
    colorId: "9",
  },
]

// In-memory event store for mock mode
let mockEvents = DEMO_DATA_ENABLED ? [...MOCK_EVENTS] : []

// GET - List calendar events or initiate OAuth
export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")

  // Check OAuth status
  if (action === "status") {
    return NextResponse.json({
      configured: isGoogleConfigured(),
      mode: isGoogleConfigured() ? "live" : DEMO_DATA_ENABLED ? "demo" : "empty",
      message: isGoogleConfigured()
        ? "Google Calendar API configured"
        : "Google Calendar not configured.",
    })
  }

  // Initiate OAuth flow
  if (action === "auth") {
    if (!isGoogleConfigured()) {
      return NextResponse.json(
        {
          error: "Google Calendar not configured",
          instructions: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables",
        },
        { status: 400 }
      )
    }

    const scopes = encodeURIComponent("https://www.googleapis.com/auth/calendar")
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CONFIG.clientId}` +
      `&redirect_uri=${encodeURIComponent(GOOGLE_CONFIG.redirectUri)}` +
      `&response_type=code` +
      `&scope=${scopes}` +
      `&access_type=offline` +
      `&prompt=consent`

    return NextResponse.json({ authUrl })
  }

  // List events
  const timeMin = searchParams.get("timeMin") || new Date().toISOString()
  const timeMax =
    searchParams.get("timeMax") || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const maxResults = parseInt(searchParams.get("maxResults") || "20")

  if (!isGoogleConfigured()) {
    // Return local events while Google Calendar is not configured.
    const filteredEvents = mockEvents
      .filter((evt) => {
        const eventDate = evt.start.dateTime || evt.start.date
        return eventDate && eventDate >= timeMin && eventDate <= timeMax
      })
      .slice(0, maxResults)

    return NextResponse.json({
      mode: DEMO_DATA_ENABLED ? "demo" : "empty",
      items: filteredEvents,
      count: filteredEvents.length,
      note: "Configure Google Calendar API for live integration.",
    })
  }

  // In production with Google configured:
  // Would use Google Calendar API here
  return NextResponse.json({
    mode: "live",
    items: [],
    message: "Google Calendar integration ready - implement token flow",
  })
})

// POST - Create calendar event
export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { summary, description, start, end, allDay, attendees } = body

    if (!summary || !start) {
      return NextResponse.json({ error: "summary and start are required" }, { status: 400 })
    }

    const newEvent: any = {
      id: `evt_${Date.now()}`,
      summary,
      description: description || "",
      status: "confirmed",
      colorId: "1",
      created: new Date().toISOString(),
    }

    if (allDay) {
      newEvent.start = { date: start }
      newEvent.end = { date: end || start }
    } else {
      newEvent.start = { dateTime: start }
      newEvent.end = {
        dateTime: end || new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString(),
      }
    }

    if (attendees) {
      newEvent.attendees = attendees.map((email: string) => ({ email }))
    }

    if (!isGoogleConfigured()) {
      // Add to mock events
      mockEvents.push(newEvent)
      return NextResponse.json({
        mode: DEMO_DATA_ENABLED ? "demo" : "empty",
        success: true,
        event: newEvent,
        note: "Event created locally. Configure Google Calendar API for live sync.",
      })
    }

    // In production: Create via Google Calendar API
    return NextResponse.json({
      mode: "live",
      success: true,
      event: newEvent,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
})

// DELETE - Delete calendar event
export const DELETE = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("eventId")

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 })
  }

  if (!isGoogleConfigured()) {
    const index = mockEvents.findIndex((e) => e.id === eventId)
    if (index > -1) {
      mockEvents.splice(index, 1)
      return NextResponse.json({
        mode: DEMO_DATA_ENABLED ? "demo" : "empty",
        success: true,
        deletedId: eventId,
      })
    }
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  // In production: Delete via Google Calendar API
  return NextResponse.json({ mode: "live", success: true, deletedId: eventId })
})
