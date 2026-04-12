"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { StoreProduct, StoreStockStatus } from "@/lib/store-types"

interface StoreProductsResponse {
  products?: StoreProduct[]
  error?: string
}

const initialFormState = {
  name: "",
  category: "ceramics" as StoreProduct["category"],
  price_tnd: "",
  stock_status: "in_stock" as StoreStockStatus,
  description: "",
  image: "",
}

const categoryLabels = {
  ceramics: "Ceramics",
  rugs: "Rugs",
  oils: "Oils",
}

const stockLabels = {
  in_stock: { label: "In Stock", variant: "default" as const },
  low_stock: { label: "Low Stock", variant: "secondary" as const },
  out_of_stock: { label: "Out of Stock", variant: "destructive" as const },
}

export default function ProductsPage() {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [formState, setFormState] = useState(initialFormState)

  const totalProducts = products.length
  const inStock = products.filter((product) => product.stock_status === "in_stock").length
  const lowStock = products.filter((product) => product.stock_status === "low_stock").length

  const sortedProducts = useMemo(
    () =>
      [...products].sort((left, right) => {
        if ((right.updated_at ?? 0) !== (left.updated_at ?? 0)) {
          return (right.updated_at ?? 0) - (left.updated_at ?? 0)
        }
        return left.name.localeCompare(right.name)
      }),
    [products]
  )

  const loadProducts = async () => {
    setLoading(true)
    setErrorMessage("")

    try {
      const response = await fetch("/api/store/products", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })

      const body = (await response.json()) as StoreProductsResponse
      if (!response.ok) {
        setErrorMessage(body.error ?? "Failed to load products")
        return
      }

      setProducts(Array.isArray(body.products) ? body.products : [])
    } catch {
      setErrorMessage("Failed to load products")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProducts()
  }, [])

  const handleCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await fetch("/api/store/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
          price_tnd: Number(formState.price_tnd),
        }),
      })

      const body = (await response.json()) as { error?: string; product?: StoreProduct }
      if (!response.ok || !body.product) {
        setErrorMessage(body.error ?? "Failed to create product")
        return
      }

      setProducts((current) => [body.product as StoreProduct, ...current])
      setFormState(initialFormState)
      setSuccessMessage("Article added successfully")
    } catch {
      setErrorMessage("Failed to create product")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await fetch(`/api/store/products/${productId}`, {
        method: "DELETE",
      })

      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setErrorMessage(body.error ?? "Failed to delete product")
        return
      }

      setProducts((current) => current.filter((product) => product.id !== productId))
      setSuccessMessage("Article removed successfully")
    } catch {
      setErrorMessage("Failed to delete product")
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">Add, remove, and manage storefront articles.</p>
      </div>

      {errorMessage && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-sm text-green-700">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add New Article</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleCreateProduct(event)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Article name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price (TND)</Label>
                <Input
                  id="price"
                  type="number"
                  min="1"
                  step="0.01"
                  value={formState.price_tnd}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, price_tnd: event.target.value }))
                  }
                  placeholder="120"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formState.category}
                  onValueChange={(value) =>
                    setFormState((current) => ({
                      ...current,
                      category: value as StoreProduct["category"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ceramics">Ceramics</SelectItem>
                    <SelectItem value="rugs">Rugs</SelectItem>
                    <SelectItem value="oils">Oils</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Stock Status</Label>
                <Select
                  value={formState.stock_status}
                  onValueChange={(value) =>
                    setFormState((current) => ({
                      ...current,
                      stock_status: value as StoreStockStatus,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose stock status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="low_stock">Low Stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Describe this article"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Image URL (optional)</Label>
              <Input
                id="image"
                value={formState.image}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, image: event.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? "Adding..." : "Add Article"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{inStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{lowStock}</div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading products...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {product.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{categoryLabels[product.category]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{product.price_tnd} TND</TableCell>
                    <TableCell>
                      <Badge
                        variant={stockLabels[product.stock_status].variant}
                        className={cn(
                          product.stock_status === "in_stock" &&
                            "bg-green-100 text-green-800 hover:bg-green-100",
                          product.stock_status === "low_stock" &&
                            "bg-amber-100 text-amber-800 hover:bg-amber-100"
                        )}
                      >
                        {stockLabels[product.stock_status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDeleteProduct(product.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
