'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Users, Eye, MousePointerClick, Sparkles, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const weeklyData = [
  { day: "Mon", visitors: 120, sales: 8 },
  { day: "Tue", visitors: 145, sales: 12 },
  { day: "Wed", visitors: 167, sales: 15 },
  { day: "Thu", visitors: 189, sales: 11 },
  { day: "Fri", visitors: 234, sales: 18 },
  { day: "Sat", visitors: 278, sales: 24 },
  { day: "Sun", visitors: 198, sales: 16 },
]

const topProducts = [
  { name: "Handwoven Berber Rug", views: 342, conversions: 28 },
  { name: "Organic Olive Oil - 1L", views: 287, conversions: 45 },
  { name: "Nabeul Ceramic Vase", views: 234, conversions: 19 },
  { name: "Prickly Pear Seed Oil", views: 198, conversions: 22 },
]

const trafficSources = [
  { source: "Instagram", percentage: 45, color: "bg-pink-500" },
  { source: "Direct", percentage: 25, color: "bg-blue-500" },
  { source: "Google Search", percentage: 18, color: "bg-green-500" },
  { source: "Facebook", percentage: 12, color: "bg-indigo-500" },
]

export default function AnalyticsPage() {
  const [insights, setInsights] = useState<string>("")
  const [loadingInsights, setLoadingInsights] = useState(false)
  const maxVisitors = Math.max(...weeklyData.map((d) => d.visitors))

  const generateInsights = async () => {
    setLoadingInsights(true)
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analyticsData: {
            weeklyData,
            topProducts,
            trafficSources,
            metrics: {
              totalVisitors: 1331,
              pageViews: 4892,
              conversionRate: "3.2%",
              avgSession: "2m 45s",
            },
          },
        }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += decoder.decode(value, { stream: true })
        }
      }

      setInsights(fullText)
    } catch (error) {
      console.error("Error generating insights:", error)
      setInsights("Failed to generate insights")
    } finally {
      setLoadingInsights(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Track your store performance and customer insights.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Visitors
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,331</div>
            <p className="text-xs text-green-600">+12.5% from last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Page Views
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4,892</div>
            <p className="text-xs text-green-600">+8.2% from last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conversion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3.2%</div>
            <p className="text-xs text-green-600">+0.3% from last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Session
            </CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2m 45s</div>
            <p className="text-xs text-muted-foreground">Same as last week</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly Visitors Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Visitors</CardTitle>
            <CardDescription>Daily visitor count for the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-48">
              {weeklyData.map((data) => (
                <div key={data.day} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                    style={{
                      height: `${(data.visitors / maxVisitors) * 100}%`,
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{data.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Traffic Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Traffic Sources</CardTitle>
            <CardDescription>Where your visitors come from</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {trafficSources.map((source) => (
              <div key={source.source} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{source.source}</span>
                  <span className="font-medium">{source.percentage}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${source.color} rounded-full`}
                    style={{ width: `${source.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-transparent">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              AI-Powered Insights
            </CardTitle>
            <CardDescription>Smart recommendations based on your data</CardDescription>
          </div>
          <Button
            onClick={generateInsights}
            disabled={loadingInsights}
            size="sm"
            variant="default"
          >
            {loadingInsights ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Generate Insights"
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {insights ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap text-sm text-gray-700">{insights}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Click "Generate Insights" to get AI-powered recommendations for your business.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Products</CardTitle>
          <CardDescription>Products with the most views and conversions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div
                key={product.name}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="font-medium">{product.name}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <p className="font-medium">{product.views}</p>
                    <p className="text-xs text-muted-foreground">views</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">{product.conversions}</p>
                    <p className="text-xs text-muted-foreground">sales</p>
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
