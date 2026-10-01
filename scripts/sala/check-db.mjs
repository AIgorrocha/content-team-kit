#!/usr/bin/env node
// Confere o esquema local esperado pela Sala de Comando sem exibir a URL do banco.
import dotenv from "dotenv"
import { Pool } from "pg"

dotenv.config({ quiet: true, path: ".env.local" })

const expectedTables = [
  "ct_agents", "ct_tasks", "ct_content_items", "ct_content_series", "ct_content_series_items",
  "ct_pipeline_stages", "ct_contacts", "ct_deals", "ct_deal_activities", "ct_subscribers",
  "ct_email_campaigns", "ct_email_sequences", "ct_email_sequence_steps", "ct_lead_magnets",
  "ct_design_system", "ct_competitors", "ct_competitor_posts", "ct_influencers", "ct_collaborations",
  "ct_audit_log", "ct_users", "ct_tenants", "ct_tenant_members", "ct_api_keys", "ct_brand_profile",
  "ct_credentials", "ct_plans", "ct_subscriptions", "ct_usage", "ct_settings",
  "ct_metrics_snapshots", "ct_social_insights", "ct_notebooks", "ct_research_runs", "ct_research_posts",
  "ct_sala_migrations", "ct_piece_revisions", "ct_piece_stages", "ct_agent_events", "ct_rules",
  "ct_connections", "ct_agent_prompts", "ct_skills", "ct_sala_oauth_states", "ct_instagram_accounts",
]

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL nao definida.")
  process.exit(1)
}

let hostname
try {
  hostname = new URL(databaseUrl).hostname
} catch {
  console.error("DATABASE_URL invalida.")
  process.exit(1)
}
if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)) {
  console.error("sala:check-db aceita somente banco local.")
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl, ssl: undefined })
try {
  const { rows } = await pool.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_name = any($1::text[])
    order by table_name
  `, [expectedTables])
  const found = new Set(rows.map(({ table_name }) => table_name))
  const missing = expectedTables.filter((table) => !found.has(table))
  if (missing.length) {
    console.error(`Tabelas ct_* ausentes (${missing.length}): ${missing.join(", ")}`)
    process.exitCode = 1
  } else {
    console.log(`Banco local verificado: ${expectedTables.length} tabelas ct_* presentes.`)
  }
} catch (error) {
  console.error("Falha ao consultar o banco local. Confira se o Supabase esta ativo.")
  process.exitCode = 1
} finally {
  await pool.end()
}
