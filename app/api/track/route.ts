import { mockSessions, mockProductEvents, mockOrders, Session, ProductEvent, Order } from "@/lib/mock-data"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { event_type, session_id, product_id, timestamp, metadata } = body

    let newSession: Session | undefined
    let newEvent: ProductEvent | undefined
    let newOrder: Order | undefined

    if (event_type === "session_start") {
      newSession = {
        id: session_id,
        timestamp,
        pages_visited: [metadata?.page || "/"],
        time_spent_ms: 0,
        user_type: metadata?.user_type || "guest",
        user_id: metadata?.user_id,
      }
      mockSessions.push(newSession)
    }

    if (event_type === "page_view" || event_type === "product_view") {
      const session = mockSessions.find((s) => s.id === session_id)
      if (session && metadata?.page) {
        if (!session.pages_visited.includes(metadata.page)) {
          session.pages_visited.push(metadata.page)
        }
      }

      if (product_id) {
        newEvent = {
          id: `evt_${Date.now()}`,
          session_id,
          product_id,
          event_type: "view",
          time_spent_ms: metadata?.time_spent_ms || 0,
          scroll_depth: metadata?.scroll_depth || 0,
          timestamp,
        }
        mockProductEvents.push(newEvent)
      }
    }

    if (event_type === "add_to_cart" || event_type === "click") {
      newEvent = {
        id: `evt_${Date.now()}`,
        session_id,
        product_id,
        event_type: event_type === "add_to_cart" ? "add_to_cart" : "click",
        time_spent_ms: 0,
        scroll_depth: metadata?.scroll_depth || 0,
        timestamp,
      }
      mockProductEvents.push(newEvent)
    }

    if (event_type === "purchase") {
      newOrder = {
        id: `ord_${Date.now()}`,
        session_id,
        user_id: metadata?.user_id,
        product_id,
        quantity: metadata?.quantity || 1,
        price_paid: metadata?.price_paid || 0,
        timestamp,
      }
      mockOrders.push(newOrder)
    }

    return Response.json({
      success: true,
      tracked: {
        session: newSession,
        event: newEvent,
        order: newOrder,
      },
      total_sessions: mockSessions.length,
      total_events: mockProductEvents.length,
      total_orders: mockOrders.length,
    })
  } catch (error) {
    console.error("[v0] Tracking error:", error)
    return Response.json({ error: "Tracking failed" }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({
    sessions: mockSessions.length,
    events: mockProductEvents.length,
    orders: mockOrders.length,
    revenue: mockOrders.reduce((sum, o) => sum + o.price_paid, 0),
  })
}
