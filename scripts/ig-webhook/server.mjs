// IG comment -> DM com link (estilo ManyChat, proprio/gratis).
// Dois modos, por regra em rules.json:
//   followGate:false  -> so Private Reply no comment_id. Permissoes: instagram_business_basic
//                        + instagram_business_manage_comments. E o modo do App Review (rota A).
//   followGate:true   -> exige follow antes do link, usa mensagem livre por igsid.
//                        Exige instagram_business_manage_messages, que NAO esta aprovada.
// DIRIGIDO POR REGRAS: rules.json mapeia palavra-chave -> link. 1 regra por post/assunto.
// Comentario que nao bate em nenhuma keyword NAO recebe resposta
// (assim o dono da conta continua respondendo os demais). So keyword dispara resposta publica + DM.
// Fluxo por regra:
//  1) comentou a keyword da regra em QUALQUER post -> checa se segue
//  2) segue -> manda o link da regra
//  3) nao segue -> pede follow + botao "Ja segui" (lembra qual regra)
//  4) toca "Ja segui" -> re-checa -> manda link da regra ou re-pede
// Sem deps. Node 18+ (http, crypto, fetch).
import http from "node:http"
import crypto from "node:crypto"
import fs from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
let defaultHandle = ""
try {
  defaultHandle = require("../../skills/_shared/ig-accounts.cjs").CLIENT_ACCOUNTS.principal.handle
} catch {}

const PORT = process.env.PORT || 3010
// Atras do nginx: escuta so no loopback. HOST=0.0.0.0 so se expuser a porta de proposito.
const HOST = process.env.HOST || "127.0.0.1"
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES) || 1024 * 1024
const MAX_PER_USER_HOUR = Number(process.env.MAX_PER_USER_HOUR) || 3
const MAX_PER_MINUTE = Number(process.env.MAX_PER_MINUTE) || 30
const RELOAD_TOKEN = process.env.RELOAD_TOKEN || ""
// DRY_SEND=1: so registra no log, nao chama a Graph API (usado nos testes).
const DRY_SEND = process.env.DRY_SEND === "1"
// IG_USER_ID e o nome antigo; o .env.local.example usa INSTAGRAM_USER_ID. Vale qualquer um dos dois.
const IG_USER_ID = process.env.IG_USER_ID || process.env.INSTAGRAM_USER_ID || ""
const IG_HANDLE = process.env.IG_HANDLE || defaultHandle
const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET
const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN
const GRAPH_HOST = "https://graph.instagram.com"
const GRAPH = `${GRAPH_HOST}/v21.0`

// Business Login for Instagram. Existe pra UM proposito: o App Review exige ver a tela de
// consentimento e o usuario concedendo a permissao, e sem redirect registrado esse flow nao
// existe. O painel (passo 4 do API Setup) estava com a URL de redirecionamento VAZIA.
// IG_APP_ID nao e segredo (aparece no painel). O segredo e o INSTAGRAM_APP_SECRET, que ja
// era usado aqui pra conferir a assinatura do webhook.
const IG_APP_ID = process.env.IG_APP_ID || ""
// PUBLIC_BASE = endereco publico HTTPS onde ESTE servidor responde, sem barra no final
// (ex.: https://bot.suaempresa.com.br; o webhook fica em PUBLIC_BASE/ig-webhook). Sem ele o login da Meta e a URL de
// exclusao de dados nao funcionam. Veja scripts/ig-webhook/PASSO-A-PASSO.md.
const PUBLIC_BASE = (process.env.PUBLIC_BASE || "").replace(/[/]+$/, "")
const PUBLIC_BASE_ERRO = "PUBLIC_BASE nao esta definido no .env.local (endereco publico HTTPS deste servidor, sem barra no final). Veja scripts/ig-webhook/PASSO-A-PASSO.md."
const REDIRECT_URI = `${PUBLIC_BASE}/auth/callback`
const TOKEN_FILE = process.env.TOKEN_FILE || "./data/ig-webhook/token.json"
// Registro das exclusoes pedidas via Meta. A Meta cobra uma URL de status consultavel.
const DELETIONS_FILE = process.env.DELETIONS_FILE || "./data/ig-webhook/deletions.json"
// Rota A do App Review: sem instagram_business_manage_messages.
const OAUTH_SCOPE = process.env.OAUTH_SCOPE || "instagram_business_basic,instagram_business_manage_comments"

