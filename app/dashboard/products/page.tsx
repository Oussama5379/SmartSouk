"use client"

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react"
import { Edit3, Trash2, Upload } from "lucide-react"
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
import { readClientCache, writeClientCache } from "@/lib/client-cache"
import { cn } from "@/lib/utils"
import type { StoreProduct, StoreStockStatus } from "@/lib/store-types"

interface StoreProductsResponse {
  products?: StoreProduct[]
  error?: string
}

interface ProductFormState {
  name: string
  category: StoreProduct["category"]
  price_tnd: string
  stock_status: StoreStockStatus
  description: string
  image: string
}

const MAX_UPLOAD_SIZE_BYTES = 3_000_000

const initialFormState: ProductFormState = {
  name: "",
  category: "ceramics",
  price_tnd: "",
  stock_status: "in_stock",
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

const PRODUCTS_CACHE_KEY = "dashboard:products:v1"
const PRODUCTS_CACHE_MAX_AGE_MS = 5 * 60 * 1000

function toFormState(product: StoreProduct): ProductFormState {
  return {
    name: product.name,
    category: product.category,
    price_tnd: String(product.price_tnd),
    stock_status: product.stock_status,
    description: product.description,
    image: product.image ?? "",
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = reader.result
      if (typeof value === "string" && value.startsWith("data:image/")) {
        resolve(value)
        return
      }
      reject(new Error("Invalid image file."))
    }
    reader.onerror = () => reject(new Error("Failed to read image file."))
    reader.readAsDataURL(file)
  })
}

