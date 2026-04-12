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
  Mail,
  Megaphone,
  Package,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut, useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const allNavigation = [
  { name: "Overview",          href: "/dashboard",                       icon: Home,      adminOnly: false },
  { name: "Products",          href: "/dashboard/products",              icon: Package,   adminOnly: true  },
  { name: "Marketing AI",      href: "/dashboard/marketing",             icon: Megaphone, adminOnly: true  },
  { name: "Product Intel",     href: "/dashboard/recommendations",       icon: Lightbulb, adminOnly: true  },
  { name: "Email Campaigns",   href: "/dashboard/email-campaigns",       icon: Mail,      adminOnly: true  },
  { name: "User Tracking",     href: "/dashboard/tracking",              icon: Activity,  adminOnly: true  },
  { name: "Analytics",         href: "/dashboard/analytics",             icon: BarChart3, adminOnly: true  },
  { name: "Settings",          href: "/dashboard/settings",              icon: Settings,  adminOnly: true  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [storeName, setStoreName] = useState("SmartSouk")
  const [signingOut, setSigningOut] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

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
    fetch("/api/auth/is-admin")
      .then((r) => r.json())
      .then((data: { isAdmin: boolean }) => setIsAdmin(data.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [session])

  useEffect(() => {
    const loadStoreName = async () => {
      try {
        const res = await fetch("/api/store/settings", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        })
        if (!res.ok) return
        const body = (await res.json()) as { settings?: { store_name?: string } }
        const name = body.settings?.store_name?.trim()
        if (name) setStoreName(name)
      } catch {
        // Keep fallback store name.
      }
    }
    void loadStoreName()
  }, [])

  if (isPending || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const navigation = isAdmin === null
    ? allNavigation.filter((item) => !item.adminOnly)
    : allNavigation.filter((item) => !item.adminOnly || isAdmin)

  const displayName =
    session.user.name?.trim() || session.user.email?.trim() || "Authenticated user"

  const handleSignOut = async () => {
    setSigningOut(true)
    const { error } = await signOut()
    if (error) { setSigningOut(false); return }
    router.replace("/login")
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                {storeName.charAt(0).toUpperCase() || "S"}
              </div>
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
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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

      <main className="ml-64 flex-1">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
