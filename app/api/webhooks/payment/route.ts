import { getTrackingDashboardData, isTrackingConfigured, recordConfirmedPaymentOrder } from "@/lib/tracking-store"
import { z } from "zod"

const paymentWebhookSchema = z.object({
  event_type: z.literal("payment.confirmed"),
  payment_reference: z.string().trim().min(1).optional(),
  session_id: z.string().trim().min(1),
  user_id: z.string().trim().min(1).optional(),
  product_id: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive().default(1),
  price_paid: z.coerce.number().nonnegative(),
})

function getTrackingNotConfiguredResponse() {
  return Response.json(
    {
      error:
        "Tracking database is not configured. Add DATABASE_URL (Neon Postgres) before using payment webhooks.",
    },
    { status: 500 }
  )
}

export async function POST(request: Request) {
  if (!isTrackingConfigured()) {
    return getTrackingNotConfiguredResponse()
  }

  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    return Response.json(
      {
        error:
          "PAYMENT_WEBHOOK_SECRET is required before accepting payment confirmation webhooks.",
      },
      { status: 500 }
    )
  }

  const providedSecret = request.headers.get("x-webhook-secret")?.trim()
  if (!providedSecret || providedSecret !== webhookSecret) {
    return Response.json({ error: "Unauthorized webhook request" }, { status: 401 })
  }

  let parsedPayload: z.infer<typeof paymentWebhookSchema>
  try {
    const body = await request.json()
    const parsed = paymentWebhookSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid payment webhook payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    parsedPayload = parsed.data
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const order = await recordConfirmedPaymentOrder({
    session_id: parsedPayload.session_id,
    user_id: parsedPayload.user_id,
    product_id: parsedPayload.product_id,
    quantity: parsedPayload.quantity,
    price_paid: parsedPayload.price_paid,
  })

  const { stats } = await getTrackingDashboardData()

  return Response.json({
    success: true,
    event_type: parsedPayload.event_type,
    payment_reference: parsedPayload.payment_reference ?? null,
    order,
    total_orders: stats.totalOrders,
    revenue: stats.totalRevenue,
  })
}
