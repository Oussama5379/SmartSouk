"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Leaf, Loader2, Package, Sparkles } from "lucide-react"
import { ChatWidget } from "@/components/chat-widget"
import { RecommendedSection } from "@/components/recommended-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useSessionTracking } from "@/hooks/use-session-tracking"
import type { StoreProduct, StoreSettings } from "@/lib/store-types"

const PURCHASED_STORAGE_KEY = "aurea_purchased_product_ids"

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
  const [focusedProductId, setFocusedProductId] = useState<string | null>(null)
  const [settings, setSettings] = useState<StoreSettings>(fallbackSettings)
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loadingStore, setLoadingStore] = useState(true)
  const [statusMessage, setStatusMessage] = useState("")
  const [checkoutProductId, setCheckoutProductId] = useState<string | null>(null)
  const [buyingProductId, setBuyingProductId] = useState<string | null>(null)
  const [purchasedProductIds, setPurchasedProductIds] = useState<Set<string>>(new Set())
  const viewedProductsRef = useRef<Set<string>>(new Set())

  const featuredProducts = useMemo(
    () => products.filter((product) => product.stock_status !== "out_of_stock").slice(0, 8),
    [products]
  )

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
    if (typeof window === "undefined") {
      return
    }

    try {
      const raw = window.localStorage.getItem(PURCHASED_STORAGE_KEY)
      if (!raw) {
        return
      }

      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        return
      }

      const normalized = parsed.filter((value): value is string => typeof value === "string")
      setPurchasedProductIds(new Set(normalized))
    } catch {
      // Ignore invalid local storage payload.
    }
  }, [])

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

  const handleBuyClick = (product: StoreProduct) => {
    if (product.stock_status === "out_of_stock") {
      return
    }

    setFocusedProductId(product.id)
    setCheckoutProductId(product.id)
    trackProductEvent(product.id, "add_to_cart")
    setStatusMessage(`${product.name} is ready. Click Pay to complete instantly.`)
  }

  const handlePayNow = async (product: StoreProduct) => {
    if (!sessionId) {
      setStatusMessage("Session is not ready yet. Please try again.")
      return
    }

    setBuyingProductId(product.id)
    setFocusedProductId(product.id)
    trackProductEvent(product.id, "add_to_cart")

    try {
      const response = await fetch("/api/store/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          product_id: product.id,
          quantity: 1,
        }),
      })

      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setStatusMessage(body.error ?? "Purchase failed")
        return
      }

      const nextPurchased = new Set(purchasedProductIds)
      nextPurchased.add(product.id)
      setPurchasedProductIds(nextPurchased)
      setCheckoutProductId(null)

      if (typeof window !== "undefined") {
        window.localStorage.setItem(PURCHASED_STORAGE_KEY, JSON.stringify(Array.from(nextPurchased)))
      }

      setStatusMessage(`${product.name} purchased successfully.`)
    } catch {
      setStatusMessage("Purchase failed")
    } finally {
      setBuyingProductId(null)
    }
  }

  const heroImageUrl = settings.hero_image_url?.trim() || ""

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              {settings.store_name.charAt(0).toUpperCase() || "S"}
            </div>
            <span className="text-lg font-semibold">{settings.store_name}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#products" className="text-sm text-muted-foreground hover:text-foreground">
              Products
            </Link>
            <Link href="#about" className="text-sm text-muted-foreground hover:text-foreground">
              About
            </Link>
            <Link href="#contact" className="text-sm text-muted-foreground hover:text-foreground">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-24 md:py-32">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              Authentic Tunisian Craftsmanship
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-balance">
              {settings.store_name}
            </h1>

            <div
              className="mt-6 overflow-hidden rounded-xl border"
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
              <div className={heroImageUrl ? "bg-black/45 p-6" : "bg-muted/40 p-6"}>
                <p
                  className={`text-lg text-balance ${
                    heroImageUrl ? "text-white" : "text-muted-foreground"
                  }`}
                >
                  {settings.store_description}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
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
        <div className="container">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Leaf className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">100% Natural</h3>
                <p className="text-sm text-muted-foreground">Organic oils and natural materials</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Worldwide Shipping</h3>
                <p className="text-sm text-muted-foreground">Delivery to your doorstep</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Handcrafted</h3>
                <p className="text-sm text-muted-foreground">By skilled local artisans</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="products" className="py-20">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Featured Products</h2>
            <p className="mt-2 text-muted-foreground">Browse articles and buy directly from the catalog</p>
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
                    <div className="absolute inset-0 flex items-center justify-center text-4xl text-muted-foreground/30">
                      {getCategoryEmoji(product.category)}
                    </div>
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
                        <Button
                          size="sm"
                          disabled={
                            product.stock_status === "out_of_stock" ||
                            purchasedProductIds.has(product.id) ||
                            (buyingProductId !== null && buyingProductId === product.id)
                          }
                          onClick={() => handleBuyClick(product)}
                        >
                          {purchasedProductIds.has(product.id) ? "Bought" : "Buy"}
                        </Button>

                        {checkoutProductId === product.id && !purchasedProductIds.has(product.id) && (
                          <Button
                            size="sm"
                            disabled={buyingProductId === product.id}
                            onClick={() => void handlePayNow(product)}
                          >
                            {buyingProductId === product.id ? "Paying..." : "Pay"}
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

      <RecommendedSection />

      <section id="about" className="border-t bg-muted/30 py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Our Story</h2>
            <p className="mt-4 text-muted-foreground">{settings.store_description}</p>
          </div>
        </div>
      </section>

      <footer id="contact" className="border-t py-12">
        <div className="container">
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
