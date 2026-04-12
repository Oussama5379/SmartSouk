import { z } from "zod"
import { adminErrorResponse, requireAdminAccess } from "@/lib/admin-auth"
import { deleteStoreProduct, getStoreProductById, updateStoreProduct } from "@/lib/store-data"

const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  category: z.enum(["ceramics", "rugs", "oils"]).optional(),
  price_tnd: z.coerce.number().positive().optional(),
  stock_status: z.enum(["in_stock", "low_stock", "out_of_stock"]).optional(),
  description: z.string().trim().min(3).max(1000).optional(),
  image: z.string().trim().max(5_000_000).optional(),
})

async function getProductId(context: { params: Promise<{ id: string }> }): Promise<string> {
  const { id } = await context.params
  return id.trim()
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const productId = await getProductId(context)
  if (!productId) {
    return Response.json({ error: "Product id is required" }, { status: 400 })
  }

  const product = await getStoreProductById(productId)
  if (!product) {
    return Response.json({ error: "Product not found" }, { status: 404 })
  }

  return Response.json({ product })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authResult = await requireAdminAccess(request)
  if (!authResult.ok) {
    return adminErrorResponse(authResult)
  }

  const productId = await getProductId(context)
  if (!productId) {
    return Response.json({ error: "Product id is required" }, { status: 400 })
  }

  let payload: z.infer<typeof updateProductSchema>
  try {
    const body = await request.json()
    const parsed = updateProductSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid product update payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }
    payload = parsed.data
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const product = await updateStoreProduct(productId, {
    ...payload,
    image: typeof payload.image === "string" ? payload.image : undefined,
  })

  if (!product) {
    return Response.json({ error: "Product not found" }, { status: 404 })
  }

  return Response.json({ product })
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authResult = await requireAdminAccess(_request)
  if (!authResult.ok) {
    return adminErrorResponse(authResult)
  }

  const productId = await getProductId(context)
  if (!productId) {
    return Response.json({ error: "Product id is required" }, { status: 400 })
  }

  const deleted = await deleteStoreProduct(productId)
  if (!deleted) {
    return Response.json({ error: "Product not found" }, { status: 404 })
  }

  return Response.json({ success: true })
}
