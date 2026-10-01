#!/usr/bin/env node
// Encaminha eventos de terminal (Claude Code, Codex, Kimi Code, Grok) pra ct_agent_events
// via POST /api/sala/eventos/ingest (Tarefa B2, ampliado na Batelada B7).
// Formatos aceitos, detectados pelo conteudo do JSON ou por --familia explicito:
// - Claude Code: hook padrao (stdin JSON com hook_event_name). Ver
//   https://docs.claude.com/en/docs/claude-code/hooks
// - Codex CLI: `notify` chama este script com o JSON como UNICO argumento de linha de
//   comando (nao stdin), campos `type`, `turn-id`, `input-messages`, `last-assistant-message`.
// - Kimi Code CLI: hooks do config.toml mandam JSON no stdin com campo `event` (mesmos
//   nomes de evento do Claude Code) em vez de `hook_event_name`.
// - Grok (sem hook oficial): `--familia grok --evento <tipo> --agente <nome> --tarefa "<texto>"`
//   por linha de comando, sem stdin.
//
// Regras duras deste script:
// - SEMPRE sai com codigo 0 (hook nunca pode travar o terminal).
// - NUNCA imprime nada em stdout (hooks tratam stdout como feedback pro usuario).
// - Timeout de 2s no POST; falha vira fila local (output/sala-hook-queue.jsonl, max 200 linhas).
// - Le token e URL do .env.local relativo ao cwd que o hook informa (nao o cwd do processo).
// - NUNCA persiste payload bruto (prompt, tool args, output) em disco ou em ct_agent_events:
//   so strings de allowlist fixa (evento/agente/ferramenta) e resumo generico.
//
// Mapeamento (evento -> caixa do mapa /sala/ao-vivo):
//   UserPromptSubmit -> caixa 1 "pedido"
//   SubagentStart     -> caixa 2 "diretor_planejou" se for ct-diretor, senao caixa 3 "agente_iniciou"
//   SubagentStop      -> caixa 3 "agente_concluiu"
//   Stop              -> caixa 6 "registrado"
//   PostToolUse(Agent) -> SEM EVENTO (decisao: SubagentStart/SubagentStop ja cobrem inicio e fim
//     do Agent tool; emitir aqui duplicaria a caixa 3. So processa se o matcher no settings.json
//     mudar no futuro pra cobrir outra ferramenta.)
//   Codex "agent-turn-complete" (e demais tipos do notify) -> caixa 6 "registrado"
//   Grok (--evento) -> caixa conforme o proprio tipo informado (ver CAIXA_POR_TIPO)
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { createHash } from "node:crypto"
import { pathToFileURL } from "node:url"

const FILA_MAX = 200

// Flags simples: --familia, --evento, --agente, --tarefa, --modelo. Qualquer argumento sem
// "--" na frente entra em `positional` (e' o caso do JSON unico que o Codex `notify` manda).
function parseArgs(argv) {
  const flags = { positional: [] }
  const CONHECIDAS = new Set(["familia", "evento", "agente", "tarefa", "modelo"])
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith("--") && CONHECIDAS.has(arg.slice(2))) {
      flags[arg.slice(2)] = argv[i + 1]
      i++
    } else {
      flags.positional.push(arg)
    }
  }
  return flags
}

async function main() {
  const flags = parseArgs(process.argv.slice(2))

  if (flags.familia === "grok") {
    const evento = mapearEventoGrok(flags, process.cwd())
    await despachar(evento, process.cwd())
    return
  }

  const bruto = flags.positional[0] ?? (await lerStdin())
  if (!bruto) return
  let payload
  try {
    payload = JSON.parse(bruto)
  } catch {
    return
  }

  const cwd = typeof payload.cwd === "string" ? payload.cwd : process.cwd()
  const evento = mapearEvento(payload, cwd, flags.familia, flags.modelo)
  await despachar(evento, cwd)
}

async function despachar(evento, cwd) {
  // Leitor nativo do Node, sem dotenv: worktree sem node_modules quebrava o import
  // antes do "sempre sai 0". Nao imprime em stdout e nao sobrescreve env ja definido.
  const envLocal = join(cwd, ".env.local")
  if (existsSync(envLocal)) {
    try { process.loadEnvFile(envLocal) } catch {}
  }
  const salaUrl = process.env.SALA_URL || "http://localhost:5000"
  const token = process.env.SALA_HOOK_TOKEN
  const filaPath = join(cwd, "output", "sala-hook-queue.jsonl")

  // Sempre tenta esvaziar a fila antes (best effort), depois o evento atual.
  if (token) {
    await flush(filaPath, salaUrl, token)
  }

  if (!evento) return
  if (!token) {
    enfileirar(filaPath, evento)
    return
  }

  const ok = await enviar(salaUrl, token, evento)
  if (!ok) enfileirar(filaPath, evento)
}

