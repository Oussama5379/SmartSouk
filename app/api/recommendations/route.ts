import { listStoreProducts } from "@/lib/store-data"
import { getTrackingDashboardData, isTrackingConfigured } from "@/lib/tracking-store"
import { adminErrorResponse, requireAdminAccess } from "@/lib/admin-auth"
import type {
  DailyPerformanceSnapshot,
  InventoryAlert,
  PagePerformanceSnapshot,
  ProductPerformanceSnapshot,
  RecommendationItem,
  RecommendationSegment,
  RecommendationsApiResponse,
  TrafficSourceSnapshot,
  TrackedProductEvent,
} from "@/lib/tracking-types"
import type { Session, StoreProduct } from "@/lib/store-types"

const WEEKLY_DAYS = 7

function round(value: number, precision = 1): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function createDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function createDayLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  })
}

function buildDailyPerformance(
  sessions: Array<{ timestamp: number }>,
  orders: Array<{ timestamp: number }>
): DailyPerformanceSnapshot[] {
  const dayBuckets = new Map<string, DailyPerformanceSnapshot>()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  for (let offset = WEEKLY_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - offset)
    const dayStart = date.getTime()
    dayBuckets.set(createDayKey(dayStart), {
      day: createDayLabel(dayStart),
      sessions: 0,
      orders: 0,
    })
  }

  for (const session of sessions) {
    const key = createDayKey(session.timestamp)
    const bucket = dayBuckets.get(key)
    if (bucket) {
      bucket.sessions += 1
    }
  }

  for (const order of orders) {
    const key = createDayKey(order.timestamp)
    const bucket = dayBuckets.get(key)
    if (bucket) {
      bucket.orders += 1
    }
  }

  return Array.from(dayBuckets.values())
}

function buildTopProducts(
  products: StoreProduct[],
  events: TrackedProductEvent[],
  orders: Array<{ product_id: string; quantity: number; price_paid: number }>
): ProductPerformanceSnapshot[] {
  const productNameById = new Map(products.map((product) => [product.id, product.name]))

  const metricsByProduct = new Map<
    string,
    {
      product_id: string
      product_name: string
      views: number
      clicks: number
      add_to_cart: number
      orders: number
      revenue: number
    }
  >()

  const ensureMetrics = (productId: string) => {
    if (!metricsByProduct.has(productId)) {
      metricsByProduct.set(productId, {
        product_id: productId,
        product_name: productNameById.get(productId) ?? "Unknown Product",
        views: 0,
        clicks: 0,
        add_to_cart: 0,
        orders: 0,
        revenue: 0,
      })
    }

    return metricsByProduct.get(productId)!
  }

  for (const event of events) {
    if (!event.product_id) {
      continue
    }

    const row = ensureMetrics(event.product_id)

    if (event.event_type === "product_view") {
      row.views += 1
    } else if (event.event_type === "click") {
      row.clicks += 1
    } else if (event.event_type === "add_to_cart") {
      row.add_to_cart += 1
    }
  }

  for (const order of orders) {
    const row = ensureMetrics(order.product_id)
    row.orders += Math.max(1, order.quantity)
    row.revenue += Math.max(0, order.price_paid)
  }

  return Array.from(metricsByProduct.values())
    .map((row) => ({
      ...row,
      conversion_rate: row.views > 0 ? round((row.orders / row.views) * 100) : 0,
      revenue: round(row.revenue, 2),
    }))
    .sort((left, right) => {
      if (right.revenue !== left.revenue) {
        return right.revenue - left.revenue
      }

      if (right.orders !== left.orders) {
        return right.orders - left.orders
      }

      return right.views - left.views
    })
}