export default function ProductsPage() {
  const cachedProducts = useMemo(
    () => readClientCache<StoreProduct[]>(PRODUCTS_CACHE_KEY, PRODUCTS_CACHE_MAX_AGE_MS),
    []
  )
  const [products, setProducts] = useState<StoreProduct[]>(cachedProducts ?? [])
  const [loading, setLoading] = useState(!cachedProducts)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [formState, setFormState] = useState<ProductFormState>(initialFormState)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editFormState, setEditFormState] = useState<ProductFormState>(initialFormState)

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

  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingProductId) ?? null,
    [products, editingProductId]
  )

  const loadProducts = async (options?: { background?: boolean }) => {
    if (!options?.background) {
      setLoading(true)
    }
    setErrorMessage("")

    try {
      const response = await fetch("/api/store/products", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      const body = (await response.json()) as StoreProductsResponse
      if (!response.ok) {
        setErrorMessage(body.error ?? "Failed to load products")
        return
      }

      const nextProducts = Array.isArray(body.products) ? body.products : []
      setProducts(nextProducts)
      writeClientCache<StoreProduct[]>(PRODUCTS_CACHE_KEY, nextProducts)
    } catch {
      setErrorMessage("Failed to load products")
    } finally {
      if (!options?.background) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadProducts({ background: !!cachedProducts })
  }, [cachedProducts])

  const handleImageFile = async (
    event: ChangeEvent<HTMLInputElement>,
    mode: "create" | "edit"
  ) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setErrorMessage("Image is too large. Please upload an image under 3MB.")
      event.target.value = ""
      return
    }

    try {
      const dataUrl = await fileToDataUrl(file)
      if (mode === "create") {
        setFormState((current) => ({ ...current, image: dataUrl }))
      } else {
        setEditFormState((current) => ({ ...current, image: dataUrl }))
      }
      setErrorMessage("")
      setSuccessMessage("Image uploaded. Save the article to persist it.")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to process image.")
    } finally {
      event.target.value = ""
    }
  }

  const handleCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreating(true)
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

      setProducts((current) => {
        const nextProducts = [body.product as StoreProduct, ...current]
        writeClientCache<StoreProduct[]>(PRODUCTS_CACHE_KEY, nextProducts)
        return nextProducts
      })
      setFormState(initialFormState)
      setSuccessMessage("Article added successfully")
    } catch {
      setErrorMessage("Failed to create product")
    } finally {
      setCreating(false)
    }
  }

  const handleStartEdit = (product: StoreProduct) => {
    setEditingProductId(product.id)
    setEditFormState(toFormState(product))
    setErrorMessage("")
    setSuccessMessage("")
  }

  const handleCancelEdit = () => {
    setEditingProductId(null)
    setEditFormState(initialFormState)
  }

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingProductId) {
      return
    }

    setUpdating(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await fetch(`/api/store/products/${editingProductId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editFormState,
          price_tnd: Number(editFormState.price_tnd),
        }),
      })

      const body = (await response.json()) as { error?: string; product?: StoreProduct }
      if (!response.ok || !body.product) {
        setErrorMessage(body.error ?? "Failed to update product")
        return
      }

      setProducts((current) => {
        const nextProducts = current.map((product) =>
          product.id === editingProductId ? body.product! : product
        )
        writeClientCache<StoreProduct[]>(PRODUCTS_CACHE_KEY, nextProducts)
        return nextProducts
      })
      setEditingProductId(null)
      setEditFormState(initialFormState)
      setSuccessMessage("Article updated successfully")
    } catch {
      setErrorMessage("Failed to update product")
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    setErrorMessage("")
    setSuccessMessage("")
    setDeletingProductId(productId)

    try {
      const response = await fetch(`/api/store/products/${productId}`, {
        method: "DELETE",
      })

      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setErrorMessage(body.error ?? "Failed to delete product")
        return
      }

      setProducts((current) => {
        const nextProducts = current.filter((product) => product.id !== productId)
        writeClientCache<StoreProduct[]>(PRODUCTS_CACHE_KEY, nextProducts)
        return nextProducts
      })
      if (editingProductId === productId) {
        handleCancelEdit()
      }
      setSuccessMessage("Article removed successfully")
    } catch {
      setErrorMessage("Failed to delete product")
    } finally {
      setDeletingProductId(null)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">Add, edit, upload photos, and manage storefront articles.</p>
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="image-url">Image URL or Data URL (optional)</Label>
                <Input
                  id="image-url"
                  value={formState.image}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, image: event.target.value }))
                  }
                  placeholder="https://... or data:image/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-file">Upload image</Label>
                <Input
                  id="image-file"
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handleImageFile(event, "create")}
                />
                <p className="text-xs text-muted-foreground">Stored in DB (max 3MB).</p>
              </div>
            </div>

            {formState.image && (
              <div className="rounded-md border p-3 w-fit">
                <img src={formState.image} alt="Preview" className="h-20 w-20 object-cover rounded" />
              </div>
            )}

            <Button type="submit" disabled={creating}>
              {creating ? "Adding..." : "Add Article"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {editingProduct && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>Edit Article</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void handleSaveEdit(event)}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editFormState.name}
                    onChange={(event) =>
                      setEditFormState((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price (TND)</Label>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={editFormState.price_tnd}
                    onChange={(event) =>
                      setEditFormState((current) => ({ ...current, price_tnd: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={editFormState.category}
                    onValueChange={(value) =>
                      setEditFormState((current) => ({
                        ...current,
                        category: value as StoreProduct["category"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                    value={editFormState.stock_status}
                    onValueChange={(value) =>
                      setEditFormState((current) => ({
                        ...current,
                        stock_status: value as StoreStockStatus,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                <Label>Description</Label>
                <Textarea
                  value={editFormState.description}
                  onChange={(event) =>
                    setEditFormState((current) => ({ ...current, description: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Image URL or Data URL</Label>
                  <Input
                    value={editFormState.image}
                    onChange={(event) =>
                      setEditFormState((current) => ({ ...current, image: event.target.value }))
                    }
                    placeholder="https://... or data:image/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Upload replacement image</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleImageFile(event, "edit")}
                  />
                </div>
              </div>

              {editFormState.image && (
                <div className="rounded-md border p-3 w-fit">
                  <img src={editFormState.image} alt="Preview" className="h-20 w-20 object-cover rounded" />
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={updating}>
                  {updating ? "Saving..." : "Save Changes"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{inStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alert</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{lowStock}</div>
          </CardContent>
        </Card>
      </div>

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
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-md overflow-hidden bg-muted shrink-0">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                              <Upload className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
                        </div>
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
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartEdit(product)}
                          disabled={updating || creating}
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDeleteProduct(product.id)}
                          disabled={deletingProductId === product.id}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {deletingProductId === product.id ? "Removing..." : "Remove"}
                        </Button>
                      </div>
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