function lerStdin() {
  return new Promise((resolve) => {
    let data = ""
    try {
      process.stdin.setEncoding("utf8")
      process.stdin.on("data", (chunk) => { data += chunk })
      process.stdin.on("end", () => resolve(data))
      process.stdin.on("error", () => resolve(data))
      // stdin pode nao emitir 'end' se nao houver pipe: timeout de seguranca.
      setTimeout(() => resolve(data), 800)
    } catch {
      resolve("")
    }
  })
}

// Só usado pra achar o slug ct-* (regex abaixo): o texto concatenado em si nunca é
// persistido, nem em log nem em ct_agent_events (pode conter prompt, tool args ou output).
function extrairTexto(payload) {
  const campos = [
    payload.subagent_type,
    payload.agent_type,
    payload.name,
    payload.description,
    payload.prompt,
    payload.tool_input && payload.tool_input.subagent_type,
    payload.tool_input && payload.tool_input.description,
    payload.tool_input && payload.tool_input.prompt,
    payload.result,
    payload.output,
  ]
  return campos.filter((c) => typeof c === "string").join(" \n ")
}

function detectarSlugAgente(texto, cwd) {
  const nomes = new Set(readdirSync(join(cwd, "agents")).filter((nome) => /^ct-[a-z0-9-]+\.md$/.test(nome)).map((nome) => nome.slice(0, -3)))
  return (texto.match(/ct-[a-z][a-z0-9-]*/g) ?? []).find((slug) => nomes.has(slug)) ?? null
}

// Nomes de ferramenta são um conjunto fechado do Claude Code: nunca repassa tool_name cru.
const FERRAMENTAS_CONHECIDAS = new Set([
  "Task", "Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "WebSearch",
  "NotebookEdit", "TodoWrite", "BashOutput", "KillShell", "SlashCommand",
])
function sanitizarFerramenta(nome) {
  if (typeof nome !== "string") return null
  return FERRAMENTAS_CONHECIDAS.has(nome) ? nome : "outra"
}

function sha1(texto) {
  return createHash("sha1").update(texto).digest("hex")
}

// Heuristica de formato quando --familia nao foi passado explicito. Claude Code e Kimi Code
// mandam JSON de hook (so muda o nome do campo do evento); Codex manda o JSON do notify
// (tipo + turno). Sem sinal nenhum, cai em "claude" (formato historico deste script).
function detectarFamilia(payload) {
  if (typeof payload.hook_event_name === "string") return "claude"
  if (
    typeof payload.type === "string" &&
    (payload["turn-id"] !== undefined || Array.isArray(payload["input-messages"]) || typeof payload["last-assistant-message"] === "string")
  ) {
    return "codex"
  }
  if (typeof payload.event === "string") return "kimi"
  return "claude"
}

function mapearEvento(payload, cwd, familiaForcada, modeloFlag) {
  const familia = familiaForcada || detectarFamilia(payload)
  const modelo = typeof modeloFlag === "string" ? modeloFlag : (typeof payload.model === "string" ? payload.model : null)
  if (familia === "codex") return mapearEventoCodex(payload, cwd, modelo)
  if (familia === "kimi") return mapearEventoHook(payload, cwd, "kimi", payload.event, modelo)
  return mapearEventoHook(payload, cwd, "claude", payload.hook_event_name, modelo)
}

