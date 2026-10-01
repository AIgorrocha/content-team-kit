#!/usr/bin/env node
// Vigia da Sala de Comando (Tarefa B1, ADR 3.1): observa os arquivos que SÃO a fonte
// (agents/*.md, skills/*/SKILL.md, clients/*/*.md e regras locais) e sobe pro Supabase
// o que a Sala já sabe ler (ct_agent_prompts, ct_agents, ct_skills, ct_rules). Edição pela
// tela (rota grava o arquivo) e edição pelo terminal (git, editor) caem aqui do mesmo jeito:
// uma fonte, dois pontos de entrada.
//
// NUNCA reseta ct_agents.status (a rota antiga sync-agents-push.mjs fazia isso e apagaria o
// estado "trabalhando agora" de um agente no meio de uma tarefa).
//
// Uso: node scripts/sala/watch-sync.mjs
// SALA_WATCH_POLL=1 força polling (útil em filesystem de rede / alguns setups de container).

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, appendFileSync, writeFileSync, rmSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import chokidar from "chokidar"
import dotenv from "dotenv"
import { Pool } from "pg"
import { arquivoRegrasCliente } from "./arquivo-regras.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")

dotenv.config({ quiet: true, path: join(ROOT, ".env.local") })
const regrasLegadas = process.env.SALA_REGRAS_CLIENT ? arquivoRegrasCliente(process.env.SALA_REGRAS_CLIENT, ROOT) : null

const OUTPUT_DIR = join(ROOT, "output")
mkdirSync(OUTPUT_DIR, { recursive: true })
const LOG_PATH = join(OUTPUT_DIR, "sala-watch.log")
const HEARTBEAT_PATH = join(OUTPUT_DIR, "sala-watch.heartbeat")

function log(msg) {
  const linha = `[${new Date().toISOString()}] ${msg}`
  console.log(linha)
  try {
    appendFileSync(LOG_PATH, linha + "\n")
  } catch {
    // arquivo de log é só conveniência, nunca derruba o vigia.
  }
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL não definida (.env.local). O vigia precisa do banco pra sincronizar.")
  process.exit(1)
}
// Mesma regra de src/lib/db.ts: SSL desligado só em Postgres local.
const isLocalDb = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname)
const useSsl = !isLocalDb && process.env.DATABASE_SSL !== "false"
const pool = new Pool({ connectionString: databaseUrl, ssl: useSsl ? { rejectUnauthorized: false } : undefined })

function sha256(texto) {
  return createHash("sha256").update(texto, "utf-8").digest("hex")
}

// Mesmo regex de src/lib/sala/fontes/agentes.ts (CRLF-safe). Duplicado aqui porque este é
// um script Node puro (sem alias @/, sem tsx): se o formato do frontmatter mudar, ajuste os
// dois lugares.
function parseFrontmatter(raw) {
  const bloco = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!bloco) return { name: "", description: "" }
  const fm = bloco[1]
  const name = fm.match(/^name:\s*(.+?)\r?$/m)?.[1]?.trim() ?? ""
  const description = fm.match(/^description:\s*"([\s\S]*?)"\s*\r?$/m)?.[1]?.trim() ?? ""
  return { name, description }
}

// Mesma heurística de scripts/sync-skills-push.mjs, pra ficar consistente com a
// categorização que a reconciliação completa (`npm run sync:skills`) já usa.
function inferCategory(slug) {
  if (slug.includes("publicar") || slug.includes("agendar")) return "Publicacao"
  if (slug.includes("pesquisa") || slug.includes("analisar") || slug.includes("seo") || slug === "ct-web") return "Pesquisa"
  if (["carrossel", "story", "reel", "telas", "thumbnail", "adaptar", "notebook", "linkedin", "extrair"].some((k) => slug.includes(k)))
    return "Criacao"
  if (slug.includes("banco") || slug.includes("orquestrador") || slug.includes("obsidian")) return "Ferramentas"
  if (slug.includes("help")) return "Ajuda"
  if (slug.includes("ads") || slug.includes("trafego")) return "Ads"
  return "Outros"
}

