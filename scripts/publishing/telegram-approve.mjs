/**
 * telegram-approve.mjs
 *
 * Bot de gestao de conteudo via Telegram.
 * Quem aprova recebe preview com legenda, define data/hora, e o sistema publica sozinho.
 *
 * Comandos:
 *   /pendentes                        - lista conteudos pra aprovar
 *   /preview [id]                     - preview completo com legenda
 *   /aprovar [id] [data] [hora]       - aprova e agenda (ex: /aprovar abc123 17/03 10:00)
 *   /rejeitar [id] [motivo]           - rejeita
 *   /editar [id]                      - marca pra edicao
 *   /legenda [id] [nova legenda]      - altera a legenda antes de aprovar
 *   /agendar [id] [data] [hora]       - muda data/hora de publicacao
 *   /semana                           - mostra agenda da semana
 *   /hoje                             - mostra o que publica hoje
 *   /ajuda                            - lista comandos
 *
 * Modo bot: node scripts/publishing/telegram-approve.mjs --bot (24h)
 * Modo check: node scripts/publishing/telegram-approve.mjs --check (envia pendentes e sai)
 */
import { config } from 'dotenv'
config({ path: '.env.local' }); config()
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT = process.env.TELEGRAM_CHAT_ID
const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`

if (!SUPABASE_URL || !SUPABASE_KEY || !TG_TOKEN || !TG_CHAT) {
  console.error('Faltam variaveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// --- Telegram ---
async function sendTG(text) {
  const res = await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' })
  })
  return res.json()
}

async function getUpdates(offset) {
  const res = await fetch(`${TG_API}/getUpdates?offset=${offset}&timeout=30`)
  const data = await res.json()
  return data.result || []
}

// --- Helpers ---
function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function parseDate(dateStr, timeStr) {
  // Aceita: 17/03 10:00  |  17/03/2026 10:00  |  2026-03-17 10:00
  const now = new Date()
  let day, month, year, hour, minute

  if (dateStr.includes('-')) {
    // ISO: 2026-03-17
    const parts = dateStr.split('-')
    year = parseInt(parts[0])
    month = parseInt(parts[1]) - 1
    day = parseInt(parts[2])
  } else {
    // BR: 17/03 ou 17/03/2026
    const parts = dateStr.split('/')
    day = parseInt(parts[0])
    month = parseInt(parts[1]) - 1
    year = parts[2] ? parseInt(parts[2]) : now.getFullYear()
  }

  if (timeStr) {
    const timeParts = timeStr.split(':')
    hour = parseInt(timeParts[0])
    minute = parseInt(timeParts[1]) || 0
  } else {
    hour = 10
    minute = 0
  }

  const date = new Date(year, month, day, hour, minute)
  // Ajustar pro fuso BRT (-3)
  return new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString()
}

function formatDate(isoStr) {
  if (!isoStr) return 'Sem data'
  const d = new Date(isoStr)
  return d.toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
  })
}

const PLATFORM_EMOJI = {
  instagram: '📸', linkedin: '💼', tiktok: '🎵',
  youtube: '📺', x: '🐦', threads: '🧵'
}

const TYPE_NAME = {
  carousel: 'Carrossel', reels: 'Reels/Video', linkedin_post: 'Post texto',
  x_thread: 'Thread', youtube_short: 'Short', post: 'Post'
}

async function findItem(shortId) {
  const { data } = await supabase
    .from('ct_content_items')
    .select('*')
    .like('id', `${shortId}%`)
    .limit(1)
  return data?.[0] || null
}

// --- Formatacao ---
function formatPreview(item) {
  const id = item.id.substring(0, 8)
  const emoji = PLATFORM_EMOJI[item.platform] || '📄'
  const type = TYPE_NAME[item.content_type] || item.content_type
  const date = formatDate(item.scheduled_at)
  const status = { planned: '🟡 Planejado', draft: '📝 Rascunho', approved: '🟢 Aprovado', published: '✅ Publicado', rejected: '🔴 Rejeitado', needs_edit: '🔧 Editar' }[item.status] || item.status

  // Legenda: usa caption primeiro, depois content_body
  let legenda = item.caption || item.content_body || '(sem legenda)'
  if (legenda.length > 1000) legenda = legenda.substring(0, 1000) + '...'

  let msg = `${emoji} <b>${esc(item.title)}</b>\n`
  msg += `${type} | ${status}\n`
  msg += `Data: ${date}\n`
  msg += `ID: <code>${id}</code>\n`
  msg += `${'-'.repeat(25)}\n`
  msg += `<pre>${esc(legenda)}</pre>\n`
  msg += `${'-'.repeat(25)}\n`

  if (item.hashtags) {
    msg += `Tags: ${esc(item.hashtags)}\n`
  }

  if (item.media_urls && item.media_urls.length > 0) {
    msg += `Imagens: ${item.media_urls.length}\n`
  }

  msg += `\n/aprovar ${id} DD/MM HH:MM\n`
  msg += `/rejeitar ${id}\n`
  msg += `/editar ${id}\n`
  msg += `/legenda ${id} [nova legenda]`

  return msg
}

// --- Comandos ---

async function cmdPendentes() {
  const { data: items } = await supabase
    .from('ct_content_items')
    .select('*')
    .in('status', ['planned', 'draft'])
    .order('scheduled_at', { ascending: true })
    .limit(10)

  if (!items || items.length === 0) {
    await sendTG('Nenhum conteudo pendente.')
    return
  }

  await sendTG(`<b>${items.length} conteudo(s) pendente(s)</b>`)

  for (const item of items) {
    await sendTG(formatPreview(item))
    await new Promise(r => setTimeout(r, 500))
  }
}

async function cmdPreview(shortId) {
  const item = await findItem(shortId)
  if (!item) { await sendTG(`ID ${shortId} nao encontrado.`); return }
  await sendTG(formatPreview(item))
}

async function cmdAprovar(shortId, dateStr, timeStr) {
  const item = await findItem(shortId)
  if (!item) { await sendTG(`ID ${shortId} nao encontrado.`); return }

  const updates = { status: 'approved' }

  if (dateStr) {
    updates.scheduled_at = parseDate(dateStr, timeStr)
  } else if (!item.scheduled_at) {
    await sendTG(`Informe a data: /aprovar ${shortId} DD/MM HH:MM`)
    return
  }

  const { error } = await supabase
    .from('ct_content_items')
    .update(updates)
    .eq('id', item.id)

  if (error) { await sendTG(`Erro: ${error.message}`); return }

  const dateDisplay = formatDate(updates.scheduled_at || item.scheduled_at)
  const emoji = PLATFORM_EMOJI[item.platform] || '📄'
  const auto = ['instagram', 'linkedin'].includes(item.platform)

  await sendTG(
    `${emoji} <b>APROVADO</b>\n` +
    `${esc(item.title)}\n` +
    `Publicacao: ${dateDisplay}\n` +
    (auto ? 'Sera publicado automaticamente.' : 'Voce recebera lembrete pra publicar.')
  )
}

async function cmdRejeitar(shortId, reason) {
  const item = await findItem(shortId)
  if (!item) { await sendTG(`ID ${shortId} nao encontrado.`); return }

  const { error } = await supabase
    .from('ct_content_items')
    .update({ status: 'rejected', approval_notes: reason || 'Rejeitado' })
    .eq('id', item.id)

  if (error) { await sendTG(`Erro: ${error.message}`); return }
  await sendTG(`🔴 <b>REJEITADO</b> ${esc(item.title)}\nMotivo: ${esc(reason || 'nenhum')}`)
}

async function cmdEditar(shortId) {
  const item = await findItem(shortId)
  if (!item) { await sendTG(`ID ${shortId} nao encontrado.`); return }

  const { error } = await supabase
    .from('ct_content_items')
    .update({ status: 'needs_edit' })
    .eq('id', item.id)

  if (error) { await sendTG(`Erro: ${error.message}`); return }
  await sendTG(`🔧 <b>MARCADO PRA EDICAO</b>\n${esc(item.title)}\n\nDepois de editar use /aprovar ${shortId} DD/MM HH:MM`)
}

async function cmdLegenda(shortId, novaLegenda) {
  const item = await findItem(shortId)
  if (!item) { await sendTG(`ID ${shortId} nao encontrado.`); return }

  const { error } = await supabase
    .from('ct_content_items')
    .update({ caption: novaLegenda })
    .eq('id', item.id)

  if (error) { await sendTG(`Erro: ${error.message}`); return }
  await sendTG(`✏️ <b>LEGENDA ATUALIZADA</b>\n${esc(item.title)}\n\n<pre>${esc(novaLegenda.substring(0, 500))}</pre>\n\nAgora use /aprovar ${shortId} DD/MM HH:MM`)
}

async function cmdAgendar(shortId, dateStr, timeStr) {
  const item = await findItem(shortId)
  if (!item) { await sendTG(`ID ${shortId} nao encontrado.`); return }

  if (!dateStr) { await sendTG(`Use: /agendar ${shortId} DD/MM HH:MM`); return }

  const scheduledAt = parseDate(dateStr, timeStr)
  const { error } = await supabase
    .from('ct_content_items')
    .update({ scheduled_at: scheduledAt })
    .eq('id', item.id)

  if (error) { await sendTG(`Erro: ${error.message}`); return }
  await sendTG(`📅 <b>REAGENDADO</b>\n${esc(item.title)}\nNova data: ${formatDate(scheduledAt)}`)
}

async function cmdSemana() {
  const now = new Date()
  const monday = new Date(now)
  const dayOfWeek = now.getDay()
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const { data: items } = await supabase
    .from('ct_content_items')
    .select('*')
    .gte('scheduled_at', monday.toISOString())
    .lte('scheduled_at', sunday.toISOString())
    .order('scheduled_at', { ascending: true })

  if (!items || items.length === 0) {
    await sendTG('Nenhum conteudo agendado esta semana.')
    return
  }

  let msg = `<b>Agenda da Semana</b>\n${formatDate(monday.toISOString()).split(',')[0]} a ${formatDate(sunday.toISOString()).split(',')[0]}\n${'-'.repeat(25)}\n\n`

  for (const item of items) {
    const emoji = PLATFORM_EMOJI[item.platform] || '📄'
    const status = { planned: '🟡', draft: '📝', approved: '🟢', published: '✅', rejected: '🔴' }[item.status] || '❓'
    const date = formatDate(item.scheduled_at)
    const id = item.id.substring(0, 8)
    msg += `${status} ${emoji} ${date}\n   ${esc(item.title)} (<code>${id}</code>)\n\n`
  }

  await sendTG(msg)
}

async function cmdHoje() {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()

  const { data: items } = await supabase
    .from('ct_content_items')
    .select('*')
    .gte('scheduled_at', start)
    .lte('scheduled_at', end)
    .order('scheduled_at', { ascending: true })

  if (!items || items.length === 0) {
    await sendTG('Nada agendado pra hoje.')
    return
  }

  let msg = `<b>Publicacoes de Hoje</b>\n${'-'.repeat(25)}\n\n`

  for (const item of items) {
    const emoji = PLATFORM_EMOJI[item.platform] || '📄'
    const status = { approved: '🟢 Pronto', published: '✅ Publicado', planned: '🟡 Pendente', draft: '📝 Rascunho' }[item.status] || item.status
    const time = new Date(item.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    const id = item.id.substring(0, 8)
    msg += `${emoji} ${time} - ${esc(item.title)}\n   ${status} (<code>${id}</code>)\n\n`
  }

  await sendTG(msg)
}

// --- Router ---
async function processCommand(text) {
  const parts = text.trim().split(/\s+/)
  const cmd = parts[0].toLowerCase()
  const arg1 = parts[1] || ''
  const arg2 = parts[2] || ''
  const arg3 = parts[3] || ''
  const rest = parts.slice(2).join(' ')

  switch (cmd) {
    case '/pendentes': case '/pending':
      await cmdPendentes(); break
    case '/preview': case '/ver':
      if (!arg1) { await sendTG('Use: /preview [id]'); break }
      await cmdPreview(arg1); break
    case '/aprovar': case '/approve': case '/ok':
      if (!arg1) { await sendTG('Use: /aprovar [id] DD/MM HH:MM'); break }
      await cmdAprovar(arg1, arg2, arg3); break
    case '/rejeitar': case '/reject': case '/nao':
      if (!arg1) { await sendTG('Use: /rejeitar [id] [motivo]'); break }
      await cmdRejeitar(arg1, rest); break
    case '/editar': case '/edit':
      if (!arg1) { await sendTG('Use: /editar [id]'); break }
      await cmdEditar(arg1); break
    case '/legenda': case '/caption':
      if (!arg1 || !rest) { await sendTG('Use: /legenda [id] [nova legenda completa]'); break }
      await cmdLegenda(arg1, rest); break
    case '/agendar': case '/schedule':
      if (!arg1) { await sendTG('Use: /agendar [id] DD/MM HH:MM'); break }
      await cmdAgendar(arg1, arg2, arg3); break
    case '/semana': case '/week':
      await cmdSemana(); break
    case '/hoje': case '/today':
      await cmdHoje(); break
    case '/help': case '/ajuda':
      await sendTG(
        '<b>Comandos Content Team</b>\n\n' +
        '<b>Ver conteudos:</b>\n' +
        '/pendentes - Lista pra aprovar\n' +
        '/preview [id] - Preview com legenda\n' +
        '/hoje - Publicacoes de hoje\n' +
        '/semana - Agenda da semana\n\n' +
        '<b>Gerenciar:</b>\n' +
        '/aprovar [id] DD/MM HH:MM - Aprova e agenda\n' +
        '/rejeitar [id] [motivo] - Rejeita\n' +
        '/editar [id] - Marca pra edicao\n' +
        '/legenda [id] [texto] - Altera legenda\n' +
        '/agendar [id] DD/MM HH:MM - Muda data/hora\n\n' +
        '<b>Exemplo:</b>\n' +
        '<code>/aprovar abc123 17/03 10:00</code>\n' +
        'Aprova e publica dia 17/03 as 10h'
      )
      break
  }
}

// --- Modos ---
async function modeCheck() {
  console.log('Enviando pendentes pro Telegram...')
  await cmdPendentes()
}

async function modeBot() {
  console.log('Bot de aprovacao rodando...')
  let offset = 0

  while (true) {
    try {
      const updates = await getUpdates(offset)
      for (const update of updates) {
        offset = update.update_id + 1
        const msg = update.message
        if (!msg || !msg.text) continue
        if (String(msg.chat.id) !== TG_CHAT) continue
        if (msg.text.startsWith('/')) {
          console.log(`CMD: ${msg.text}`)
          await processCommand(msg.text)
        }
      }
    } catch (err) {
      console.warn('Polling erro:', err.message)
      await new Promise(r => setTimeout(r, 5000))
    }
  }
}

const mode = process.argv[2]
if (mode === '--check') modeCheck().catch(e => { console.error(e); process.exit(1) })
else if (mode === '--bot') modeBot().catch(e => { console.error(e); process.exit(1) })
else { console.log('Use: --check ou --bot'); process.exit(0) }
