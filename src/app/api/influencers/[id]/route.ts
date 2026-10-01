import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getInfluencer } from "@/lib/queries/influencers"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withTenantDB(request, async (db) => {
    const { id } = await params
    const result = await getInfluencer(db, id)
    if (!result) throw new Error("Influencer not found")
    return {
      influencer: result.influencer,
      collaborations: result.collaborations,
    }
  })
}
