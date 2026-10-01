// Seed do provedor mock da Sala de Comando (Tarefa 14): composicao GENERICA, sem dado pessoal
// de nenhum cliente. Os parsers de arquivo (agentes, regras, padroes visuais, pecas do disco,
// onboarding, cliente ativo) saem daqui na Tarefa A2 e moram em `src/lib/sala/fontes/*`,
// compartilhados com o futuro provedor live; este arquivo so faz a composicao ESPECIFICA do
// mock (seed.json de cliente, mapeamento de url pra /sala-mock/..., cenario padrao/vazio).
// Os dados de exemplo REAIS de um cliente (peças, agentes enriquecidos, regras, eventos etc.)
// vivem em `clients/{slug}/sala-mock/seed.json`, fora do código, e são lidos em runtime só se
// o arquivo existir (tolerante: nunca lança se faltar). Sem esse JSON (caso do Kit exportado,
// que nunca leva `clients/{cliente}/`), a Sala mostra o cenário genérico vazio: agentes reais
// (agents/*.md sempre ficam, fazem parte do Kit), zero peças, zero eventos, conexões e redes
// no molde "ainda não conectado", regras do `regras-cliente.md` do próprio cliente (se tiver
// alguma) e onboarding com respostas vazias.
// `construirSeed()` é chamado de novo a cada `reset()` (ver `state.ts`), então ele nunca deve
// depender de estado anterior.
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
  type Agente,
  type Aprendizado,
  type BlocoOnboarding,
  type Conexao,
  type Configuracao,
  type EventoAoVivo,
  type ItemCalendario,
  type Peca,
  type PadraoVisual,
  type Rede,
  type Regra,
  type ResumoRede,
  type Selo,
  type VisaoGeral,
} from "@/lib/sala/types"
import { LABEL_REDE } from "@/lib/sala/rotulos"
import { ROOT, lerArquivo, sha256, lerAgentesDoDisco, lerRegrasDoArquivo, lerOnboarding, resolverClienteAtivo as resolverClienteAtivoFonte, type RespostasBloco } from "@/lib/sala/fontes"

// Confere que a imagem existe fisicamente em public/ antes de expor a url: um cliente que
// exportou o próprio seed.json sem copiar os assets pra public/sala-mock não deve virar link
// quebrado na tela, e sim capa/artefato sem imagem (estado vazio do card).
function resolverUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return existsSync(join(ROOT, "public", url)) ? url : null
}

function sanearPeca(peca: Peca): Peca {
  return {
    ...peca,
    capaUrl: resolverUrl(peca.capaUrl),
    artefatos: peca.artefatos.map((a) => ({ ...a, url: resolverUrl(a.url) })),
  }
}

// ---------------------------------------------------------------------------
// Agentes: le do disco (fontes/agentes.ts) e sobrepoe o enriquecimento de cliente
// (status, tarefa atual, memória recente) que vem do seed.json.
// ---------------------------------------------------------------------------

interface AgenteOverride {
  status?: Agente["status"]
  tarefaAtual?: string | null
  ultimaAtividade?: string | null
  contexto?: string[]
  ultimasPecas?: string[]
  memoriaRecente?: Agente["memoriaRecente"]
}

function construirAgentes(cliente: string, overrides: Record<string, AgenteOverride>): Agente[] {
  return lerAgentesDoDisco(cliente).map((agente) => {
    const override = overrides[agente.slug] ?? {}
    return {
      ...agente,
      status: override.status ?? agente.status,
      tarefaAtual: override.tarefaAtual ?? agente.tarefaAtual,
      ultimaAtividade: override.ultimaAtividade ?? agente.ultimaAtividade,
      contexto: override.contexto ?? agente.contexto,
      memoriaRecente: override.memoriaRecente ?? agente.memoriaRecente,
      ultimasPecas: override.ultimasPecas ?? agente.ultimasPecas,
    }
  })
}

// ---------------------------------------------------------------------------
// Regras: no cenário genérico, parseia `clients/{slug}/regras-cliente.md` (ou o
// `_template`, sempre vazio, se o cliente ainda não tiver o arquivo próprio) com o parser
// compartilhado `lerRegrasDoArquivo` (fontes/regras.ts). O template nunca tem heading com
// selo, então o cenário genérico sem nenhuma correção registrada devolve lista vazia.
// ---------------------------------------------------------------------------

function construirRegrasGenericas(cliente: string): Regra[] {
  const caminhoCliente = `clients/${cliente}/regras-cliente.md`
  const arquivo = existsSync(join(ROOT, caminhoCliente)) ? caminhoCliente : "clients/_template/regras-cliente.md"
  return lerRegrasDoArquivo(arquivo, cliente)
}

