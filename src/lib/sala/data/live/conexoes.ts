// Conexões no provedor live (Tarefa A3): ct_connections (Tarefa A1, hoje vazia; passa a ser
// escrita na Tarefa D1) é a fonte de validade real (status "ok" só sai daqui, com checagem
// recente). Presença de variável de ambiente e sessão local só aparecem no `detalhe`, nunca
// viram "ok" sozinhas: uma chave configurada não prova que o token ainda é válido.
import { FUSO, type Conexao, type Rede } from "@/lib/sala/types"
import { lerArquivo } from "@/lib/sala/fontes"
import { query } from "@/lib/db"

interface LinhaConexao {
  credential_ref: string | null
  service: string
  account_label: string | null
  obtained_at: string | null
  expires_at: string | null
  status: string | null
  renew_kind: string | null
  last_checked_at: string | null
  last_used_at: string | null
}

// Mapa do status gravado em ct_connections (Tarefa D1) pro status exibido na Sala.
const STATUS_DB_PARA_UI: Record<string, Conexao["status"]> = {
  ok: "ok",
  vencendo: "vencendo",
  vencida: "vencida",
  unknown: "desconhecida",
  session: "sessao",
}

const RENOVACAO: Record<string, Conexao["renovacao"]> = {
  instagram: "automatica",
  linkedin: "manual",
  youtube: "nao_expira",
  tiktok: "sessao",
  meta_ads: "nao_expira",
}

const NOMES: Record<string, string> = {
  instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok", meta_ads: "Meta Ads",
  supabase: "Banco de dados (Supabase)", ai_memory: "Memória (ai-memory)", vps: "Servidor (VPS)",
  telegram: "Telegram", higgsfield: "Higgsfield AI",
}

// Fallback estritamente vinculado ao slug selecionado: o perfil documenta o link da
// própria conta por rede. Não lê token nem qualquer variável de ambiente de credencial.
export function contaLocalDaRede(cliente: string, rede: Rede): string | null {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(cliente)) return null
  const raw = lerArquivo(`clients/${cliente}/brand-profile.md`)
  if (!raw) return null

  const padrao: Partial<Record<Rede, RegExp>> = {
    instagram: /instagram\.com\/([a-z0-9._-]+)/i,
    linkedin: /linkedin\.com\/(?:in|company)\/([a-z0-9-]+)/i,
    youtube: /youtube\.com\/@([a-z0-9._-]+)/i,
    tiktok: /tiktok\.com\/@([a-z0-9._-]+)/i,
    meta_ads: /meta_ad_account:\s*`?([a-z0-9_]+)`?/i,
  }
  const expressao = padrao[rede]
  if (!expressao) return null

  const marcador = rede === "meta_ads" ? /meta\s*ads|meta_ad_account/i : new RegExp(rede, "i")
  for (const linha of raw.split(/\r?\n/)) {
    if (!marcador.test(linha)) continue
    const encontrado = linha.match(expressao)
    if (encontrado?.[1]) return rede === "meta_ads" ? encontrado[1] : `@${encontrado[1]}`
  }
  return null
}

function diasRestantesDe(expiraEm: string | null): number | null {
  if (!expiraEm) return null
  const valor = new Date(expiraEm).getTime()
  return Number.isFinite(valor) ? Math.ceil((valor - Date.now()) / 86_400_000) : null
}

