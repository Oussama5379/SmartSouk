"use client"

import { useEffect, useMemo, useState } from "react"
import {
  DollarSign,
  Eye,
  Loader2,
  MousePointerClick,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { readClientCache, writeClientCache } from "@/lib/client-cache"
import type { RecommendationsApiResponse } from "@/lib/tracking-types"

const ANALYTICS_CACHE_KEY = "dashboard:analytics:v1"
const ANALYTICS_CACHE_MAX_AGE_MS = 5 * 60 * 1000

const emptyRecommendationsResponse: RecommendationsApiResponse = {
  generated: false,
  generatedAt: "",
  stats: {
    totalSessions: 0,
    totalEvents: 0,
    totalOrders: 0,
    totalRevenue: 0,
    avgSessionDuration: 0,
    revenuePerVisitor: 0,
    cartAbandonmentRate: 0,
    cartsStarted: 0,
    cartsAbandoned: 0,
  },
  salesData: {
    totals: {
      sessions: 0,
      events: 0,
      orders: 0,
      revenue: 0,
      conversionRate: 0,
      revenuePerVisitor: 0,
      cartAbandonmentRate: 0,
    },
    dailyPerformance: [],
    topProducts: [],
  },
  customerBehavior: {
    topPages: [],
    trafficSources: [],
    guestSessions: 0,
    customerSessions: 0,
    avgSessionDurationSeconds: 0,
  },
  insightSummary: "",
  recommendations: [],
  inventoryAlerts: [],
  customerSegments: [],
  actionItems: [],
}

function formatDuration(seconds: number): string {
  const normalizedSeconds = Math.max(0, Math.round(seconds))
  const mins = Math.floor(normalizedSeconds / 60)
  const secs = normalizedSeconds % 60
  return `${mins}m ${secs}s`
}

export default function AnalyticsPage() {
  const cachedPayload = useMemo(
    () => readClientCache<RecommendationsApiResponse>(ANALYTICS_CACHE_KEY, ANALYTICS_CACHE_MAX_AGE_MS),
    []
  )
  const [payload, setPayload] = useState<RecommendationsApiResponse>(
    cachedPayload ?? emptyRecommendationsResponse
  )
  const [loading, setLoading] = useState(!cachedPayload)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadAnalytics = async (options?: { background?: boolean }) => {
    if (!options?.background) {
      setLoading(true)
    }
    setErrorMessage(null)

    try {
      const response = await fetch("/api/recommendations", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      const body = (await response.json()) as RecommendationsApiResponse & { error?: string }
      if (!response.ok) {
        setErrorMessage(body.error ?? "Failed to load analytics")
        return
      }

      setPayload(body)
      writeClientCache<RecommendationsApiResponse>(ANALYTICS_CACHE_KEY, body)
    } catch {
      setErrorMessage("Failed to load analytics")
    } finally {
      if (!options?.background) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadAnalytics({ background: !!cachedPayload })
  }, [cachedPayload])

  const maxDailySessions = useMemo(() => {
    const values = payload.salesData.dailyPerformance.map((day) => day.sessions)
    return Math.max(1, ...values)
  }, [payload.salesData.dailyPerformance])

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Live visitor behavior, conversion trends, and actionable growth insights.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadAnalytics()}>
          Refresh
        </Button>
      </div>

      {errorMessage && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Visitors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payload.salesData.totals.sessions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Guests: {payload.customerBehavior.guestSessions} • Customers:{" "}
              {payload.customerBehavior.customerSessions}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Page Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payload.salesData.totals.events}</div>
            <p className="text-xs text-muted-foreground mt-1">Tracked interaction events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payload.salesData.totals.conversionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {payload.salesData.totals.orders} confirmed orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue / Visitor</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payload.salesData.totals.revenuePerVisitor} TND</div>
            <p className="text-xs text-muted-foreground mt-1">
              {payload.salesData.totals.revenue} TND total revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cart Abandonment</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payload.salesData.totals.cartAbandonmentRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {payload.stats.cartsAbandoned} abandoned of {payload.stats.cartsStarted} carts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Session</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(payload.customerBehavior.avgSessionDurationSeconds)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue: {payload.salesData.totals.revenue} TND
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Sessions</CardTitle>
            <CardDescription>Daily session count from tracked traffic</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-48">
              {payload.salesData.dailyPerformance.map((day) => (
                <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                    style={{ height: `${(day.sessions / maxDailySessions) * 100}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{day.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Traffic Sources (UTM)</CardTitle>
            <CardDescription>Attribution from stored utm_source and utm_medium values</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {payload.customerBehavior.trafficSources.length === 0 && (
              <p className="text-sm text-muted-foreground">No source attribution data yet.</p>
            )}
            {payload.customerBehavior.trafficSources.map((source) => (
              <div key={source.source} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{source.source}</span>
                  <span className="font-medium">{source.share}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, source.share)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{source.sessions} sessions</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-transparent">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Performance Insights
            </CardTitle>
            <CardDescription>Generated from tracked sessions, orders, and basket analysis</CardDescription>
          </div>
          <Button onClick={() => void loadAnalytics()} size="sm" variant="default">
            Refresh Insights
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700">
            {payload.insightSummary || "No insights generated yet."}
          </p>
          {payload.actionItems.length > 0 && (
            <div className="space-y-2">
              {payload.actionItems.map((action, index) => (
                <div key={`${index}-${action}`} className="flex items-start gap-2 text-sm">
                  <span className="font-semibold text-blue-600">{index + 1}.</span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Performing Products</CardTitle>
          <CardDescription>Ranked by confirmed revenue and conversion behavior</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {payload.salesData.topProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">No product performance data yet.</p>
            )}
            {payload.salesData.topProducts.slice(0, 6).map((product, index) => (
              <div
                key={product.product_id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="font-medium">{product.product_name}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="font-medium">{product.views}</p>
                    <p className="text-xs text-muted-foreground">views</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">{product.orders}</p>
                    <p className="text-xs text-muted-foreground">orders</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{product.revenue} TND</p>
                    <p className="text-xs text-muted-foreground">revenue</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
