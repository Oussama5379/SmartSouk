import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

export function useSessionTracking() {
  const sessionIdRef = useRef<string>("")
  const pathname = usePathname()
  const pageStartTimeRef = useRef<number>(0)

  useEffect(() => {
    // Initialize session
    if (!sessionIdRef.current) {
      sessionIdRef.current = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Track session start
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "session_start",
          session_id: sessionIdRef.current,
          timestamp: Date.now(),
          metadata: {
            user_type: "guest",
            page: pathname,
          },
        }),
      }).catch((e) => console.error("[v0] Session tracking error:", e))
    }
  }, [])

  useEffect(() => {
    pageStartTimeRef.current = Date.now()

    // Track page view
    const timeSpent = Date.now() - pageStartTimeRef.current
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "page_view",
        session_id: sessionIdRef.current,
        timestamp: Date.now(),
        metadata: {
          page: pathname,
          time_spent_ms: timeSpent,
        },
      }),
    }).catch((e) => console.error("[v0] Page tracking error:", e))
  }, [pathname])

  const trackProductEvent = (productId: string, eventType: "view" | "click" | "add_to_cart", scrollDepth = 0) => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        session_id: sessionIdRef.current,
        product_id: productId,
        timestamp: Date.now(),
        metadata: {
          scroll_depth: scrollDepth,
        },
      }),
    }).catch((e) => console.error("[v0] Product event tracking error:", e))
  }

  const trackPurchase = (productId: string, quantity: number, pricePaid: number, userId?: string) => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "purchase",
        session_id: sessionIdRef.current,
        product_id: productId,
        timestamp: Date.now(),
        metadata: {
          quantity,
          price_paid: pricePaid,
          user_id: userId,
        },
      }),
    }).catch((e) => console.error("[v0] Purchase tracking error:", e))
  }

  return {
    sessionId: sessionIdRef.current,
    trackProductEvent,
    trackPurchase,
  }
}
