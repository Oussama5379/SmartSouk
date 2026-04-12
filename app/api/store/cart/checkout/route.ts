import { z } from "zod"
import { getAuthenticatedUser } from "@/lib/admin-auth"
import { getStoreProductById } from "@/lib/store-data"
import { isTrackingConfigured, recordConfirmedPaymentOrder } from "@/lib/tracking-store"

const checkoutSchema = z.object({
  session_id: z.string().trim().min(1),
  items: z
    .array(
      z.object({
        product_id: z.string().trim().min(1),
        quantity: z.coerce.number().int().positive().max(99).default(1),
      })
    )
    .min(1)
    .max(50),
})

export async function POST(request: Request) {
  let payload: z.infer<typeof checkoutSchema>
  try {
    const body = await request.json()
    const parsed = checkoutSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid checkout payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }
    payload = parsed.data
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const itemByProduct = new Map<string, number>()
  for (const item of payload.items) {
    itemByProduct.set(
      item.product_id,
      (itemByProduct.get(item.product_id) ?? 0) + Math.max(1, Math.floor(item.quantity))
    )
  }

  const normalizedItems = Array.from(itemByProduct.entries()).map(([product_id, quantity]) => ({
    product_id,
    quantity: Math.max(1, quantity),
  }))

  const products = await Promise.all(
    normalizedItems.map(async (item) => ({
      item,
      product: await getStoreProductById(item.product_id),
    }))
  )

  const missingProduct = products.find((entry) => !entry.product)
  if (missingProduct) {
    return Response.json(
      { error: `Product "${missingProduct.item.product_id}" was not found.` },
      { status: 404 }
    )
  }

  const outOfStock = products.find((entry) => entry.product?.stock_status === "out_of_stock")
  if (outOfStock?.product) {
    return Response.json(
      { error: `${outOfStock.product.name} is currently out of stock.` },
      { status: 409 }
    )
  }

  const authenticatedUser = await getAuthenticatedUser(request)
  const trustedUserId = authenticatedUser?.id
  const trackingEnabled = isTrackingConfigured()

  const orders = await Promise.all(
    products.map(async (entry) => {
      const product = entry.product!
      const quantity = entry.item.quantity
      const pricePaid = Number((product.price_tnd * quantity).toFixed(2))

      if (!trackingEnabled) {
        return {
          id: `sim_ord_${Date.now()}_${product.id}`,
          session_id: payload.session_id,
          user_id: trustedUserId,
          product_id: product.id,
          quantity,
          price_paid: pricePaid,
          timestamp: Date.now(),
        }
      }

      return recordConfirmedPaymentOrder({
        session_id: payload.session_id,
        user_id: trustedUserId,
        product_id: product.id,
        quantity,
        price_paid: pricePaid,
      })
    })
  )

  const totalItems = orders.reduce((sum, order) => sum + Math.max(1, order.quantity), 0)
  const totalPaidTnd = Number(
    orders.reduce((sum, order) => sum + Math.max(0, order.price_paid), 0).toFixed(2)
  )

  return Response.json({
    success: true,
    simulated: !trackingEnabled,
    total_items: totalItems,
    total_paid_tnd: totalPaidTnd,
    orders,
  })
}
