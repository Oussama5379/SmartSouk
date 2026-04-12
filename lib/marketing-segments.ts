import { neon } from "@neondatabase/serverless"
import { buildCustomerSegments } from "@/lib/customer-segments"
import { listStoreProducts } from "@/lib/store-data"
import { getTrackingDashboardData, isTrackingConfigured } from "@/lib/tracking-store"
import type { MarketingSegment } from "@/lib/tracking-types"

const databaseUrl = process.env.DATABASE_URL?.trim()

interface AuthUserRow {
  id: string
  email: string | null
  name: string | null
  created_at: string | number | null
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (typeof value === "bigint") {
    return Number(value)
  }

  return 0
}

async function getAuthUsers() {
  if (!databaseUrl) {
    return []
  }

  const sql = neon(databaseUrl)
  try {
    const rows = (await sql`
      SELECT
        id,
        email,
        name,
        (EXTRACT(EPOCH FROM "createdAt") * 1000)::BIGINT AS created_at
      FROM "user";
    `) as AuthUserRow[]

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      created_at: toNumber(row.created_at) || null,
    }))
  } catch (error) {
    console.error("[marketing-segments] Failed to query auth users.", error)
    return []
  }
}

export async function getMarketingSegments(): Promise<MarketingSegment[]> {
  if (!databaseUrl || !isTrackingConfigured()) {
    throw new Error("Tracking database is not configured.")
  }

  const [products, trackingData, customers] = await Promise.all([
    listStoreProducts(),
    getTrackingDashboardData({
      sessionLimit: 5000,
      eventLimit: 30000,
      orderLimit: 30000,
    }),
    getAuthUsers(),
  ])

  return buildCustomerSegments({
    customers,
    sessions: trackingData.sessions,
    events: trackingData.events,
    orders: trackingData.orders,
    products,
  })
}
