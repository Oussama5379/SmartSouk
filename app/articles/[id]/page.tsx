"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react"
import { CartDropdown } from "@/components/cart-dropdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "@/hooks/use-cart"
import { useSessionTracking } from "@/hooks/use-session-tracking"
import type { StoreProduct, StoreSettings } from "@/lib/store-types"

interface StoreProductResponse {
  product?: StoreProduct
  error?: string
}

interface StoreSettingsResponse {
  settings: StoreSettings
}

const fallbackSettings: StoreSettings = {
  store_name: "SmartSouk",
  store_description: "Authentic Tunisian craftsmanship.",
  contact_email: "contact@smartsouk.tn",
  hero_image_url: "",
  updated_at: Date.now(),
}

function getCategoryLabel(category: StoreProduct["category"]): string {
  if (category === "ceramics") {
    return "Ceramics"
  }

  if (category === "rugs") {
    return "Rugs"
  }

  return "Oils"
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

export default function ArticlePage() {
  const params = useParams<{ id: string }>()
  const articleId = typeof params.id === "string" ? params.id.trim() : ""
  const { sessionId, trackProductEvent } = useSessionTracking()
  const { addItem } = useCart()

  const [settings, setSettings] = useState<StoreSettings>(fallbackSettings)
  const [product, setProduct] = useState<StoreProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const viewTrackedRef = useRef(false)

  useEffect(() => {
    const load = async () => {
      if (!articleId) {
        setLoading(false)
        setMessage("Invalid article id")
        return
      }

      setLoading(true)
      try {
        const [productResponse, settingsResponse] = await Promise.all([
          fetch(`/api/store/products/${articleId}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          }),
          fetch("/api/store/settings", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          }),
        ])

        const productBody = (await productResponse.json()) as StoreProductResponse
        if (!productResponse.ok || !productBody.product) {
          setMessage(productBody.error ?? "Article not found")
          setProduct(null)
          return
        }

        setProduct(productBody.product)

        if (settingsResponse.ok) {
          const settingsBody = (await settingsResponse.json()) as StoreSettingsResponse
          setSettings(settingsBody.settings)
        }
      } catch {
        setMessage("Failed to load article")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [articleId])

  useEffect(() => {
    if (!product || viewTrackedRef.current) {
      return
    }

    trackProductEvent(product.id, "product_view")
    viewTrackedRef.current = true
  }, [product, trackProductEvent])

  const handleAddToCart = () => {
    if (!product) {
      return
    }

    if (product.stock_status === "out_of_stock") {
      return
    }

    addItem(product.id, 1)
    trackProductEvent(product.id, "add_to_cart")
    setMessage(`${product.name} added to cart.`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container py-16 space-y-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Store
        </Link>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{message || "Article not found"}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Store
          </Link>
          <div className="flex items-center gap-3">
            <CartDropdown sessionId={sessionId} />
            <span className="text-sm text-muted-foreground">{settings.store_name}</span>
          </div>
        </div>
      </header>

      <main className="container py-10">
        <div className="grid gap-8 md:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="aspect-square bg-muted relative">
              {product.image ? (
                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-7xl text-muted-foreground/40">
                  {product.category === "ceramics" ? "🏺" : product.category === "rugs" ? "🧶" : "🫒"}
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-5">
            <Badge variant="outline">{getCategoryLabel(product.category)}</Badge>
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <p className="text-muted-foreground leading-relaxed">{product.description}</p>

            <div className="flex items-center gap-3">
              <Badge variant={product.stock_status === "in_stock" ? "secondary" : "destructive"}>
                {getStockBadgeLabel(product.stock_status)}
              </Badge>
              <span className="text-3xl font-bold">{product.price_tnd} TND</span>
            </div>

            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={product.stock_status === "out_of_stock"}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add to Cart
            </Button>

            {message && <p className="text-sm text-muted-foreground">{message}</p>}

            <p className="text-xs text-muted-foreground">Need help? Contact {settings.contact_email}</p>
          </div>
        </div>
      </main>
    </div>
  )
}
