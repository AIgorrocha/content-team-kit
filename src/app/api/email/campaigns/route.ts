import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { listCampaigns, createCampaign } from "@/lib/queries/email"
import type { CampaignStatus } from "@/lib/types"

export async function GET(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const params = request.nextUrl.searchParams

    const page = Math.max(1, parseInt(params.get("page") ?? "1"))
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20")))

    const { data, total } = await listCampaigns(db, {
      status: (params.get("status") as CampaignStatus) || undefined,
      page,
      limit,
    })

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  return withTenantDB(request, async (db) => {
    if (!body.name?.trim() || !body.subject?.trim()) {
      throw new Error("Nome e assunto sao obrigatorios")
    }
    const campaign = await createCampaign(db, {
      name: body.name.trim(),
      subject: body.subject.trim(),
      campaign_type: body.campaign_type || "broadcast",
    })
    return campaign
  })
}
