"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import type {
  TrackEventMetadata,
  TrackEventType,
  TrackableProductEventType,
} from "@/lib/tracking-types"

const SESSION_STORAGE_KEY = "aurea_session_id"

function createSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function useSessionTracking() {
  const pathname = usePathname()
  const [sessionId, setSessionId] = useState("")
  const sessionStartTrackedRef = useRef(false)

  const sendTrackingEvent = useCallback(
    (eventType: TrackEventType, options?: { productId?: string; metadata?: TrackEventMetadata }) => {
      if (!sessionId) {
        return
      }

      const payload = {
        event_type: eventType,
        session_id: sessionId,
        timestamp: Date.now(),
        product_id: options?.productId,
        metadata: options?.metadata,
      }

      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((error) => {
        console.error("[tracking] Failed to send event:", error)
      })
    },
    [sessionId]
  )

  useEffect(() => {
    const existingSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (existingSessionId) {
      setSessionId(existingSessionId)
      return
    }

    const generatedSessionId = createSessionId()
    sessionStorage.setItem(SESSION_STORAGE_KEY, generatedSessionId)
    setSessionId(generatedSessionId)
  }, [])

  useEffect(() => {
    if (!sessionId || sessionStartTrackedRef.current) {
      return
    }

    sessionStartTrackedRef.current = true
    sendTrackingEvent("session_start", {
      metadata: {
        user_type: "guest",
        page: pathname,
      },
    })
  }, [pathname, sendTrackingEvent, sessionId])

  useEffect(() => {
    if (!sessionId) {
      return
    }

    sendTrackingEvent("page_view", {
      metadata: {
        page: pathname,
      },
    })
  }, [pathname, sendTrackingEvent, sessionId])

  const trackProductEvent = useCallback(
    (productId: string, eventType: TrackableProductEventType, scrollDepth = 0) => {
      sendTrackingEvent(eventType, {
        productId,
        metadata: {
          scroll_depth: Math.max(0, scrollDepth),
          page: pathname,
        },
      })
    },
    [pathname, sendTrackingEvent]
  )

  const trackPurchase = useCallback(
    (productId: string, quantity: number, pricePaid: number, userId?: string) => {
      sendTrackingEvent("purchase", {
        productId,
        metadata: {
          quantity,
          price_paid: pricePaid,
          user_id: userId,
          page: pathname,
        },
      })
    },
    [pathname, sendTrackingEvent]
  )

  const trackChatOpen = useCallback(() => {
    sendTrackingEvent("chat_open", {
      metadata: {
        page: pathname,
      },
    })
  }, [pathname, sendTrackingEvent])

  return {
    sessionId,
    currentPath: pathname,
    trackProductEvent,
    trackPurchase,
    trackChatOpen,
  }
}
