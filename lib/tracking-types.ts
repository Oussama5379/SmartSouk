import type { Order, Session } from "@/lib/store-types"

export const TRACK_EVENT_TYPES = [
  "session_start",
  "page_view",
  "product_view",
  "click",
  "add_to_cart",
  "chat_open",
] as const

export type TrackEventType = (typeof TRACK_EVENT_TYPES)[number]
export type TrackableProductEventType = Extract<
  TrackEventType,
  "product_view" | "click" | "add_to_cart"
>
export type TrackUserType = "guest" | "customer"

export interface TrackEventMetadata {
  page?: string
  page_url?: string
  user_type?: TrackUserType
  user_id?: string
  time_spent_ms?: number
  scroll_depth?: number
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
}

export interface TrackEventPayload {
  event_type: TrackEventType
  session_id: string
  product_id?: string
  metadata?: TrackEventMetadata
}

export interface TrackedProductEvent {
  id: string
  session_id: string
  product_id: string | null
  event_type: TrackEventType
  time_spent_ms: number
  scroll_depth: number
  timestamp: number
  page?: string
}

export interface TrackingStats {
  totalSessions: number
  totalEvents: number
  totalOrders: number
  totalRevenue: number
  avgSessionDuration: number
  revenuePerVisitor: number
  cartAbandonmentRate: number
  cartsStarted: number
  cartsAbandoned: number
}

export interface TrackingDashboardData {
  stats: TrackingStats
  sessions: Session[]
  events: TrackedProductEvent[]
  orders: Order[]
}

export interface SessionSignals {
  viewedProductIds: string[]
  lastPage: string | null
}

export interface ChatContext {
  session_id?: string
  current_page_url?: string
  active_product_id?: string | null
}

export interface LeadQualificationResult {
  score: number
  products: string[]
  actions: string[]
  analysis: string
  summary: string
}

export type RecommendationType = "upsell" | "cross_sell" | "at_risk" | "top_performer"

export interface RecommendationItem {
  type: RecommendationType
  product_id: string
  reason: string
  confidence: number
  potential_revenue: number
}

export interface RecommendationSegment {
  name: string
  summary: string
  indicators: string[]
}

export interface ProductPerformanceSnapshot {
  product_id: string
  product_name: string
  views: number
  clicks: number
  add_to_cart: number
  orders: number
  revenue: number
  conversion_rate: number
}

export interface DailyPerformanceSnapshot {
  day: string
  sessions: number
  orders: number
}

export interface PagePerformanceSnapshot {
  page: string
  hits: number
  share: number
}

export interface TrafficSourceSnapshot {
  source: string
  sessions: number
  share: number
}

export interface InventoryAlert {
  product_id: string
  stock_status: "low_stock" | "out_of_stock"
  demand_signals: number
  estimated_revenue_at_risk: number
  reason: string
}

export interface RecommendationsApiResponse {
  generated: boolean
  generatedAt: string
  stats: TrackingStats
  salesData: {
    totals: {
      sessions: number
      events: number
      orders: number
      revenue: number
      conversionRate: number
      revenuePerVisitor: number
      cartAbandonmentRate: number
    }
    dailyPerformance: DailyPerformanceSnapshot[]
    topProducts: ProductPerformanceSnapshot[]
  }
  customerBehavior: {
    topPages: PagePerformanceSnapshot[]
    trafficSources: TrafficSourceSnapshot[]
    guestSessions: number
    customerSessions: number
    avgSessionDurationSeconds: number
  }
  insightSummary: string
  recommendations: RecommendationItem[]
  inventoryAlerts: InventoryAlert[]
  customerSegments: RecommendationSegment[]
  actionItems: string[]
}

export function isTrackEventType(value: unknown): value is TrackEventType {
  return typeof value === "string" && TRACK_EVENT_TYPES.includes(value as TrackEventType)
}
