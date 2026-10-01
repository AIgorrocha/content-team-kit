#!/usr/bin/env node
/**
 * Ads Sync Daily
 *
 * Roda todo dia às 7h via cron (em servidor ou computador sempre ligado).
 * Sincroniza campanhas + insights do Meta Ads pro Supabase.
 * Só traz dados. As recomendações (ct_ad_recommendations) são gravadas pelo agente ct-trafego.
 *
 * Uso: node scripts/infra/ads-sync-daily.mjs
 *
 * Cron sugerido:
 *   0 7 * * * cd <pasta-do-kit> && set -a && source .env && set +a && node scripts/infra/ads-sync-daily.mjs >> ads-sync.log 2>&1
 */

import pg from "pg"

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const GRAPH_API = "https://graph.facebook.com/v21.0"

async function main() {
  console.log(`[${new Date().toISOString()}] Starting daily ads sync...`)

  const accounts = await pool.query(
    `SELECT id, handle, ad_account_id, access_token FROM ct_instagram_accounts
     WHERE is_active = true AND ad_account_id IS NOT NULL`
  )

  for (const acct of accounts.rows) {
    console.log(`\n== ${acct.handle} (${acct.ad_account_id}) ==`)

    // 1. Sync campaigns with metrics
    try {
      const res = await fetch(
        `${GRAPH_API}/${acct.ad_account_id}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,insights.date_preset(last_7d){impressions,reach,clicks,spend,cpc,ctr,cpm,actions}&access_token=${acct.access_token}`
      )
      const data = await res.json()

      if (data.error) {
        console.error(`  Campaign fetch error: ${data.error.message}`)
        continue
      }

      for (const c of data.data ?? []) {
        const daily = c.daily_budget ? parseFloat(c.daily_budget) / 100 : null
        const lifetime = c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null

        const insight = c.insights?.data?.[0]
        const metrics = insight
          ? {
              impressions: parseInt(insight.impressions ?? "0"),
              reach: parseInt(insight.reach ?? "0"),
              clicks: parseInt(insight.clicks ?? "0"),
              spend: parseFloat(insight.spend ?? "0"),
              cpc: parseFloat(insight.cpc ?? "0"),
              ctr: parseFloat(insight.ctr ?? "0"),
              cpm: parseFloat(insight.cpm ?? "0"),
              landing_page_views:
                (insight.actions ?? []).find((a) => a.action_type === "landing_page_view")?.value ?? 0,
            }
          : {}

        await pool.query(
          `INSERT INTO ct_ad_campaigns (account_id, meta_campaign_id, name, objective, status, daily_budget, lifetime_budget, metrics, metrics_updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (account_id, meta_campaign_id) DO UPDATE SET
             name = EXCLUDED.name,
             status = EXCLUDED.status,
             daily_budget = EXCLUDED.daily_budget,
             lifetime_budget = EXCLUDED.lifetime_budget,
             metrics = EXCLUDED.metrics,
             metrics_updated_at = NOW()`,
          [acct.id, c.id, c.name, c.objective, c.status, daily, lifetime, JSON.stringify(metrics)]
        )
      }

      console.log(`  ${data.data?.length ?? 0} campaigns synced`)
    } catch (err) {
      console.error(`  Error: ${err.message}`)
    }

    // 2. Sync daily insights (last 7 days)
    try {
      const res = await fetch(
        `${GRAPH_API}/${acct.ad_account_id}/insights?fields=campaign_id,impressions,reach,clicks,spend,cpc,ctr,cpm,actions&level=campaign&date_preset=last_7d&time_increment=1&access_token=${acct.access_token}`
      )
      const data = await res.json()

      if (data.error) {
        console.error(`  Insights error: ${data.error.message}`)
        continue
      }

      let count = 0
      for (const r of data.data ?? []) {
        const lpv = (r.actions ?? []).find((a) => a.action_type === "landing_page_view")
        const vv = (r.actions ?? []).find((a) => a.action_type === "video_view")

        await pool.query(
          `INSERT INTO ct_ad_insights (campaign_id, date, impressions, reach, clicks, spend, cpc, ctr, cpm, landing_page_views, video_views, actions)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (campaign_id, date) DO UPDATE SET
             impressions = EXCLUDED.impressions,
             reach = EXCLUDED.reach,
             clicks = EXCLUDED.clicks,
             spend = EXCLUDED.spend,
             cpc = EXCLUDED.cpc,
             ctr = EXCLUDED.ctr,
             cpm = EXCLUDED.cpm,
             landing_page_views = EXCLUDED.landing_page_views,
             video_views = EXCLUDED.video_views,
             actions = EXCLUDED.actions`,
          [
            r.campaign_id,
            r.date_start,
            parseInt(r.impressions ?? "0"),
            parseInt(r.reach ?? "0"),
            parseInt(r.clicks ?? "0"),
            parseFloat(r.spend ?? "0"),
            parseFloat(r.cpc ?? "0"),
            parseFloat(r.ctr ?? "0"),
            parseFloat(r.cpm ?? "0"),
            lpv ? parseInt(lpv.value) : 0,
            vv ? parseInt(vv.value) : 0,
            JSON.stringify(r.actions ?? []),
          ]
        )
        count++
      }

      console.log(`  ${count} daily insights synced`)
    } catch (err) {
      console.error(`  Insights error: ${err.message}`)
    }
  }

  console.log(`\n[${new Date().toISOString()}] Daily sync complete`)
  await pool.end()
}

main().catch((err) => {
  console.error("Fatal:", err)
  pool.end()
  process.exit(1)
})
