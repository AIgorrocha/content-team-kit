#!/usr/bin/env node
/**
 * ct-query.mjs - Query generica nas tabelas ct_* do Supabase
 *
 * Uso:
 *   node ct-query.mjs select ct_content_items '{"status":"draft"}' --limit 10
 *   node ct-query.mjs select ct_tasks '{"status":"pending"}' --order -created_at
 *   node ct-query.mjs insert ct_tasks '{"title":"Novo","status":"pending"}'
 *   node ct-query.mjs update ct_content_items '{"status":"approved"}' --filter '{"id":"abc123"}'
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY necessarias')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const ALLOWED_TABLES = [
  'ct_content_items', 'ct_tasks', 'ct_agents', 'ct_audit_log',
  'ct_content_series', 'ct_content_series_items',
  'ct_competitors', 'ct_competitor_posts',
  'ct_contacts', 'ct_deals', 'ct_deal_activities',
  'ct_pipeline_stages', 'ct_subscribers', 'ct_email_campaigns',
  'ct_email_sequences', 'ct_email_sequence_steps', 'ct_lead_magnets',
  'ct_design_system', 'ct_influencers', 'ct_collaborations',
  'ct_brand_profile', 'ct_credentials',
]

function getArg(flag) {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 ? process.argv[idx + 1] : null
}

const operation = process.argv[2]
const table = process.argv[3]
const dataOrFilters = process.argv[4] ? JSON.parse(process.argv[4]) : null

if (!operation || !table) {
  console.error('Uso: node ct-query.mjs <select|insert|update> <tabela> [dados_json] [--limit N] [--order col] [--filter json]')
  process.exit(1)
}

if (!ALLOWED_TABLES.includes(table)) {
  console.error(`Tabela "${table}" nao permitida.\nTabelas validas: ${ALLOWED_TABLES.join(', ')}`)
  process.exit(1)
}

function applyFilters(query, filters) {
  if (!filters) return query
  for (const [col, val] of Object.entries(filters)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (val.gte) query = query.gte(col, val.gte)
      if (val.lte) query = query.lte(col, val.lte)
      if (val.like) query = query.like(col, val.like)
      if (val.in) query = query.in(col, val.in)
      if (val.neq) query = query.neq(col, val.neq)
    } else {
      query = query.eq(col, val)
    }
  }
  return query
}

try {
  if (operation === 'select') {
    let query = supabase.from(table).select('*')
    query = applyFilters(query, dataOrFilters)

    const orderBy = getArg('--order')
    if (orderBy) {
      const desc = orderBy.startsWith('-')
      const col = desc ? orderBy.slice(1) : orderBy
      query = query.order(col, { ascending: !desc })
    }

    const limit = parseInt(getArg('--limit') || '20')
    query = query.limit(Math.min(limit, 50))

    const { data: rows, error } = await query
    if (error) throw new Error(error.message)
    console.log(JSON.stringify({ count: rows.length, data: rows }, null, 2))

  } else if (operation === 'insert') {
    if (!dataOrFilters) throw new Error('Dados JSON obrigatorios para insert')
    const { data: result, error } = await supabase.from(table).insert(dataOrFilters).select()
    if (error) throw new Error(error.message)
    console.log(JSON.stringify({ inserted: result }, null, 2))

  } else if (operation === 'update') {
    if (!dataOrFilters) throw new Error('Dados JSON obrigatorios para update')
    const filterJson = getArg('--filter')
    if (!filterJson) throw new Error('--filter obrigatorio para update (seguranca)')
    const filters = JSON.parse(filterJson)

    let query = supabase.from(table).update(dataOrFilters)
    query = applyFilters(query, filters)

    const { data: result, error } = await query.select()
    if (error) throw new Error(error.message)
    console.log(JSON.stringify({ updated: result }, null, 2))

  } else {
    throw new Error(`Operacao "${operation}" nao suportada. Use: select, insert, update`)
  }
} catch (err) {
  console.error(`ERRO: ${err.message}`)
  process.exit(1)
}
