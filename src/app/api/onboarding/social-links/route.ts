import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getOrCreateBrandProfile, updateSocialLinks } from "@/lib/queries/brand-profile"
import { z } from "zod"

const BodySchema = z.object({
  social_links: z.record(z.string().url().or(z.string().max(0))),
  site_url: z.string().url().nullable().optional(),
})

export async function POST(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const body = await request.json()
    const { social_links, site_url } = BodySchema.parse(body)

    // Filter out empty strings
    const filtered: Record<string, string> = {}
    for (const [key, value] of Object.entries(social_links)) {
      if (value) filtered[key] = value
    }

    const profile = await getOrCreateBrandProfile(db)
    const updated = await updateSocialLinks(db, profile.id, filtered, site_url ?? null)

    return updated
  })
}
