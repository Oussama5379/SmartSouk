"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  BarChart3,
  Home,
  Lightbulb,
  Loader2,
  LogOut,
  Menu,
  Megaphone,
  Package,
  Settings,
} from "lucide-react"
import { Toaster } from "@/components/ui/toaster"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { signOut, useSession } from "@/lib/auth-client"
import { isAdminDashboardRoute } from "@/lib/admin-routes"
import { readClientCache, writeClientCache } from "@/lib/client-cache"
import { cn } from "@/lib/utils"

const DASHBOARD_LAYOUT_CACHE_KEY = "dashboard:layout:v1"
const DASHBOARD_LAYOUT_CACHE_TTL_MS = 10 * 60 * 1000

interface DashboardLayoutCacheSnapshot {
  storeName: string
  siteIconUrl?: string
  isAdmin: boolean | null
}

const allNavigation = [
  { name: "Overview", href: "/dashboard", icon: Home, adminOnly: false },
  { name: "Products", href: "/dashboard/products", icon: Package, adminOnly: true },
  { name: "Marketing AI", href: "/dashboard/marketing", icon: Megaphone, adminOnly: true },
  { name: "Product Intel", href: "/dashboard/recommendations", icon: Lightbulb, adminOnly: true },
  { name: "User Tracking", href: "/dashboard/tracking", icon: Activity, adminOnly: true },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3, adminOnly: true },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, adminOnly: true },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const cachedSnapshot = useMemo(
    () => readClientCache<DashboardLayoutCacheSnapshot>(DASHBOARD_LAYOUT_CACHE_KEY, DASHBOARD_LAYOUT_CACHE_TTL_MS),
    []
  )
  const [storeName, setStoreName] = useState(cachedSnapshot?.storeName ?? "SmartSouk")
  const [siteIconUrl, setSiteIconUrl] = useState(cachedSnapshot?.siteIconUrl ?? "")
  const [signingOut, setSigningOut] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(cachedSnapshot?.isAdmin ?? null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const callbackURL = useMemo(() => {
    if (pathname?.startsWith("/dashboard")) return pathname
    return "/dashboard"
  }, [pathname])

  useEffect(() => {
    if (isPending || session) return
    router.replace(`/login?callbackURL=${encodeURIComponent(callbackURL)}`)
  }, [callbackURL, isPending, router, session])

  useEffect(() => {
    if (!session) return
    fetch("/api/auth/is-admin", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { isAdmin: boolean }) => setIsAdmin(data.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [session])

  useEffect(() => {
    if (!session || isAdmin !== false) return
    // Allow any logged in user to access admin routes during pitch
    // if (!isAdminDashboardRoute(pathname)) return
    // router.replace("/dashboard")
  }, [isAdmin, pathname, router, session])

  useEffect(() => {
    const loadStoreName = async () => {
      try {
        const res = await fetch("/api/store/settings", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })
        if (!res.ok) return
        const body = (await res.json()) as { settings?: { store_name?: string; site_icon_url?: string } }
        const name = body.settings?.store_name?.trim()
        if (name) setStoreName(name)
        const iconUrl = body.settings?.site_icon_url?.trim()
        if (iconUrl !== undefined) setSiteIconUrl(iconUrl)
      } catch {
        // Keep fallback store name.
      }
    }
    void loadStoreName()
  }, [])

  useEffect(() => {
    writeClientCache<DashboardLayoutCacheSnapshot>(DASHBOARD_LAYOUT_CACHE_KEY, {
      storeName,
      siteIconUrl,
      isAdmin,
    })
  }, [isAdmin, storeName, siteIconUrl])

  const navigation =
    isAdmin === null
      ? allNavigation.filter((item) => !item.adminOnly)
      : allNavigation.filter((item) => !item.adminOnly || isAdmin)

  // Disable blocking for pitch - allow any authenticated user to view the content
  const shouldBlockAdminRoute = false // isAdminDashboardRoute(pathname) && isAdmin !== true

  useEffect(() => {
    for (const item of navigation) {
      router.prefetch(item.href)
    }
  }, [navigation, router])

  if (isPending || !session || shouldBlockAdminRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const displayName =
    session.user.name?.trim() || session.user.email?.trim() || "Authenticated user"

  const handleSignOut = async () => {
    setSigningOut(true)
    const { error } = await signOut()
    if (error) {
      setSigningOut(false)
      return
    }
    router.replace("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r bg-card md:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6">
            <Link href="/" className="flex items-center gap-2">
              {siteIconUrl ? (
                <img src={siteIconUrl} alt="Store Icon" className="h-8 w-8 rounded-lg object-contain" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                  {storeName.charAt(0).toUpperCase() || "S"}
                </div>
              )}
              <span className="text-lg font-semibold">{storeName}</span>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="border-t p-4">
            <p className="mb-3 truncate text-xs text-muted-foreground">{displayName}</p>
            <Button
              variant="outline"
              className="mb-3 w-full justify-start"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Home className="h-4 w-4" />
              Back to Store
            </Link>
          </div>
        </div>
      </aside>

      <div className="md:ml-64">
        <header className="sticky top-0 z-30 border-b bg-card md:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              {siteIconUrl ? (
                <img src={siteIconUrl} alt="Store Icon" className="h-8 w-8 rounded-lg object-contain" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                  {storeName.charAt(0).toUpperCase() || "S"}
                </div>
              )}
              <span className="truncate text-base font-semibold">{storeName}</span>
            </Link>

            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open dashboard menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[86vw] max-w-[18rem] p-0">
                <SheetTitle className="sr-only">Dashboard Menu</SheetTitle>
                <div className="flex h-full flex-col">
                  <div className="border-b p-4">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                  </div>

                  <nav className="flex-1 space-y-1 p-4">
                    {navigation.map((item) => {
                      const isActive = pathname === item.href
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          prefetch
                          onClick={() => setMobileNavOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                          {item.name}
                        </Link>
                      )
                    })}
                  </nav>

                  <div className="space-y-3 border-t p-4">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => void handleSignOut()}
                      disabled={signingOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {signingOut ? "Signing out..." : "Sign out"}
                    </Button>
                    <Link
                      href="/"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Home className="h-4 w-4" />
                      Back to Store
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main>
          <div className="p-4 sm:p-6 md:p-8">{children}</div>
        </main>
      </div>

      <Toaster />
    </div>
  )
}