function buildTopPages(
  events: Array<{ page?: string }>,
  sessions: Array<{ pages_visited: string[] }>
): PagePerformanceSnapshot[] {
  const pageHits = new Map<string, number>()

  for (const event of events) {
    const page = event.page?.trim()
    if (!page) {
      continue
    }
    pageHits.set(page, (pageHits.get(page) ?? 0) + 1)
  }

  if (pageHits.size === 0) {
    for (const session of sessions) {
      for (const page of session.pages_visited) {
        const normalizedPage = page.trim()
        if (!normalizedPage) {
          continue
        }

        pageHits.set(normalizedPage, (pageHits.get(normalizedPage) ?? 0) + 1)
      }
    }
  }

  const totalHits = Array.from(pageHits.values()).reduce((sum, count) => sum + count, 0)
  if (totalHits === 0) {
    return []
  }

  return Array.from(pageHits.entries())
    .map(([page, hits]) => ({
      page,
      hits,
      share: round((hits / totalHits) * 100),
    }))
    .sort((left, right) => right.hits - left.hits)
    .slice(0, 6)
}

function buildTrafficSources(sessions: Session[]): TrafficSourceSnapshot[] {
  if (sessions.length === 0) {
    return []
  }

  const sourceCounts = new Map<string, number>()

  for (const session of sessions) {
    const source = session.utm_source?.trim()
    const medium = session.utm_medium?.trim()
    const label = source ? (medium ? `${source} / ${medium}` : source) : "Direct"
    sourceCounts.set(label, (sourceCounts.get(label) ?? 0) + 1)
  }

  return Array.from(sourceCounts.entries())
    .map(([source, count]) => ({
      source,
      sessions: count,
      share: round((count / sessions.length) * 100),
    }))
    .sort((left, right) => right.sessions - left.sessions)
    .slice(0, 6)
}

function buildInventoryAlerts(
  products: StoreProduct[],
  topProducts: ProductPerformanceSnapshot[]
): InventoryAlert[] {
  const topProductMap = new Map(topProducts.map((product) => [product.product_id, product]))

  return products
    .filter(
      (product): product is StoreProduct & { stock_status: "low_stock" | "out_of_stock" } =>
        product.stock_status === "low_stock" || product.stock_status === "out_of_stock"
    )
    .map((product) => {
      const signals = topProductMap.get(product.id)
      const demandSignals = (signals?.views ?? 0) + (signals?.add_to_cart ?? 0) + (signals?.orders ?? 0) * 2
      const estimatedRevenueAtRisk = signals
        ? round(Math.max(signals.revenue, signals.orders * product.price_tnd), 2)
        : round(demandSignals * product.price_tnd * 0.25, 2)

      return {
        product_id: product.id,
        stock_status: product.stock_status,
        demand_signals: demandSignals,
        estimated_revenue_at_risk: estimatedRevenueAtRisk,
        reason:
          product.stock_status === "out_of_stock"
            ? "Out of stock while demand signals are still active."
            : "Low stock with active browsing and cart intent.",
      }
    })
    .filter((alert) => alert.demand_signals > 0)
    .sort((left, right) => right.estimated_revenue_at_risk - left.estimated_revenue_at_risk)
}

function buildCrossSellRecommendations(
  orders: Array<{ session_id: string; product_id: string }>,
  products: StoreProduct[]
): RecommendationItem[] {
  const productNameById = new Map(products.map((product) => [product.id, product.name]))
  const priceById = new Map(products.map((product) => [product.id, product.price_tnd]))
  const orderedProductsBySession = new Map<string, Set<string>>()

  for (const order of orders) {
    const sessionProducts = orderedProductsBySession.get(order.session_id) ?? new Set<string>()
    sessionProducts.add(order.product_id)
    orderedProductsBySession.set(order.session_id, sessionProducts)
  }

  const pairCounts = new Map<string, number>()
  const baseCounts = new Map<string, number>()

  for (const sessionProducts of orderedProductsBySession.values()) {
    const items = Array.from(sessionProducts)
    if (items.length < 2) {
      continue
    }

    for (const base of items) {
      baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1)

      for (const paired of items) {
        if (paired === base) {
          continue
        }
        const key = `${base}|${paired}`
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }
  }

  const items: RecommendationItem[] = []

  for (const [key, pairSessions] of pairCounts.entries()) {
    const [baseId, pairedId] = key.split("|")
    const baseSessions = baseCounts.get(baseId) ?? 0
    if (baseSessions === 0) continue

    const confidence = round((pairSessions / baseSessions) * 100)
    const support = round((pairSessions / Math.max(1, orderedProductsBySession.size)) * 100)

    items.push({
      type: "cross_sell",
      product_id: pairedId,
      reason: `${productNameById.get(pairedId) ?? "Companion product"} appears with ${productNameById.get(baseId) ?? "base product"} in ${pairSessions} shared carts (${confidence}% confidence, ${support}% support).`,
      confidence,
      potential_revenue: round((priceById.get(pairedId) ?? 0) * pairSessions, 2),
    })
  }

  return items.sort((left, right) => right.confidence - left.confidence).slice(0, 2)
}