const RULES_FILE = process.env.RULES_FILE || "./data/ig-webhook/rules.json"
const SEEN_FILE = process.env.SEEN_FILE || "./data/ig-webhook/seen.json"
const PENDING_FILE = process.env.PENDING_FILE || "./data/ig-webhook/pending.json" // {igsid: ruleId}
const LOG_FILE = process.env.LOG_FILE || "./data/ig-webhook/events.log"
try { fs.mkdirSync("./data/ig-webhook", { recursive: true }) } catch {}

function loadRules() {
  try {
    const arr = JSON.parse(fs.readFileSync(RULES_FILE, "utf8"))
    return arr.map(r => ({
      ...r,
      re: r.keyword ? new RegExp(r.keyword, "i") : /$^/,
      followGate: r.followGate !== false,
      mediaIds: (r.mediaIds || []).map(String),
      anyComment: r.anyComment === true,
      links: Array.isArray(r.links) ? r.links : null,
    }))
  } catch (e) {
    log(e.code === "ENOENT"
      ? `rules nao encontrado em ${RULES_FILE}. Copie scripts/ig-webhook/rules.example.json para esse caminho e edite (veja skills/ct-dm-auto/SKILL.md).`
      : `rules invalido em ${RULES_FILE} (JSON quebrado? confira virgulas e aspas): ${e.message}`)
    return []
  }
}
let RULES = []

// Aparece no log de boot e no /health, os dois filmados no screencast do App Review.
// Se mentir sobre o modo, contradiz o formulario da submissao.
// Funcao e nao constante de proposito: /reload troca RULES em runtime.
const mode = () => RULES.some(r => r.followGate) ? "follow-gate" : "private-reply-only"

