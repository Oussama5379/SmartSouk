export interface Product {
  id: string
  name: string
  category: "ceramics" | "rugs" | "oils"
  price_tnd: number
  stock_status: "in_stock" | "low_stock" | "out_of_stock"
  description: string
  image?: string
}

export const products: Product[] = [
  {
    id: "1",
    name: "Handwoven Berber Rug",
    category: "rugs",
    price_tnd: 150,
    stock_status: "in_stock",
    description: "Authentic red and black wool rug from Kef. Handcrafted by local artisans using traditional techniques passed down through generations."
  },
  {
    id: "2",
    name: "Nabeul Ceramic Vase",
    category: "ceramics",
    price_tnd: 45,
    stock_status: "in_stock",
    description: "Beautiful hand-painted blue and white ceramic vase from Nabeul. Perfect for displaying fresh flowers or as a standalone decorative piece."
  },
  {
    id: "3",
    name: "Organic Olive Oil - 1L",
    category: "oils",
    price_tnd: 35,
    stock_status: "in_stock",
    description: "Premium extra virgin olive oil from Sfax. Cold-pressed from hand-picked olives, perfect for cooking and salad dressings."
  },
  {
    id: "4",
    name: "Sejnane Pottery Bowl Set",
    category: "ceramics",
    price_tnd: 80,
    stock_status: "low_stock",
    description: "Set of 3 traditional Berber pottery bowls from Sejnane. UNESCO-recognized craftsmanship with geometric patterns."
  },
  {
    id: "5",
    name: "Kairouan Kilim Runner",
    category: "rugs",
    price_tnd: 220,
    stock_status: "in_stock",
    description: "Elegant flat-weave kilim runner from Kairouan. Features traditional geometric patterns in earthy tones. 2m x 0.8m."
  },
  {
    id: "6",
    name: "Prickly Pear Seed Oil - 30ml",
    category: "oils",
    price_tnd: 95,
    stock_status: "in_stock",
    description: "Luxurious anti-aging facial oil extracted from Tunisian prickly pear seeds. Rich in Vitamin E and essential fatty acids."
  },
  {
    id: "7",
    name: "Guellala Ceramic Plate",
    category: "ceramics",
    price_tnd: 55,
    stock_status: "out_of_stock",
    description: "Decorative plate from Djerba's famous Guellala village. Hand-painted with traditional fish motifs in vibrant colors."
  },
  {
    id: "8",
    name: "Argan Oil - 100ml",
    category: "oils",
    price_tnd: 65,
    stock_status: "in_stock",
    description: "Pure Moroccan-Tunisian blend argan oil for hair and skin. Nourishing and deeply moisturizing for all skin types."
  }
]

export function getProductById(id: string): Product | undefined {
  return products.find(p => p.id === id)
}

export function getProductsByCategory(category: Product["category"]): Product[] {
  return products.filter(p => p.category === category)
}

// Session & Tracking Data
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

export interface ProductEvent {
  id: string
  session_id: string
  product_id: string
  event_type: "view" | "click" | "add_to_cart" | "purchase"
  time_spent_ms: number
  scroll_depth: number // 0-100%
  timestamp: number
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

// Mock session data
export const mockSessions: Session[] = [
  {
    id: "sess_001",
    timestamp: Date.now() - 3600000,
    pages_visited: ["/", "/dashboard", "/dashboard/products"],
    time_spent_ms: 480000,
    user_type: "customer",
    user_id: "user_123",
  },
  {
    id: "sess_002",
    timestamp: Date.now() - 1800000,
    pages_visited: ["/"],
    time_spent_ms: 120000,
    user_type: "guest",
  },
  {
    id: "sess_003",
    timestamp: Date.now() - 900000,
    pages_visited: ["/", "/dashboard/marketing"],
    time_spent_ms: 240000,
    user_type: "customer",
    user_id: "user_456",
  },
]

// Mock product events
export const mockProductEvents: ProductEvent[] = [
  {
    id: "evt_001",
    session_id: "sess_001",
    product_id: "1",
    event_type: "view",
    time_spent_ms: 45000,
    scroll_depth: 85,
    timestamp: Date.now() - 3500000,
  },
  {
    id: "evt_002",
    session_id: "sess_001",
    product_id: "1",
    event_type: "click",
    time_spent_ms: 0,
    scroll_depth: 85,
    timestamp: Date.now() - 3450000,
  },
  {
    id: "evt_003",
    session_id: "sess_001",
    product_id: "3",
    event_type: "view",
    time_spent_ms: 30000,
    scroll_depth: 60,
    timestamp: Date.now() - 3400000,
  },
  {
    id: "evt_004",
    session_id: "sess_002",
    product_id: "2",
    event_type: "view",
    time_spent_ms: 20000,
    scroll_depth: 40,
    timestamp: Date.now() - 1700000,
  },
  {
    id: "evt_005",
    session_id: "sess_003",
    product_id: "5",
    event_type: "view",
    time_spent_ms: 55000,
    scroll_depth: 95,
    timestamp: Date.now() - 800000,
  },
  {
    id: "evt_006",
    session_id: "sess_003",
    product_id: "5",
    event_type: "add_to_cart",
    time_spent_ms: 0,
    scroll_depth: 95,
    timestamp: Date.now() - 750000,
  },
]

// Mock orders
export const mockOrders: Order[] = [
  {
    id: "ord_001",
    session_id: "sess_001",
    user_id: "user_123",
    product_id: "1",
    quantity: 1,
    price_paid: 150,
    timestamp: Date.now() - 3300000,
  },
  {
    id: "ord_002",
    session_id: "sess_001",
    user_id: "user_123",
    product_id: "3",
    quantity: 2,
    price_paid: 70,
    timestamp: Date.now() - 3300000,
  },
  {
    id: "ord_003",
    session_id: "sess_003",
    user_id: "user_456",
    product_id: "5",
    quantity: 1,
    price_paid: 220,
    timestamp: Date.now() - 600000,
  },
]
