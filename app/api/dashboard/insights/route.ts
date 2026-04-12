import { Redis } from "@upstash/redis"
import { getAuthenticatedUser } from "@/lib/admin-auth"
import { listStoreProducts } from "@/lib/store-data"
import { getTrackingDashboardData, isTrackingConfigured } from "@/lib/tracking-store"
import type { UserDashboardInsightsResponse } from "@/lib/tracking-types"

const DASHBOARD_INSIGHTS_CACHE_TTL_SECONDS = 60 * 60 * 12
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim()
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
const redis = upstashUrl && upstashToken ? Redis.fromEnv() : null

function round(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function createCacheKey(userId: string): string {
  return `dashboard:insights:${userId}`
}

function toCategoryLabel(value: string): string {
  const normalized = value.trim().replace(/_/g, " ")
  if (!normalized) {
    return "Other"
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function normalizeInsightsPayload(
  payload: Partial<UserDashboardInsightsResponse>
): UserDashboardInsightsResponse {
  return {
    generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : new Date().toISOString(),
    cacheHit: !!payload.cacheHit,
    cachedUntil: typeof payload.cachedUntil === "string" ? payload.cachedUntil : "",
    totalSpentTnd: typeof payload.totalSpentTnd === "number" ? payload.totalSpentTnd : 0,
    totalOrders: typeof payload.totalOrders === "number" ? payload.totalOrders : 0,
    avgOrderValueTnd: typeof payload.avgOrderValueTnd === "number" ? payload.avgOrderValueTnd : 0,
    mostBoughtItem: payload.mostBoughtItem ?? null,
    recommendation: payload.recommendation ?? null,
    recentPurchases: Array.isArray(payload.recentPurchases) ? payload.recentPurchases : [],
    spendingByCategory: Array.isArray(payload.spendingByCategory) ? payload.spendingByCategory : [],
  }
}

function getEventWeight(eventType: string): number {
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

async function readCachedInsights(userId: string): Promise<UserDashboardInsightsResponse | null> {
  if (!redis) {
    return null
  }

  try {
    const cached = await redis.get<UserDashboardInsightsResponse>(createCacheKey(userId))
    return cached ?? null
  } catch (error) {
    console.warn("[dashboard-insights] Failed to read cached insights.", error)
    return null
  }
}

async function writeCachedInsights(userId: string, insights: UserDashboardInsightsResponse) {
  if (!redis) {
    return
  }

  try {
    await redis.set(createCacheKey(userId), insights, { ex: DASHBOARD_INSIGHTS_CACHE_TTL_SECONDS })
  } catch (error) {
    console.warn("[dashboard-insights] Failed to cache insights.", error)
  }
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 })
  }

  if (!isTrackingConfigured()) {
    const empty: UserDashboardInsightsResponse = {
      generatedAt: new Date().toISOString(),
      cacheHit: false,
      cachedUntil: new Date(Date.now() + DASHBOARD_INSIGHTS_CACHE_TTL_SECONDS * 1000).toISOString(),
      totalSpentTnd: 0,
      totalOrders: 0,
      avgOrderValueTnd: 0,
      mostBoughtItem: null,
      recommendation: null,
      recentPurchases: [],
      spendingByCategory: [],
    }
    return Response.json(empty)
  }

  const cached = await readCachedInsights(user.id)
  if (cached) {
    const normalizedCached = normalizeInsightsPayload(cached)
    return Response.json({
      ...normalizedCached,
      cacheHit: true,
    } satisfies UserDashboardInsightsResponse)
  }

  try {
    const [products, trackingData] = await Promise.all([
      listStoreProducts(),
      getTrackingDashboardData({
        sessionLimit: 5000,
        eventLimit: 30000,
        orderLimit: 30000,
      }),
    ])

    const productById = new Map(products.map((product) => [product.id, product]))
    const userOrders = trackingData.orders.filter((order) => order.user_id === user.id)
    const sortedUserOrders = [...userOrders].sort((a, b) => b.timestamp - a.timestamp)
    const userSessionIds = new Set(
      trackingData.sessions
        .filter((session) => session.user_id === user.id)
        .map((session) => session.id)
    )
    const userEvents = trackingData.events.filter((event) => userSessionIds.has(event.session_id))

    const totalSpentTnd = round(userOrders.reduce((sum, order) => sum + Math.max(0, order.price_paid), 0))
    const totalOrders = userOrders.reduce((sum, order) => sum + Math.max(1, order.quantity), 0)
    const avgOrderValueTnd =
      userOrders.length > 0 ? round(totalSpentTnd / Math.max(1, userOrders.length)) : 0

    const purchaseByProduct = new Map<string, { quantity: number; spent: number }>()
    for (const order of userOrders) {
      const bucket = purchaseByProduct.get(order.product_id) ?? { quantity: 0, spent: 0 }
      bucket.quantity += Math.max(1, order.quantity)
      bucket.spent += Math.max(0, order.price_paid)
      purchaseByProduct.set(order.product_id, bucket)
    }

    const mostBought = Array.from(purchaseByProduct.entries())
      .sort((a, b) => {
        if (b[1].quantity !== a[1].quantity) {
          return b[1].quantity - a[1].quantity
        }
        return b[1].spent - a[1].spent
      })
      .at(0)

    const mostBoughtItem = mostBought
      ? {
          product_id: mostBought[0],
          product_name: productById.get(mostBought[0])?.name ?? "Unknown Product",
          quantity: mostBought[1].quantity,
          spent_tnd: round(mostBought[1].spent),
        }
      : null

    const recentPurchases = sortedUserOrders.slice(0, 6).map((order) => ({
      order_id: order.id,
      product_id: order.product_id,
      product_name: productById.get(order.product_id)?.name ?? "Unknown Product",
      quantity: Math.max(1, order.quantity),
      spent_tnd: round(Math.max(0, order.price_paid)),
      purchased_at: order.timestamp,
    }))

    const categorySpendingMap = new Map<string, { quantity: number; spent: number }>()
    for (const order of userOrders) {
      const category = productById.get(order.product_id)?.category
      const bucketKey = category ? toCategoryLabel(category) : "Other"
      const current = categorySpendingMap.get(bucketKey) ?? { quantity: 0, spent: 0 }
      current.quantity += Math.max(1, order.quantity)
      current.spent += Math.max(0, order.price_paid)
      categorySpendingMap.set(bucketKey, current)
    }

    const spendingByCategory = Array.from(categorySpendingMap.entries())
      .map(([category, bucket]) => ({
        category,
        quantity: bucket.quantity,
        spent_tnd: round(bucket.spent),
      }))
      .sort((a, b) => b.spent_tnd - a.spent_tnd)

    const userInterestScoreByProduct = new Map<string, number>()
    const userCategoryAffinity = new Map<string, number>()
    for (const event of userEvents) {
      if (!event.product_id) {
        continue
      }

      const weight = getEventWeight(event.event_type)
      if (weight <= 0) {
        continue
      }

      userInterestScoreByProduct.set(
        event.product_id,
        (userInterestScoreByProduct.get(event.product_id) ?? 0) + weight
      )

      const category = productById.get(event.product_id)?.category
      if (category) {
        userCategoryAffinity.set(category, (userCategoryAffinity.get(category) ?? 0) + weight)
      }
    }

    for (const order of userOrders) {
      const category = productById.get(order.product_id)?.category
      if (category) {
        userCategoryAffinity.set(category, (userCategoryAffinity.get(category) ?? 0) + Math.max(2, order.quantity))
      }
    }

    const purchasedProductIds = new Set(userOrders.map((order) => order.product_id))
    const globalOrderSignals = new Map<string, number>()
    for (const order of trackingData.orders) {
      globalOrderSignals.set(order.product_id, (globalOrderSignals.get(order.product_id) ?? 0) + order.quantity)
    }

    const recommendationCandidates = products.filter(
      (product) => product.stock_status !== "out_of_stock" && !purchasedProductIds.has(product.id)
    )

    const scoredCandidates = recommendationCandidates.map((product) => {
      const interest = userInterestScoreByProduct.get(product.id) ?? 0
      const affinity = userCategoryAffinity.get(product.category) ?? 0
      const globalDemand = globalOrderSignals.get(product.id) ?? 0
      const totalScore = interest * 2 + affinity + globalDemand * 0.7

      return {
        product,
        score: totalScore,
        interest,
        affinity,
        globalDemand,
      }
    })

    scoredCandidates.sort((a, b) => b.score - a.score)
    const topCandidate = scoredCandidates.at(0)

    const recommendation = topCandidate
      ? {
          product_id: topCandidate.product.id,
          product_name: topCandidate.product.name,
          confidence: Math.min(96, Math.max(40, round(35 + topCandidate.score * 6, 0))),
          reason:
            topCandidate.interest > 0
              ? `Based on your recent interest in similar products and browsing behavior.`
              : topCandidate.affinity > 0
                ? `Based on your spending pattern in ${topCandidate.product.category} products.`
                : `Based on current store demand and your profile activity.`,
        }
      : null

    const response: UserDashboardInsightsResponse = {
      generatedAt: new Date().toISOString(),
      cacheHit: false,
      cachedUntil: new Date(Date.now() + DASHBOARD_INSIGHTS_CACHE_TTL_SECONDS * 1000).toISOString(),
      totalSpentTnd,
      totalOrders,
      avgOrderValueTnd,
      mostBoughtItem,
      recommendation,
      recentPurchases,
      spendingByCategory,
    }

    await writeCachedInsights(user.id, response)
    return Response.json(response)
  } catch {
    return Response.json({ error: "Failed to load dashboard insights." }, { status: 500 })
  }
}
