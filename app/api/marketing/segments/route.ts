import { adminErrorResponse, requireAdminAccess } from "@/lib/admin-auth"
import { getMarketingSegments } from "@/lib/marketing-segments"

export async function GET(request: Request) {
  const authResult = await requireAdminAccess(request)
  if (!authResult.ok) {
    return adminErrorResponse(authResult)
  }

  try {
    const segments = await getMarketingSegments()
    return Response.json({
      generatedAt: new Date().toISOString(),
      segments,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to build marketing segments."
    return Response.json({ error: message }, { status: 500 })
  }
}
