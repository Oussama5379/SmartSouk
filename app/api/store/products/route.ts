import { z } from "zod"
import { adminErrorResponse, requireAdminAccess } from "@/lib/admin-auth"
import { createStoreProduct, listStoreProducts } from "@/lib/store-data"

const createProductSchema = z.object({
  name: z.string().trim().min(2).max(180),
  category: z.enum(["ceramics", "rugs", "oils"]),
  price_tnd: z.coerce.number().positive(),
  stock_status: z.enum(["in_stock", "low_stock", "out_of_stock"]),
  description: z.string().trim().min(3).max(1000),
  image: z.string().trim().max(2048).optional(),
})

export async function GET() {
  const products = await listStoreProducts()
  return Response.json({ products })
}

export async function POST(request: Request) {
  const authResult = await requireAdminAccess(request)
  if (!authResult.ok) {
    return adminErrorResponse(authResult)
  }

  let payload: z.infer<typeof createProductSchema>

  try {
    const body = await request.json()
    const parsed = createProductSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid product payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    payload = parsed.data
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const product = await createStoreProduct({
    ...payload,
    image: payload.image?.trim() || undefined,
  })

  return Response.json({ product }, { status: 201 })
}
