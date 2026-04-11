'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, AlertTriangle, Gift, Target, BarChart3, Lightbulb, Users, Package } from "lucide-react"
import { products } from "@/lib/mock-data"

interface Recommendation {
  type: "upsell" | "cross_sell" | "at_risk" | "top_performer"
  product_id: string
  reason: string
  confidence: number
  potential_revenue: number
}

const mockRecommendations: Recommendation[] = [
  {
    type: "cross_sell",
    product_id: "1",
    reason: "Customers buying Berber rugs often add ceramic vases. 3.2x likelihood.",
    confidence: 92,
    potential_revenue: 450,
  },
  {
    type: "upsell",
    product_id: "6",
    reason: "Prickly Pear Oil is premium offering. High-value customers respond well.",
    confidence: 87,
    potential_revenue: 320,
  },
  {
    type: "at_risk",
    product_id: "7",
    reason: "Guellala Plate: out of stock. Risk of losing 15% of annual demand.",
    confidence: 78,
    potential_revenue: -450,
  },
  {
    type: "top_performer",
    product_id: "3",
    reason: "Olive Oil: highest profit margin + repeat purchase rate 67%.",
    confidence: 95,
    potential_revenue: 1200,
  },
]

export default function ProductIntelligencePage() {
  const getRecommendationColor = (type: string) => {
    switch (type) {
      case "upsell":
        return "bg-green-50 border-green-200"
      case "cross_sell":
        return "bg-blue-50 border-blue-200"
      case "at_risk":
        return "bg-red-50 border-red-200"
      case "top_performer":
        return "bg-purple-50 border-purple-200"
      default:
        return "bg-gray-50"
    }
  }

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case "upsell":
        return <TrendingUp className="h-5 w-5 text-green-600" />
      case "cross_sell":
        return <Gift className="h-5 w-5 text-blue-600" />
      case "at_risk":
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      case "top_performer":
        return <BarChart3 className="h-5 w-5 text-purple-600" />
      default:
        return <Target className="h-5 w-5" />
    }
  }

  const getRecommendationLabel = (type: string) => {
    const labels = {
      upsell: "Upsell Opportunity",
      cross_sell: "Cross-Sell Opportunity",
      at_risk: "At-Risk Product",
      top_performer: "Top Performer",
    }
    return labels[type as keyof typeof labels] || "Recommendation"
  }

  const getProductName = (id: string) => {
    return products.find((p) => p.id === id)?.name || "Unknown Product"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Product Intelligence</h1>
        <p className="text-muted-foreground mt-2">
          AI-powered insights on product performance, opportunities, and customer segments
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upsell Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-green-600 mt-1">+$770 potential revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cross-Sell Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-blue-600 mt-1">Avg. conversion lift: 3.2x</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              At-Risk Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">1</div>
            <p className="text-xs text-red-600 mt-1">Restock urgently</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">Olive Oil</div>
            <p className="text-xs text-purple-600 mt-1">67% repeat rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockRecommendations.map((rec, idx) => (
          <Card
            key={idx}
            className={`border transition-all ${getRecommendationColor(rec.type)}`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getRecommendationIcon(rec.type)}
                  <div>
                    <CardTitle className="text-base">
                      {getProductName(rec.product_id)}
                    </CardTitle>
                    <Badge variant="outline" className="mt-2">
                      {getRecommendationLabel(rec.type)}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{rec.confidence}%</div>
                  <p className="text-xs text-muted-foreground">confidence</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">{rec.reason}</p>
              <div className="mt-3 p-2 bg-white rounded border text-sm font-semibold">
                Potential: {rec.potential_revenue > 0 ? "+" : ""} ${rec.potential_revenue} TND
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Market Segments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Customer Segments & Behavior
          </CardTitle>
          <CardDescription>Behavior patterns and purchase preferences by segment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg bg-gradient-to-br from-orange-50 to-transparent">
              <h4 className="font-semibold text-sm mb-2">Ceramics Buyers</h4>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• Avg. order value: $65 TND</li>
                <li>• Repeat purchase: 45%</li>
                <li>• Top interest: Decorative pieces</li>
                <li>• Best channel: Instagram</li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg bg-gradient-to-br from-amber-50 to-transparent">
              <h4 className="font-semibold text-sm mb-2">Rug Buyers</h4>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• Avg. order value: $185 TND</li>
                <li>• Repeat purchase: 28%</li>
                <li>• Top interest: Authentic pieces</li>
                <li>• Best channel: Direct</li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg bg-gradient-to-br from-rose-50 to-transparent">
              <h4 className="font-semibold text-sm mb-2">Oil/Beauty Buyers</h4>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• Avg. order value: $80 TND</li>
                <li>• Repeat purchase: 67%</li>
                <li>• Top interest: Premium oils</li>
                <li>• Best channel: Reviews</li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg bg-gradient-to-br from-slate-50 to-transparent">
              <h4 className="font-semibold text-sm mb-2">Business Buyers</h4>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• Avg. order value: $450 TND</li>
                <li>• Repeat purchase: 89%</li>
                <li>• Top interest: Bulk orders</li>
                <li>• Best channel: Email</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Items */}
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-green-600" />
            Recommended Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-semibold text-sm">Restock Guellala Ceramic Plate immediately</p>
              <p className="text-xs text-muted-foreground">
                Out of stock. High demand signals. Est. $450 lost revenue.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              2
            </div>
            <div>
              <p className="font-semibold text-sm">Launch Prickly Pear Oil to premium segment</p>
              <p className="text-xs text-muted-foreground">
                Target high-value customers. Expected lift: 35-45% conversion increase.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              3
            </div>
            <div>
              <p className="font-semibold text-sm">Create Rug + Ceramic Vase bundle</p>
              <p className="text-xs text-muted-foreground">
                Cross-sell opportunity. 3.2x conversion likelihood. Est. $350+ per bundle.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
