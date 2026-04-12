"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Leaf, Loader2, Package, Sparkles } from "lucide-react"
import { CartDropdown } from "@/components/cart-dropdown"
import { ChatWidget } from "@/components/chat-widget"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "@/hooks/use-cart"
import { useSessionTracking } from "@/hooks/use-session-tracking"
import { useSession } from "@/lib/auth-client"
import type { StoreProduct, StoreSettings } from "@/lib/store-types"
import type { UserDashboardInsightsResponse } from "@/lib/tracking-types"

interface StoreBootstrapResponse {
  settings: StoreSettings
  products: StoreProduct[]
  persisted: boolean
}

const fallbackSettings: StoreSettings = {
  store_name: "SmartSouk",
  store_description:
    "Discover handcrafted ceramics, woven rugs, and organic oils from Tunisia. Every piece tells a story of tradition.",
  contact_email: "contact@smartsouk.tn",
  hero_image_url: "",
  site_icon_url: "",
  feature_one_title: "100% Natural",
  feature_one_description: "Organic oils and natural materials",
  feature_two_title: "Worldwide Shipping",
  feature_two_description: "Delivery to your doorstep",
  feature_three_title: "Handcrafted",
  feature_three_description: "By skilled local artisans",
  updated_at: Date.now(),
}

function getCategoryEmoji(category: StoreProduct["category"]): string {
  if (category === "ceramics") {
    return "🏺"
  }

  if (category === "rugs") {
    return "🧶"
  }

  return "🫒"
}

function getStockBadgeLabel(status: StoreProduct["stock_status"]): string {
  if (status === "low_stock") {
    return "Low Stock"
  }
  if (status === "out_of_stock") {
    return "Out of Stock"
  }
  return "In Stock"
}

function toBackgroundImage(url: string): string {
  return `url("${url.replace(/"/g, '\\"')}")`
}

