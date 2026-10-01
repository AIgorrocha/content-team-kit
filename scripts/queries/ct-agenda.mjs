#!/usr/bin/env node
/**
 * ct-agenda.mjs - Agenda de conteudo (hoje ou semana)
 *
 * Uso:
 *   node ct-agenda.mjs hoje
 *   node ct-agenda.mjs semana
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
const periodo = process.argv[2] || 'hoje'

const PLATFORM_EMOJI = {
  instagram: '📸', linkedin: '💼', tiktok: '🎵',
  youtube: '📺', x: '🐦', threads: '🧵',
}

const STATUS_EMOJI = {
  approved: '🟢', published: '✅', planned: '🟡', draft: '📝',
}

function formatDate(isoStr) {
  if (!isoStr) return 'Sem data'
  return new Date(isoStr).toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  })
}

let start, end, titulo

if (periodo === 'semana') {
  const now = new Date()
  const monday = new Date(now)
  const dayOfWeek = now.getDay()
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  start = monday.toISOString()
  end = sunday.toISOString()
  titulo = 'Agenda da Semana'
} else {
  const today = new Date()
  start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()
  titulo = 'Publicacoes de Hoje'
}

const { data: items, error } = await supabase
  .from('ct_content_items')
  .select('*')
  .gte('scheduled_at', start)
  .lte('scheduled_at', end)
  .order('scheduled_at', { ascending: true })

if (error) {
  console.error(`Erro Supabase: ${error.message}`)
  process.exit(1)
}

if (!items?.length) {
  console.log(periodo === 'semana' ? 'Nenhum conteudo agendado esta semana.' : 'Nada agendado pra hoje.')
  process.exit(0)
}

let msg = `${titulo}\n\n`
for (const item of items) {
  const emoji = PLATFORM_EMOJI[item.platform] || '📄'
  const status = STATUS_EMOJI[item.status] || '❓'
  const date = formatDate(item.scheduled_at)
  const id = item.id.substring(0, 8)

  if (periodo === 'semana') {
    msg += `${status} ${emoji} ${date}\n   ${item.title} (${id})\n\n`
  } else {
    const time = new Date(item.scheduled_at).toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    })
    msg += `${emoji} ${time} — ${item.title} (${id})\n`
  }
}

console.log(msg.trim())
