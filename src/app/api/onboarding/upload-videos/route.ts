import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getOrCreateBrandProfile, updateVideoUrls } from "@/lib/queries/brand-profile"
import { z } from "zod"

const BodySchema = z.object({
  video_urls: z.array(z.string().url()).min(1).max(5),
})

export async function POST(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const body = await request.json()
    const { video_urls } = BodySchema.parse(body)

    const profile = await getOrCreateBrandProfile(db)
    const updated = await updateVideoUrls(db, profile.id, video_urls)

    return updated
  })
}