function buildTopPerformerRecommendation(
  topProducts: ProductPerformanceSnapshot[],
  totalRevenue: number
): RecommendationItem | null {
  const topProduct = topProducts[0]
  if (!topProduct || topProduct.revenue <= 0) {
    return null
  }

  const revenueShare = totalRevenue > 0 ? round((topProduct.revenue / totalRevenue) * 100) : 0

  return {
    type: "top_performer",
    product_id: topProduct.product_id,
    reason: `${topProduct.product_name} contributes ${revenueShare}% of tracked revenue with ${topProduct.orders} confirmed orders.`,
    confidence: Math.min(99, revenueShare),
    potential_revenue: round(topProduct.revenue, 2),
  }
}

function buildUpsellRecommendation(
  topProducts: ProductPerformanceSnapshot[],
  products: StoreProduct[],
  totalRevenue: number,
  totalOrders: number
): RecommendationItem | null {
  if (totalOrders <= 0 || topProducts.length === 0) {
    return null
  }

  const avgOrderValue = totalRevenue / totalOrders
  const productById = new Map(products.map((product) => [product.id, product]))

  const candidate = topProducts.find((topProduct) => {
    const product = productById.get(topProduct.product_id)
    return Boolean(product && product.stock_status !== "out_of_stock" && product.price_tnd > avgOrderValue)
  })

  if (!candidate) {
    return null
  }

  const product = productById.get(candidate.product_id)
  if (!product) {
    return null
  }

  const potentialRevenue = round((product.price_tnd - avgOrderValue) * Math.max(1, candidate.orders), 2)

  return {
    type: "upsell",
    product_id: product.id,
    reason: `${product.name} price (${product.price_tnd} TND) is above average order value (${round(avgOrderValue, 2)} TND) and already converts with intent traffic.`,
    confidence: Math.min(98, round(55 + candidate.conversion_rate * 0.7)),
    potential_revenue: Math.max(0, potentialRevenue),
  }
}

