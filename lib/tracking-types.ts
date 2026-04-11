import type { Order, Session } from "@/lib/mock-data"

export const TRACK_EVENT_TYPES = [
  "session_start",
  "page_view",
  "product_view",
  "click",
  "add_to_cart",
  "purchase",
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
  user_type?: TrackUserType
  user_id?: string
  time_spent_ms?: number
  scroll_depth?: number
  quantity?: number
  price_paid?: number
}

export interface TrackEventPayload {
  event_type: TrackEventType
  session_id: string
  product_id?: string
  timestamp: number
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

export function isTrackEventType(value: unknown): value is TrackEventType {
  return typeof value === "string" && TRACK_EVENT_TYPES.includes(value as TrackEventType)
}