export default function StorefrontPage() {
  const { sessionId, currentPath, trackProductEvent, trackChatOpen } = useSessionTracking()
  const { data: session } = useSession()
  const { items: cartItems, addItem } = useCart()
  const [focusedProductId, setFocusedProductId] = useState<string | null>(null)
  const [settings, setSettings] = useState<StoreSettings>(fallbackSettings)
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loadingStore, setLoadingStore] = useState(true)
  const [statusMessage, setStatusMessage] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [userInsights, setUserInsights] = useState<UserDashboardInsightsResponse | null>(null)
  const viewedProductsRef = useRef<Set<string>>(new Set())

  const inStockProducts = useMemo(
    () => products.filter((product) => product.stock_status !== "out_of_stock"),
    [products]
  )

  const featuredProducts = useMemo(() => inStockProducts.slice(0, 8), [inStockProducts])

  const storefrontFeatures = useMemo(
    () => [
      {
        icon: Leaf,
        title: settings.feature_one_title?.trim() || "100% Natural",
        description:
          settings.feature_one_description?.trim() || "Organic oils and natural materials",
      },
      {
        icon: Package,
        title: settings.feature_two_title?.trim() || "Worldwide Shipping",
        description: settings.feature_two_description?.trim() || "Delivery to your doorstep",
      },
      {
        icon: Sparkles,
        title: settings.feature_three_title?.trim() || "Handcrafted",
        description: settings.feature_three_description?.trim() || "By skilled local artisans",
      },
    ],
    [
      settings.feature_one_description,
      settings.feature_one_title,
      settings.feature_three_description,
      settings.feature_three_title,
      settings.feature_two_description,
      settings.feature_two_title,
    ]
  )

  const cartQuantityByProductId = useMemo(() => {
    const byProduct = new Map<string, number>()
    for (const item of cartItems) {
      byProduct.set(item.product_id, (byProduct.get(item.product_id) ?? 0) + Math.max(1, item.quantity))
    }
    return byProduct
  }, [cartItems])

  const loadStoreData = async () => {
    setLoadingStore(true)
    try {
      const response = await fetch("/api/store/bootstrap", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })

      if (!response.ok) {
        setStatusMessage("Failed to load store data")
        return
      }

      const payload = (await response.json()) as StoreBootstrapResponse
      setSettings(payload.settings)
      setProducts(Array.isArray(payload.products) ? payload.products : [])
    } catch {
      setStatusMessage("Failed to load store data")
    } finally {
      setLoadingStore(false)
    }
  }

  useEffect(() => {
    void loadStoreData()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setIsAdmin(false)
      return
    }

    let active = true
    void fetch("/api/auth/is-admin", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json() as Promise<{ isAdmin?: boolean }>)
      .then((payload) => {
        if (!active) {
          return
        }
        setIsAdmin(Boolean(payload.isAdmin))
      })
      .catch(() => {
        if (active) {
          setIsAdmin(false)
        }
      })

    return () => {
      active = false
    }
  }, [session?.user])

  useEffect(() => {
    if (!session?.user || isAdmin) {
      setUserInsights(null)
      return
    }

    let active = true
    void fetch("/api/dashboard/insights", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          return null
        }
        return (await response.json()) as UserDashboardInsightsResponse
      })
      .then((payload) => {
        if (active) {
          setUserInsights(payload)
        }
      })
      .catch(() => {
        if (active) {
          setUserInsights(null)
        }
      })

    return () => {
      active = false
    }
  }, [isAdmin, session?.user])

  const recommendedProducts = useMemo(() => {
    if (!session?.user || isAdmin || inStockProducts.length === 0) {
      return [] as StoreProduct[]
    }

    const selected: StoreProduct[] = []
    const usedIds = new Set<string>()
    const primaryRecommendation = userInsights?.recommendation?.product_id
    const primaryProduct = primaryRecommendation
      ? inStockProducts.find((product) => product.id === primaryRecommendation)
      : undefined

    if (primaryProduct) {
      selected.push(primaryProduct)
      usedIds.add(primaryProduct.id)

      for (const product of inStockProducts) {
        if (selected.length >= 3) {
          break
        }

        if (usedIds.has(product.id)) {
          continue
        }

        if (product.category === primaryProduct.category) {
          selected.push(product)
          usedIds.add(product.id)
        }
      }
    }

    for (const product of inStockProducts) {
      if (selected.length >= 3) {
        break
      }

      if (usedIds.has(product.id)) {
        continue
      }

      selected.push(product)
      usedIds.add(product.id)
    }

    return selected
  }, [inStockProducts, isAdmin, session?.user, userInsights?.recommendation?.product_id])

  const handleProductHover = (productId: string) => {
    setFocusedProductId(productId)
    if (!viewedProductsRef.current.has(productId)) {
      viewedProductsRef.current.add(productId)
      trackProductEvent(productId, "product_view")
    }
  }

  const handleProductClick = (productId: string) => {
    setFocusedProductId(productId)
    trackProductEvent(productId, "click")
  }

  const handleAddToCart = (product: StoreProduct) => {
    if (product.stock_status === "out_of_stock") {
      return
    }

    setFocusedProductId(product.id)
    addItem(product.id, 1)
    trackProductEvent(product.id, "add_to_cart")
    setStatusMessage(`${product.name} added to cart.`)
  }

  const heroImageUrl = settings.hero_image_url?.trim() || ""

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            {settings.site_icon_url ? (
              <img src={settings.site_icon_url} alt="Store Icon" className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                {settings.store_name.charAt(0).toUpperCase() || "S"}
              </div>
            )}
            <span className="text-lg font-semibold">{settings.store_name}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#products" className="text-sm text-muted-foreground hover:text-foreground">
              Products
            </Link>
            {session?.user && !isAdmin ? (
              <Link href="#recommended" className="text-sm text-muted-foreground hover:text-foreground">
                For You
              </Link>
            ) : null}
            <Link href="#about" className="text-sm text-muted-foreground hover:text-foreground">
              About
            </Link>
            <Link href="#contact" className="text-sm text-muted-foreground hover:text-foreground">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            {isAdmin ? <Badge variant="secondary">Admin Mode</Badge> : <CartDropdown sessionId={sessionId} />}
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-14 md:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-balance">
              {settings.store_name}
            </h1>

            <div
              className="mt-5 overflow-hidden rounded-2xl border"
              style={
                heroImageUrl
                  ? {
                      backgroundImage: toBackgroundImage(heroImageUrl),
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              <div className={heroImageUrl ? "bg-black/45 px-6 py-10 md:px-8 md:py-14" : "bg-muted/40 px-6 py-10 md:px-8 md:py-14"}>
                <p
                  className={`text-lg text-balance ${
                    heroImageUrl ? "text-white" : "text-muted-foreground"
                  }`}
                >
                  {settings.store_description}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="#products">
                  Shop Collection <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/dashboard">For Business Owners</Link>
              </Button>
            </div>
            {statusMessage && <p className="mt-4 text-sm text-muted-foreground">{statusMessage}</p>}
          </div>
        </div>

        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </section>

      <section className="border-y bg-muted/30 py-12">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            {storefrontFeatures.map((feature) => (
              <Card key={feature.title} className="border-muted bg-background/70">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {session?.user && !isAdmin && recommendedProducts.length > 0 && (
        <section id="recommended" className="py-16">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Recommended for you</h2>
                <p className="mt-2 text-muted-foreground">
                  {userInsights?.recommendation?.reason ??
                    "Based on your browsing and order activity."}
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href="#products">View all products</Link>
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {recommendedProducts.map((product) => (
                <Card
                  key={`recommended-${product.id}`}
                  className="group overflow-hidden"
                  onMouseEnter={() => handleProductHover(product.id)}
                >
                  <div className="aspect-[4/3] bg-muted relative">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-muted via-muted/70 to-primary/10">
                        <span className="text-4xl">{getCategoryEmoji(product.category)}</span>
                        <span className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                          {product.category}
                        </span>
                      </div>
                    )}
                    <Badge className="absolute top-2 right-2" variant="secondary">
                      For You
                    </Badge>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <Link
                      href={`/articles/${product.id}`}
                      className="block"
                      onClick={() => handleProductClick(product.id)}
                    >
                      <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {product.description}
                      </p>
                    </Link>

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">{product.price_tnd} TND</span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/articles/${product.id}`} onClick={() => handleProductClick(product.id)}>
                            Article
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          disabled={product.stock_status === "out_of_stock"}
                          onClick={() => handleAddToCart(product)}
                        >
                          {cartQuantityByProductId.has(product.id)
                            ? `In Cart (${cartQuantityByProductId.get(product.id)})`
                            : "Add to Cart"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="products" className="py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Featured Products</h2>
            <p className="mt-2 text-muted-foreground">Browse articles and add products to your cart</p>
          </div>

          {loadingStore ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="group overflow-hidden"
                  onMouseEnter={() => handleProductHover(product.id)}
                >
                  <div className="aspect-square bg-muted relative">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-muted via-muted/70 to-primary/10">
                        <span className="text-5xl">{getCategoryEmoji(product.category)}</span>
                        <span className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                          {product.category}
                        </span>
                      </div>
                    )}
                    <Badge
                      variant={product.stock_status === "in_stock" ? "secondary" : "destructive"}
                      className="absolute top-2 right-2"
                    >
                      {getStockBadgeLabel(product.stock_status)}
                    </Badge>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <Link
                      href={`/articles/${product.id}`}
                      className="block"
                      onClick={() => handleProductClick(product.id)}
                    >
                      <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {product.description}
                      </p>
                    </Link>

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">{product.price_tnd} TND</span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/articles/${product.id}`} onClick={() => handleProductClick(product.id)}>
                            Article
                          </Link>
                        </Button>
                        {isAdmin ? (
                          <Button variant="secondary" size="sm" asChild>
                            <Link href="/dashboard/products">Manage</Link>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={product.stock_status === "out_of_stock"}
                            onClick={() => handleAddToCart(product)}
                          >
                            {cartQuantityByProductId.has(product.id)
                              ? `In Cart (${cartQuantityByProductId.get(product.id)})`
                              : "Add to Cart"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="about" className="border-t bg-muted/30 py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Our Story</h2>
            <p className="mt-4 text-muted-foreground">{settings.store_description}</p>
          </div>
        </div>
      </section>

      <footer id="contact" className="border-t py-12">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                {settings.store_name.charAt(0).toUpperCase() || "S"}
              </div>
              <span className="text-lg font-semibold">{settings.store_name}</span>
            </div>
            <p className="text-sm text-muted-foreground">Contact: {settings.contact_email}</p>
          </div>
        </div>
      </footer>

      <ChatWidget
        sessionId={sessionId}
        currentPageUrl={currentPath}
        activeProductId={focusedProductId}
        onOpen={trackChatOpen}
        storeName={settings.store_name}
      />
    </div>
  )
}