let seen = new Set()
let pending = {} // igsid -> ruleId
try { seen = new Set(JSON.parse(fs.readFileSync(SEEN_FILE, "utf8"))) } catch {}
try { pending = JSON.parse(fs.readFileSync(PENDING_FILE, "utf8")) } catch {}
const saveSeen = () => { try { writeSecret(SEEN_FILE, JSON.stringify([...seen].slice(-5000))) } catch {} }
const savePending = () => { try { writeSecret(PENDING_FILE, JSON.stringify(pending)) } catch {} }
// Nunca deixa token/segredo nem quebra de linha (injecao de log) chegar no log.
function mask(s) {
  s = String(s).replace(/(access_token|client_secret)=[^&\s"']+/gi, "$1=***").replace(/Bearer\s+[\w.-]+/gi, "Bearer ***").replace(/[\r\n]+/g, " ")
  for (const v of [IG_TOKEN, APP_SECRET]) if (v) s = s.split(v).join("***")
  return s
}
function log(m) { const l = `[${new Date().toISOString()}] ${mask(m)}\n`; try { fs.appendFileSync(LOG_FILE, l, { mode: 0o600 }) } catch {}; console.log(l.trim()) }
// Arquivos com dado/segredo: so o dono le e escreve.
function writeSecret(file, data) { fs.writeFileSync(file, data, { mode: 0o600 }); try { fs.chmodSync(file, 0o600) } catch {} }
for (const f of [TOKEN_FILE, SEEN_FILE, PENDING_FILE, LOG_FILE, DELETIONS_FILE]) { try { fs.chmodSync(f, 0o600) } catch {} }

// Limite de envio: por from.id/hora e global/minuto. Estourou: so registra, nao envia.
const userHits = new Map()
let globalHits = []
function allowSend(fromId) {
  const now = Date.now()
  globalHits = globalHits.filter(t => now - t < 60000)
  if (globalHits.length >= MAX_PER_MINUTE) return false
  if (fromId) {
    const h = (userHits.get(fromId) || []).filter(t => now - t < 3600000)
    if (h.length >= MAX_PER_USER_HOUR) { userHits.set(fromId, h); return false }
    h.push(now); userHits.set(fromId, h)
    if (userHits.size > 10000) for (const [k, v] of userHits) if (now - v[v.length - 1] >= 3600000) userHits.delete(k)
  }
  globalHits.push(now)
  return true
}
const esc = (x) => String(x).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
const safeEq = (a, b) => { const h = (x) => crypto.createHash("sha256").update(String(x)).digest(); return crypto.timingSafeEqual(h(a), h(b)) }
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"])
// /reload: so pedido local direto (sem cabecalho de proxy) ou com RELOAD_TOKEN.
function reloadAllowed(req, url) {
  const t = url.searchParams.get("token")
  if (RELOAD_TOKEN && t && safeEq(t, RELOAD_TOKEN)) return true
  return LOOPBACK.has(req.socket.remoteAddress) && !req.headers["x-forwarded-for"] && !req.headers["x-real-ip"]
}
// state do OAuth: aleatorio, 10 min, uso unico.
const oauthStates = new Map()
const newState = () => {
  const now = Date.now()
  for (const [k, exp] of oauthStates) if (exp < now) oauthStates.delete(k)
  if (oauthStates.size >= 1000) oauthStates.delete(oauthStates.keys().next().value)
  const st = crypto.randomBytes(24).toString("hex"); oauthStates.set(st, now + 600000); return st
}
const takeState = (st) => { const exp = st && oauthStates.get(st); oauthStates.delete(st); return !!exp && exp >= Date.now() }

// Texto do pedido de follow: explica o motivo (mais conteudo pratico e gratis). GENERICO/COMPARTILHADO
// entre TODOS os gatilhos: nao e texto por regra no rules.json. Edite aqui pra mudar o tom.
const followMsg = (rule) => ({
  text: `Quase lá! Segue meu perfil @${IG_HANDLE} pra você passar a receber mais conteúdo na prática e grátis, como esse, que realmente traz resultado. Toca no botão abaixo que te mando o link na hora.`,
  quick_replies: [{ content_type: "text", title: "Já segui", payload: `JA_SEGUI:${rule.id}` }],
})
const linkMsg = (rule) => {
  if (rule.generic) {
    return {
      text: `Oi! Valeu por comentar. Se quiser saber mais, é só perguntar por aqui ou seguir meu perfil @${IG_HANDLE} pra acompanhar o conteúdo.`,
    }
  }
  const body = rule.links?.length
    ? rule.links.map(l => `${l.label ? l.label + "\n" : ""}${l.url}`).join("\n\n")
    : (rule.link || "")
  return { text: `${rule.linkText || "Aqui está o material:"}\n\n${body}` }
}

// CODIGO MORTO (nao apagado): FALLBACK_RULE nunca e escolhida por matchRule (sem keyword nao ha
// resposta) e o ramo `generic` de linkMsg nunca dispara. Hoje so findRule ainda o referencia.
// Regra catch-all: todo comentario recebe resposta e direct. Antes, comentario que nao batia em nenhuma keyword do rules.json nao recebia nada
// (return cedo no handleComment). Fica FORA do rules.json de proposito: nao e uma oferta por
// post/keyword, e o piso padrao da conta, entao nao faz sentido no arquivo que o dono da conta edita
// por campanha. So entra quando NENHUMA regra especifica bateu (RULES.find roda primeiro).
// Mesmo fluxo de follow-gate das outras regras; so a DM muda (generic:true -> linkMsg manda
// um agradecimento no lugar do link, ja que nao ha oferta especifica pra comentario generico).
// followGate:false: o generico nao tem link, entao pedir follow "pra mandar o link"
// prometia algo que nao existe. Agradece direto no privado.
const FALLBACK_RULE = { id: "catchall", followGate: false, publicReply: "Valeu!", generic: true }
const findRule = (id) => RULES.find(r => r.id === id) || (id === FALLBACK_RULE.id ? FALLBACK_RULE : null)
function matchRule(text, mediaId) {
  const mid = mediaId ? String(mediaId) : ""
  const inScope = (r) => !r.mediaIds.length || (mid && r.mediaIds.includes(mid))
  const keywordHit = RULES.find(r => inScope(r) && r.re.test(text))
  if (keywordHit) return keywordHit
  const anyOnPost = RULES.find(r => r.anyComment && r.mediaIds.length && mid && r.mediaIds.includes(mid))
  if (anyOnPost) return anyOnPost
  // anyComment sem mediaIds NAO casa: sem palavra-chave nao ha resposta (anyComment so vale por post).
  return null
}
const retryMsg = (rule) => ({
  text: `Ainda não consegui confirmar que você segue. Segue meu perfil @${IG_HANDLE} e toca em "Já segui" de novo que te mando o link.`,
  quick_replies: [{ content_type: "text", title: "Já segui", payload: `JA_SEGUI:${rule.id}` }],
})

function verifySig(raw, header) {
  if (!header || !APP_SECRET) return false
  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex")
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header)) } catch { return false }
}

