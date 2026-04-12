import { getStoreSnapshot, isStorePersisted } from "@/lib/store-data"

export async function GET() {
  const snapshot = await getStoreSnapshot()

  return Response.json({
    settings: snapshot.settings,
    products: snapshot.products,
    persisted: isStorePersisted(),
  })
}