/**
 * POST /api/agents/higgsfield-reel
 *
 * Trigger-on-demand pra gerar Reel via Higgsfield AI.
 * Segue padrao TRIGGER-ON-DEMAND do ct-artigo-linkedin: claude code, telegram e frontend
 * chamam este mesmo endpoint -> mesmo estado no Supabase.
 *
 * Body:
 * {
 *   "client_slug": "<slug do cliente ativo, ver src/lib/clients/>",
 *   "image_prompt": "Medium Close-Up Dolly In Slow of a sectioned 3D cutaway building...",
 *   "motion_id": "<id da motion Higgsfield>",
 *   "video_action_prompt": "Camera slowly dollies in as the layers peel away...",
 *   "quality": "standard" | "turbo" | "lite",
 *   "approve_credits": true   // obrigatorio pra confirmar gasto
 * }
 */
import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import pool from "@/lib/db"
import { generateReelFromPrompt } from "@/lib/higgsfield"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

interface Body {
  client_slug?: string
  image_prompt?: string
  motion_id?: string
  video_action_prompt?: string
  quality?: "standard" | "turbo" | "lite"
  approve_credits?: boolean
}

export const POST = withAuth(async (request: NextRequest) => {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 })
  }

  const clientSlug = (body.client_slug ?? "").trim()
  const imagePrompt = (body.image_prompt ?? "").trim()
  const motionId = (body.motion_id ?? "").trim()

  if (!clientSlug) return NextResponse.json({ error: "client_slug obrigatorio" }, { status: 400 })
  if (!imagePrompt) return NextResponse.json({ error: "image_prompt obrigatorio" }, { status: 400 })
  if (!motionId) return NextResponse.json({ error: "motion_id obrigatorio" }, { status: 400 })
  if (!body.approve_credits) {
    return NextResponse.json(
      { error: "approve_credits=true obrigatorio. Gasto estimado: 3+9 = 12 creditos (~US$0,75)" },
      { status: 400 }
    )
  }

  if (!process.env.HIGGSFIELD_API_KEY || !process.env.HIGGSFIELD_SECRET) {
    return NextResponse.json(
      { error: "HIGGSFIELD_API_KEY/SECRET nao configurados. Ver docs/HIGGSFIELD_SETUP.md" },
      { status: 500 }
    )
  }

  try {
    const result = await generateReelFromPrompt({
      imagePrompt,
      motionId,
      videoActionPrompt: body.video_action_prompt,
      videoQuality: body.quality ?? "standard",
    })

    // Registrar em ct_content_items
    const rows = await pool.query<{ id: string }>(
      `INSERT INTO ct_content_items (
         title, caption, hashtags, content_type, platform, status,
         approval_status, source_agent, client_slug, metadata, media_urls
       ) VALUES ($1, $2, $3::text[], 'reel', 'instagram', 'draft', 'pending',
                 'ct-video-higgsfield', $4, $5::jsonb, ARRAY[$6]::text[])
       RETURNING id`,
      [
        imagePrompt.slice(0, 80),
        body.video_action_prompt ?? imagePrompt,
        "{}",
        clientSlug,
        JSON.stringify({
          higgsfield: {
            image_url: result.imageUrl,
            video_url: result.videoUrl,
            credits: result.totalCredits,
            quality: body.quality ?? "standard",
            motion_id: motionId,
          },
        }),
        result.videoUrl,
      ]
    )

    return NextResponse.json({
      success: true,
      content_id: rows.rows[0].id,
      video_url: result.videoUrl,
      image_url: result.imageUrl,
      credits_used: result.totalCredits,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
