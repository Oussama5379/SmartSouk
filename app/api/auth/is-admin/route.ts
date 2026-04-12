export const dynamic = "force-dynamic"

import { requireAdminAccess } from "@/lib/admin-auth"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const authResult = await requireAdminAccess(request)
  return NextResponse.json(
    { isAdmin: authResult.ok },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  )
}
