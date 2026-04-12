"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

export interface CartItem {
  product_id: string
  quantity: number
  added_at: number
}

const CART_STORAGE_KEY = "aurea_cart_items"

function normalizeQuantity(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1
  }
  return Math.min(99, Math.floor(parsed))
}

function normalizeCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  const nextItems: CartItem[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue
    }
    const item = entry as Partial<CartItem>
    const productId = typeof item.product_id === "string" ? item.product_id.trim() : ""
    if (!productId) {
      continue
    }
    nextItems.push({
      product_id: productId,
      quantity: normalizeQuantity(item.quantity),
      added_at: typeof item.added_at === "number" && Number.isFinite(item.added_at) ? item.added_at : Date.now(),
    })
  }

  return nextItems
}

function readCartItems(): CartItem[] {
  if (typeof window === "undefined") {
    return []
  }

  const raw = window.localStorage.getItem(CART_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    return normalizeCartItems(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeCartItems(items: CartItem[]) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const current = readCartItems()
    setItems(current)
    setReady(true)
  }, [])

  useEffect(() => {
    const syncFromStorage = () => {
      setItems(readCartItems())
    }

    window.addEventListener("storage", syncFromStorage)
    return () => {
      window.removeEventListener("storage", syncFromStorage)
    }
  }, [])

  const updateItems = useCallback((updater: (current: CartItem[]) => CartItem[]) => {
    setItems((current) => {
      const next = normalizeCartItems(updater(current))
      writeCartItems(next)
      return next
    })
  }, [])

  const addItem = useCallback(
    (productId: string, quantity = 1) => {
      const normalizedProductId = productId.trim()
      if (!normalizedProductId) {
        return
      }

      updateItems((current) => {
        const existing = current.find((item) => item.product_id === normalizedProductId)
        if (!existing) {
          return [
            {
              product_id: normalizedProductId,
              quantity: normalizeQuantity(quantity),
              added_at: Date.now(),
            },
            ...current,
          ]
        }

        return current.map((item) =>
          item.product_id === normalizedProductId
            ? {
                ...item,
                quantity: normalizeQuantity(item.quantity + quantity),
              }
            : item
        )
      })
    },
    [updateItems]
  )

  const removeItem = useCallback(
    (productId: string) => {
      const normalizedProductId = productId.trim()
      if (!normalizedProductId) {
        return
      }
      updateItems((current) => current.filter((item) => item.product_id !== normalizedProductId))
    },
    [updateItems]
  )

  const setItemQuantity = useCallback(
    (productId: string, quantity: number) => {
      const normalizedProductId = productId.trim()
      if (!normalizedProductId) {
        return
      }

      const normalizedQuantity = normalizeQuantity(quantity)
      updateItems((current) =>
        current.map((item) =>
          item.product_id === normalizedProductId
            ? {
                ...item,
                quantity: normalizedQuantity,
              }
            : item
        )
      )
    },
    [updateItems]
  )

  const clearCart = useCallback(() => {
    updateItems(() => [])
  }, [updateItems])

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0),
    [items]
  )

  return {
    ready,
    items,
    totalItems,
    addItem,
    removeItem,
    setItemQuantity,
    clearCart,
  }
}
