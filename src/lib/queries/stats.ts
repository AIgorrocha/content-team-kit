import type { TenantDB } from "@/lib/tenant-db"
import type { DashboardStats, ContentItem } from "@/lib/types"

export async function getDashboardStats(
  db: TenantDB,
  opts: { client_slug?: string } = {}
): Promise<DashboardStats> {
  const slug = opts.client_slug ?? null
  const slugClause = slug ? `AND client_slug = $1` : ""
  const slugClauseWhere = slug ? `WHERE client_slug = $1` : ""
  const slugParams = slug ? [slug] : []

  const [contentStats] = await db.query<{
    total: string
    this_week: string
    scheduled: string
    published: string
  }>(
    `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (
        WHERE created_at >= date_trunc('week', CURRENT_DATE)
          AND created_at < date_trunc('week', CURRENT_DATE) + interval '7 days'
      ) as this_week,
      COUNT(*) FILTER (
        WHERE status = 'scheduled'
          AND scheduled_at IS NOT NULL
      ) as scheduled,
      COUNT(*) FILTER (WHERE status = 'published') as published
    FROM ct_content_items
    ${slugClauseWhere}
  `,
    slugParams
  )

  const upcoming = await db.query<ContentItem>(
    `
    SELECT * FROM ct_content_items
    WHERE scheduled_at > NOW()
      AND status IN ('scheduled', 'draft')
      ${slugClause}
    ORDER BY scheduled_at ASC
    LIMIT 7
  `,
    slugParams
  )

  const recent = await db.query<ContentItem>(
    `
    SELECT * FROM ct_content_items
    WHERE status != 'published'
      ${slugClause}
    ORDER BY created_at DESC
    LIMIT 5
  `,
    slugParams
  )

  const platformRows = await db.query<{
    platform: string
    count: string
  }>(
    `
    SELECT
      COALESCE(platform, 'sem plataforma') as platform,
      COUNT(*) as count
    FROM ct_content_items
    WHERE status != 'published'
      ${slugClause}
    GROUP BY platform
    ORDER BY count DESC
  `,
    slugParams
  )

  return {
    content: {
      total: parseInt(contentStats?.total ?? "0"),
      thisWeek: parseInt(contentStats?.this_week ?? "0"),
      scheduled: parseInt(contentStats?.scheduled ?? "0"),
      published: parseInt(contentStats?.published ?? "0"),
    },
    upcoming,
    recent,
    platformDistribution: platformRows.map((r) => ({
      platform: r.platform,
      count: parseInt(r.count),
    })),
  }
}
