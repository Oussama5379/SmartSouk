import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, TrendingUp, Users, DollarSign } from "lucide-react"
import Link from "next/link"

const stats = [
  { name: "Total Products", value: "8", icon: Package, change: "+2 this week" },
  { name: "Total Revenue", value: "2,450 TND", icon: DollarSign, change: "+12% from last month" },
  { name: "Website Visitors", value: "1,234", icon: Users, change: "+8% from last week" },
  { name: "Conversion Rate", value: "3.2%", icon: TrendingUp, change: "+0.5% from last month" },
]

const recentActivities = [
  { id: 1, action: "New order", description: "Handwoven Berber Rug purchased", time: "2 hours ago" },
  { id: 2, action: "Low stock alert", description: "Sejnane Pottery Bowl Set - only 3 left", time: "5 hours ago" },
  { id: 3, action: "New review", description: "5-star review on Organic Olive Oil", time: "1 day ago" },
  { id: 4, action: "Campaign completed", description: "Summer Sale campaign ended", time: "2 days ago" },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s an overview of your SmartSouk business.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
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
