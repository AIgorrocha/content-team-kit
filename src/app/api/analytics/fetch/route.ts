import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/route-helper"
import type { Pool } from "pg"

interface PlatformMetrics {
  [key: string]: unknown
}

interface FetchResult {
  contentItemId: string
  platform: string
  externalId: string
  success: boolean
  metrics?: PlatformMetrics
  error?: string
}

async function fetchInstagramMetrics(
  externalId: string
): Promise<{ success: boolean; metrics?: PlatformMetrics; error?: string }> {
  try {
    const { getPostInsights } = await import("@/lib/integrations/instagram")
    const result = await getPostInsights(externalId)

    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? "Sem dados retornados" }
    }

    return { success: true, metrics: result.data as unknown as PlatformMetrics }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return {
      success: false,
      error: `Instagram insights indisponivel: ${message}`,
    }
  }
}

async function fetchLinkedInMetrics(
  externalId: string
): Promise<{ success: boolean; metrics?: PlatformMetrics; error?: string }> {
  try {
    const { getPostAnalytics } = await import("@/lib/integrations/linkedin")
    const result = await getPostAnalytics(externalId)

    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? "Sem dados retornados" }
    }

    return { success: true, metrics: result.data as unknown as PlatformMetrics }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return {
      success: false,
      error: `LinkedIn analytics indisponivel: ${message}`,
    }
  }
}

function buildMetricsFetcher(platform: string) {
  switch (platform) {
    case "instagram":
      return fetchInstagramMetrics
    case "linkedin":
      return fetchLinkedInMetrics
    default:
      return null
  }
}

export const POST = withAuth(
  async (_req: NextRequest, db: Pool, _userId: string) => {
    // 1. Get recent publications with external_id that are published
    const pubsResult = await db.query(
      `SELECT
        p.id AS publication_id,
        p.content_item_id,
        p.platform,
        p.external_id
      FROM ct_publications p
      WHERE p.status = 'published'
        AND p.external_id IS NOT NULL
        AND p.content_item_id IS NOT NULL
      ORDER BY p.published_at DESC NULLS LAST
      LIMIT 100`
    )

    const publications = pubsResult.rows as Array<{
      publication_id: string
      content_item_id: string
      platform: string
      external_id: string
    }>

    if (publications.length === 0) {
      return NextResponse.json({
        data: {
          message: "Nenhuma publicacao com external_id encontrada",
          total: 0,
          fetched: 0,
          failed: 0,
          results: [],
        },
      })
    }

    // 2. For each publication, fetch metrics from the platform API
    const results: FetchResult[] = []

    for (const pub of publications) {
      const fetcher = buildMetricsFetcher(pub.platform)

      if (!fetcher) {
        results.push({
          contentItemId: pub.content_item_id,
          platform: pub.platform,
          externalId: pub.external_id,
          success: false,
          error: `Plataforma ${pub.platform} nao suportada para analytics`,
        })
        continue
      }

      const { success, metrics, error } = await fetcher(pub.external_id)

      if (!success || !metrics) {
        results.push({
          contentItemId: pub.content_item_id,
          platform: pub.platform,
          externalId: pub.external_id,
          success: false,
          error,
        })
        continue
      }

      // 3. Update ct_content_items.engagement JSONB field
      // Merge new metrics under the platform key so we keep data from multiple platforms
      try {
        await db.query(
          `UPDATE ct_content_items
          SET engagement = COALESCE(engagement, '{}'::jsonb) || jsonb_build_object(
            $2, $3::jsonb
          ),
          updated_at = NOW()
          WHERE id = $1`,
          [
            pub.content_item_id,
            pub.platform,
            JSON.stringify({
              ...metrics,
              fetched_at: new Date().toISOString(),
            }),
          ]
        )

        results.push({
          contentItemId: pub.content_item_id,
          platform: pub.platform,
          externalId: pub.external_id,
          success: true,
          metrics,
        })
      } catch (dbError) {
        const dbMessage =
          dbError instanceof Error ? dbError.message : "Erro ao salvar no banco"
        results.push({
          contentItemId: pub.content_item_id,
          platform: pub.platform,
          externalId: pub.external_id,
          success: false,
          error: dbMessage,
        })
      }
    }

    // 4. Return summary
    const fetched = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      data: {
        message: `Analytics coletados: ${fetched} sucesso, ${failed} falhas`,
        total: publications.length,
        fetched,
        failed,
        results,
      },
    })
  }
)