// Mesmo regex de src/lib/sala/fontes/regras.ts (extrairSelo + varredura de blocos).
function extrairSelo(linhaHeading) {
  const m = linhaHeading.match(/^(#{2,4})\s+(.+?)\s*`\[(FIXA|REINCIDENTE|HIPOTESE)\]`/)
  if (!m) return null
  return { nivel: m[1].length, titulo: m[2].trim(), selo: m[3] }
}

function parseRegras(raw) {
  const linhas = raw.split(/\r?\n/)
  const regras = []
  let contador = 0
  for (let i = 0; i < linhas.length; i++) {
    const info = extrairSelo(linhas[i])
    if (!info) continue
    contador++
    const corpo = []
    for (let j = i + 1; j < linhas.length; j++) {
      const proxHeading = linhas[j].match(/^(#{1,6})\s+/)
      if (proxHeading && proxHeading[1].length <= info.nivel) break
      corpo.push(linhas[j])
    }
    regras.push({ ruleKey: String(contador), label: info.selo, text: corpo.join("\n").trim() })
  }
  return regras
}

async function upsertAgente(slug, absPath) {
  const raw = await readFile(absPath, "utf-8")
  const { name, description } = parseFrontmatter(raw)
  const displayName = (name || slug).replace(/^ct-/, "").replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  // ct_agents.role é varchar(50) em produção (mesmo limite de sync-agents-push.mjs):
  // sem o corte, description longa derruba o upsert (só descobri rodando de verdade contra
  // o banco real).
  const role = (description || "").slice(0, 50)

  await pool.query(
    `insert into ct_agent_prompts (agent_slug, prompt_md, config, updated_at)
     values ($1, $2, $3::jsonb, now())
     on conflict (agent_slug) do update set prompt_md = $2, config = $3::jsonb, updated_at = now()`,
    [slug, raw, JSON.stringify({ source: "watch-sync", description })]
  )
  // status só entra no valor do INSERT (agente novo). No conflito, o SET não toca status:
  // nunca reseta um agente "trabalhando" pra "idle" só porque o prompt mudou.
  // config faz merge raso (||) em vez de substituir: preserva campos gravados por outros
  // pontos (ex.: produces_content), só atualiza description.
  await pool.query(
    `insert into ct_agents (slug, display_name, role, config, status)
     values ($1, $2, $3, $4::jsonb, 'idle')
     on conflict (slug) do update
       set display_name = $2, role = $3, config = coalesce(ct_agents.config, '{}'::jsonb) || $4::jsonb`,
    [slug, displayName, role, JSON.stringify({ description })]
  )
  log(`agente sincronizado: ${slug}`)
}

async function upsertSkill(slug, absPath) {
  const raw = await readFile(absPath, "utf-8")
  const { name, description } = parseFrontmatter(raw)
  await pool.query(
    `insert into ct_skills (slug, name, description, category, content, path, active, updated_at)
     values ($1, $2, $3, $4, $5, $6, true, now())
     on conflict (slug) do update
       set name = $2, description = $3, category = $4, content = $5, path = $6, active = true, updated_at = now()`,
    [slug, name || slug, (description || "").slice(0, 500), inferCategory(slug), raw, absPath.replace(ROOT, "").replace(/\\/g, "/")]
  )
  log(`skill sincronizada: ${slug}`)
}

async function desativarSkill(slug) {
  await pool.query(`update ct_skills set active = false, updated_at = now() where slug = $1`, [slug])
  log(`skill desativada (arquivo removido): ${slug}`)
}

async function sincronizarRegras(clientSlug, filePath, absPath) {
  const raw = existsSync(absPath) ? await readFile(absPath, "utf-8") : null
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query(`delete from ct_rules where client_slug = $1 and file_path = $2`, [clientSlug, filePath])
    if (raw != null) {
      const fileHash = sha256(raw)
      for (const regra of parseRegras(raw)) {
        await client.query(
          `insert into ct_rules (client_slug, scope, file_path, rule_key, content_type, label, text, file_hash, updated_at)
           values ($1, 'client', $2, $3, null, $4, $5, $6, now())`,
          [clientSlug, filePath, regra.ruleKey, regra.label, regra.text, fileHash]
        )
      }
    }
    await client.query("COMMIT")
    log(`regras sincronizadas: ${filePath} (cliente ${clientSlug})`)
  } catch (err) {
    await client.query("ROLLBACK")
    log(`erro sincronizando regras de ${filePath}: ${err.message}`)
  } finally {
    client.release()
  }
}

// Roteamento por caminho relativo (normalizado com "/"). depth:1 do watcher já limita o
// alcance; aqui só decide o QUE fazer com cada arquivo que passou.
async function onChange(event, relPath) {
  const absPath = join(ROOT, relPath)

  if (relPath === "references/__sala_watch_selftest__.md") return // arquivo do autoteste, ignora

  const agente = relPath.match(/^agents\/([a-z0-9-]+)\.md$/)
  if (agente) {
    if (event === "unlink") return log(`aviso: ${relPath} foi removido, nada sincronizado`)
    return upsertAgente(agente[1], absPath).catch((err) => log(`erro sincronizando ${relPath}: ${err.message}`))
  }

  const skill = relPath.match(/^skills\/([^/]+)\/SKILL\.md$/)
  if (skill) {
    if (event === "unlink") return desativarSkill(skill[1]).catch((err) => log(`erro desativando skill ${skill[1]}: ${err.message}`))
    return upsertSkill(skill[1], absPath).catch((err) => log(`erro sincronizando ${relPath}: ${err.message}`))
  }

  const regrasCliente = relPath.match(/^clients\/([^/]+)\/regras-cliente\.md$/)
  if (regrasCliente) {
    return sincronizarRegras(regrasCliente[1], relPath, absPath).catch((err) => log(`erro sincronizando ${relPath}: ${err.message}`))
  }

  if (regrasLegadas && relPath === regrasLegadas) {
    return sincronizarRegras(process.env.SALA_REGRAS_CLIENT, relPath, absPath).catch(() => log("erro sincronizando regras locais"))
  }

  // clients/*/design-system.md, clients/*/brand-profile.md, references/*.md: observados
  // (fazem parte da ADR 3.1) mas ainda sem tabela própria (ct_design_system não existe
  // nesta migration). Só loga; nada quebra quando essa tabela nascer numa tarefa futura.
  log(`arquivo mudou (sem sincronização de banco ainda): ${relPath}`)
}

const timers = new Map()
function debounced(event, relPath) {
  clearTimeout(timers.get(relPath))
  timers.set(
    relPath,
    setTimeout(() => {
      timers.delete(relPath)
      onChange(event, relPath).catch((err) => log(`erro inesperado em ${relPath}: ${err.message}`))
    }, 500)
  )
}

function criarWatcher(usePolling) {
  return chokidar.watch(["agents", "skills", "clients", "references", ...(regrasLegadas ? [regrasLegadas] : [])], {
    cwd: ROOT,
    ignoreInitial: true,
    followSymlinks: false,
    depth: 1, // skills/{x}/SKILL.md e clients/{x}/*.md cabem
    usePolling,
    interval: usePolling ? 300 : undefined,
  })
}

let watcher = criarWatcher(process.env.SALA_WATCH_POLL === "1")
let eventoVisto = false

const testFile = join(ROOT, "references", "__sala_watch_selftest__.md")
let autotesteCriado = false
function limparAutoteste() {
  if (!autotesteCriado) return
  autotesteCriado = false
  try {
    rmSync(testFile, { force: true }) // force:true já ignora se o arquivo não existir mais
  } catch {
    // melhor esforço: nunca derruba o vigia por causa do autoteste
  }
}

function anexarHandlers(w) {
  w.on("all", (event, relPathRaw) => {
    const relPath = relPathRaw.replace(/\\/g, "/")
    if (relPath.endsWith(".sala-lock") || /\.tmp-[a-f0-9-]+$/.test(relPath)) return
    const jaTinhaVisto = eventoVisto
    eventoVisto = true
    // Primeira prova de evento nativo: não precisa segurar o arquivo de autoteste até o
    // timeout de 30s (o vigia pode ser derrubado antes disso, ex.: suíte de teste curta).
    if (!jaTinhaVisto) limparAutoteste()
    if (event === "add" || event === "change" || event === "unlink") debounced(event, relPath)
  })
  w.on("error", (err) => log(`erro do watcher: ${err.message}`))
}
anexarHandlers(watcher)

watcher.on("ready", () => {
  log(`vigia pronto (${process.env.SALA_WATCH_POLL === "1" ? "polling forçado" : "eventos nativos"})`)
  if (process.env.SALA_WATCH_POLL === "1") return

  // Autoteste: se o evento nativo não chegar em 30s depois de tocar um arquivo watchado,
  // o filesystem local não está entregando eventos (comum em alguns setups de rede/container)
  // e o vigia troca sozinho pra polling.
  eventoVisto = false
  try {
    writeFileSync(testFile, "autoteste do vigia, pode apagar", { flag: "wx" })
    autotesteCriado = true
  } catch (err) {
    log(`aviso: autoteste do vigia não pôde escrever ${testFile}: ${err.message}`)
    // Sobra de uma execução anterior interrompida antes de limpar (ex.: SIGKILL): apaga
    // agora, ignorando erro se já não existir, pra não vazar pro repo pra sempre.
    try {
      rmSync(testFile, { force: true })
    } catch {
      // ignora: melhor esforço
    }
    return
  }
  setTimeout(async () => {
    limparAutoteste()
    if (eventoVisto) return
    log("evento nativo não chegou em 30s: trocando para polling")
    await watcher.close()
    watcher = criarWatcher(true)
    anexarHandlers(watcher)
  }, 30_000)
})

const heartbeat = setInterval(() => {
  try {
    writeFileSync(HEARTBEAT_PATH, new Date().toISOString())
  } catch {
    // heartbeat é só sinal de "vigia vivo"; falha de escrita não derruba o processo.
  }
}, 5000)

let encerrando = false
async function encerrar() {
  if (encerrando) return
  encerrando = true
  log("encerrando vigia (SIGINT)")
  clearInterval(heartbeat)
  for (const t of timers.values()) clearTimeout(t)
  try {
    rmSync(HEARTBEAT_PATH, { force: true })
    rmSync(testFile, { force: true }) // force:true ignora se o autoteste nunca chegou a criar
  } catch {
    // best effort
  }
  await watcher.close()
  await pool.end()
  process.exit(0)
}
process.on("SIGINT", encerrar)
process.on("SIGTERM", encerrar)

log(`vigia iniciado (root: ${ROOT})`)