async function follows(igsid) {
  if (DRY_SEND) { log(`DRY follows ${igsid}`); return true }
  try {
    const r = await fetch(`${GRAPH}/${igsid}?fields=is_user_follow_business`, { headers: { Authorization: `Bearer ${IG_TOKEN}` } })
    const j = await r.json()
    if (j.error) { log(`follow check erro ${igsid}: ${JSON.stringify(j.error)}`); return null }
    return !!j.is_user_follow_business
  } catch (e) { log(`follow check exc ${igsid}: ${e.message}`); return null }
}

async function send(recipient, msg) {
  if (DRY_SEND) { log(`DRY send ${JSON.stringify(recipient)}`); return true }
  const r = await fetch(`${GRAPH}/${IG_USER_ID}/messages`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${IG_TOKEN}` },
    body: JSON.stringify({ recipient, message: msg }),
  })
  const j = await r.json().catch(() => ({}))
  if (j.error) { log(`send ERRO ${JSON.stringify(recipient)}: ${JSON.stringify(j.error)}`); return false }
  log(`send OK ${JSON.stringify(recipient)}`); return true
}

// Resposta PUBLICA no comentario. Endpoint diferente do private reply: aqui e
// POST /{comment-id}/replies, que responde na thread do post e todo mundo ve.
// O private reply (send com comment_id) vai pro Direct e so a pessoa ve.
// O ManyChat faz os dois: confirma em publico e entrega no privado.
async function replyToComment(commentId, message) {
  if (DRY_SEND) { log(`DRY reply ${commentId}`); return true }
  const r = await fetch(`${GRAPH}/${commentId}/replies`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Bearer ${IG_TOKEN}` },
    body: new URLSearchParams({ message }),
  })
  const j = await r.json().catch(() => ({}))
  if (j.error) { log(`reply publico ERRO ${commentId}: ${JSON.stringify(j.error)}`); return false }
  log(`reply publico OK ${commentId}`); return true
}

async function handleComment(value) {
  const commentId = value.id, text = value.text || "", fromId = value.from?.id
  const mediaId = value.media?.id
  if (!commentId || seen.has(commentId)) return
  if (fromId && fromId === IG_USER_ID) return
  const rule = matchRule(text, mediaId)
  seen.add(commentId); saveSeen()
  if (!rule) { log(`COMMENT sem keyword, ignorado comment=${commentId} from=${value.from?.username || fromId}`); return }
  log(`COMMENT match rule=${rule.id} comment=${commentId} media=${mediaId || "-"} from=${value.from?.username || fromId}`)

  if (!allowSend(fromId)) { log(`LIMITE de envio atingido, nao enviado comment=${commentId} from=${fromId || "-"}`); return }

  // 1) Resposta publica, SEMPRE. E o sinal social: quem passa no post ve que respondemos.
  //    Nao depende do follow: negar resposta publica a quem nao segue fica hostil.
  await replyToComment(commentId, rule.publicReply || "Te mandei no direct.")

  // 2) Entrega no privado. Sem follow gate, manda o link direto.
  if (!rule.followGate) { await send({ comment_id: commentId }, linkMsg(rule)); return }

  // 3) Com follow gate: SO entrega pra quem confirmadamente segue.
  //    Na duvida (f === null) NAO entrega, pede o follow. Motivo: no primeiro
  //    contato quase sempre da null, porque `is_user_follow_business` so existe
  //    depois que ha conversa aberta. Entregar no null furaria o gate sempre.
  const f = fromId ? await follows(fromId) : null
  if (f === true) { await send({ comment_id: commentId }, linkMsg(rule)); return }
  if (fromId) { pending[fromId] = rule.id; savePending() }
  await send({ comment_id: commentId }, followMsg(rule))
}

