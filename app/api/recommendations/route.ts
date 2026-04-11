import { generateText, Output } from "ai"
import { products } from "@/lib/mock-data"
import { getTrackingDashboardData, isTrackingConfigured } from "@/lib/tracking-store"
import { z } from "zod"
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

const WEEKLY_DAYS = 7

const aiRecommendationsSchema = z.object({
  insightSummary: z.string().min(1),
  recommendations: z
    .array(
      z.object({
        type: z.enum(["upsell", "cross_sell", "at_risk", "top_performer"]),
        product_id: z.string().min(1),
        reason: z.string().min(1),
        confidence: z.number().min(0).max(100),
        potential_revenue: z.number(),
      })
    )
    .min(1)
    .max(8),
  customerSegments: z
    .array(
      z.object({
        name: z.string().min(1),
        summary: z.string().min(1),
        indicators: z.array(z.string().min(1)).min(1).max(5),
      })
    )
    .max(6),
  actionItems: z.array(z.string().min(1)).min(1).max(6),
})

function isInventoryRiskProduct(product: (typeof products)[number]): product is (typeof products)[number] & {
  stock_status: "low_stock" | "out_of_stock"
} {
  return product.stock_status === "low_stock" || product.stock_status === "out_of_stock"
}

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
  events: TrackedProductEvent[],
  orders: Array<{ product_id: string; quantity: number; price_paid: number }>
): ProductPerformanceSnapshot[] {
  const productMap = new Map(
    products.map((product) => [product.id, { id: product.id, name: product.name }])
  )

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

  const ensureProductMetrics = (productId: string) => {
    if (!metricsByProduct.has(productId)) {
      metricsByProduct.set(productId, {
        product_id: productId,
        product_name: productMap.get(productId)?.name ?? "Unknown Product",
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

    const row = ensureProductMetrics(event.product_id)
    if (event.event_type === "product_view") {
      row.views += 1
    } else if (event.event_type === "click") {
      row.clicks += 1
    } else if (event.event_type === "add_to_cart") {
      row.add_to_cart += 1
    }
  }

  for (const order of orders) {
    const row = ensureProductMetrics(order.product_id)
    row.orders += Math.max(1, order.quantity)
    row.revenue += Math.max(0, order.price_paid)
  }

  return Array.from(metricsByProduct.values())
    .map((row) => ({
      ...row,
      conversion_rate: row.views > 0 ? round((row.orders / row.views) * 100) : 0,
      revenue: round(row.revenue, 2),
    }))
    .sort((a, b) => {
      if (b.revenue !== a.revenue) {
        return b.revenue - a.revenue
      }

      if (b.orders !== a.orders) {
        return b.orders - a.orders
      }

      return b.views - a.views
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
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 6)
}

function buildTrafficSources(
  sessions: Array<{ utm_source?: string; utm_medium?: string }>
): TrafficSourceSnapshot[] {
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
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 6)
}

function buildInventoryAlerts(topProducts: ProductPerformanceSnapshot[]): InventoryAlert[] {
  const topProductMap = new Map(topProducts.map((product) => [product.product_id, product]))

  return products
    .filter(isInventoryRiskProduct)
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
    .sort((a, b) => b.estimated_revenue_at_risk - a.estimated_revenue_at_risk)
}

function buildCrossSellRecommendations(
  orders: Array<{ session_id: string; product_id: string }>
): RecommendationItem[] {
  const productNameById = new Map(products.map((product) => [product.id, product.name]))
  const priceById = new Map(products.map((product) => [product.id, product.price_tnd]))

  const orderedProductsBySession = new Map<string, Set<string>>()
  for (const order of orders) {
    const sessionProducts = orderedProductsBySession.get(order.session_id) ?? new Set<string>()
    sessionProducts.add(order.product_id)
    orderedProductsBySession.set(order.session_id, sessionProducts)
  }

  const baskets = Array.from(orderedProductsBySession.values()).filter(
    (productsInBasket) => productsInBasket.size > 1
  )
  if (baskets.length === 0) {
    return []
  }

  const baseCounts = new Map<string, number>()
  const pairCounts = new Map<string, number>()

  for (const basket of baskets) {
    const items = Array.from(basket)
    for (const baseProductId of items) {
      baseCounts.set(baseProductId, (baseCounts.get(baseProductId) ?? 0) + 1)
      for (const pairedProductId of items) {
        if (baseProductId === pairedProductId) {
          continue
        }

        const pairKey = `${baseProductId}|${pairedProductId}`
        pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1)
      }
    }
  }

  const candidates = Array.from(pairCounts.entries())
    .map(([pairKey, pairSessions]) => {
      const [baseProductId, pairedProductId] = pairKey.split("|")
      const baseSessions = baseCounts.get(baseProductId) ?? 0
      if (baseSessions === 0) {
        return null
      }

      const confidence = round((pairSessions / baseSessions) * 100)
      const support = round((pairSessions / baskets.length) * 100)
      return {
        baseProductId,
        pairedProductId,
        pairSessions,
        baseSessions,
        confidence,
        support,
      }
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => {
      if (!candidate) {
        return false
      }

      return candidate.pairSessions >= 1 && candidate.baseSessions >= 1
    })
    .sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence
      }
      if (b.support !== a.support) {
        return b.support - a.support
      }
      return b.pairSessions - a.pairSessions
    })

  return candidates.slice(0, 2).map((candidate) => {
    const baseName = productNameById.get(candidate.baseProductId) ?? "this product"
    const pairedName = productNameById.get(candidate.pairedProductId) ?? "this companion product"
    const price = priceById.get(candidate.pairedProductId) ?? 0

    return {
      type: "cross_sell",
      product_id: candidate.pairedProductId,
      reason: `${pairedName} appears with ${baseName} in ${candidate.pairSessions} of ${candidate.baseSessions} shared baskets (${candidate.confidence}% confidence, ${candidate.support}% support).`,
      confidence: candidate.confidence,
      potential_revenue: round(price * candidate.pairSessions, 2),
    }
  })
}

