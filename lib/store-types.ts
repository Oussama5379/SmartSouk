export const STORE_CATEGORIES = ["ceramics", "rugs", "oils"] as const
export type StoreCategory = (typeof STORE_CATEGORIES)[number]

export const STORE_STOCK_STATUSES = ["in_stock", "low_stock", "out_of_stock"] as const
export type StoreStockStatus = (typeof STORE_STOCK_STATUSES)[number]

export interface StoreProduct {
  id: string
  name: string
  category: StoreCategory
  price_tnd: number
  stock_status: StoreStockStatus
  description: string
  image?: string
  created_at?: number
  updated_at?: number
}

export interface StoreSettings {
  store_name: string
  store_description: string
  contact_email: string
  hero_image_url?: string
  updated_at: number
}

export interface StoreSnapshot {
  settings: StoreSettings
  products: StoreProduct[]
}

export interface Session {
  id: string
  timestamp: number
  pages_visited: string[]
  time_spent_ms: number
  user_type: "guest" | "customer"
  user_id?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
}

export interface Order {
  id: string
  session_id: string
  user_id?: string
  product_id: string
  quantity: number
  price_paid: number
  timestamp: number
}