async function handleMessaging(m) {
  const igsid = m.sender?.id
  if (!igsid || igsid === IG_USER_ID) return
  const payload = m.message?.quick_reply?.payload || m.postback?.payload
  if (!payload || !payload.startsWith("JA_SEGUI:")) return
  if (!allowSend(null)) { log(`LIMITE global de envio atingido, quickreply ignorado igsid=${igsid}`); return }
  const ruleId = payload.split(":")[1]
  const rule = findRule(ruleId) || findRule(pending[igsid])
  if (!rule) { log(`quickreply sem regra igsid=${igsid} payload=${payload}`); return }
  log(`QUICKREPLY ${payload} from=${igsid}`)
  // Aqui JA existe conversa (a pessoa tocou o botao), entao o follows() responde
  // true/false de verdade pra conta comum (verificado em teste). So entrega no `true`.
  // Antes entregava tambem no null: o webhook manda o mesmo toque em dobro, uma copia
  // com o ID de conta business do remetente, onde o follow check sempre da null, e isso
  // furava o gate. No null agora re-pede (e loga) em vez de entregar.
  const f = await follows(igsid)
  log(`follow check quickreply ${igsid}: ${f}`)
  if (f !== true) { await send({ id: igsid }, retryMsg(rule)); return }
  delete pending[igsid]; savePending()
  await send({ id: igsid }, linkMsg(rule))
}

// A Meta assina o corpo do deauthorize e do data deletion com o app secret.
// Formato: "<assinatura base64url>.<payload base64url>". Sem conferir a assinatura,
// qualquer um apagaria dado nosso mandando um POST.
function parseSignedRequest(signed) {
  if (!signed || !signed.includes(".")) return null
  const [sigB64, payloadB64] = signed.split(".", 2)
  const expected = crypto.createHmac("sha256", APP_SECRET).update(payloadB64).digest()
  let got
  try { got = Buffer.from(sigB64, "base64url") } catch { return null }
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null
  try { return JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) } catch { return null }
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")) } catch { return fallback }
}

// Apaga o que guardamos daquele usuario. Hoje isso e: o token dele, se for o dono da conta,
// e os comment_id que ele gerou (guardados so pra nao responder duas vezes ao mesmo comentario).
function eraseUser(igUserId) {
  const tok = readJson(TOKEN_FILE, null)
  if (tok && String(tok.user_id) === String(igUserId)) { try { fs.unlinkSync(TOKEN_FILE) } catch {} }
  if (pending[igUserId]) { delete pending[igUserId]; savePending() }
}

// Le o corpo com teto de MAX_BODY_BYTES; estourou: 413 e para de ler (antes de qualquer assinatura).
function collectBody(req, res, cb) {
  const tooBig = () => { log("corpo grande demais, 413"); res.writeHead(413, { "Connection": "close" }); res.end("payload too large") }
  if (Number(req.headers["content-length"]) > MAX_BODY_BYTES) { tooBig(); req.resume(); return }
  const chunks = []
  let size = 0, over = false
  req.on("data", c => {
    if (over) return
    size += c.length
    if (size > MAX_BODY_BYTES) { over = true; chunks.length = 0; tooBig(); return }
    chunks.push(c)
  })
  req.on("end", () => { if (!over) cb(Buffer.concat(chunks)) })
}

function authPage(title, detail) {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
    `<body style="font:16px system-ui;max-width:640px;margin:80px auto;padding:0 24px">` +
    `<h1 style="font-size:22px">${title}</h1><p>${detail}</p></body>`
}

