"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  DollarSign,
  Loader2,
  Package,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { readClientCache, writeClientCache } from "@/lib/client-cache"
import type { StoreProduct, StoreSettings } from "@/lib/store-types"
import type { TrackingStats, UserDashboardInsightsResponse } from "@/lib/tracking-types"

const DASHBOARD_OVERVIEW_CACHE_KEY = "dashboard:overview:v2"
const DASHBOARD_OVERVIEW_CACHE_MAX_AGE_MS = 5 * 60 * 1000

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

const emptyUserInsights: UserDashboardInsightsResponse = {
  generatedAt: "",
  cacheHit: false,
  cachedUntil: "",
  totalSpentTnd: 0,
  totalOrders: 0,
  avgOrderValueTnd: 0,
  mostBoughtItem: null,
  recommendation: null,
  recentPurchases: [],
  spendingByCategory: [],
}

interface StoreBootstrapResponse {
  settings?: StoreSettings
  products?: StoreProduct[]
}

interface TrackingOrder {
  product_id: string
  timestamp: number
  price_paid: number
}

interface TrackingResponse {
  stats?: TrackingStats
  orders?: TrackingOrder[]
  error?: string
}

interface AdminStatusResponse {
  isAdmin?: boolean
}

interface DashboardOverviewCacheSnapshot {
  storeName: string
  products: StoreProduct[]
  stats: TrackingStats
  recentOrders: TrackingOrder[]
  userInsights: UserDashboardInsightsResponse
  isAdmin: boolean | null
}

function normalizeUserInsights(
  value: Partial<UserDashboardInsightsResponse> | null | undefined
): UserDashboardInsightsResponse {
  if (!value) {
    return emptyUserInsights
  }

  return {
    ...emptyUserInsights,
    ...value,
    recentPurchases: Array.isArray(value.recentPurchases) ? value.recentPurchases : [],
    spendingByCategory: Array.isArray(value.spendingByCategory) ? value.spendingByCategory : [],
  }
}

