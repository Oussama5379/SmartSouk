import type { Order, Session, StoreProduct } from "@/lib/store-types"
import type {
  MarketingSegment,
  MarketingSegmentKey,
  TrackedProductEvent,
} from "@/lib/tracking-types"

const DAY_MS = 24 * 60 * 60 * 1000

interface CustomerRecord {
  id: string
  email?: string | null
  name?: string | null
  created_at?: number | null
}

interface CustomerProfile {
  userId: string
  email?: string
  name?: string
  createdAt: number | null
  firstSeenAt: number | null
  lastActivityAt: number | null
  totalSpending: number
  orderCount: number
  activityEvents: number
  addToCartCount: number
  interestScores: Map<string, number>
}

const segmentMeta: Record<MarketingSegmentKey, { name: string; focus: string }> = {
  target_segment: {
    name: "Target Segment",
    focus: "High interest with untapped conversion potential.",
  },
  high_value_customers: {
    name: "High Value Customers",
    focus: "Strong spenders worth retention and upsell campaigns.",
  },
  new_customers: {
    name: "New Customers",
    focus: "Recently acquired customers that need nurturing.",
  },
  inactive_users: {
    name: "Inactive Users",
    focus: "Users with low recent activity who need win-back flows.",
  },
  vip_members: {
    name: "VIP Members",
    focus: "Top-tier spenders with consistently high loyalty.",
  },
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

function normalizeTimestamp(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null
  }
  return Math.round(value)
}

function format(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))
  return sorted[idx]
}

function updateBounds(profile: CustomerProfile, timestamp: number | null) {
  if (!timestamp) {
    return
  }

  profile.firstSeenAt = profile.firstSeenAt ? Math.min(profile.firstSeenAt, timestamp) : timestamp
  profile.lastActivityAt = profile.lastActivityAt
    ? Math.max(profile.lastActivityAt, timestamp)
    : timestamp
}

function getInterestWeight(eventType: TrackedProductEvent["event_type"]): number {
  if (eventType === "add_to_cart") {
    return 3
  }
  if (eventType === "click") {
    return 2
  }
  if (eventType === "product_view") {
    return 1
  }
  return 0
}

function getTopInterests(profile: CustomerProfile, productNameById: Map<string, string>): string[] {
  return Array.from(profile.interestScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([productId]) => productNameById.get(productId) ?? productId)
}

function daysSince(timestamp: number | null, now: number): number {
  if (!timestamp) {
    return Number.POSITIVE_INFINITY
  }
  return Math.max(0, (now - timestamp) / DAY_MS)
}

function ensureProfile(
  map: Map<string, CustomerProfile>,
  userId: string,
  customerLookup: Map<string, CustomerRecord>
): CustomerProfile {
  const existing = map.get(userId)
  if (existing) {
    return existing
  }

  const customer = customerLookup.get(userId)
  const createdAt = normalizeTimestamp(customer?.created_at ?? null)
  const profile: CustomerProfile = {
    userId,
    email: customer?.email?.trim() || undefined,
    name: customer?.name?.trim() || undefined,
    createdAt,
    firstSeenAt: createdAt,
    lastActivityAt: null,
    totalSpending: 0,
    orderCount: 0,
    activityEvents: 0,
    addToCartCount: 0,
    interestScores: new Map<string, number>(),
  }

  map.set(userId, profile)
  return profile
}

interface BuildSegmentsInput {
  customers?: CustomerRecord[]
  sessions: Session[]
  events: TrackedProductEvent[]
  orders: Order[]
  products: StoreProduct[]
}

