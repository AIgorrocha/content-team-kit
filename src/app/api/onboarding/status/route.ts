import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import { getBrandProfile } from "@/lib/queries/brand-profile"

export async function GET(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const profile = await getBrandProfile(db)

    if (!profile) {
      return {
        step: "not_started",
        completed: false,
        has_profile: false,
      }
    }

    return {
      step: profile.onboarding_step,
      completed: profile.onboarding_completed,
      has_profile: true,
      has_social_links: Object.keys(profile.social_links || {}).length > 0,
      has_videos: (profile.video_urls || []).length > 0,
      has_brand_voice: Object.keys(profile.brand_voice || {}).length > 0,
      has_questionnaire: Object.keys(profile.questionnaire || {}).length > 0,
    }
  })
}
