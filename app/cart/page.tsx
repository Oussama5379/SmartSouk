"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCart } from "@/hooks/use-cart"
import { useSessionTracking } from "@/hooks/use-session-tracking"
import { useSession } from "@/lib/auth-client"
import type { StoreProduct } from "@/lib/store-types"

interface StoreProductsResponse {
  products?: StoreProduct[]
  error?: string
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

export default function CartPage() {
  const { sessionId } = useSessionTracking()
  const { data: session } = useSession()
  const { ready, items, setItemQuantity, removeItem, clearCart } = useCart()
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)
  const [message, setMessage] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)

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
        if (active) {
          setIsAdmin(Boolean(payload.isAdmin))
        }
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
    const loadProducts = async () => {
      setLoadingProducts(true)
      try {
        const response = await fetch("/api/store/products", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        })

        const body = (await response.json()) as StoreProductsResponse
        if (!response.ok) {
          setMessage(body.error ?? "Failed to load products.")
          return
        }

        setProducts(Array.isArray(body.products) ? body.products : [])
      } catch {
        setMessage("Failed to load products.")
      } finally {
        setLoadingProducts(false)
      }
    }

    void loadProducts()
  }, [])

  const itemsWithProduct = useMemo(() => {
    const resolved: Array<{ item: (typeof items)[number]; product: StoreProduct }> = []
    for (const item of items) {
      const product = products.find((entry) => entry.id === item.product_id)
      if (product) {
        resolved.push({ item, product })
      }
    }
    return resolved
  }, [items, products])

  const subtotal = useMemo(
    () =>
      Number(
        itemsWithProduct
          .reduce((sum, entry) => sum + entry.product.price_tnd * Math.max(1, entry.item.quantity), 0)
          .toFixed(2)
      ),
    [itemsWithProduct]
  )

  const handleCheckout = async () => {
    setMessage("")
    if (!sessionId) {
      setMessage("Session is not ready yet. Please try again.")
      return
    }

    if (itemsWithProduct.length === 0) {
      setMessage("Your cart is empty.")
      return
    }

    const outOfStock = itemsWithProduct.find((entry) => entry.product.stock_status === "out_of_stock")
    if (outOfStock) {
      setMessage(`${outOfStock.product.name} is out of stock.`)
      return
    }

    setCheckingOut(true)
    try {
      const response = await fetch("/api/store/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          items: itemsWithProduct.map((entry) => ({
            product_id: entry.product.id,
            quantity: Math.max(1, entry.item.quantity),
          })),
        }),
      })

      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setMessage(body.error ?? "Checkout failed.")
        return
      }

      clearCart()
      setMessage("Checkout completed successfully.")
    } catch {
      setMessage("Checkout failed.")
    } finally {
      setCheckingOut(false)
    }
  }

  if (!ready || loadingProducts) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-4 text-center">
          <h1 className="text-3xl font-bold">Cart is disabled for admin accounts</h1>
          <p className="mt-3 text-muted-foreground">
            Use the dashboard to manage products and orders from your own storefront.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Back to Store</Link>
            </Button>
          </div>
        </main>
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
          <p className="text-sm text-muted-foreground">Cart</p>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Your Cart</h1>
        </div>

        {itemsWithProduct.length === 0 ? (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm text-muted-foreground">Your cart is currently empty.</p>
              <Button asChild>
                <Link href="/">Browse products</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {itemsWithProduct.map((entry) => (
                  <div
                    key={entry.product.id}
                    className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="h-20 w-20 rounded-md overflow-hidden bg-muted relative shrink-0">
                      {entry.product.image ? (
                        <img
                          src={entry.product.image}
                          alt={entry.product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl text-muted-foreground/60">
                          {getCategoryEmoji(entry.product.category)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="font-semibold">{entry.product.name}</p>
                      <p className="text-sm text-muted-foreground">{entry.product.price_tnd} TND each</p>
                      <Badge variant="outline" className="mt-2">
                        {entry.product.stock_status.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setItemQuantity(entry.product.id, Math.max(1, entry.item.quantity - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-semibold">{entry.item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setItemQuantity(entry.product.id, entry.item.quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => removeItem(entry.product.id)}>
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Items</span>
                  <span>{itemsWithProduct.reduce((sum, entry) => sum + entry.item.quantity, 0)}</span>
                </div>
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{subtotal} TND</span>
                </div>
                <Button className="w-full" disabled={checkingOut} onClick={() => void handleCheckout()}>
                  {checkingOut ? "Processing..." : "Checkout"}
                </Button>
                {message && <p className="text-sm text-muted-foreground">{message}</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