// Formato comum a Claude Code e Kimi Code: so difere no nome do campo que carrega o evento
// (hook_event_name vs event), o resto do payload segue o mesmo contrato de hook.
function mapearEventoHook(payload, cwd, familia, hookEvent, modelo) {
  const sessionId = payload.session_id || "sem-sessao"
  const agora = new Date().toISOString()
  const clientSlug = resolverClienteSeguro(cwd)
  const toolUseId = payload.tool_use_id || null

  let tipo = null
  let caixa = null
  let agent = null
  let resumo = null

  if (hookEvent === "UserPromptSubmit") {
    tipo = "pedido"
    caixa = 1
    resumo = "pedido recebido"
  } else if (hookEvent === "SubagentStart") {
    const texto = extrairTexto(payload)
    const ehDiretor = /ct-diretor|diretor/i.test(texto)
    tipo = ehDiretor ? "diretor_planejou" : "agente_iniciou"
    caixa = ehDiretor ? 2 : 3
    agent = detectarSlugAgente(texto, cwd) || (ehDiretor ? "ct-diretor" : null)
    resumo = `iniciou: ${agent || "agente"}`
  } else if (hookEvent === "SubagentStop") {
    const texto = extrairTexto(payload)
    tipo = "agente_concluiu"
    caixa = 3
    agent = detectarSlugAgente(texto, cwd)
    resumo = agent ? `${agent} concluiu` : "subagente concluiu"
  } else if (hookEvent === "Stop") {
    tipo = "registrado"
    caixa = 6
    resumo = "sessão encerrou o turno"
  } else {
    // PostToolUse(Agent) e qualquer outro hook nao mapeado: sem evento (ver nota de topo).
    return null
  }

  return {
    ts: agora,
    client_slug: clientSlug,
    agent,
    event: tipo,
    tool: hookEvent === "PostToolUse" ? sanitizarFerramenta(payload.tool_name) : null,
    task_id: null,
    parent_id: null,
    piece_slug: null,
    payload: { caixa, resumo, origem_hook: hookEvent, session_id: sha1(String(sessionId)), sala_sanitizado: 1 },
    source: "terminal",
    familia,
    modelo,
    dedupe_key: sha1(`${familia}:${sessionId}:${hookEvent}:${toolUseId || agora}`),
  }
}

// Codex `notify`: um unico JSON por chamada, sem hook_event_name. `type` documentado inclui
// "agent-turn-complete" (fim de turno, equivalente ao Stop do Claude Code); outros tipos
// futuros caem no mesmo tratamento generico (caixa 6, resumo fixo, nunca o texto real).
function extrairTextoCodex(payload) {
  const partes = []
  if (Array.isArray(payload["input-messages"])) {
    for (const m of payload["input-messages"]) {
      if (typeof m === "string") partes.push(m)
      else if (m && typeof m.content === "string") partes.push(m.content)
      else if (m && typeof m.text === "string") partes.push(m.text)
    }
  }
  if (typeof payload["last-assistant-message"] === "string") partes.push(payload["last-assistant-message"])
  return partes.join(" \n ")
}

function mapearEventoCodex(payload, cwd, modelo) {
  const agora = new Date().toISOString()
  const clientSlug = resolverClienteSeguro(cwd)
  const turnoId = payload["turn-id"] ?? payload.turnId ?? "sem-turno"
  const tipoBruto = typeof payload.type === "string" ? payload.type : "evento"
  const texto = extrairTextoCodex(payload)
  const agent = detectarSlugAgente(texto, cwd)
  const resumo = tipoBruto === "agent-turn-complete" ? "turno concluído" : "evento codex"

  return {
    ts: agora,
    client_slug: clientSlug,
    agent,
    event: "registrado",
    tool: null,
    task_id: null,
    parent_id: null,
    piece_slug: null,
    payload: { caixa: 6, resumo, origem_hook: "codex_notify", session_id: sha1(String(turnoId)), sala_sanitizado: 1 },
    source: "terminal",
    familia: "codex",
    modelo,
    dedupe_key: sha1(`codex:${turnoId}:${tipoBruto}`),
  }
}

// Grok Build/grok-delegation nao tem hook oficial: quem registra e' o proprio chamador via
// flags de linha de comando. --tarefa vira o resumo do cartao (texto curto, decidido por
// quem chama o CLI, nao um dump de prompt/output). --evento fora da allowlist cai em
// "agente_ferramenta" (caixa 3), o mais seguro pra nao inventar estado.
const CAIXA_POR_TIPO = {
  pedido: 1,
  diretor_planejou: 2,
  agente_iniciou: 3,
  agente_ferramenta: 3,
  agente_concluiu: 3,
  aprovacao_pedida: 4,
  aprovado: 4,
  ajuste_pedido: 4,
  publicado: 5,
  registrado: 6,
  erro: 6,
}

function mapearEventoGrok(flags, cwd) {
  const tipo = Object.prototype.hasOwnProperty.call(CAIXA_POR_TIPO, flags.evento) ? flags.evento : "agente_ferramenta"
  const caixa = CAIXA_POR_TIPO[tipo]
  const agora = new Date().toISOString()
  const agent = typeof flags.agente === "string" ? flags.agente : null
  const tarefa = typeof flags.tarefa === "string" ? flags.tarefa.slice(0, 240) : null

  return {
    ts: agora,
    client_slug: resolverClienteSeguro(cwd),
    agent,
    event: tipo,
    tool: null,
    task_id: null,
    parent_id: null,
    piece_slug: null,
    payload: { caixa, resumo: tarefa || `${agent || "grok"}: ${tipo}`, origem_hook: "grok_cli", sala_sanitizado: 1 },
    source: "terminal",
    familia: "grok",
    modelo: typeof flags.modelo === "string" ? flags.modelo : null,
    dedupe_key: sha1(`grok:${agent}:${tipo}:${Date.now()}`),
  }
}

