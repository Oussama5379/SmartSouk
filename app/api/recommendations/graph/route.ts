import { getAuthenticatedUser } from "@/lib/admin-auth"
import { getGraphRagRecommendations } from "@/lib/graph-rag"

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("user_id")?.trim() || user.id

  try {
    const recommendations = await getGraphRagRecommendations(userId)
    return Response.json({ recommendations })
  } catch (error) {
    console.error("[recommendations/graph] failed", error)
    return Response.json({ error: "Failed to generate graph recommendations." }, { status: 500 })
  }
}
