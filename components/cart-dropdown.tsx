"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCart } from "@/hooks/use-cart"
import { readClientCache, writeClientCache } from "@/lib/client-cache"
import type { StoreProduct } from "@/lib/store-types"

interface CartDropdownProps {
  sessionId: string
}

interface StoreProductsResponse {
  products?: StoreProduct[]
  error?: string
}

const CART_PRODUCTS_CACHE_KEY = "store:products:v1"
const CART_PRODUCTS_CACHE_MAX_AGE_MS = 5 * 60 * 1000

function getCategoryEmoji(category: StoreProduct["category"]): string {
  if (category === "ceramics") {
    return "🏺"
  }
  if (category === "rugs") {
    return "🧶"
  }
  return "🫒"
}

export function CartDropdown({ sessionId }: CartDropdownProps) {
  const cachedProducts = useMemo(
    () => readClientCache<StoreProduct[]>(CART_PRODUCTS_CACHE_KEY, CART_PRODUCTS_CACHE_MAX_AGE_MS),
    []
  )

  const { ready, items, totalItems, setItemQuantity, removeItem, clearCart } = useCart()
  const [products, setProducts] = useState<StoreProduct[]>(cachedProducts ?? [])
  const [loadingProducts, setLoadingProducts] = useState(!cachedProducts)
  const [checkingOut, setCheckingOut] = useState(false)
  const [message, setMessage] = useState("")

  const loadProducts = async (options?: { background?: boolean }) => {
    if (!options?.background) {
      setLoadingProducts(true)
    }

    try {
      const response = await fetch("/api/store/products", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      const body = (await response.json()) as StoreProductsResponse
      if (!response.ok) {
        setMessage(body.error ?? "Failed to load products.")
        return
      }

      const nextProducts = Array.isArray(body.products) ? body.products : []
      setProducts(nextProducts)
      writeClientCache<StoreProduct[]>(CART_PRODUCTS_CACHE_KEY, nextProducts)
    } catch {
      setMessage("Failed to load products.")
    } finally {
      if (!options?.background) {
        setLoadingProducts(false)
      }
    }
  }

  useEffect(() => {
    void loadProducts({ background: !!cachedProducts })
  }, [cachedProducts])

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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ShoppingCart className="h-4 w-4" />
          Cart
          <Badge variant="secondary">{totalItems}</Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[26rem] p-0">
        <div className="border-b px-4 py-3">
          <p className="font-semibold">Your Cart</p>
          <p className="text-xs text-muted-foreground">{totalItems} item(s)</p>
        </div>

        {!ready || loadingProducts ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {itemsWithProduct.length === 0 ? (
              <p className="text-sm text-muted-foreground">Your cart is currently empty.</p>
            ) : (
              <>
                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {itemsWithProduct.map((entry) => (
                    <div key={entry.product.id} className="rounded-lg border p-3">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted relative">
                          {entry.product.image ? (
                            <img
                              src={entry.product.image}
                              alt={entry.product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-xl text-muted-foreground/60">
                              {getCategoryEmoji(entry.product.category)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="line-clamp-1 text-sm font-semibold">{entry.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.product.price_tnd} TND each
                          </p>
                          <p className="text-xs font-medium mt-1">
                            {(entry.product.price_tnd * Math.max(1, entry.item.quantity)).toFixed(2)} TND
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeItem(entry.product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            setItemQuantity(entry.product.id, Math.max(1, entry.item.quantity - 1))
                          }
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold">{entry.item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setItemQuantity(entry.product.id, entry.item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-semibold">{subtotal} TND</span>
                  </div>
                  <Button
                    className="mt-3 w-full"
                    disabled={checkingOut}
                    onClick={() => void handleCheckout()}
                  >
                    {checkingOut ? "Processing..." : "Checkout"}
                  </Button>
                </div>
              </>
            )}

            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