export function buildCustomerSegments(input: BuildSegmentsInput): MarketingSegment[] {
  const customerLookup = new Map((input.customers ?? []).map((customer) => [customer.id, customer]))
  const productNameById = new Map(input.products.map((product) => [product.id, product.name]))
  const profiles = new Map<string, CustomerProfile>()

  const sessionUserById = new Map<string, string>()
  for (const session of input.sessions) {
    const userId = session.user_id?.trim()
    if (!userId) {
      continue
    }

    sessionUserById.set(session.id, userId)
    const profile = ensureProfile(profiles, userId, customerLookup)
    updateBounds(profile, normalizeTimestamp(toNumber(session.timestamp)))
  }

  for (const order of input.orders) {
    const userId = order.user_id?.trim()
    if (!userId) {
      continue
    }

    const profile = ensureProfile(profiles, userId, customerLookup)
    profile.totalSpending += Math.max(0, toNumber(order.price_paid))
    profile.orderCount += Math.max(1, toNumber(order.quantity))
    updateBounds(profile, normalizeTimestamp(toNumber(order.timestamp)))
  }

  for (const event of input.events) {
    const userId = sessionUserById.get(event.session_id)
    if (!userId) {
      continue
    }

    const profile = ensureProfile(profiles, userId, customerLookup)
    profile.activityEvents += 1
    if (event.event_type === "add_to_cart") {
      profile.addToCartCount += 1
    }

    if (event.product_id) {
      const weight = getInterestWeight(event.event_type)
      if (weight > 0) {
        profile.interestScores.set(
          event.product_id,
          (profile.interestScores.get(event.product_id) ?? 0) + weight
        )
      }
    }

    updateBounds(profile, normalizeTimestamp(toNumber(event.timestamp)))
  }

  for (const customer of input.customers ?? []) {
    if (!profiles.has(customer.id)) {
      ensureProfile(profiles, customer.id, customerLookup)
    }
  }

  const allProfiles = Array.from(profiles.values())
  const spendValues = allProfiles.map((profile) => profile.totalSpending).filter((value) => value > 0)
  const interestValues = allProfiles
    .map((profile) => Array.from(profile.interestScores.values()).reduce((sum, score) => sum + score, 0))
    .filter((value) => value > 0)

  const vipThreshold = Math.max(320, percentile(spendValues, 0.9))
  const highValueThreshold = Math.max(120, percentile(spendValues, 0.7))
  const interestThreshold = Math.max(3, percentile(interestValues, 0.6))
  const now = Date.now()

  const usersBySegment = new Map<MarketingSegmentKey, CustomerProfile[]>(
    (Object.keys(segmentMeta) as MarketingSegmentKey[]).map((key) => [key, []])
  )

  for (const profile of allProfiles) {
    const lastActivityDays = daysSince(profile.lastActivityAt, now)
    const firstSeenDays = daysSince(profile.firstSeenAt ?? profile.createdAt, now)
    const interestScore = Array.from(profile.interestScores.values()).reduce((sum, score) => sum + score, 0)
    const hasIntentWithoutOrder = profile.addToCartCount > 0 && profile.orderCount === 0

    let segment: MarketingSegmentKey = "target_segment"

    const isVip =
      profile.totalSpending >= vipThreshold && profile.orderCount >= 3 && lastActivityDays <= 60
    const isHighValue =
      profile.totalSpending >= highValueThreshold && profile.orderCount >= 2 && lastActivityDays <= 90
    const isInactive =
      lastActivityDays > 75 && (profile.activityEvents > 0 || profile.orderCount > 0 || firstSeenDays > 30)
    const isNew = firstSeenDays <= 30 && profile.orderCount <= 1 && lastActivityDays <= 45
    const isTarget =
      hasIntentWithoutOrder ||
      (interestScore >= interestThreshold && profile.totalSpending < highValueThreshold)

    if (isVip) {
      segment = "vip_members"
    } else if (isHighValue) {
      segment = "high_value_customers"
    } else if (isInactive) {
      segment = "inactive_users"
    } else if (isNew) {
      segment = "new_customers"
    } else if (isTarget) {
      segment = "target_segment"
    } else if (lastActivityDays > 60) {
      segment = "inactive_users"
    }

    usersBySegment.get(segment)?.push(profile)
  }

  return (Object.keys(segmentMeta) as MarketingSegmentKey[]).map((segmentKey) => {
    const users = usersBySegment.get(segmentKey) ?? []
    const avgSpending =
      users.reduce((sum, user) => sum + user.totalSpending, 0) / Math.max(1, users.length)
    const avgOrders = users.reduce((sum, user) => sum + user.orderCount, 0) / Math.max(1, users.length)
    const avgEvents = users.reduce((sum, user) => sum + user.activityEvents, 0) / Math.max(1, users.length)

    const segmentInterestScores = new Map<string, number>()
    for (const user of users) {
      for (const [productId, score] of user.interestScores.entries()) {
        segmentInterestScores.set(productId, (segmentInterestScores.get(productId) ?? 0) + score)
      }
    }

    const topInterests = Array.from(segmentInterestScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([productId]) => productNameById.get(productId) ?? productId)

    return {
      key: segmentKey,
      name: segmentMeta[segmentKey].name,
      summary: `${users.length} users in this segment. ${segmentMeta[segmentKey].focus}`,
      indicators: [
        `Avg spend: ${format(avgSpending)} TND`,
        `Avg orders: ${format(avgOrders)} items`,
        `Avg activity: ${format(avgEvents)} events`,
        `Top interests: ${topInterests.join(", ") || "No strong product signal yet"}`,
      ],
      count: users.length,
      user_ids: users.map((user) => user.userId),
      recipient_emails: users
        .map((user) => user.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
      members: users.map((user) => ({
        user_id: user.userId,
        email: user.email,
        name: user.name,
        total_spending: format(user.totalSpending, 2),
        order_count: user.orderCount,
        activity_events: user.activityEvents,
        last_activity_at: user.lastActivityAt,
        top_interests: getTopInterests(user, productNameById),
      })),
    }
  })
}