function buildUpsellRecommendation(
  topProducts: ProductPerformanceSnapshot[],
  totalRevenue: number,
  totalOrders: number
): RecommendationItem | null {
  if (topProducts.length === 0 || totalOrders === 0) {
    return null
  }

  const overallAov = totalRevenue / totalOrders
  let bestCandidate: ProductPerformanceSnapshot | null = null
  let bestScore = -1

  for (const product of topProducts) {
    if (product.orders <= 0 || product.revenue <= 0) {
      continue
    }

    const productAov = product.revenue / product.orders
    if (productAov <= overallAov) {
      continue
    }

    const cartToOrderRatio = product.add_to_cart > 0 ? product.orders / product.add_to_cart : 1
    const premiumDelta = productAov - overallAov
    const score = premiumDelta * Math.max(cartToOrderRatio, 0.25) * product.orders

    if (score > bestScore) {
      bestScore = score
      bestCandidate = product
    }
  }

  if (!bestCandidate) {
    return null
  }

  const bestAov = bestCandidate.revenue / bestCandidate.orders
  const cartToOrderRatio = bestCandidate.add_to_cart > 0 ? bestCandidate.orders / bestCandidate.add_to_cart : 1
  const confidence = Math.min(
    99,
    round(Math.min(1, cartToOrderRatio) * 70 + Math.min(29, (bestAov / Math.max(overallAov, 1)) * 20))
  )
  const potentialRevenue = round((bestAov - overallAov) * bestCandidate.orders, 2)

  return {
    type: "upsell",
    product_id: bestCandidate.product_id,
    reason: `${bestCandidate.product_name} has ${round(bestAov, 2)} TND average order value vs ${round(overallAov, 2)} TND store average, with ${round(cartToOrderRatio * 100)}% cart-to-order completion.`,
    confidence,
    potential_revenue: potentialRevenue,
  }
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
    reason: `${topProduct.product_name} contributes ${revenueShare}% of total revenue with ${topProduct.orders} confirmed orders and ${topProduct.conversion_rate}% product conversion.`,
    confidence: revenueShare,
    potential_revenue: round(topProduct.revenue, 2),
  }
}