// ponytail: reimplementa a resolucao de cliente em vez de importar
// scripts/_lib/workspace-client.mjs por valor, porque aquele modulo lanca Error quando nao
// acha cliente valido, e o hook nunca pode lancar. Mesma precedencia (CT_CLIENT > .workspace
// > active-client.md legado).
function resolverClienteSeguro(cwd) {
  try {
    const dir = join(cwd, "clients")
    if (!existsSync(dir)) return null
    const slugs = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "_template")
      .filter((d) => existsSync(join(dir, d.name, "brand-profile.md")))
      .map((d) => d.name)
    const allowed = new Set(slugs)
    if (process.env.CT_CLIENT && allowed.has(process.env.CT_CLIENT)) return process.env.CT_CLIENT
    const ws = join(cwd, ".workspace")
    if (existsSync(ws)) {
      const m = readFileSync(ws, "utf8").match(/^\s*client:\s*([a-z0-9-]+)\s*$/m)
      if (m && allowed.has(m[1])) return m[1]
    }
    const legacy = join(cwd, "clients", "active-client.md")
    if (existsSync(legacy)) {
      const m = readFileSync(legacy, "utf8").match(/^\s*client:\s*([a-z0-9-]+)\s*$/m)
      if (m && allowed.has(m[1])) return m[1]
    }
    return null
  } catch {
    return null
  }
}

function enfileirar(filaPath, evento) {
  try {
    mkdirSync(dirname(filaPath), { recursive: true })
    let linhas = []
    if (existsSync(filaPath)) {
      linhas = readFileSync(filaPath, "utf8").split("\n").filter(Boolean)
    }
    linhas.push(JSON.stringify(evento))
    if (linhas.length > FILA_MAX) linhas = linhas.slice(linhas.length - FILA_MAX)
    writeFileSync(filaPath, linhas.join("\n") + "\n", "utf8")
  } catch {
    // fila e best effort
  }
}

async function enviar(url, token, evento, timeoutMs = 2000) {
  try {
    const controlador = new AbortController()
    const timer = setTimeout(() => controlador.abort(), timeoutMs)
    const resp = await fetch(`${url}/api/sala/eventos/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sala-token": token },
      body: JSON.stringify(evento),
      signal: controlador.signal,
    })
    clearTimeout(timer)
    return resp.ok
  } catch {
    return false
  }
}

// ponytail: so tenta esvaziar no maximo 2 itens por execucao (timeout curto de 1s cada) pra
// nao empilhar latencia no hook quando a fila esta grande; o resto fica pra proxima chamada.
// Upgrade se sobrar backlog: um processo separado (cron local) que drena a fila inteira.
const FLUSH_POR_EXECUCAO = 2

async function flush(filaPath, url, token) {
  try {
    if (!existsSync(filaPath)) return
    const linhas = readFileSync(filaPath, "utf8").split("\n").filter(Boolean)
    if (linhas.length === 0) return
    const restantes = []
    let tentativas = 0
    for (const linha of linhas) {
      let evento
      try {
        evento = JSON.parse(linha)
        if (evento.payload?.sala_sanitizado !== 1) {
          evento.agent = null
          evento.tool = null
          evento.piece_slug = null
          evento.payload = { caixa: evento.payload?.caixa, resumo: "evento anterior do terminal", sala_sanitizado: 1 }
        }
      } catch {
        continue
      }
      if (tentativas >= FLUSH_POR_EXECUCAO) {
        restantes.push(JSON.stringify(evento))
        continue
      }
      tentativas++
      const ok = await enviar(url, token, evento, 1000)
      if (!ok) restantes.push(JSON.stringify(evento))
    }
    writeFileSync(filaPath, restantes.length ? restantes.join("\n") + "\n" : "", "utf8")
  } catch {
    // best effort
  }
}

// So roda main() quando o arquivo e' executado diretamente (hook/CLI real). Quando importado
// por teste (node --test), so expoe as funcoes de normalizacao abaixo, sem tocar em rede/stdin.
const executadoDiretamente = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (executadoDiretamente) {
  main().then(
    () => process.exit(0),
    () => process.exit(0)
  )
}

export { parseArgs, detectarFamilia, mapearEvento, mapearEventoGrok, resolverClienteSeguro }
