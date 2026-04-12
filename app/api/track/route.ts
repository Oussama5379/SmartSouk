import { getTrackingDashboardData, isTrackingConfigured, trackEvent } from "@/lib/tracking-store"
import {
  isTrackEventType,
  type TrackEventMetadata,
  type TrackEventPayload,
} from "@/lib/tracking-types"

function parseNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()
  return normalized ? normalized : undefined
}

function normalizePagePath(value: string): string {
  try {
    const parsed = new URL(value, "https://aurea.local")
    return parsed.pathname || "/"
  } catch {
    const [withoutQuery] = value.split("?")
    return withoutQuery || "/"
  }
}

function parseUtmFieldsFromUrl(value: string): Partial<TrackEventMetadata> {
  try {
    const parsed = new URL(value, "https://aurea.local")
    const source = parsed.searchParams.get("utm_source")?.trim()
    const medium = parsed.searchParams.get("utm_medium")?.trim()
    const campaign = parsed.searchParams.get("utm_campaign")?.trim()
    const term = parsed.searchParams.get("utm_term")?.trim()
    const content = parsed.searchParams.get("utm_content")?.trim()

    return {
      utm_source: source || undefined,
      utm_medium: medium || undefined,
      utm_campaign: campaign || undefined,
      utm_term: term || undefined,
      utm_content: content || undefined,
    }
  } catch {
    return {}
  }
}

function parseTrackMetadata(value: unknown): TrackEventMetadata | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const rawMetadata = value as Record<string, unknown>
  const metadata: TrackEventMetadata = {}

  const rawPage = parseNonEmptyString(rawMetadata.page)
  if (rawPage) {
    metadata.page = normalizePagePath(rawPage)
  }

  const rawPageUrl = parseNonEmptyString(rawMetadata.page_url)
  if (rawPageUrl) {
    metadata.page_url = rawPageUrl
    metadata.page = metadata.page ?? normalizePagePath(rawPageUrl)
  }

  if (rawMetadata.user_type === "guest" || rawMetadata.user_type === "customer") {
    metadata.user_type = rawMetadata.user_type
  }

  const userId = parseNonEmptyString(rawMetadata.user_id)
  if (userId) {
    metadata.user_id = userId
  }

  if (typeof rawMetadata.time_spent_ms === "number" && Number.isFinite(rawMetadata.time_spent_ms)) {
    metadata.time_spent_ms = rawMetadata.time_spent_ms
  }

  if (typeof rawMetadata.scroll_depth === "number" && Number.isFinite(rawMetadata.scroll_depth)) {
    metadata.scroll_depth = rawMetadata.scroll_depth
  }

  const explicitSource = parseNonEmptyString(rawMetadata.utm_source)
  const explicitMedium = parseNonEmptyString(rawMetadata.utm_medium)
  const explicitCampaign = parseNonEmptyString(rawMetadata.utm_campaign)
  const explicitTerm = parseNonEmptyString(rawMetadata.utm_term)
  const explicitContent = parseNonEmptyString(rawMetadata.utm_content)

  if (explicitSource) {
    metadata.utm_source = explicitSource
  }
  if (explicitMedium) {
    metadata.utm_medium = explicitMedium
  }
  if (explicitCampaign) {
    metadata.utm_campaign = explicitCampaign
  }
  if (explicitTerm) {
    metadata.utm_term = explicitTerm
  }
  if (explicitContent) {
    metadata.utm_content = explicitContent
  }

  const utmFromUrl = parseUtmFieldsFromUrl(metadata.page_url ?? rawPage ?? "")
  metadata.utm_source = metadata.utm_source ?? utmFromUrl.utm_source
  metadata.utm_medium = metadata.utm_medium ?? utmFromUrl.utm_medium
  metadata.utm_campaign = metadata.utm_campaign ?? utmFromUrl.utm_campaign
  metadata.utm_term = metadata.utm_term ?? utmFromUrl.utm_term
  metadata.utm_content = metadata.utm_content ?? utmFromUrl.utm_content

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

    return Response.json({
      success: true,
      tracked,
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
      revenue_per_visitor: data.stats.revenuePerVisitor,
      cart_abandonment_rate: data.stats.cartAbandonmentRate,
    })
  } catch {
    return Response.json({ error: "Failed to fetch tracking data" }, { status: 500 })
  }
}