// "ok" só sai do banco (checagem real feita pela Tarefa D1) com checagem recente: a rotina é
// diária, então 48h de folga já cobre um dia perdido. Data vencida sempre vence a checagem
// (nunca "ok" com prazo estourado); "vencendo" é sempre <= 7 dias, mesmo se o status salvo
// ainda disser "ok". Nenhuma data é fabricada: sem expires_at, diasRestantes fica null.
function statusRealDe(db: LinhaConexao | undefined): { status: Conexao["status"]; diasRestantes: number | null } {
  if (!db) return { status: "desconhecida", diasRestantes: null }
  const diasRestantes = diasRestantesDe(db.expires_at)
  if (db.status === "vencida" || (db.expires_at && new Date(db.expires_at).getTime() <= Date.now())) return { status: "vencida", diasRestantes }
  if (diasRestantes !== null && diasRestantes <= 7) return { status: "vencendo", diasRestantes }
  const statusUi = STATUS_DB_PARA_UI[db.status ?? ""] ?? "desconhecida"
  if (statusUi === "sessao") return { status: "sessao", diasRestantes }
  const checadaRecentemente = db.last_checked_at ? Date.now() - new Date(db.last_checked_at).getTime() < 48 * 60 * 60 * 1000 : false
  if (statusUi === "ok" && checadaRecentemente) return { status: "ok", diasRestantes }
  if (statusUi === "vencida" || statusUi === "vencendo") return { status: statusUi, diasRestantes }
  return { status: "desconhecida", diasRestantes }
}

// Sem nomes internos nem env vars no texto exibido: só descreve se houve checagem real.
function detalheChecagem(db: LinhaConexao | undefined): string {
  if (!db) return "Sem registro de conexão ainda."
  if (!db.last_checked_at) return "Conectado, mas sem checagem real registrada ainda."
  const data = new Date(db.last_checked_at).toLocaleString("pt-BR", { timeZone: FUSO, dateStyle: "short", timeStyle: "short" })
  return `Última checagem em ${data}.`
}

async function conexaoRede(id: string, dbPorService: Map<string, LinhaConexao>, cliente: string): Promise<Conexao> {
  const db = dbPorService.get(id)
  const { status, diasRestantes } = statusRealDe(db)
  return {
    id,
    nome: NOMES[id],
    categoria: "rede",
    status,
    conectadoEm: db?.obtained_at ?? null,
    expiraEm: db?.expires_at ?? null,
    diasRestantes,
    renovacao: ({ manual: "manual", never: "nao_expira", auto: "automatica", automatic: "automatica", session: "sessao" } as Record<string, Conexao["renovacao"]>)[db?.renew_kind ?? ""] ?? RENOVACAO[id],
    ultimoUso: db?.last_used_at ?? null,
    conta: db?.account_label?.trim() || contaLocalDaRede(cliente, id as Rede),
    acao: id === "tiktok" ? null : status === "vencida" || status === "vencendo"
      ? db?.credential_ref || db?.obtained_at ? "renovar" : "conectar"
      : status === "ok" || db?.credential_ref ? "testar" : "conectar",
    detalhe: detalheChecagem(db),
  }
}

async function pingAiMemory(): Promise<boolean> {
  try {
    const controlador = new AbortController()
    const timeout = setTimeout(() => controlador.abort(), 2000)
    const url = process.env.AI_MEMORY_URL || "http://localhost:49374/mcp"
    const resposta = await fetch(url, { signal: controlador.signal }).catch(() => null)
    clearTimeout(timeout)
    return resposta !== null && resposta.ok
  } catch {
    return false
  }
}

async function conexaoSupabase(): Promise<Conexao> {
  let ok = false
  try {
    await query("select 1")
    ok = true
  } catch {
    ok = false
  }
  return {
    id: "supabase", nome: NOMES.supabase, categoria: "infra",
    status: ok ? "ok" : "desconhecida", conectadoEm: null, expiraEm: null, diasRestantes: null,
    renovacao: "nao_expira", ultimoUso: null, conta: null, acao: "testar",
    detalhe: ok ? "Consulta de teste respondeu normalmente." : "Consulta de teste falhou.",
  }
}

async function conexaoAiMemory(): Promise<Conexao> {
  const ok = await pingAiMemory()
  return {
    id: "ai_memory", nome: NOMES.ai_memory, categoria: "infra",
    status: ok ? "ok" : "desconhecida", conectadoEm: null, expiraEm: null, diasRestantes: null,
    renovacao: "nao_expira", ultimoUso: null, conta: null, acao: "testar",
    detalhe: ok ? "Servidor respondeu ao teste de conexão." : "Servidor não respondeu em 2s.",
  }
}

