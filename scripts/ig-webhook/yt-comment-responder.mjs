// YouTube: comentou a palavra de uma regra -> resposta publica com o link da regra.
// Le as MESMAS regras do Instagram (rules.json do ig-webhook): 1 palavra, 1 link, todas as redes.
// Polling (cron). Raw fetch, sem googleapis. Dedup em arquivo.
// Uso: node yt-comment-responder.mjs [videoId1,videoId2,...]
import fs from "node:fs"
// env via `node --env-file=.env` (Node 22+) ou process.env

const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env
const VIDEOS = (process.argv[2] || process.env.YT_VIDEO_IDS || "").split(",").map(s => s.trim()).filter(Boolean)
const RULES_FILE = process.env.RULES_FILE || "./data/ig-webhook/rules.json"
let RULES
try {
  RULES = JSON.parse(fs.readFileSync(RULES_FILE, "utf8")).filter(r => r.keyword).map(r => ({ ...r, re: new RegExp(r.keyword, "i") }))
} catch (e) {
  console.error(e.code === "ENOENT"
    ? "Nao achei " + RULES_FILE + ". Copie scripts/ig-webhook/rules.example.json para esse caminho e edite (veja skills/ct-dm-auto/SKILL.md)."
    : "Arquivo de regras invalido (" + RULES_FILE + "): confira virgulas, aspas e a palavra-chave (regex). " + e.message)
  process.exit(1)
}
// No YouTube nao existe DM: a entrega e publica, na propria thread. Sem follow gate.
const replyText = (r) => `${r.ytReply || r.linkText || "Aqui esta o seu acesso:"}

${r.links?.length ? r.links.map(l => (l.label ? l.label + "\n" : "") + l.url).join("\n\n") : r.link}`
const SEEN_FILE = process.env.YT_SEEN_FILE || "./data/yt-responder/seen.json"
const LOG_FILE = process.env.YT_LOG_FILE || "./data/yt-responder/events.log"
const API = "https://www.googleapis.com/youtube/v3"

let seen = new Set()
try { seen = new Set(JSON.parse(fs.readFileSync(SEEN_FILE, "utf8"))) } catch {}
function markSeen(id) { seen.add(id); try { fs.mkdirSync(SEEN_FILE.replace(/\/[^/]+$/, ""), { recursive: true }); fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen].slice(-5000))) } catch {} }
function log(m) { const l = `[${new Date().toISOString()}] ${m}\n`; try { fs.mkdirSync(LOG_FILE.replace(/\/[^/]+$/, ""), { recursive: true }); fs.appendFileSync(LOG_FILE, l) } catch {}; console.log(l.trim()) }

async function getToken() {
  const p = new URLSearchParams({ client_id: YOUTUBE_CLIENT_ID, client_secret: YOUTUBE_CLIENT_SECRET, refresh_token: YOUTUBE_REFRESH_TOKEN, grant_type: "refresh_token" })
  const j = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: p })).json()
  if (!j.access_token) throw new Error("token: " + JSON.stringify(j))
  return j.access_token
}

async function myChannelId(tok) {
  const j = await (await fetch(`${API}/channels?part=id&mine=true`, { headers: { Authorization: `Bearer ${tok}` } })).json()
  return j.items?.[0]?.id
}

async function listComments(tok, videoId) {
  let out = [], pageToken = ""
  do {
    const u = `${API}/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&order=time${pageToken ? "&pageToken=" + pageToken : ""}`
    const j = await (await fetch(u, { headers: { Authorization: `Bearer ${tok}` } })).json()
    if (j.error) { log(`list erro ${videoId}: ${JSON.stringify(j.error)}`); break }
    for (const it of j.items || []) {
      const c = it.snippet.topLevelComment.snippet
      out.push({ id: it.snippet.topLevelComment.id, text: c.textOriginal || c.textDisplay || "", author: c.authorChannelId?.value })
    }
    pageToken = j.nextPageToken
  } while (pageToken)
  return out
}

async function reply(tok, parentId, text) {
  const r = await fetch(`${API}/comments?part=snippet`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ snippet: { parentId, textOriginal: text } }),
  })
  const j = await r.json()
  if (j.error) { log(`reply ERRO parent=${parentId}: ${JSON.stringify(j.error)}`); return false }
  log(`reply OK parent=${parentId} id=${j.id}`)
  return true
}

async function main() {
  const tok = await getToken()
  const owner = await myChannelId(tok)
  for (const v of VIDEOS) {
    const comments = await listComments(tok, v)
    log(`video=${v} comentarios=${comments.length}`)
    for (const c of comments) {
      if (seen.has(c.id)) continue
      if (c.author && owner && c.author === owner) continue // ignora dono
      const rule = RULES.find(r => r.re.test(c.text))
      if (!rule) continue
      markSeen(c.id)
      log(`MATCH rule=${rule.id} video=${v} comment=${c.id} text="${c.text.slice(0, 60)}"`)
      await reply(tok, c.id, replyText(rule))
    }
  }
}
main().catch(e => { log("ERRO: " + e.message); process.exit(1) })