function buildSegments(
  orders: Array<{ session_id: string; user_id?: string; price_paid: number; timestamp: number }>
): RecommendationSegment[] {
  if (orders.length === 0) {
    return []
  }

  const customerMap = new Map<
    string,
    {
      frequency: number
      monetary: number
      lastOrderTs: number
    }
  >()

  for (const order of orders) {
    const key = order.user_id?.trim() || order.session_id
    const existing = customerMap.get(key) ?? {
      frequency: 0,
      monetary: 0,
      lastOrderTs: 0,
    }

    existing.frequency += 1
    existing.monetary += Math.max(0, order.price_paid)
    existing.lastOrderTs = Math.max(existing.lastOrderTs, order.timestamp)
    customerMap.set(key, existing)
  }

  const customers = Array.from(customerMap.values())
  const avgMonetary =
    customers.reduce((sum, customer) => sum + customer.monetary, 0) / Math.max(1, customers.length)
  const now = Date.now()

  const buckets = new Map<
    string,
    {
      count: number
      totalRecency: number
      totalFrequency: number
      totalMonetary: number
    }
  >()

  for (const customer of customers) {
    const recencyDays = Math.max(0, (now - customer.lastOrderTs) / (1000 * 60 * 60 * 24))
    let label = "Occasional Buyers"

    if (customer.frequency >= 3 && customer.monetary >= avgMonetary && recencyDays <= 30) {
      label = "Champions"
    } else if (customer.frequency >= 2 && recencyDays <= 60) {
      label = "Loyal Customers"
    } else if (customer.frequency === 1 && recencyDays <= 30) {
      label = "New Customers"
    } else if (customer.frequency >= 2 && recencyDays > 90) {
      label = "At Risk Customers"
    }

    const bucket = buckets.get(label) ?? {
      count: 0,
      totalRecency: 0,
      totalFrequency: 0,
      totalMonetary: 0,
    }

    bucket.count += 1
    bucket.totalRecency += recencyDays
    bucket.totalFrequency += customer.frequency
    bucket.totalMonetary += customer.monetary
    buckets.set(label, bucket)
  }

  return Array.from(buckets.entries())
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 4)
    .map(([name, bucket]) => ({
      name,
      summary: `${bucket.count} customers in this segment.`,
      indicators: [
        `Recency: ${round(bucket.totalRecency / bucket.count, 1)} days`,
        `Frequency: ${round(bucket.totalFrequency / bucket.count, 1)} purchases`,
        `Monetary: ${round(bucket.totalMonetary / bucket.count, 1)} TND average`,
      ],
    }))
}

function buildActionItems(params: {
  recommendations: RecommendationItem[]
  inventoryAlerts: InventoryAlert[]
  trafficSources: TrafficSourceSnapshot[]
  cartAbandonmentRate: number
  cartsAbandoned: number
  cartsStarted: number
  revenuePerVisitor: number
}): string[] {
  const actions: string[] = []

  if (params.cartsStarted > 0 && params.cartAbandonmentRate >= 30) {
    actions.push(
      `Recover abandoned carts: ${params.cartsAbandoned} of ${params.cartsStarted} carts dropped (${params.cartAbandonmentRate}% abandonment).`
    )
  }

  const crossSell = params.recommendations.find((recommendation) => recommendation.type === "cross_sell")
  if (crossSell) {
    actions.push(`Deploy a cross-sell bundle for product ${crossSell.product_id} on related product pages.`)
  }

  const upsell = params.recommendations.find((recommendation) => recommendation.type === "upsell")
  if (upsell) {
    actions.push(`Run an upsell offer test for product ${upsell.product_id} post add-to-cart.`)
  }

  const topRisk = params.inventoryAlerts[0]
  if (topRisk) {
    actions.push(
      `Prioritize stock fix for ${topRisk.product_id}; current demand puts ${topRisk.estimated_revenue_at_risk} TND at risk.`
    )
  }

  const topSource = params.trafficSources[0]
  if (topSource && topSource.source !== "Direct") {
    actions.push(`Scale ${topSource.source} campaigns, currently contributing ${topSource.share}% of sessions.`)
  }

  actions.push(
    `Target weekly revenue-per-visitor above ${params.revenuePerVisitor} TND using bundles and upsell experiments.`
  )

  return Array.from(new Set(actions)).slice(0, 6)
}

function buildInsightSummary(params: {
  recommendations: RecommendationItem[]
  inventoryAlerts: InventoryAlert[]
  trafficSources: TrafficSourceSnapshot[]
  revenuePerVisitor: number
  cartAbandonmentRate: number
}): string {
  const topSource = params.trafficSources[0]
  const performer = params.recommendations.find((item) => item.type === "top_performer")
  const risk = params.inventoryAlerts[0]

  return `Revenue per visitor is ${params.revenuePerVisitor} TND with cart abandonment at ${params.cartAbandonmentRate}%. ${topSource ? `${topSource.source} drives ${topSource.share}% of tracked sessions.` : "Source attribution is limited."} ${performer ? `Top performer confidence is ${performer.confidence}%.` : "No dominant top performer yet."} ${risk ? `Highest inventory risk is ${risk.product_id} with ${risk.estimated_revenue_at_risk} TND at risk.` : "No active inventory risk from current demand signals."}`
}

