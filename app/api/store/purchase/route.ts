import { z } from "zod"
import { getStoreProductById } from "@/lib/store-data"
import { getAuthenticatedUser } from "@/lib/admin-auth"
import { isTrackingConfigured, recordConfirmedPaymentOrder } from "@/lib/tracking-store"

const purchaseSchema = z.object({
  session_id: z.string().trim().min(1),
  product_id: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive().default(1),
})

export async function POST(request: Request) {
  let payload: z.infer<typeof purchaseSchema>
  try {
    const body = await request.json()
    const parsed = purchaseSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid purchase payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    payload = parsed.data
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const product = await getStoreProductById(payload.product_id)
  if (!product) {
    return Response.json({ error: "Product not found" }, { status: 404 })
  }

  if (product.stock_status === "out_of_stock") {
    return Response.json({ error: "This product is currently out of stock" }, { status: 409 })
  }

  const quantity = Math.max(1, payload.quantity)
  const pricePaid = Number((product.price_tnd * quantity).toFixed(2))
  const authenticatedUser = await getAuthenticatedUser(request)
  const trustedUserId = authenticatedUser?.id

  const trackingEnabled = isTrackingConfigured()

  const order = trackingEnabled
    ? await recordConfirmedPaymentOrder({
        session_id: payload.session_id,
        user_id: trustedUserId,
        product_id: product.id,
        quantity,
        price_paid: pricePaid,
      })
    : {
        id: `sim_ord_${Date.now()}`,
        session_id: payload.session_id,
        user_id: trustedUserId,
        product_id: product.id,
        quantity,
        price_paid: pricePaid,
        timestamp: Date.now(),
      }

  return Response.json({
    success: true,
    simulated: !trackingEnabled,
    order,
    product,
  })
}
