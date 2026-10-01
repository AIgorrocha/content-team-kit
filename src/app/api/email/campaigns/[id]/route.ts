import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getCampaignById } from "@/lib/queries/email"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenantDB(request, async (db) => {
    const { id } = await params
    const campaign = await getCampaignById(db, id)
    if (!campaign) throw new Error("Campaign not found")
    return campaign
  })
}
