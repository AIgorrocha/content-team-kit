// Configuração no provedor live (Tarefa A3): banco (local/nuvem pela URL real), modelos
// (~/.codex/config.toml e ~/.claude/settings.json, só nomes de modelo, grok é fixo por
// convenção do projeto), chaves (presença de variável, nunca o valor) e kit.dono (extraído de
// clients/{slug}/brand-profile.md).
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import packageJson from "../../../../../package.json"
import { type Configuracao } from "@/lib/sala/types"
import { lerArquivo } from "@/lib/sala/fontes"
import { query } from "@/lib/db"

const NOMES_CHAVES_ENV = [
  "ADMIN_USERNAME", "ADMIN_PASSWORD", "JWT_SECRET", "CREDENTIALS_ENCRYPTION_KEY",
  "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL",
  "INSTAGRAM_USER_ID", "INSTAGRAM_APP_SECRET", "INSTAGRAM_ACCESS_TOKEN",
  "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_ACCESS_TOKEN",
  "YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN",
  "TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_ACCESS_TOKEN",
  "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "NOTION_TOKEN",
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "HIGGSFIELD_API_KEY", "CRON_SECRET",
]

function mascararUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//***@${u.host}${u.pathname}`
  } catch {
    return "(não configurada)"
  }
}

async function lerBanco(): Promise<Configuracao["banco"]> {
  const url = process.env.DATABASE_URL ?? ""
  let local = false
  try { local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname) } catch { /* não configurado */ }
  let ok = false
  try {
    await query("select 1")
    ok = true
  } catch {
    ok = false
  }
  return { modo: local ? "local" : "nuvem", url: url ? mascararUrl(url) : "(não configurada)", ok, editavel: false }
}

export class ConfiguracaoManual extends Error {
  constructor() { super("Banco e modelos são configurados na instalação. A tela mostra a configuração em uso.") }
}

function lerModelosCodex(): { condutor: string; subagente: string | null; esforco: string } | null {
  const caminho = join(homedir(), ".codex", "config.toml")
  if (!existsSync(caminho)) return null
  const raw = readFileSync(caminho, "utf-8")
  const condutor = raw.match(/^model\s*=\s*"([^"]+)"/m)?.[1] ?? "(desconhecido)"
  const esforco = raw.match(/^model_reasoning_effort\s*=\s*"([^"]+)"/m)?.[1] ?? "-"
  const blocoAgents = raw.match(/\[agents\][\s\S]*?(?=\n\[|$)/)?.[0] ?? ""
  const subagente = blocoAgents.match(/default_subagent_model\s*=\s*"([^"]+)"/)?.[1] ?? null
  return { condutor, subagente, esforco }
}

function lerModelosClaude(): { condutor: string; subagente: string | null; esforco: string } | null {
  const caminho = join(homedir(), ".claude", "settings.json")
  if (!existsSync(caminho)) return null
  try {
    const config = JSON.parse(readFileSync(caminho, "utf-8")) as { model?: string; env?: Record<string, string> }
    return { condutor: config.model ?? "(desconhecido)", subagente: config.env?.CLAUDE_CODE_SUBAGENT_MODEL ?? null, esforco: "-" }
  } catch {
    return null
  }
}

function extrairDono(cliente: string): string {
  const raw = lerArquivo(`clients/${cliente}/brand-profile.md`)
  if (!raw) return "Você"
  const blocoQuem = raw.match(/^##\s*Quem[^\n]*\n([\s\S]{0,600})/im)?.[1] ?? raw.slice(0, 600)
  const nome = blocoQuem.match(/\*\*([^*]{2,60}?)\*\*/)?.[1]?.trim()
  if (!nome) return "Você"
  return nome.split(/\s+/)[0]
}

export async function lerConfiguracaoLive(cliente: string): Promise<Configuracao> {
  const banco = await lerBanco()
  const codex = lerModelosCodex()
  const claude = lerModelosClaude()

  const modelos: Configuracao["modelos"] = [
    { familia: "claude", condutor: claude?.condutor ?? "(desconhecido)", subagente: claude?.subagente ?? null, esforco: claude?.esforco ?? "-" },
    { familia: "codex", condutor: codex?.condutor ?? "(desconhecido)", subagente: codex?.subagente ?? null, esforco: codex?.esforco ?? "-" },
    { familia: "grok", condutor: "grok-4.6", subagente: null, esforco: "high" },
  ]

  const chaves = NOMES_CHAVES_ENV.map((nome) => ({ nome, presente: !!process.env[nome] }))

  return {
    banco,
    modelos,
    chaves,
    kit: { versao: (packageJson as { version?: string }).version ?? "0.0.0", cliente, exportadoEm: null, dono: extrairDono(cliente) },
  }
}
