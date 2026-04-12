"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Loader2, Package, TrendingUp, Users } from "lucide-react"
import type { TrackingStats } from "@/lib/tracking-types"
import type { StoreProduct, StoreSettings } from "@/lib/store-types"

const emptyStats: TrackingStats = {
  totalSessions: 0,
  totalEvents: 0,
  totalOrders: 0,
  totalRevenue: 0,
  avgSessionDuration: 0,
  revenuePerVisitor: 0,
  cartAbandonmentRate: 0,
  cartsStarted: 0,
  cartsAbandoned: 0,
}

interface StoreBootstrapResponse {
  settings?: StoreSettings
  products?: StoreProduct[]
}

interface TrackingResponse {
  stats?: TrackingStats
  orders?: Array<{ product_id: string; timestamp: number; price_paid: number }>
  error?: string
}

export default function DashboardPage() {
  const [storeName, setStoreName] = useState("SmartSouk")
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [stats, setStats] = useState<TrackingStats>(emptyStats)
  const [recentOrders, setRecentOrders] = useState<Array<{ product_id: string; timestamp: number; price_paid: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [storeResponse, trackingResponse] = await Promise.all([
          fetch("/api/store/bootstrap", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          }),
          fetch("/api/track", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          }),
        ])

        if (storeResponse.ok) {
          const storeBody = (await storeResponse.json()) as StoreBootstrapResponse
          const nextStoreName = storeBody.settings?.store_name?.trim()
          if (nextStoreName) {
            setStoreName(nextStoreName)
          }
          setProducts(Array.isArray(storeBody.products) ? storeBody.products : [])
        }

        if (trackingResponse.ok) {
          const trackingBody = (await trackingResponse.json()) as TrackingResponse
          setStats(trackingBody.stats ?? emptyStats)
          setRecentOrders(Array.isArray(trackingBody.orders) ? trackingBody.orders.slice(0, 5) : [])
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const statsCards = useMemo(
    () => [
      {
        name: "Total Products",
        value: String(products.length),
        icon: Package,
        change: `${products.filter((product) => product.stock_status === "in_stock").length} in stock`,
      },
      {
        name: "Total Revenue",
        value: `${stats.totalRevenue} TND`,
        icon: DollarSign,
        change: `${stats.totalOrders} confirmed orders`,
      },
      {
        name: "Website Visitors",
        value: String(stats.totalSessions),
        icon: Users,
        change: `${stats.totalEvents} tracked events`,
      },
      {
        name: "Conversion Rate",
        value: `${stats.totalSessions > 0 ? ((stats.totalOrders / stats.totalSessions) * 100).toFixed(1) : "0.0"}%`,
        icon: TrendingUp,
        change: `Cart abandonment ${stats.cartAbandonmentRate}%`,
      },
    ],
    [products, stats]
  )

  const productNameById = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products]
  )

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s an overview of your {storeName} business.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump into your most used features</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link
              href="/dashboard/marketing"
              className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Generate Marketing Campaign</p>
                <p className="text-sm text-muted-foreground">
                  Use AI to create social media content
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/products"
              className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Manage Products</p>
                <p className="text-sm text-muted-foreground">
                  View and update your product catalog
                </p>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates from your store</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent orders yet.</p>
              )}
              {recentOrders.map((order) => (
                <div key={`${order.product_id}-${order.timestamp}`} className="flex items-start gap-3">
                  <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">New order</p>
                    <p className="text-sm text-muted-foreground">
                      {productNameById.get(order.product_id) ?? "Unknown Product"} purchased for {order.price_paid} TND
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(order.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
