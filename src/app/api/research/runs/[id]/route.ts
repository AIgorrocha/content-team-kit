import { NextRequest } from "next/server"
import { withTenantDB } from "@/lib/route-helper"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return withTenantDB(request, async (db) => {
    const run = await db.queryOne(
      `SELECT id, platform, mode, client_slug, label, source_url, keywords,
              source_file, fetched_at, posts_count, metadata, created_at
         FROM ct_research_runs WHERE id = $1`,
      [id]
    )
    if (!run) return { run: null, posts: [] }

    // Rank by "engagement score" — sum of all numeric values in metrics jsonb
    const posts = await db.query(
      `SELECT id, platform, external_id, author_name, author_handle, url, text,
              media, metrics, tags, external_links, posted_at, created_at,
              (
                COALESCE((metrics->>'views')::bigint, 0) +
                COALESCE((metrics->>'likes')::bigint, 0) * 10 +
                COALESCE((metrics->>'reactions')::bigint, 0) * 10 +
                COALESCE((metrics->>'comments')::bigint, 0) * 20 +
                COALESCE((metrics->>'reposts')::bigint, 0) * 30 +
                COALESCE((metrics->>'shares')::bigint, 0) * 30 +
                COALESCE((metrics->>'saves')::bigint, 0) * 40
              ) AS engagement_score
         FROM ct_research_posts
         WHERE run_id = $1
         ORDER BY engagement_score DESC NULLS LAST, posted_at DESC NULLS LAST
         LIMIT 50`,
      [id]
    )
    return { run, posts }
  })
}
