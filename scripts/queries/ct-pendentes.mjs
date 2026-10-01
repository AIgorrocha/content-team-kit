#!/usr/bin/env node
/**
 * ct-pendentes.mjs - Lista conteudos pendentes (draft/planned)
 *
 * Uso: node ct-pendentes.mjs [--limit N]
 * Saida: texto formatado com conteudos pendentes
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

const limitArg = process.argv.indexOf('--limit')
const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1]) || 10 : 10

const PLATFORM_EMOJI = {
  instagram: '📸', linkedin: '💼', tiktok: '🎵',
  youtube: '📺', x: '🐦', threads: '🧵',
}

function formatDate(isoStr) {
  if (!isoStr) return 'Sem data'
  return new Date(isoStr).toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  })
}

const { data: items, error } = await supabase
  .from('ct_content_items')
  .select('*')
  .in('status', ['planned', 'draft'])
  .order('scheduled_at', { ascending: true })
  .limit(limit)

if (error) {
  console.error(`Erro Supabase: ${error.message}`)
  process.exit(1)
}

if (!items?.length) {
  console.log('Nenhum conteudo pendente.')
  process.exit(0)
}

let msg = `${items.length} conteudo(s) pendente(s)\n\n`
for (const item of items) {
  const emoji = PLATFORM_EMOJI[item.platform] || '📄'
  const id = item.id.substring(0, 8)
  const date = formatDate(item.scheduled_at)
  msg += `${emoji} ${item.title}\n   ${date} | ${id}\n\n`
}

console.log(msg.trim())
