import { getTrackingDashboardData, isTrackingConfigured, trackEvent } from "@/lib/tracking-store"
import {
  isTrackEventType,
  type TrackEventMetadata,
  type TrackEventPayload,
} from "@/lib/tracking-types"

function parseTrackMetadata(value: unknown): TrackEventMetadata | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const rawMetadata = value as Record<string, unknown>
  const metadata: TrackEventMetadata = {}

  if (typeof rawMetadata.page === "string") {
    metadata.page = rawMetadata.page
  }

  if (rawMetadata.user_type === "guest" || rawMetadata.user_type === "customer") {
    metadata.user_type = rawMetadata.user_type
  }

  if (typeof rawMetadata.user_id === "string") {
    metadata.user_id = rawMetadata.user_id
  }

  if (typeof rawMetadata.time_spent_ms === "number" && Number.isFinite(rawMetadata.time_spent_ms)) {
    metadata.time_spent_ms = rawMetadata.time_spent_ms
  }

  if (typeof rawMetadata.scroll_depth === "number" && Number.isFinite(rawMetadata.scroll_depth)) {
    metadata.scroll_depth = rawMetadata.scroll_depth
  }

  if (typeof rawMetadata.quantity === "number" && Number.isFinite(rawMetadata.quantity)) {
    metadata.quantity = rawMetadata.quantity
  }

  if (typeof rawMetadata.price_paid === "number" && Number.isFinite(rawMetadata.price_paid)) {
    metadata.price_paid = rawMetadata.price_paid
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined
}

function parseTrackPayload(value: unknown): TrackEventPayload | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const body = value as Record<string, unknown>
  if (!isTrackEventType(body.event_type) || typeof body.session_id !== "string") {
    return null
  }

  const sessionId = body.session_id.trim()
  if (!sessionId) {
    return null
  }

  const payload: TrackEventPayload = {
    event_type: body.event_type,
    session_id: sessionId,
    timestamp: typeof body.timestamp === "number" && Number.isFinite(body.timestamp)
      ? body.timestamp
      : Date.now(),
    metadata: parseTrackMetadata(body.metadata),
  }

  if (typeof body.product_id === "string" && body.product_id.trim()) {
    payload.product_id = body.product_id.trim()
  }

  return payload
}

function getTrackingNotConfiguredResponse() {
  return Response.json(
    {
      error:
        "Tracking database is not configured. Add DATABASE_URL (Neon Postgres) before using /api/track.",
    },
    { status: 500 }
  )
}

export async function POST(request: Request) {
  if (!isTrackingConfigured()) {
    return getTrackingNotConfiguredResponse()
  }

  try {
    const body = await request.json()
    const payload = parseTrackPayload(body)

    if (!payload) {
      return Response.json({ error: "Invalid tracking payload" }, { status: 400 })
    }

    const tracked = await trackEvent(payload)
    const { stats } = await getTrackingDashboardData()

    return Response.json({
      success: true,
      tracked,
      total_sessions: stats.totalSessions,
      total_events: stats.totalEvents,
      total_orders: stats.totalOrders,
      revenue: stats.totalRevenue,
    })
  } catch {
    return Response.json({ error: "Tracking failed" }, { status: 500 })
  }
}

export async function GET() {
  if (!isTrackingConfigured()) {
    return getTrackingNotConfiguredResponse()
  }

  try {
    const data = await getTrackingDashboardData()

    return Response.json({
      stats: data.stats,
      sessions: data.sessions,
      events: data.events,
      orders: data.orders,
      sessions_count: data.stats.totalSessions,
      events_count: data.stats.totalEvents,
      orders_count: data.stats.totalOrders,
      revenue: data.stats.totalRevenue,
      avg_session_duration: data.stats.avgSessionDuration,
    })
  } catch {
    return Response.json({ error: "Failed to fetch tracking data" }, { status: 500 })
  }
}