function conexaoVps(): Conexao {
  return {
    id: "vps", nome: NOMES.vps, categoria: "infra",
    status: "desconhecida", conectadoEm: null, expiraEm: null, diasRestantes: null,
    renovacao: "nao_expira", ultimoUso: null, conta: null, acao: null,
    detalhe: "Checagem do servidor depende da configuração da instalação.",
  }
}

function conexaoPorToken(id: "telegram" | "higgsfield", envNome: string): Conexao {
  const presente = !!process.env[envNome]
  return {
    id, nome: NOMES[id], categoria: "infra",
    // Chave presente não prova validade: sem checagem real, status fica desconhecida.
    status: "desconhecida", conectadoEm: null, expiraEm: null, diasRestantes: null,
    renovacao: "nao_expira", ultimoUso: null, conta: null, acao: null,
    detalhe: presente ? "Chave configurada; ainda sem checagem real de validade." : "Chave não configurada.",
  }
}

interface McpConfig { mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }> }

function conexoesMcp(): Conexao[] {
  const raw = lerArquivo(".mcp.json")
  if (!raw) return []
  let config: McpConfig
  try {
    config = JSON.parse(raw)
  } catch {
    return []
  }
  return Object.entries(config.mcpServers ?? {}).map(([nome, def]) => {
    const chavesEnv = Object.keys(def?.env ?? {}).filter((chave) => /^[A-Z][A-Z0-9_]{0,79}$/.test(chave))
    return {
      id: `mcp:${nome}`,
      nome: `MCP ${nome}`,
      categoria: "mcp" as const,
      status: "desconhecida" as const,
      conectadoEm: null,
      expiraEm: null,
      diasRestantes: null,
      renovacao: "sessao" as const,
      ultimoUso: null,
      conta: null,
      acao: "copiar_trecho" as const,
      // Nunca expõe command/args/URL reais (podem carregar segredo); só o nome e as chaves
      // de env como referência genérica ${NOME}.
      trechoConfig: JSON.stringify(
        { [nome]: { env: Object.fromEntries(chavesEnv.map((chave) => [chave, `\${${chave}}`])) } },
        null,
        2
      ),
      detalhe: "Válido só dentro da sessão atual do Claude Code; reconecta a cada nova sessão.",
    }
  })
}

export async function lerConexoesLive(cliente: string): Promise<Conexao[]> {
  // Sem unique em ct_connections: o registro do cliente sempre vence o global (client_slug
  // null), e em caso de mais de uma linha pro mesmo service a ordem é determinística por
  // data (checagem mais recente, depois obtenção mais recente, id como desempate final).
  const linhasDb = await query<LinhaConexao>(
    `select service, account_label, obtained_at, expires_at, status, renew_kind, last_checked_at, last_used_at, credential_ref
     from ct_connections
     where client_slug = $1
     order by service, case when client_slug = $1 then 0 else 1 end,
       last_checked_at desc nulls last, obtained_at desc nulls last, id desc`,
    [cliente]
  )
  const dbPorService = new Map<string, LinhaConexao>()
  for (const linha of linhasDb) {
    if (!dbPorService.has(linha.service)) dbPorService.set(linha.service, linha)
  }

  const redes = await Promise.all([
    conexaoRede("instagram", dbPorService, cliente),
    conexaoRede("linkedin", dbPorService, cliente),
    conexaoRede("youtube", dbPorService, cliente),
    conexaoRede("tiktok", dbPorService, cliente),
    conexaoRede("meta_ads", dbPorService, cliente),
  ])

  const infra = await Promise.all([conexaoSupabase(), conexaoAiMemory(), conexaoTelegramHiggsfield()])

  return [...redes, ...infra.flat(), conexaoVps(), ...conexoesMcp()]
}

function conexaoTelegramHiggsfield(): Conexao[] {
  return [conexaoPorToken("telegram", "TELEGRAM_BOT_TOKEN"), conexaoPorToken("higgsfield", "HIGGSFIELD_API_KEY")]
}
