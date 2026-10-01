import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"
import {
  getOrCreateBrandProfile,
  updateOnboardingStep,
  saveAnalysisResults,
} from "@/lib/queries/brand-profile"
import { scrapeAllSocials } from "@/lib/analysis/social-scraper"
import { analyzeSite } from "@/lib/analysis/site-analyzer"
import { transcribeMultipleVideos } from "@/lib/analysis/video-transcriber"
import { buildBrandProfile } from "@/lib/analysis/profile-builder"
import { generateQuestions, identifyGaps } from "@/lib/analysis/question-generator"
import type { TenantDB } from "@/lib/tenant-db"
import type { BrandProfile } from "@/lib/types"

// Run analysis in background (fire-and-forget pattern)
async function runAnalysis(db: TenantDB, profile: BrandProfile) {
  try {
    // Step 1: Scrape social media + analyze site in parallel
    const [socialResults, siteAnalysis] = await Promise.all([
      profile.social_links && Object.keys(profile.social_links).length > 0
        ? scrapeAllSocials(profile.social_links as Record<string, string>)
        : Promise.resolve([]),
      profile.site_url
        ? analyzeSite(profile.site_url)
        : Promise.resolve(null),
    ])

    // Step 2: Transcribe videos (sequential, can be slow)
    const transcriptions = profile.video_urls.length > 0
      ? await transcribeMultipleVideos(profile.video_urls)
      : []

    // Step 3: Build brand profile with AI
    const generated = await buildBrandProfile({
      socialResults,
      siteAnalysis,
      transcriptions,
    })

    // Step 4: Generate complementary questions
    const gaps = identifyGaps(generated)
    const questions = await generateQuestions(generated, gaps)

    // Step 5: Save everything to DB
    const rawSocialData: Record<string, unknown> = {}
    for (const result of socialResults) {
      rawSocialData[result.platform] = {
        profile: result.profile,
        posts_count: result.posts.length,
        top_posts: result.posts.slice(0, 5),
        error: result.error,
      }
    }

    await saveAnalysisResults(db, profile.id, {
      brand_voice: generated.brand_voice,
      visual_identity: generated.visual_identity,
      content_strategy: generated.content_strategy,
      audience: generated.audience,
      raw_social_data: {
        ...rawSocialData,
        questions,
        gaps,
      },
      site_analysis: siteAnalysis ? (siteAnalysis as unknown as Record<string, unknown>) : {},
      video_transcripts: transcriptions
        .filter((t) => !t.error)
        .map((t) => t.transcript),
    })
  } catch (error) {
    // If analysis fails, set step back so user can retry
    console.error("Analysis failed:", error)
    await updateOnboardingStep(db, profile.id, "upload_videos")
  }
}

export async function POST(request: NextRequest) {
  return withTenantDB(request, async (db) => {
    const profile = await getOrCreateBrandProfile(db)

    // Set step to analyzing
    await updateOnboardingStep(db, profile.id, "analyzing")

    // Fire-and-forget: run analysis in background
    // The frontend will poll GET /api/onboarding/status
    runAnalysis(db, profile)

    return {
      status: "analyzing",
      message: "Análise iniciada. Use GET /api/onboarding/status para acompanhar.",
    }
  })
}