// ---------------------------------------------------------------------------
// Conexões e redes: cenário genérico com as 7 redes suportadas + infraestrutura básica
// do framework (banco de dados, servidor, mensageria) + um MCP de exemplo, todos "ainda
// não conectado" (o brief pede status desconhecida/desligada com ação conectar).
// ---------------------------------------------------------------------------

const REDES_SUPORTADAS: Rede[] = ["instagram", "linkedin", "youtube", "tiktok", "x", "meta_ads", "email"]

function construirConexoesGenericas(): Conexao[] {
  const redes: Conexao[] = REDES_SUPORTADAS.map((rede) => ({
    id: rede,
    nome: LABEL_REDE[rede],
    categoria: "rede",
    status: "desconhecida",
    conectadoEm: null,
    expiraEm: null,
    diasRestantes: null,
    renovacao: "manual",
    ultimoUso: null,
    conta: null,
    acao: "conectar",
    detalhe: "Ainda não conectado. Conecte esta rede pra começar a publicar.",
  }))
  const infra: Conexao[] = [
    { id: "banco_dados", nome: "Banco de dados", categoria: "infra", status: "desligada", conectadoEm: null, expiraEm: null, diasRestantes: null, renovacao: "nao_expira", ultimoUso: null, conta: null, acao: "conectar", detalhe: "Ainda não configurado." },
    { id: "servidor", nome: "Servidor", categoria: "infra", status: "desligada", conectadoEm: null, expiraEm: null, diasRestantes: null, renovacao: "nao_expira", ultimoUso: null, conta: null, acao: "conectar", detalhe: "Ainda não configurado." },
    { id: "mensageria", nome: "Mensageria", categoria: "infra", status: "desligada", conectadoEm: null, expiraEm: null, diasRestantes: null, renovacao: "nao_expira", ultimoUso: null, conta: null, acao: "conectar", detalhe: "Ainda não configurado." },
  ]
  const mcp: Conexao[] = [
    { id: "mcp:playwright", nome: "MCP Playwright", categoria: "mcp", status: "desconhecida", conectadoEm: null, expiraEm: null, diasRestantes: null, renovacao: "sessao", ultimoUso: null, conta: null, acao: "conectar", detalhe: "Ainda não conectado nesta sessão." },
  ]
  return [...redes, ...infra, ...mcp]
}

function construirRedesGenericas(): ResumoRede[] {
  return REDES_SUPORTADAS.map((rede) => ({
    rede,
    conta: null,
    estadoConta: "desligada",
    ultimosPosts: [],
    melhorHorario: null,
    automacao: { tipo: "nenhuma", regras: [] },
  }))
}

// ---------------------------------------------------------------------------
// Configuração: nomes de variável de ambiente são do framework (genéricos, o Kit inteiro
// usa os mesmos nomes), só a presença é fabricada no mock. kit.cliente é sempre o slug
// ativo desta pasta, nunca hardcoded.
// ---------------------------------------------------------------------------

const NOMES_CHAVES_ENV = [
  "ADMIN_USERNAME", "ADMIN_PASSWORD", "JWT_SECRET", "CREDENTIALS_ENCRYPTION_KEY",
  "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL",
  "INSTAGRAM_USER_ID", "INSTAGRAM_APP_SECRET", "INSTAGRAM_ACCESS_TOKEN",
  "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_PERSON_ID", "LINKEDIN_ACCESS_TOKEN",
  "YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN",
  "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_ACCESS_TOKEN",
  "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "NOTION_TOKEN",
  "ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "CONTENT_TEAM_MODEL", "OPENAI_API_KEY",
  "HEYGEN_API_KEY", "FIGMA_ACCESS_TOKEN", "HIGGSFIELD_API_KEY", "HIGGSFIELD_SECRET", "CRON_SECRET",
]

function construirConfiguracao(cliente: string, dono: string): Configuracao {
  return {
    banco: { modo: "nuvem", url: "definida em SUPABASE_URL (não exibida)", ok: true },
    modelos: [
      { familia: "claude", condutor: "Fable", subagente: "Sonnet", esforco: "high" },
      { familia: "codex", condutor: "Astra", subagente: "Luna", esforco: "high" },
      { familia: "grok", condutor: "4.6", subagente: null, esforco: "high" },
    ],
    chaves: NOMES_CHAVES_ENV.map((nome) => ({ nome, presente: true })),
    kit: { versao: "1.0.0", cliente, exportadoEm: null, dono },
  }
}

// ---------------------------------------------------------------------------
// seed.json de cliente (dado pessoal, fora do código): `clients/{slug}/sala-mock/seed.json`.
// Formato: ver o seed.json do cliente ativo desta pasta como exemplo real. Nunca lança
// se faltar ou vier corrompido, cai pro cenário genérico.
// ---------------------------------------------------------------------------