function buildRfmSegments(
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
    const customerKey = order.user_id?.trim() || order.session_id
    const existing = customerMap.get(customerKey) ?? {
      frequency: 0,
      monetary: 0,
      lastOrderTs: 0,
    }

    existing.frequency += 1
    existing.monetary += Math.max(0, order.price_paid)
    existing.lastOrderTs = Math.max(existing.lastOrderTs, order.timestamp)
    customerMap.set(customerKey, existing)
  }

  const customers = Array.from(customerMap.values())
  const averageMonetary =
    customers.reduce((sum, customer) => sum + customer.monetary, 0) / Math.max(1, customers.length)
  const now = Date.now()

  const segments = new Map<
    string,
    {
      count: number
      totalFrequency: number
      totalMonetary: number
      totalRecencyDays: number
    }
  >()

  for (const customer of customers) {
    const recencyDays = Math.max(0, (now - customer.lastOrderTs) / (1000 * 60 * 60 * 24))
    let segmentName = "Occasional Buyers"

    if (customer.frequency >= 3 && customer.monetary >= averageMonetary && recencyDays <= 30) {
      segmentName = "Champions"
    } else if (customer.frequency >= 2 && recencyDays <= 60) {
      segmentName = "Loyal Customers"
    } else if (customer.frequency === 1 && recencyDays <= 30) {
      segmentName = "New Customers"
    } else if (customer.frequency >= 2 && recencyDays > 90) {
      segmentName = "At Risk Customers"
    }

    const bucket = segments.get(segmentName) ?? {
      count: 0,
      totalFrequency: 0,
      totalMonetary: 0,
      totalRecencyDays: 0,
    }

    bucket.count += 1
    bucket.totalFrequency += customer.frequency
    bucket.totalMonetary += customer.monetary
    bucket.totalRecencyDays += recencyDays
    segments.set(segmentName, bucket)
  }

  return Array.from(segments.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4)
    .map(([name, stats]) => ({
      name,
      summary: `${stats.count} customer profiles in this segment.`,
      indicators: [
        `Recency: ${round(stats.totalRecencyDays / stats.count, 1)} days`,
        `Frequency: ${round(stats.totalFrequency / stats.count, 1)} purchases`,
        `Monetary: ${round(stats.totalMonetary / stats.count, 1)} TND average`,
      ],
    }))
}

function buildActionItems(params: {
  revenuePerVisitor: number
  cartAbandonmentRate: number
  cartsAbandoned: number
  cartsStarted: number
  recommendations: RecommendationItem[]
  inventoryAlerts: InventoryAlert[]
  trafficSources: TrafficSourceSnapshot[]
}): string[] {
  const actions: string[] = []

  if (params.cartsStarted > 0 && params.cartAbandonmentRate >= 30) {
    actions.push(
      `Recover abandoned carts: ${params.cartsAbandoned} of ${params.cartsStarted} carts dropped (${params.cartAbandonmentRate}% abandonment).`
    )
  }

  const crossSell = params.recommendations.find((recommendation) => recommendation.type === "cross_sell")
  if (crossSell) {
    const productName =
      products.find((product) => product.id === crossSell.product_id)?.name ?? "recommended companion"
    actions.push(`Launch a bundle placement test for ${productName} on related product pages.`)
  }

  const upsell = params.recommendations.find((recommendation) => recommendation.type === "upsell")
  if (upsell) {
    const productName = products.find((product) => product.id === upsell.product_id)?.name ?? "premium product"
    actions.push(`Use a post-add-to-cart upsell module to promote ${productName} to higher-intent buyers.`)
  }

  const inventoryAlert = params.inventoryAlerts.find((alert) => alert.stock_status === "out_of_stock")
  if (inventoryAlert) {
    const productName =
      products.find((product) => product.id === inventoryAlert.product_id)?.name ?? "out-of-stock item"
    actions.push(
      `Restock ${productName} first to prevent ${inventoryAlert.estimated_revenue_at_risk} TND additional revenue risk.`
    )
  }

  const topSource = params.trafficSources[0]
  if (topSource && topSource.source !== "Direct") {
    actions.push(
      `Scale ${topSource.source} traffic quality: it currently drives ${topSource.share}% of tracked sessions.`
    )
  }

  if (params.revenuePerVisitor > 0) {
    actions.push(
      `Set a weekly target to lift revenue per visitor above ${params.revenuePerVisitor} TND through bundle and upsell experiments.`
    )
  }

  return Array.from(new Set(actions)).slice(0, 6)
}

