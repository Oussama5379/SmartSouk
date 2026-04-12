"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, BarChart3, Gift, Lightbulb, Loader2, TrendingUp, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { StoreProduct } from "@/lib/store-types"
import type { RecommendationItem, RecommendationsApiResponse } from "@/lib/tracking-types"

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

export default function ProductIntelligencePage() {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [payload, setPayload] = useState<RecommendationsApiResponse>(emptyRecommendationsResponse)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadRecommendations = async () => {
    setLoading(true)
    setErrorMessage(null)

    try {
      const [recommendationsResponse, productsResponse] = await Promise.all([
        fetch("/api/recommendations", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }),
        fetch("/api/store/products", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }),
      ])

      const body = (await recommendationsResponse.json()) as RecommendationsApiResponse & { error?: string }
      if (!recommendationsResponse.ok) {
        setErrorMessage(body.error ?? "Failed to load recommendations")
        return
      }

      setPayload(body)

      if (productsResponse.ok) {
        const productsBody = (await productsResponse.json()) as { products?: StoreProduct[] }
        setProducts(Array.isArray(productsBody.products) ? productsBody.products : [])
      }
    } catch {
      setErrorMessage("Failed to load recommendations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRecommendations()
  }, [])

  const getRecommendationColor = (type: RecommendationItem["type"]) => {
    switch (type) {
      case "upsell":
        return "bg-green-50 border-green-200"
      case "cross_sell":
        return "bg-blue-50 border-blue-200"
      case "top_performer":
        return "bg-purple-50 border-purple-200"
      default:
        return "bg-gray-50"
    }
  }

  const getRecommendationIcon = (type: RecommendationItem["type"]) => {
    switch (type) {
      case "upsell":
        return <TrendingUp className="h-5 w-5 text-green-600" />
      case "cross_sell":
        return <Gift className="h-5 w-5 text-blue-600" />
      case "top_performer":
        return <BarChart3 className="h-5 w-5 text-purple-600" />
      default:
        return <TrendingUp className="h-5 w-5" />
    }
  }

  const getRecommendationLabel = (type: RecommendationItem["type"]) => {
    const labels = {
      upsell: "Upsell Opportunity",
      cross_sell: "Cross-Sell Opportunity",
      at_risk: "At-Risk Product",
      top_performer: "Top Performer",
    }
    return labels[type]
  }

  const getProductName = (id: string) => {
    return products.find((product) => product.id === id)?.name ?? "Unknown Product"
  }

  const summary = useMemo(() => {
    const recommendations = payload.recommendations
    const topPerformer = recommendations.find((recommendation) => recommendation.type === "top_performer")
    const opportunityRevenue = recommendations
      .filter((recommendation) => recommendation.potential_revenue > 0)
      .reduce((total, recommendation) => total + recommendation.potential_revenue, 0)

    return {
      upsellCount: recommendations.filter((recommendation) => recommendation.type === "upsell").length,
      crossSellCount: recommendations.filter((recommendation) => recommendation.type === "cross_sell").length,
      inventoryAlertCount: payload.inventoryAlerts.length,
      topPerformerProduct: topPerformer ? getProductName(topPerformer.product_id) : "N/A",
      opportunityRevenue: opportunityRevenue.toFixed(1),
    }
  }, [payload.inventoryAlerts.length, payload.recommendations, products])

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Intelligence</h1>
          <p className="text-muted-foreground mt-2">
            Behavioral recommendations and inventory alerts generated from tracked conversions
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadRecommendations()}>
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

      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-600" />
            Intelligence Summary
          </CardTitle>
          <CardDescription>
            {payload.generated
              ? `Generated ${new Date(payload.generatedAt).toLocaleString()}`
              : "Waiting for enough event and order data"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700">
            {payload.insightSummary || "No behavior insight generated yet."}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upsell Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.upsellCount}</div>
            <p className="text-xs text-green-600 mt-1">+{summary.opportunityRevenue} TND potential</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cross-Sell Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.crossSellCount}</div>
            <p className="text-xs text-blue-600 mt-1">
              Based on {payload.salesData.totals.events} tracked interactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.inventoryAlertCount}</div>
            <p className="text-xs text-red-600 mt-1">Tracked demand vs stock status</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Performer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold text-purple-600">{summary.topPerformerProduct}</div>
            <p className="text-xs text-purple-600 mt-1">{payload.salesData.totals.revenue} TND total revenue</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {payload.recommendations.length === 0 && (
          <Card>
            <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  No behavior recommendations yet. Generate more tracked interactions and confirmed orders.
                </p>
              </CardContent>
            </Card>
        )}
        {payload.recommendations.map((recommendation) => (
          <Card
            key={`${recommendation.type}-${recommendation.product_id}-${recommendation.reason}`}
            className={`border transition-all ${getRecommendationColor(recommendation.type)}`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getRecommendationIcon(recommendation.type)}
                  <div>
                    <CardTitle className="text-base">{getProductName(recommendation.product_id)}</CardTitle>
                    <Badge variant="outline" className="mt-2">
                      {getRecommendationLabel(recommendation.type)}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{recommendation.confidence}%</div>
                  <p className="text-xs text-muted-foreground">confidence</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">{recommendation.reason}</p>
              <div className="mt-3 p-2 bg-white rounded border text-sm font-semibold">
                Potential: {recommendation.potential_revenue > 0 ? "+" : ""}
                {recommendation.potential_revenue} TND
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Inventory Risk Alerts
          </CardTitle>
          <CardDescription>Stock risk based on real demand signals and order history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {payload.inventoryAlerts.length === 0 && (
            <p className="text-sm text-muted-foreground">No inventory alerts from current tracking data.</p>
          )}
          {payload.inventoryAlerts.map((alert) => (
            <div key={alert.product_id} className="rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{getProductName(alert.product_id)}</p>
                <Badge variant={alert.stock_status === "out_of_stock" ? "destructive" : "outline"}>
                  {alert.stock_status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{alert.reason}</p>
              <p className="text-xs mt-2">
                Demand signals: <span className="font-semibold">{alert.demand_signals}</span> • Revenue at risk:{" "}
                <span className="font-semibold">{alert.estimated_revenue_at_risk} TND</span>
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Customer Segments
          </CardTitle>
          <CardDescription>Segments inferred from real sessions and events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {payload.customerSegments.length === 0 && (
            <p className="text-sm text-muted-foreground">No segment output yet.</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {payload.customerSegments.map((segment) => (
              <div
                key={segment.name}
                className="p-4 border rounded-lg bg-gradient-to-br from-slate-50 to-transparent"
              >
                <h4 className="font-semibold text-sm mb-2">{segment.name}</h4>
                <p className="text-sm text-gray-700 mb-2">{segment.summary}</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {segment.indicators.map((indicator) => (
                    <li key={indicator}>• {indicator}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-green-600" />
            Recommended Actions
          </CardTitle>
          <CardDescription>Generated from current conversion and behavior signals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {payload.actionItems.length === 0 && (
            <p className="text-sm text-muted-foreground">No action items yet.</p>
          )}
          {payload.actionItems.map((item, index) => (
            <div key={`${index}-${item}`} className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {index + 1}
              </div>
              <p className="font-semibold text-sm">{item}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
