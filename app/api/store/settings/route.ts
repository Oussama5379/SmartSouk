import { z } from "zod"
import { getStoreSettings, updateStoreSettings } from "@/lib/store-data"

const updateStoreSettingsSchema = z.object({
  store_name: z.string().trim().min(2).max(120).optional(),
  store_description: z.string().trim().min(5).max(400).optional(),
  contact_email: z.string().trim().email().max(180).optional(),
  hero_image_url: z.string().trim().max(2048).optional(),
})

export async function GET() {
  const settings = await getStoreSettings()
  return Response.json({ settings })
}

export async function PUT(request: Request) {
  let payload: z.infer<typeof updateStoreSettingsSchema>
  try {
    const body = await request.json()
    const parsed = updateStoreSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid store settings payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }
    payload = parsed.data
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const settings = await updateStoreSettings(payload)
  return Response.json({ settings })
}