export default function DashboardPage() {
  const cachedSnapshot = useMemo(
    () =>
      readClientCache<DashboardOverviewCacheSnapshot>(
        DASHBOARD_OVERVIEW_CACHE_KEY,
        DASHBOARD_OVERVIEW_CACHE_MAX_AGE_MS
      ),
    []
  )

  const [storeName, setStoreName] = useState(cachedSnapshot?.storeName ?? "SmartSouk")
  const [products, setProducts] = useState<StoreProduct[]>(cachedSnapshot?.products ?? [])
  const [stats, setStats] = useState<TrackingStats>(cachedSnapshot?.stats ?? emptyStats)
  const [recentOrders, setRecentOrders] = useState<TrackingOrder[]>(cachedSnapshot?.recentOrders ?? [])
  const [userInsights, setUserInsights] = useState<UserDashboardInsightsResponse>(
    normalizeUserInsights(cachedSnapshot?.userInsights)
  )
  const [isAdmin, setIsAdmin] = useState<boolean | null>(cachedSnapshot?.isAdmin ?? null)
  const [loading, setLoading] = useState(!cachedSnapshot)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = async (options?: { background?: boolean }) => {
    if (!options?.background) {
      setLoading(true)
    }
    setErrorMessage(null)

    let nextStoreName = storeName
    let nextProducts = products
    let nextStats = stats
    let nextRecentOrders = recentOrders
    let nextUserInsights = userInsights
    let nextIsAdmin = isAdmin

    try {
      const [storeResponse, adminResponse, insightsResponse] = await Promise.all([
        fetch("/api/store/bootstrap", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }),
        fetch("/api/auth/is-admin", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }),
        fetch("/api/dashboard/insights", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }),
      ])

      if (storeResponse.ok) {
        const storeBody = (await storeResponse.json()) as StoreBootstrapResponse
        const nextName = storeBody.settings?.store_name?.trim()
        if (nextName) {
          nextStoreName = nextName
        }
        nextProducts = Array.isArray(storeBody.products) ? storeBody.products : []
      }

      if (adminResponse.ok) {
        const adminBody = (await adminResponse.json()) as AdminStatusResponse
        nextIsAdmin = !!adminBody.isAdmin
      } else if (nextIsAdmin === null) {
        nextIsAdmin = false
      }

      if (insightsResponse.ok) {
        const insightsBody = (await insightsResponse.json()) as Partial<UserDashboardInsightsResponse>
        nextUserInsights = normalizeUserInsights(insightsBody)
      }

      if (nextIsAdmin) {
        const trackingResponse = await fetch("/api/track", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })

        if (trackingResponse.ok) {
          const trackingBody = (await trackingResponse.json()) as TrackingResponse
          nextStats = trackingBody.stats ?? emptyStats
          nextRecentOrders = Array.isArray(trackingBody.orders) ? trackingBody.orders.slice(0, 5) : []
        }
      } else {
        nextStats = emptyStats
        nextRecentOrders = []
      }

      setStoreName(nextStoreName)
      setProducts(nextProducts)
      setStats(nextStats)
      setRecentOrders(nextRecentOrders)
      setUserInsights(nextUserInsights)
      setIsAdmin(nextIsAdmin)

      writeClientCache<DashboardOverviewCacheSnapshot>(DASHBOARD_OVERVIEW_CACHE_KEY, {
        storeName: nextStoreName,
        products: nextProducts,
        stats: nextStats,
        recentOrders: nextRecentOrders,
        userInsights: nextUserInsights,
        isAdmin: nextIsAdmin,
      })
    } catch {
      setErrorMessage("Failed to load dashboard data.")
    } finally {
      if (!options?.background) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void load({ background: !!cachedSnapshot })
  }, [cachedSnapshot])

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

  const topCategory =
    userInsights.spendingByCategory.length > 0 ? userInsights.spendingByCategory[0] : null

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isAdmin) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of your {storeName} business.
          </p>
        </div>

        {errorMessage && (
          <Card className="border-destructive/40">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{errorMessage}</p>
            </CardContent>
          </Card>
        )}

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

        <div className="grid gap-6 md:grid-cols-2">
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
                  <p className="text-sm text-muted-foreground">Use AI to create social media content</p>
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
                  <p className="text-sm text-muted-foreground">View and update your product catalog</p>
                </div>
              </Link>
            </CardContent>
          </Card>

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
                        {productNameById.get(order.product_id) ?? "Unknown Product"} purchased for{" "}
                        {order.price_paid} TND
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.timestamp).toLocaleString()}
                      </p>
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Dashboard</h1>
        <p className="text-muted-foreground">
          Your purchases, spending behavior, and personalized picks from {storeName}.
        </p>
      </div>

      {errorMessage && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userInsights.totalSpentTnd} TND</div>
            <p className="text-xs text-muted-foreground">Across {userInsights.totalOrders} purchased items</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userInsights.avgOrderValueTnd} TND</div>
            <p className="text-xs text-muted-foreground">Per completed checkout line</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
              Favorite Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topCategory?.category ?? "N/A"}</div>
            <p className="text-xs text-muted-foreground">
              {topCategory
                ? `${topCategory.quantity} items • ${topCategory.spent_tnd} TND spent`
                : "Start purchasing to build category insights."}
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Most Bought Item</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold">
              {userInsights.mostBoughtItem?.product_name ?? "No purchase data yet"}
            </div>
            <p className="text-xs text-muted-foreground">
              {userInsights.mostBoughtItem
                ? `${userInsights.mostBoughtItem.quantity} units • ${userInsights.mostBoughtItem.spent_tnd} TND`
                : "Complete purchases to unlock this insight."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-600" />
              Recommended For You
            </CardTitle>
            <CardDescription>Personalized from your spending and browsing behavior.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-semibold">
              {userInsights.recommendation?.product_name ?? "No recommendation yet"}
            </div>
            <p className="text-sm text-muted-foreground">
              {userInsights.recommendation?.reason ??
                "We’ll recommend products once we detect enough activity."}
            </p>
            {userInsights.cachedUntil && (
              <p className="text-xs text-muted-foreground">
                Updated every 12h • Next refresh after{" "}
                {new Date(userInsights.cachedUntil).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Spending</CardTitle>
            <CardDescription>Where most of your budget has gone so far.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {userInsights.spendingByCategory.length === 0 && (
              <p className="text-sm text-muted-foreground">No category spending data yet.</p>
            )}
            {userInsights.spendingByCategory.map((entry) => (
              <div key={entry.category} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-semibold">{entry.category}</p>
                  <p className="text-xs text-muted-foreground">{entry.quantity} items purchased</p>
                </div>
                <p className="text-sm font-semibold">{entry.spent_tnd} TND</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Purchases</CardTitle>
          <CardDescription>Your latest order activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userInsights.recentPurchases.length === 0 && (
            <p className="text-sm text-muted-foreground">No purchases yet.</p>
          )}
          {userInsights.recentPurchases.map((purchase) => (
            <div key={purchase.order_id} className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="font-medium">{purchase.product_name}</p>
                <p className="text-sm text-muted-foreground">
                  Qty {purchase.quantity} • {purchase.spent_tnd} TND
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(purchase.purchased_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Continue shopping
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