async function handleAuthCallback(url, res) {
  const send = (code, title, detail) => { res.writeHead(code, { "Content-Type": "text/html; charset=utf-8" }); res.end(authPage(title, detail)) }
  const err = url.searchParams.get("error_description") || url.searchParams.get("error")
  if (err) { log(`auth negado: ${err}`); return send(400, "Authorization was not completed", esc(err)) }
  if (!takeState(url.searchParams.get("state"))) { log("auth callback sem state valido"); return send(400, "Invalid or expired state", "Start again at /auth/start.") }
  const code = url.searchParams.get("code")
  if (!code) return send(400, "Missing authorization code", "This URL is the OAuth callback. Start at /auth/start.")
  if (!APP_SECRET) { log("auth sem INSTAGRAM_APP_SECRET"); return send(500, "Server is not configured", "INSTAGRAM_APP_SECRET is missing on the server.") }
  try {
    // 1) code -> token curto
    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: new URLSearchParams({ client_id: IG_APP_ID, client_secret: APP_SECRET, grant_type: "authorization_code", redirect_uri: REDIRECT_URI, code }),
    })
    const short = await shortRes.json()
    if (!short.access_token) { log(`auth troca falhou: ${JSON.stringify(short)}`); return send(400, "Token exchange failed", esc(short.error_message || short.error_type || "unknown error")) }

    // 2) token curto -> token longo (60 dias)
    // ponytail: esta troca (GET /access_token) exige access_token e client_secret na query; o log mascara.
    const longRes = await fetch(`${GRAPH_HOST}/access_token?` + new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: APP_SECRET, access_token: short.access_token }))
    const long = await longRes.json()
    const token = long.access_token || short.access_token

    // 3) quem autorizou
    const me = await fetch(`${GRAPH}/me?fields=id,username`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())

    writeSecret(TOKEN_FILE, JSON.stringify({ user_id: me.id, username: me.username, access_token: token, expires_in: long.expires_in || null, obtained_at: new Date().toISOString(), scope: OAUTH_SCOPE }, null, 2))
    log(`auth OK user=${me.username || me.id} longlived=${!!long.access_token}`)
    send(200, "Connected", `The Instagram professional account <b>@${esc(me.username || me.id)}</b> granted access to this app. The token is stored on our server. You can close this window.`)
  } catch (e) {
    log(`auth exc: ${e.message}`)
    send(500, "Unexpected error", esc(e.message))
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost")
  if (req.method === "GET" && url.pathname.endsWith("/ig-webhook")) {
    if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === VERIFY_TOKEN) {
      log("verify OK"); res.writeHead(200, { "Content-Type": "text/plain" }); res.end(url.searchParams.get("hub.challenge")); return
    }
    res.writeHead(403); res.end("forbidden"); return
  }
  if (req.method === "POST" && url.pathname.endsWith("/ig-webhook")) {
    collectBody(req, res, (raw) => {
      if (!verifySig(raw, req.headers["x-hub-signature-256"])) { log("assinatura invalida"); res.writeHead(401); res.end("bad sig"); return }
      res.writeHead(200); res.end("EVENT_RECEIVED")
      try {
        const body = JSON.parse(raw.toString("utf8"))
        for (const entry of body.entry || []) {
          for (const ch of entry.changes || []) if (ch.field === "comments" && ch.value) handleComment(ch.value)
          for (const m of entry.messaging || []) handleMessaging(m)
        }
      } catch (e) { log(`parse erro: ${e.message}`) }
    })
    return
  }
  if (url.pathname === "/reload" || url.pathname === "/ig-webhook/reload") {
    if (!reloadAllowed(req, url)) { log("reload negado"); res.writeHead(403); res.end("forbidden"); return }
    RULES = loadRules(); log(`rules recarregadas: ${RULES.length}`); res.writeHead(200); res.end(`rules: ${RULES.length}`); return
  }
  if (url.pathname.endsWith("/health")) { res.writeHead(200); res.end(`ok rules=${RULES.length} mode=${mode()}`); return }

  // Abre a tela de consentimento da Meta. E a URL que o dono da conta abre pra autorizar o app.
  if (url.pathname.endsWith("/auth/start")) {
    if (!PUBLIC_BASE || !IG_APP_ID) { res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" }); res.end(authPage("Server is not configured", !PUBLIC_BASE ? PUBLIC_BASE_ERRO : "IG_APP_ID nao esta definido no .env.local (ID do app Instagram, no painel da Meta).")); return }
    const auth = new URL("https://www.instagram.com/oauth/authorize")
    auth.searchParams.set("client_id", IG_APP_ID)
    auth.searchParams.set("redirect_uri", REDIRECT_URI)
    auth.searchParams.set("response_type", "code")
    auth.searchParams.set("scope", OAUTH_SCOPE)
    auth.searchParams.set("state", newState())
    log(`auth start scope=${OAUTH_SCOPE}`)
    res.writeHead(302, { Location: auth.toString() }); res.end(); return
  }

  // Recebe o code, troca por token longo e grava. A pagina e em INGLES de proposito:
  // ela aparece no screencast e a Meta exige interface em ingles.
  if (url.pathname.endsWith("/auth/callback")) { handleAuthCallback(url, res); return }

  // Exigida pela Meta antes de submeter: chamada quando alguem remove o app.
  if (req.method === "POST" && url.pathname.endsWith("/auth/deauthorize")) {
    collectBody(req, res, (raw) => {
      const data = parseSignedRequest(new URLSearchParams(raw.toString("utf8")).get("signed_request"))
      if (!data) { log("deauthorize com assinatura invalida"); res.writeHead(400); res.end("bad signature"); return }
      log(`deauthorize user=${data.user_id}`)
      eraseUser(data.user_id)
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true }))
    })
    return
  }

  // Exigida pela Meta antes de submeter: pedido de exclusao de dados.
  // A resposta TEM que ser {url, confirmation_code}, e a url precisa abrir e mostrar o status.
  if (req.method === "POST" && url.pathname.endsWith("/auth/data-deletion")) {
    collectBody(req, res, (raw) => {
      const data = parseSignedRequest(new URLSearchParams(raw.toString("utf8")).get("signed_request"))
      if (!data) { log("data-deletion com assinatura invalida"); res.writeHead(400); res.end("bad signature"); return }
      if (!PUBLIC_BASE) { log(PUBLIC_BASE_ERRO); res.writeHead(500); res.end("PUBLIC_BASE missing"); return }
      const code = crypto.randomBytes(8).toString("hex")
      eraseUser(data.user_id)
      const all = readJson(DELETIONS_FILE, {})
      all[code] = { user_id: data.user_id, requested_at: new Date().toISOString(), status: "completed" }
      try { writeSecret(DELETIONS_FILE, JSON.stringify(all, null, 2)) } catch (e) { log(`deletions write erro: ${e.message}`) }
      log(`data-deletion user=${data.user_id} code=${code}`)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ url: `${PUBLIC_BASE}/auth/data-deletion?code=${code}`, confirmation_code: code }))
    })
    return
  }

  // Pagina de status da exclusao, em ingles porque a Meta abre pra conferir.
  if (req.method === "GET" && url.pathname.endsWith("/auth/data-deletion")) {
    const code = url.searchParams.get("code")
    const rec = code ? readJson(DELETIONS_FILE, {})[code] : null
    if (!rec) { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }); res.end(authPage("Unknown confirmation code", "We have no deletion request with this code.")); return }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(authPage("Data deletion completed", `Request <code>${esc(code)}</code> was received on ${esc(rec.requested_at)} and the data we held for that user has been deleted. We only store a comment id for deduplication and the connected account token.`))
    return
  }

  res.writeHead(404); res.end("not found")
})

RULES = loadRules()
if (!IG_USER_ID || !IG_TOKEN || !APP_SECRET || !VERIFY_TOKEN) log("AVISO: faltam variaveis no .env.local (INSTAGRAM_USER_ID, INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_APP_SECRET, IG_VERIFY_TOKEN). O webhook nao vai funcionar.")
if (!PUBLIC_BASE) log("AVISO: " + PUBLIC_BASE_ERRO)
server.listen(PORT, HOST, () => log(`ig-webhook (rules=${RULES.length}, mode=${mode()}) on ${HOST}:${PORT}`))