function buildInsightSummary(params: {
  revenuePerVisitor: number
  cartAbandonmentRate: number
  trafficSources: TrafficSourceSnapshot[]
  recommendations: RecommendationItem[]
  inventoryAlerts: InventoryAlert[]
}): string {
  const topSource = params.trafficSources[0]
  const topPerformer = params.recommendations.find((recommendation) => recommendation.type === "top_performer")
  const inventoryRisk = params.inventoryAlerts[0]

  const sourceSummary = topSource
    ? `${topSource.source} contributes ${topSource.share}% of tracked sessions.`
    : "Traffic source attribution is waiting on session data."
  const performerSummary = topPerformer
    ? `Top performer confidence is ${topPerformer.confidence}% based on observed order revenue share.`
    : "No revenue leader detected yet."
  const inventorySummary = inventoryRisk
    ? `${products.find((product) => product.id === inventoryRisk.product_id)?.name ?? "One item"} currently carries ${inventoryRisk.estimated_revenue_at_risk} TND in stock-out risk.`
    : "No inventory risks are active."

  return `Revenue per visitor is ${params.revenuePerVisitor} TND with cart abandonment at ${params.cartAbandonmentRate}%. ${sourceSummary} ${performerSummary} ${inventorySummary}`
}

async function buildAiRecommendations(params: {
  stats: RecommendationsApiResponse["stats"]
  salesData: RecommendationsApiResponse["salesData"]
  customerBehavior: RecommendationsApiResponse["customerBehavior"]
  inventoryAlerts: InventoryAlert[]
  fallbackRecommendations: RecommendationItem[]
  fallbackCustomerSegments: RecommendationSegment[]
  fallbackActionItems: string[]
  fallbackInsightSummary: string
}) {
  const prompt = `You are a senior e-commerce growth analyst.

Analyze this real tracking dataset and return practical, data-backed recommendations.

Tracking stats:
${JSON.stringify(params.stats)}

Sales data:
${JSON.stringify(params.salesData)}

Customer behavior:
${JSON.stringify(params.customerBehavior)}

Inventory alerts:
${JSON.stringify(params.inventoryAlerts)}

Deterministic baseline (reference only):
${JSON.stringify({
    recommendations: params.fallbackRecommendations,
    customerSegments: params.fallbackCustomerSegments,
    actionItems: params.fallbackActionItems,
    insightSummary: params.fallbackInsightSummary,
  })}

Product catalog:
${JSON.stringify(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      price_tnd: product.price_tnd,
      stock_status: product.stock_status,
    }))
  )}

Rules:
- Use only product IDs from the product catalog.
- Explain each recommendation with specific evidence.
- Confidence must be between 0 and 100.
- potential_revenue must be positive for opportunities and negative for risks.
- Keep advice actionable and concise.`

  const aiResult = await generateText({
    model: "openai/gpt-4o-mini",
    prompt,
    temperature: 0.4,
    output: Output.object({ schema: aiRecommendationsSchema }),
  })

  return aiResult.output
}

