// Agentes no provedor live (Tarefa A3): agents/*.md (fontes/agentes, framework) + status
// real de ct_agents + tarefa em andamento de ct_tasks + últimas peças de ct_audit_log +
// memória recente via CLI do ai-memory (timeout 5s, cache 60s, nunca lança).
import { execFile } from "node:child_process"
import { homedir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { type Agente, type StatusAgente } from "@/lib/sala/types"
import { lerAgentesDoDisco } from "@/lib/sala/fontes"
import { query } from "@/lib/db"

const execFileAsync = promisify(execFile)
const AI_MEMORY_BIN = join(homedir(), "bin", "ai-memory.exe")

// Cache de 60s por (cliente, projeto, termo, limite), incluindo falhas. Chamadas iguais que
// chegam enquanto o CLI ainda roda compartilham a mesma promessa.
const cacheMemoria = new Map<string, { expiraEm: number; valor: MemoriaEncontrada[] }>()
const memoriaEmAndamento = new Map<string, Promise<MemoriaEncontrada[]>>()

export interface MemoriaEncontrada { titulo: string; caminho: string; data: string }

// Formato real do `ai-memory search`: por resultado, uma linha "  <caminho>  rank=..."
// seguida da linha de título (4 espaços) e um trecho (ignorado aqui).
function parseSaidaAiMemory(stdout: string): MemoriaEncontrada[] {
  const linhas = stdout.split(/\r?\n/)
  const resultados: MemoriaEncontrada[] = []
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(/^ {2}(\S.*?) {2,}rank=/)
    if (!m) continue
    const caminho = m[1].trim()
    const titulo = (linhas[i + 1] ?? "").trim()
    const dataMatch = `${caminho} ${titulo}`.match(/\d{4}-\d{2}-\d{2}/)
    resultados.push({ titulo, caminho, data: dataMatch?.[0] ?? "" })
  }
  return resultados
}

// ponytail: um processo novo por busca (sem daemon/pool). A lista e o quadro não buscam
// memória; só o detalhe de um agente e o cartão de aprendizados usam esta função.
export async function buscarMemoria(termo: string, limite: number, cliente: string): Promise<MemoriaEncontrada[]> {
  const projeto = process.env.SALA_MEMORY_CLIENT === cliente && process.env.SALA_MEMORY_PROJECT
    ? process.env.SALA_MEMORY_PROJECT : cliente
  const chave = `${cliente}:${projeto}:${termo}:${limite}`
  const emCache = cacheMemoria.get(chave)
  if (emCache && emCache.expiraEm > Date.now()) return emCache.valor
  const emAndamento = memoriaEmAndamento.get(chave)
  if (emAndamento) return emAndamento

  const promessa = (async () => {
    try {
      const { stdout } = await execFileAsync(
        AI_MEMORY_BIN,
        ["search", "--workspace", "default", "--project", projeto, "--limit", String(limite), termo],
        { timeout: 5000 }
      )
      return parseSaidaAiMemory(stdout)
    } catch {
      // CLI ausente, timeout ou servidor fora: nunca derruba a Sala por causa da memória.
      return []
    }
  })()
    .then((valor) => {
      // Falhas também entram no cache: uma tela sem o servidor não cria um processo novo a
      // cada agente ou a cada renderização durante a janela de 60s.
      cacheMemoria.set(chave, { expiraEm: Date.now() + 60_000, valor })
      return valor
    })
    .finally(() => {
      memoriaEmAndamento.delete(chave)
    })
  memoriaEmAndamento.set(chave, promessa)
  return promessa
}

function mapStatus(status: string | null | undefined): StatusAgente {
  if (status === "working") return "trabalhando"
  if (status === "error") return "erro"
  return "parado"
}

interface LinhaAgente { slug: string; status: string | null; last_active_at: string | null }
interface LinhaTarefa { assigned_agent: string; title: string; updated_at: string }
interface LinhaAuditoria { agent: string; slug: string | null }

// ct_tasks não tem coluna client_slug própria (é gravado dentro de metadata):
// filtra por metadata->>'client_slug' pra não misturar tarefa de outro cliente.
async function lerTarefasEmAndamento(cliente: string): Promise<Map<string, string>> {
  const linhas = await query<LinhaTarefa>(
    `select assigned_agent, title, updated_at from ct_tasks
     where status in ('pending', 'in_progress') and assigned_agent is not null
       and metadata->>'client_slug' = $1
     order by updated_at desc`,
    [cliente]
  )
  const porAgente = new Map<string, string>()
  for (const t of linhas) if (!porAgente.has(t.assigned_agent)) porAgente.set(t.assigned_agent, t.title)
  return porAgente
}

// ct_audit_log guarda target_id (uuid de ct_content_items), não o slug: junta com
// ct_content_items pra chegar no slug real da peça. Tolerante: tabela vazia (caso de hoje)
// ou join sem retorno não quebra a tela, só devolve listas vazias.
async function lerUltimasPecasPorAgente(cliente: string): Promise<Map<string, string[]>> {
  let linhas: LinhaAuditoria[] = []
  try {
    linhas = await query<LinhaAuditoria>(
      `select a.agent as agent, coalesce(ci.metadata->>'piece_slug', ci.metadata->>'slug') as slug
       from ct_audit_log a
       join ct_content_items ci on ci.id = a.target_id
       where a.target_type = 'content_item' and a.agent is not null and ci.client_slug = $1
       order by a.created_at desc
       limit 300`,
      [cliente]
    )
  } catch {
    return new Map()
  }
  const porAgente = new Map<string, string[]>()
  for (const l of linhas) {
    if (!l.slug) continue
    const atuais = porAgente.get(l.agent) ?? []
    if (atuais.length < 5 && !atuais.includes(l.slug)) porAgente.set(l.agent, [...atuais, l.slug])
  }
  return porAgente
}

// Sem agenteComMemoria, serve listas e o quadro sem disparar um processo por agente. Quando
// informado, mantém memória somente para o agente pedido pelo painel de detalhe.
export async function lerAgentesLive(cliente: string, agenteComMemoria?: string): Promise<Agente[]> {
  const agentesDoDisco = lerAgentesDoDisco(cliente)
  const [linhasDb, tarefaPorAgente, ultimasPecasPorAgente] = await Promise.all([
    query<LinhaAgente>(
      `select distinct on (agent) agent as slug,
        case when event in ('agente_iniciou', 'diretor_planejou', 'agente_ferramenta') then 'working'
             when event = 'erro' then 'error' else 'idle' end as status,
        ts as last_active_at
       from ct_agent_events where client_slug = $1 and agent is not null
       order by agent, ts desc, id desc`,
      [cliente]
    ),
    lerTarefasEmAndamento(cliente),
    lerUltimasPecasPorAgente(cliente),
  ])
  const dbPorSlug = new Map(linhasDb.map((r) => [r.slug, r]))

  return Promise.all(
    agentesDoDisco.map(async (agente): Promise<Agente> => {
      const db = dbPorSlug.get(agente.slug)
      const memoriaRecente = agente.slug === agenteComMemoria ? await buscarMemoria(agente.slug, 3, cliente) : []
      return {
        ...agente,
        status: db ? mapStatus(db.status) : agente.status,
        ultimaAtividade: db?.last_active_at ?? agente.ultimaAtividade,
        tarefaAtual: tarefaPorAgente.get(agente.slug) ?? null,
        memoriaRecente,
        ultimasPecas: ultimasPecasPorAgente.get(agente.slug) ?? [],
      }
    })
  )
}