interface DefinicaoRegra { id: string; tipoConteudo: Regra["tipoConteudo"]; titulo: string; texto: string; selo?: Selo }

interface SeedJson {
  dono?: string // nome do dono da conta pra "<dono> pede"/"<dono> aprova" no mapa de /sala/ao-vivo
  agentOverrides?: Record<string, AgenteOverride>
  pecas?: Peca[]
  eventos?: Array<Omit<EventoAoVivo, "id">>
  conexoes?: Conexao[]
  regras?: DefinicaoRegra[]
  regrasArquivo?: string
  padroes?: PadraoVisual[]
  aprendizados?: Aprendizado[]
  calendario?: ItemCalendario[]
  redes?: ResumoRede[]
  onboarding?: RespostasBloco[]
  alertas?: VisaoGeral["alertas"]
  ritmo?: VisaoGeral["ritmo"]
}

function lerSeedJson(cliente: string): SeedJson | null {
  const raw = lerArquivo(`clients/${cliente}/sala-mock/seed.json`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SeedJson
  } catch {
    // ponytail: JSON de cliente corrompido cai pro cenário genérico em vez de derrubar a Sala.
    return null
  }
}

// ---------------------------------------------------------------------------
// Estado completo do mock.
// ---------------------------------------------------------------------------

export interface EstadoSala {
  pecas: Peca[]
  agentes: Agente[]
  eventos: EventoAoVivo[]
  conexoes: Conexao[]
  regras: Regra[]
  padroes: PadraoVisual[]
  aprendizados: Aprendizado[]
  calendario: ItemCalendario[]
  redes: ResumoRede[]
  configuracao: Configuracao
  onboarding: BlocoOnboarding[]
  alertas: VisaoGeral["alertas"]
  ritmo: VisaoGeral["ritmo"]
}

// Resolve o cliente ativo desta pasta (fontes/cliente.ts: .workspace > clients/active-client.md).
// Nunca hardcoded: se o cliente mudar (ex. acme), o kit.cliente da configuração acompanha.
// Cai pra "generico" só se a resolução falhar (ex. rodando fora do repo, sem clients/ nenhum).
export async function resolverClienteAtivo(): Promise<string> {
  return resolverClienteAtivoFonte()
}

export type CenarioSeed = "padrao" | "vazio"

export async function construirSeed(cenario: CenarioSeed = "padrao"): Promise<EstadoSala> {
  const clienteAtivo = await resolverClienteAtivo()
  const seedJson = cenario === "padrao" ? lerSeedJson(clienteAtivo) : null

  const agentes = construirAgentes(clienteAtivo, seedJson?.agentOverrides ?? {})
  const configuracao = construirConfiguracao(clienteAtivo, seedJson?.dono ?? "Você")

  if (!seedJson) {
    return {
      pecas: [],
      agentes,
      eventos: [],
      conexoes: construirConexoesGenericas(),
      regras: construirRegrasGenericas(clienteAtivo),
      padroes: [],
      aprendizados: [],
      calendario: [],
      redes: construirRedesGenericas(),
      configuracao,
      onboarding: lerOnboarding(clienteAtivo, []),
      alertas: [],
      ritmo: [],
    }
  }

  const regrasArquivo = seedJson.regrasArquivo ?? `clients/${clienteAtivo}/regras-cliente.md`
  const definicoesRegras = seedJson.regras ?? []
  const hashRegras = sha256(lerArquivo(regrasArquivo) ?? definicoesRegras.map((r) => r.texto).join("\n"))

  return {
    pecas: (seedJson.pecas ?? []).map(sanearPeca),
    agentes,
    eventos: (seedJson.eventos ?? []).map((e, i) => ({ id: `evt-${String(i + 1).padStart(2, "0")}`, ...e })),
    conexoes: seedJson.conexoes ?? construirConexoesGenericas(),
    regras: definicoesRegras.map((d) => ({
      id: d.id,
      tipoConteudo: d.tipoConteudo,
      selo: d.selo ?? "REINCIDENTE",
      titulo: d.titulo,
      texto: d.texto.trim(),
      arquivo: regrasArquivo,
      atualizadoEm: null,
      hash: hashRegras,
    })),
    padroes: seedJson.padroes ?? [],
    aprendizados: seedJson.aprendizados ?? [],
    calendario: seedJson.calendario ?? [],
    redes: seedJson.redes ?? construirRedesGenericas(),
    configuracao,
    onboarding: lerOnboarding(clienteAtivo, seedJson.onboarding ?? []),
    alertas: seedJson.alertas ?? [],
    ritmo: seedJson.ritmo ?? [],
  }
}