async function buildRecommendationsResponse(): Promise<RecommendationsApiResponse> {
  const products = await listStoreProducts()
  const trackingData = await getTrackingDashboardData({
    sessionLimit: 5000,
    eventLimit: 20000,
    orderLimit: 20000,
  })

  const { stats, sessions, events, orders } = trackingData
  const topProducts = buildTopProducts(products, events, orders)
  const trafficSources = buildTrafficSources(sessions)
  const inventoryAlerts = buildInventoryAlerts(products, topProducts)
  const recommendations: RecommendationItem[] = []

  recommendations.push(...buildCrossSellRecommendations(orders, products))

  const upsell = buildUpsellRecommendation(topProducts, products, stats.totalRevenue, stats.totalOrders)
  if (upsell) {
    recommendations.push(upsell)
  }

  const topPerformer = buildTopPerformerRecommendation(topProducts, stats.totalRevenue)
  if (topPerformer) {
    recommendations.push(topPerformer)
  }

  if (inventoryAlerts[0]) {
    recommendations.push({
      type: "at_risk",
      product_id: inventoryAlerts[0].product_id,
      reason: inventoryAlerts[0].reason,
      confidence: Math.min(99, round(50 + inventoryAlerts[0].demand_signals * 1.5)),
      potential_revenue: -Math.abs(inventoryAlerts[0].estimated_revenue_at_risk),
    })
  }

  const customerSegments = buildSegments(orders)
  const actionItems = buildActionItems({
    recommendations,
    inventoryAlerts,
    trafficSources,
    cartAbandonmentRate: stats.cartAbandonmentRate,
    cartsAbandoned: stats.cartsAbandoned,
    cartsStarted: stats.cartsStarted,
    revenuePerVisitor: stats.revenuePerVisitor,
  })

  const insightSummary = buildInsightSummary({
    recommendations,
    inventoryAlerts,
    trafficSources,
    revenuePerVisitor: stats.revenuePerVisitor,
    cartAbandonmentRate: stats.cartAbandonmentRate,
  })

  return {
    generated: true,
    generatedAt: new Date().toISOString(),
    stats,
    salesData: {
      totals: {
        sessions: stats.totalSessions,
        events: stats.totalEvents,
        orders: stats.totalOrders,
        revenue: stats.totalRevenue,
        conversionRate: stats.totalSessions > 0 ? round((stats.totalOrders / stats.totalSessions) * 100) : 0,
        revenuePerVisitor: stats.revenuePerVisitor,
        cartAbandonmentRate: stats.cartAbandonmentRate,
      },
      dailyPerformance: buildDailyPerformance(sessions, orders),
      topProducts: topProducts.slice(0, 10),
    },
    customerBehavior: {
      topPages: buildTopPages(events, sessions),
      trafficSources,
      guestSessions: sessions.filter((session) => session.user_type === "guest").length,
      customerSessions: sessions.filter((session) => session.user_type === "customer").length,
      avgSessionDurationSeconds: stats.avgSessionDuration,
    },
    insightSummary,
    recommendations,
    inventoryAlerts,
    customerSegments,
    actionItems,
  }
}

function getTrackingNotConfiguredResponse() {
  return Response.json(
    {
      error:
        "Tracking database is not configured. Add DATABASE_URL (Neon Postgres) before using recommendations.",
    },
    { status: 500 }
  )
}

async function handleRequest(request: Request) {
  const authResult = await requireAdminAccess(request)
  if (!authResult.ok) {
    return adminErrorResponse(authResult)
  }

  if (!isTrackingConfigured()) {
    return getTrackingNotConfiguredResponse()
  }

  try {
    const response = await buildRecommendationsResponse()
    return Response.json(response)
  } catch {
    return Response.json({ error: "Failed to generate recommendations" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handleRequest(request)
}

export async function POST(request: Request) {
  return handleRequest(request)
}