async function buildRecommendationsResponse(): Promise<RecommendationsApiResponse> {
  const trackingData = await getTrackingDashboardData({
    sessionLimit: 5000,
    eventLimit: 20000,
    orderLimit: 20000,
  })
  const { stats, sessions, events, orders } = trackingData

  const dailyPerformance = buildDailyPerformance(sessions, orders)
  const topProducts = buildTopProducts(events, orders)
  const topPages = buildTopPages(events, sessions)
  const trafficSources = buildTrafficSources(sessions)
  const inventoryAlerts = buildInventoryAlerts(topProducts)
  const guestSessions = sessions.filter((session) => session.user_type === "guest").length
  const customerSessions = sessions.filter((session) => session.user_type === "customer").length
  const conversionRate = stats.totalSessions > 0 ? round((stats.totalOrders / stats.totalSessions) * 100) : 0

  const salesData = {
    totals: {
      sessions: stats.totalSessions,
      events: stats.totalEvents,
      orders: stats.totalOrders,
      revenue: stats.totalRevenue,
      conversionRate,
      revenuePerVisitor: stats.revenuePerVisitor,
      cartAbandonmentRate: stats.cartAbandonmentRate,
    },
    dailyPerformance,
    topProducts: topProducts.slice(0, 10),
  }

  const customerBehavior = {
    topPages,
    trafficSources,
    guestSessions,
    customerSessions,
    avgSessionDurationSeconds: stats.avgSessionDuration,
  }

  const emptyResponse: RecommendationsApiResponse = {
    generated: false,
    generatedAt: new Date().toISOString(),
    stats,
    salesData,
    customerBehavior,
    insightSummary:
      "Not enough behavior and order data yet. Track a few sessions and confirmed payments to generate recommendations.",
    recommendations: [],
    inventoryAlerts,
    customerSegments: [],
    actionItems: [],
  }

  if (stats.totalEvents === 0 && stats.totalOrders === 0) {
    return emptyResponse
  }

  const recommendations: RecommendationItem[] = []
  const crossSellRecommendations = buildCrossSellRecommendations(orders)
  recommendations.push(...crossSellRecommendations)

  const upsellRecommendation = buildUpsellRecommendation(topProducts, stats.totalRevenue, stats.totalOrders)
  if (upsellRecommendation) {
    recommendations.push(upsellRecommendation)
  }

  const topPerformerRecommendation = buildTopPerformerRecommendation(topProducts, stats.totalRevenue)
  if (topPerformerRecommendation) {
    recommendations.push(topPerformerRecommendation)
  }

  const topInventoryRisk = inventoryAlerts[0]
  if (topInventoryRisk) {
    recommendations.push({
      type: "at_risk",
      product_id: topInventoryRisk.product_id,
      reason: topInventoryRisk.reason,
      confidence: Math.min(99, round(55 + topInventoryRisk.demand_signals * 1.2)),
      potential_revenue: -Math.abs(topInventoryRisk.estimated_revenue_at_risk),
    })
  }

  const customerSegments = buildRfmSegments(orders)
  const actionItems = buildActionItems({
    revenuePerVisitor: stats.revenuePerVisitor,
    cartAbandonmentRate: stats.cartAbandonmentRate,
    cartsAbandoned: stats.cartsAbandoned,
    cartsStarted: stats.cartsStarted,
    recommendations,
    inventoryAlerts,
    trafficSources,
  })
  const insightSummary = buildInsightSummary({
    revenuePerVisitor: stats.revenuePerVisitor,
    cartAbandonmentRate: stats.cartAbandonmentRate,
    trafficSources,
    recommendations,
    inventoryAlerts,
  })

  const catalogProductIds = new Set(products.map((product) => product.id))
  const fallbackProductId = topProducts[0]?.product_id ?? products[0]?.id ?? "1"

  try {
    const aiOutput = await buildAiRecommendations({
      stats,
      salesData,
      customerBehavior,
      inventoryAlerts,
      fallbackRecommendations: recommendations,
      fallbackCustomerSegments: customerSegments,
      fallbackActionItems: actionItems,
      fallbackInsightSummary: insightSummary,
    })

    return {
      generated: true,
      generatedAt: new Date().toISOString(),
      stats,
      salesData,
      customerBehavior,
      insightSummary: aiOutput.insightSummary,
      recommendations: aiOutput.recommendations.map((recommendation) => ({
        ...recommendation,
        product_id: catalogProductIds.has(recommendation.product_id)
          ? recommendation.product_id
          : fallbackProductId,
        confidence: round(recommendation.confidence),
        potential_revenue: round(recommendation.potential_revenue, 2),
      })),
      inventoryAlerts,
      customerSegments: aiOutput.customerSegments,
      actionItems: aiOutput.actionItems,
    }
  } catch {
    return {
      generated: false,
      generatedAt: new Date().toISOString(),
      stats,
      salesData,
      customerBehavior,
      insightSummary: `AI output unavailable for this request. ${insightSummary}`,
      recommendations,
      inventoryAlerts,
      customerSegments,
      actionItems,
    }
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

async function handleRequest() {
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

export async function GET() {
  return handleRequest()
}

export async function POST() {
  return handleRequest()
}
