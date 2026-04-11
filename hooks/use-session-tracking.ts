"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import type {
  TrackEventMetadata,
  TrackEventType,
  TrackableProductEventType,
} from "@/lib/tracking-types"

const SESSION_STORAGE_KEY = "aurea_session_state"
const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000

interface StoredSessionState {
  id: string
  lastActivityAt: number
}

function createSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function readStoredSessionState(): StoredSessionState | null {
  if (typeof window === "undefined") {
    return null
  }

  const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredSessionState>
    if (
      typeof parsed.id === "string" &&
      parsed.id.trim() &&
      typeof parsed.lastActivityAt === "number" &&
      Number.isFinite(parsed.lastActivityAt)
    ) {
      return {
        id: parsed.id.trim(),
        lastActivityAt: parsed.lastActivityAt,
      }
    }
  } catch {
    // Invalid client storage value; regenerate below.
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY)
  return null
}

function persistSessionState(state: StoredSessionState) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state))
}

function getOrCreateSession(): { id: string; isNewSession: boolean } {
  const now = Date.now()
  const existing = readStoredSessionState()

  if (existing && now - existing.lastActivityAt < SESSION_INACTIVITY_TIMEOUT_MS) {
    persistSessionState({ id: existing.id, lastActivityAt: now })
    return { id: existing.id, isNewSession: false }
  }

  const generatedSessionId = createSessionId()
  persistSessionState({ id: generatedSessionId, lastActivityAt: now })
  return { id: generatedSessionId, isNewSession: true }
}

function resolveActiveSession(): { id: string; isNewSession: boolean } {
  return getOrCreateSession()
}

export function useSessionTracking() {
  const pathname = usePathname()
  const [sessionId, setSessionId] = useState("")
  const [isNewSession, setIsNewSession] = useState(false)
  const sessionStartTrackedRef = useRef(false)
  const currentPath =
    typeof window !== "undefined" && window.location.search
      ? `${pathname}${window.location.search}`
      : pathname

  const buildBaseMetadata = useCallback((): TrackEventMetadata => {
    const metadata: TrackEventMetadata = {
      page: currentPath,
    }

    if (typeof window === "undefined") {
      return metadata
    }

    metadata.page_url = window.location.href

    const queryParams = new URLSearchParams(window.location.search)
    const utmSource = queryParams.get("utm_source")?.trim()
    const utmMedium = queryParams.get("utm_medium")?.trim()
    const utmCampaign = queryParams.get("utm_campaign")?.trim()
    const utmTerm = queryParams.get("utm_term")?.trim()
    const utmContent = queryParams.get("utm_content")?.trim()

    if (utmSource) {
      metadata.utm_source = utmSource
    }
    if (utmMedium) {
      metadata.utm_medium = utmMedium
    }
    if (utmCampaign) {
      metadata.utm_campaign = utmCampaign
    }
    if (utmTerm) {
      metadata.utm_term = utmTerm
    }
    if (utmContent) {
      metadata.utm_content = utmContent
    }

    return metadata
  }, [currentPath])

  const sendTrackingEvent = useCallback(
    (eventType: TrackEventType, options?: { productId?: string; metadata?: TrackEventMetadata }) => {
      if (!sessionId) {
        return
      }

      const resolvedSession = resolveActiveSession()
      const activeSessionId = resolvedSession.id

      if (activeSessionId !== sessionId) {
        setSessionId(activeSessionId)
        setIsNewSession(resolvedSession.isNewSession)
        sessionStartTrackedRef.current = false
      }

      const metadata = {
        ...buildBaseMetadata(),
        ...options?.metadata,
      }

      const payload = {
        event_type: eventType,
        session_id: activeSessionId,
        product_id: options?.productId,
        metadata,
      }

      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((error) => {
        console.error("[tracking] Failed to send event:", error)
      })
    },
    [buildBaseMetadata, sessionId]
  )

  useEffect(() => {
    const { id, isNewSession: freshSession } = getOrCreateSession()
    setSessionId(id)
    setIsNewSession(freshSession)
  }, [])

  useEffect(() => {
    if (!sessionId || !isNewSession || sessionStartTrackedRef.current) {
      return
    }

    sessionStartTrackedRef.current = true
    sendTrackingEvent("session_start", {
      metadata: {
        user_type: "guest",
      },
    })
    setIsNewSession(false)
  }, [currentPath, isNewSession, sendTrackingEvent, sessionId])

  useEffect(() => {
    if (!sessionId) {
      return
    }

    sendTrackingEvent("page_view", {
      metadata: {},
    })
  }, [currentPath, sendTrackingEvent, sessionId])

  const trackProductEvent = useCallback(
    (productId: string, eventType: TrackableProductEventType, scrollDepth = 0) => {
      sendTrackingEvent(eventType, {
        productId,
        metadata: {
          scroll_depth: Math.max(0, scrollDepth),
        },
      })
    },
    [sendTrackingEvent]
  )

  const trackChatOpen = useCallback(() => {
    sendTrackingEvent("chat_open", {
      metadata: {},
    })
  }, [sendTrackingEvent])

  return {
    sessionId,
    currentPath,
    trackProductEvent,
    trackChatOpen,
  }
}
