'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"
import { Activity, Users, ShoppingCart, TrendingUp, Eye, Clock, Loader2 } from "lucide-react"
import { mockSessions, mockProductEvents, mockOrders, products } from "@/lib/mock-data"

export default function TrackingDashboard() {
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalEvents: 0,
    totalOrders: 0,
    totalRevenue: 0,
    avgSessionDuration: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Calculate statistics from mock data
    const totalRevenue = mockOrders.reduce((sum, o) => sum + o.price_paid, 0)
    const avgSessionDuration =
      mockSessions.length > 0
        ? mockSessions.reduce((sum, s) => sum + s.time_spent_ms, 0) / mockSessions.length / 1000 // Convert to seconds
        : 0

    setStats({
      totalSessions: mockSessions.length,
      totalEvents: mockProductEvents.length,
      totalOrders: mockOrders.length,
      totalRevenue,
      avgSessionDuration: Math.round(avgSessionDuration),
    })
    setLoading(false)
  }, [])

  const getProductName = (id: string) => {
    return products.find((p) => p.id === id)?.name || "Unknown Product"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User & Session Tracking</h1>
        <p className="text-muted-foreground mt-2">
          Real-time visitor behavior, product interest, and purchase analytics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">Total visitors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">Product interactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">Conversions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRevenue} TND</div>
            <p className="text-xs text-muted-foreground mt-1">Total generated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg. Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgSessionDuration}s</div>
            <p className="text-xs text-muted-foreground mt-1">Session time</p>
          </CardContent>
        </Card>
      </div>

      {/* Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>Recent visitor sessions and pages visited</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {mockSessions.map((session) => (
              <div key={session.id} className="p-3 rounded-lg border bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{session.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.user_type === "customer" && session.user_id
                        ? `Customer #${session.user_id}`
                        : "Guest"}
                    </p>
                  </div>
                  <Badge variant={session.user_type === "customer" ? "default" : "secondary"}>
                    {session.user_type}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {session.pages_visited.map((page) => (
                    <Badge key={page} variant="outline" className="text-xs">
                      {page}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Duration: {Math.round(session.time_spent_ms / 1000)}s • {new Date(session.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Product Interactions */}
      <Card>
        <CardHeader>
          <CardTitle>Product Interactions</CardTitle>
          <CardDescription>Views, clicks, and engagement metrics by product</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {mockProductEvents.map((event) => (
              <div key={event.id} className="p-3 rounded-lg border flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-sm">{getProductName(event.product_id)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {event.event_type}
                    </Badge>
                    {event.scroll_depth > 0 && (
                      <span className="text-xs text-muted-foreground">Scroll: {event.scroll_depth}%</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {event.time_spent_ms > 0 && `Time spent: ${Math.round(event.time_spent_ms / 1000)}s`}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conversions */}
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-green-600" />
            Completed Orders
          </CardTitle>
          <CardDescription>Purchase history and revenue tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {mockOrders.map((order) => (
              <div key={order.id} className="p-3 rounded-lg border bg-white">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{getProductName(order.product_id)}</p>
                    {order.user_id && (
                      <p className="text-xs text-muted-foreground">Customer: {order.user_id}</p>
                    )}
                  </div>
                  <Badge className="bg-green-600">{order.price_paid} TND</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Qty: {order.quantity} • {new Date(order.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.totalSessions > 0
                ? ((stats.totalOrders / stats.totalSessions) * 100).toFixed(1)
                : 0}
              %
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {stats.totalOrders} conversions from {stats.totalSessions} sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Average Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(1) : 0} TND
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Total revenue: {stats.totalRevenue} TND
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
