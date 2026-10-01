// Parsers de agents/*.md e references/skill-agent-map.md, compartilhados pelo mock e pelo
// provedor live (Tarefa A2). Le agents/*.md (frontmatter name/description) sem gray-matter
// (nao e dependencia do projeto), e a familia de cada um via references/skill-agent-map.md.
// Os 25 agentes fazem parte do framework (ficam no Kit); status/tarefa/memoria/ultimas pecas
// sao dado de cliente e ficam por conta de quem chama (mock: seed.json; live: ct_agents/ct_tasks).
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { type Agente } from "@/lib/sala/types"
import { ROOT, lerArquivo } from "./arquivos"
import { sha256 } from "./hash"

const FAMILIA_BASE = [
  "ct-diretor", "ct-agenda", "ct-redator", "ct-pesquisador", "ct-reciclador",
  "ct-designer", "ct-carrossel", "ct-video", "ct-social", "ct-email",
  "ct-otimizador", "ct-parcerias", "ct-integrador", "ct-trafego", "ct-story",
]
const FAMILIA_BRIDGE = [
  "ct-video-higgsfield", "ct-video-remotion", "ct-video-mpt", "ct-video-hypit", "ct-video-editor",
]
const FAMILIA_ADS = [
  "ct-ads-audit", "ct-ads-conversion-audit", "ct-ads-creative-audit",
  "ct-ads-budget-audit", "ct-ads-account-structure-audit",
]
const NOMES_LEGIVEIS: Record<string, string> = {
  "ct-ads-audit": "Coordenador de anúncios",
  "ct-ads-conversion-audit": "Conversão dos anúncios",
  "ct-ads-creative-audit": "Criativos dos anúncios",
  "ct-ads-budget-audit": "Orçamento dos anúncios",
  "ct-ads-account-structure-audit": "Estrutura das campanhas",
  "ct-video-higgsfield": "Vídeo com Higgsfield",
  "ct-video-remotion": "Animação com Remotion",
  "ct-video-mpt": "Vídeo sem rosto",
  "ct-video-hypit": "Clonar estrutura de vídeo",
  "ct-video-editor": "Editor de vídeo",
}

export function familiaDe(slug: string): Agente["familia"] {
  if (FAMILIA_BRIDGE.includes(slug)) return "bridge"
  if (FAMILIA_ADS.includes(slug)) return "ads"
  return "base"
}

// ponytail: regex simples em vez de um parser de YAML completo, o frontmatter destes
// arquivos e sempre uma linha por chave.
export function parseFrontmatter(raw: string): { name: string; description: string } {
  // Correção: metade dos arquivos de agents/*.md está em CRLF (Windows) e a outra
  // metade em LF. Sem o \r? opcional, o bloco de frontmatter nunca batia nos arquivos
  // CRLF e todo agente caía no fallback "(sem description no frontmatter)".
  const bloco = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!bloco) return { name: "", description: "" }
  const fm = bloco[1]
  const name = fm.match(/^name:\s*(.+?)\r?$/m)?.[1]?.trim() ?? ""
  const description = fm.match(/^description:\s*"([\s\S]*?)"\s*\r?$/m)?.[1]?.trim() ?? ""
  return { name, description }
}

// Extrai "skill -> [agentes dono]" de references/skill-agent-map.md (tabelas markdown
// "| skill | dono | descricao |"). Dono pode ser composto ("ct-designer + ct-video") ou
// levar uma anotacao entre parenteses ("(dono atribuido em 07/set/2026)"): ambos sao tratados.
export function parseSkillAgentMap(): Record<string, string[]> {
  const raw = lerArquivo("references/skill-agent-map.md")
  const mapa: Record<string, string[]> = {}
  if (!raw) return mapa
  for (const linha of raw.split("\n")) {
    const m = linha.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/)
    if (!m) continue
    const skillRaw = m[1].trim()
    const donoRaw = m[2].trim()
    if (skillRaw.toLowerCase() === "skill" || skillRaw.startsWith("---")) continue
    const skill = skillRaw.replace(/`/g, "").replace(/\[cmd\]|\[local\]|\[plugin externo\]/g, "").trim()
    if (!skill) continue
    const donos = donoRaw
      .replace(/`/g, "")
      .replace(/\([^)]*\)/g, "")
      .split("+")
      .map((d) => d.trim())
      .filter((d) => d.startsWith("ct-"))
    for (const dono of donos) {
      if (!mapa[dono]) mapa[dono] = []
      if (!mapa[dono].includes(skill)) mapa[dono].push(skill)
    }
  }
  return mapa
}

function contextoPadraoDe(cliente: string, familia: Agente["familia"]): string[] {
  if (familia === "bridge") return [`clients/${cliente}/design-system.md`]
  if (familia === "ads") return [`clients/${cliente}/brand-profile.md`]
  return [`clients/${cliente}/brand-profile.md`, `clients/${cliente}/design-system.md`, `clients/${cliente}/regras-cliente.md`]
}

// Le os 25 agentes do disco (agents/*.md), sem enriquecimento de cliente: status "parado",
// tarefaAtual/ultimaAtividade null, memoriaRecente/ultimasPecas vazios. Quem chama (mock:
// seed.json; live: ct_agents/ct_tasks/ai-memory) sobrepoe esses campos por cima.
export function lerAgentesDoDisco(cliente: string): Agente[] {
  const agentsDir = join(ROOT, "agents")
  const arquivos = existsSync(agentsDir)
    ? readdirSync(agentsDir).filter((f) => f.endsWith(".md")).sort()
    : []
  const skillsPorAgente = parseSkillAgentMap()

  return arquivos.map((arquivo) => {
    const slug = arquivo.replace(/\.md$/, "")
    const raw = readFileSync(join(agentsDir, arquivo), "utf-8")
    const { name, description } = parseFrontmatter(raw)
    const familia = familiaDe(slug)

    const agente: Agente = {
      slug,
      nome: NOMES_LEGIVEIS[slug] ?? (name || slug).replace(/^ct-/, "").replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      funcao: description || "(sem description no frontmatter)",
      familia,
      status: "parado",
      tarefaAtual: null,
      ultimaAtividade: null,
      promptMd: raw,
      promptHash: sha256(raw),
      contexto: contextoPadraoDe(cliente, familia),
      skills: skillsPorAgente[slug] ?? [],
      memoriaRecente: [],
      ultimasPecas: [],
    }
    return agente
  })
}
