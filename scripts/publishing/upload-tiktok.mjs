#!/usr/bin/env node
/**
 * upload-tiktok.mjs - Upload de video pro TikTok via Playwright (browser automation)
 *
 * Abre o TikTok Studio (web), faz upload do video e preenche a legenda.
 * Browser visivel pra permitir login manual 1x (sessao salva em ~/.playwright-tiktok-{slug}, uma por marca).
 * A Content Posting API do TikTok nao publica sem audit aprovado, por isso usamos o web.
 *
 * Uso:
 *   node scripts/publishing/upload-tiktok.mjs <video.mp4> "<legenda>"
 *   node scripts/publishing/upload-tiktok.mjs <video.mp4> --caption-file <arquivo.txt>
 *
 * Ex:
 *   node scripts/publishing/upload-tiktok.mjs content/{slug}/reels/{peca}/{peca}.mp4 \
 *     --caption-file content/{slug}/reels/{peca}/legenda-tiktok.txt --cover content/{slug}/reels/{peca}/capa.png
 *
 * Depois de publicar, tenta ler o link do video no TikTok Studio e registra a peca. Se nao achar
 * (ou sem banco), avisa e diz o comando: node scripts/publishing/register-publication.mjs --platform tiktok ...
 *
 * Nota: a legenda do TikTok tem limite (~2200 chars) e o texto apos "---" no arquivo
 * (COMENTARIO FIXADO) NAO entra na legenda. Fixar o link no comentario e manual depois.
 */

import { chromium } from "playwright"
import { resolve } from "node:path"
import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { resolveClient, playwrightDir } from "../_lib/workspace-client.mjs"
const { registerPublicationSafe } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "_lib/register.mjs")).href)

const args = process.argv.slice(2)
const VIDEO_PATH = args[0]
// flags nomeadas
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const COVER_PATH = flag("--cover")            // imagem de capa (obrigatoria por regra; ver cross-post-capa-schema)
let PIN_LINK = flag("--pin-link") || ""       // link pro comentario fixado (manual)
let caption = ""
const capFile = flag("--caption-file")
if (capFile) {
  if (!existsSync(capFile)) { console.error("Arquivo de legenda nao encontrado:", capFile); process.exit(1) }
  const raw = readFileSync(capFile, "utf8")
  // pega so o conteudo antes do separador "---" (o resto e nota interna / comentario fixado)
  caption = raw.split(/\n-{3,}\n/)[0].trim()
  // extrai COMENTARIO FIXADO: <link> se existir e nenhum --pin-link foi passado
  if (!PIN_LINK) { const m = raw.match(/COMENTARIO FIXADO:\s*(\S+)/i); if (m) PIN_LINK = m[1] }
} else if (args[1] && !args[1].startsWith("--")) {
  caption = args[1]
}

if (COVER_PATH && !existsSync(COVER_PATH)) { console.error("Capa nao encontrada:", COVER_PATH); process.exit(1) }
if (!COVER_PATH) console.warn("AVISO: sem --cover. REGRA: reel/short nao deve ir sem capa. Passe --cover <capa.png> ou troque manual no app depois.")

if (!VIDEO_PATH || !existsSync(VIDEO_PATH)) {
  console.error('Uso: node upload-tiktok.mjs <video.mp4> "<legenda>"  (ou --caption-file <arquivo.txt>)')
  process.exit(1)
}

// Sessao e registro sao da marca ativa (.workspace ou CT_CLIENT). Falha clara se nao houver.
const CLIENT = resolveClient()
const USER_DATA_DIR = playwrightDir("tiktok")
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  console.log("Abrindo navegador (TikTok)...")
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
    locale: "pt-BR",
    args: ["--disable-blink-features=AutomationControlled"],
  })
  const page = context.pages()[0] || await context.newPage()

  console.log("Acessando TikTok Studio (upload)...")
  await page.goto("https://www.tiktok.com/tiktokstudio/upload", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {})
  await sleep(4000)

  console.log("\n========================================")
  console.log("SE PEDIR LOGIN: faca login no navegador (QR code pelo app e mais rapido).")
  console.log("O script ESPERA a area de upload aparecer (ate 5 min). Nao feche a janela.")
  console.log("========================================\n")

  // Poll: procura o input[type=file] (so aparece logado + na pagina de upload), em todas as frames, ate 5 min
  const findFileInput = async () => {
    for (const f of page.frames()) {
      const fi = f.locator('input[type="file"]').first()
      if (await fi.count().catch(() => 0)) return fi
    }
    return null
  }
  let fileInput = null
  for (let i = 0; i < 100; i++) { // 100 * 3s = 5 min
    // se saiu da pagina de upload (login redirecionou), volta
    if (!/tiktokstudio\/upload/.test(page.url()) && !/login|signup/i.test(page.url())) {
      await page.goto("https://www.tiktok.com/tiktokstudio/upload", { waitUntil: "domcontentloaded" }).catch(() => {})
      await sleep(3000)
    }
    fileInput = await findFileInput()
    if (fileInput) break
    if (i % 5 === 0) console.log(`Aguardando area de upload... (${i * 3}s) url=${page.url()}`)
    await sleep(3000)
  }
  if (!fileInput) { console.log("Nao encontrei a area de upload em 5 min. Faca o upload manual na janela aberta."); await sleep(180000); await context.close(); return }

  console.log("Fazendo upload de:", VIDEO_PATH)
  await fileInput.setInputFiles(resolve(VIDEO_PATH))
  console.log("Arquivo enviado, aguardando processar...")
  await sleep(8000)

  // Preencher legenda (campo contenteditable do TikTok)
  if (caption) {
    console.log("Preenchendo legenda...")
    // fecha pop-ups/tooltips que interceptam o clique (ex: "Vamos analisar seu video...")
    for (let i = 0; i < 3; i++) { await page.keyboard.press("Escape").catch(() => {}); await sleep(400) }
    await page.mouse.click(640, 700).catch(() => {}) // clica numa area neutra
    await sleep(800)
    try {
      const box = page.locator('div[contenteditable="true"], .public-DraftEditor-content').first()
      // force:true ignora overlays que interceptam pointer events
      await box.click({ timeout: 10000, force: true })
      await page.keyboard.press("Control+A")
      await page.keyboard.press("Delete")
      await page.keyboard.type(caption, { delay: 8 }) // devagar = dispara deteccao de hashtags
    } catch (e) {
      console.log("Nao consegui preencher a legenda automatico:", e.message, "-> preencha manual.")
    }
  }

  await sleep(3000)

  // Garantir visibilidade PUBLICA (TikTok as vezes default "Somente eu")
  console.log("Definindo visibilidade: Todos (publico)...")
  try {
    // abre o seletor "Quem pode ver este video"
    const sel = page.getByText(/Quem pode ver|Who can view/i).first()
    if (await sel.count()) {
      // o dropdown costuma ser um combobox proximo; clica nele
      const combo = page.locator('[class*="select"], [role="combobox"]').filter({ hasText: /Somente eu|Only you|Todos|Everyone|Amigos|Friends|Seguidores/i }).first()
      await combo.click({ timeout: 4000, force: true }).catch(() => {})
      await sleep(800)
      const opt = page.getByText(/^Todos$|^Everyone$|^Público$|^Public$/i).first()
      await opt.click({ timeout: 4000, force: true })
      console.log("Visibilidade -> Todos")
    }
  } catch (e) { console.log("Nao consegui setar visibilidade auto:", e.message, "-> confira manual (deve ser Todos).") }
  await sleep(1500)

  // Setar CAPA (cover) — regra: nunca publicar sem capa.
  // Fluxo REAL (validado na pratica):
  //   "Editar capa" (botao overlay na miniatura, so reage a HOVER + clique real no elemento)
  //   -> modal abre com botao "Carregar capa" (upload de imagem propria, NAO frame do video)
  //   -> setInputFiles(COVER) no input[type=file] (via filechooser ou input direto)
  //   -> "Salvar" (canto sup. direito do modal).
  // Confirmar visualmente que a miniatura da capa mudou pra imagem propria antes de publicar.
  if (COVER_PATH) {
    console.log("Setando capa (cover):", COVER_PATH)
    try {
      const editBtn = page.getByText(/Editar capa|Edit cover/i).first()
      await editBtn.scrollIntoViewIfNeeded().catch(() => {})
      const bb = await editBtn.boundingBox().catch(() => null)
      if (bb) {
        // hover pra revelar o botao clicavel, depois clique real
        await page.mouse.move(bb.x + bb.width / 2, bb.y - 30); await sleep(400)
        await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(400)
      }
      await editBtn.click({ timeout: 5000 }).catch(() => bb && page.mouse.dblclick(bb.x + bb.width / 2, bb.y + bb.height / 2))
      await sleep(3000)

      const modalOpen = await page.getByText(/Carregar capa|Upload cover/i).first().count().catch(() => 0)
      if (!modalOpen) throw new Error("modal de capa nao abriu (Carregar capa nao apareceu)")

      // clica "Carregar capa" capturando o filechooser; fallback: setInputFiles direto
      const carregar = page.getByText(/Carregar capa|Upload cover/i).first()
      let done = false
      page.once("filechooser", async (fc) => { await fc.setFiles(resolve(COVER_PATH)).catch(() => {}); done = true })
      await carregar.click({ force: true }).catch(() => {})
      await sleep(2000)
      if (!done) {
        for (const fr of page.frames()) {
          const inp = fr.locator('input[type="file"]').last()
          if (await inp.count().catch(() => 0)) { await inp.setInputFiles(resolve(COVER_PATH)).catch(() => {}); done = true; break }
        }
      }
      await sleep(3500)
      // Salvar a capa
      const save = page.getByRole("button", { name: /^Salvar$|^Save$/i }).first()
      await save.click({ timeout: 6000, force: true }).catch(() => {})
      await sleep(3000)
      console.log(done ? "Capa aplicada (imagem propria) + salva." : "Nao consegui carregar a capa -> troque manual no app.")
    } catch (e) {
      console.log("Nao consegui setar a capa automatico:", e.message, "-> troque manual no app (Editar capa > Carregar capa).")
    }
  }

  // Reafirmar privacidade "Todos" no form (TikTok as vezes reverte pra "Somente eu")
  try {
    const combo = page.locator('[role="combobox"], [class*="select"]').filter({ hasText: /Todos|Amigos|Seguidores|Somente eu|Only you|Friends|Everyone/i }).first()
    const cur = (await combo.innerText().catch(() => "")).trim()
    if (cur && !/Todos|Everyone|P[uú]blico|Public/i.test(cur)) {
      await combo.click({ force: true }); await sleep(800)
      await page.getByText(/^Todos$|^Everyone$|^P[uú]blico$/i).first().click({ force: true }).catch(() => {})
      console.log("Privacidade reafirmada -> Todos")
    }
  } catch {}

  // Esperar o video terminar de processar ANTES de publicar (publish antes do processamento
  // gera "publish fantasma": clica mas nao posta). um arquivo de ~86 MB precisou >=50s;
  // um de ~159 MB precisa mais. Escala com o arquivo.
  const sizeMB = statSync(VIDEO_PATH).size / 1048576
  const waitMs = sizeMB > 100 ? 90000 : 50000
  console.log(`Aguardando processamento do video (${Math.round(waitMs / 1000)}s, arquivo ${sizeMB.toFixed(0)} MB)...`)
  await sleep(waitMs)

  // AUTO-PUBLICAR
  const AUTO_PUBLISH = process.env.NO_PUBLISH ? false : true
  if (AUTO_PUBLISH) {
    console.log("Publicando...")
    let posted = false
    for (let i = 0; i < 24 && !posted; i++) {
      for (const rx of [/^Publicar$/i, /^Postar$/i, /^Post$/i, /^Publish$/i]) {
        try {
          const btn = page.getByRole("button", { name: rx }).first()
          if (await btn.count() && await btn.isEnabled().catch(() => false)) {
            await btn.click({ timeout: 3000 }); console.log("Clicou:", rx); posted = true; break
          }
        } catch {}
      }
      if (!posted) await sleep(2500)
    }
    // trata dialogo de confirmacao pos-clique (as vezes aparece "Publicar"/"Continuar"/"Confirmar")
    if (posted) {
      await sleep(3000)
      for (let i = 0; i < 3; i++) {
        const dlg = page.getByRole("button", { name: /^Publicar$|^Postar$|^Continuar$|^Confirmar$|^Publish$|^Continue$|^OK$/i }).last()
        if (await dlg.count().catch(() => 0) && await dlg.isVisible().catch(() => false) && await dlg.isEnabled().catch(() => false)) {
          await dlg.click({ force: true }).catch(() => {}); console.log("Confirmou dialogo pos-publicar"); await sleep(2500)
        }
        await sleep(1500)
      }
      await sleep(10000)
      // VERIFICA de verdade na pagina de Conteudo (nao confia so na mensagem): o comeco da legenda
      // tem que aparecer na lista. Sem legenda, so confirma que a pagina abriu.
      const needle = caption.replace(/\s+/g, " ").slice(0, 25)
      let ok = false
      for (let i = 0; i < 6 && !ok; i++) {
        await page.goto("https://www.tiktok.com/tiktokstudio/content", { waitUntil: "domcontentloaded" }).catch(() => {})
        await sleep(8000)
        const txt = await page.innerText("body").catch(() => "")
        ok = /tiktokstudio\/content/.test(page.url()) && (needle ? txt.replace(/\s+/g, " ").includes(needle) : true)
        if (!ok && /tiktokstudio\/content/.test(page.url())) {
          console.log("Conteudo abriu mas o video novo ainda nao apareceu (tentativa " + (i + 1) + ")")
        }
      }
      const qaDir = resolve("output", "tiktok-qa")
      try {
        const { mkdirSync } = await import("node:fs")
        mkdirSync(qaDir, { recursive: true })
        await page.screenshot({ path: resolve(qaDir, "conteudo.png"), fullPage: true })
        console.log("QA snapshot:", resolve(qaDir, "conteudo.png"))
      } catch (e) { console.log("QA snapshot falhou:", e.message) }
      console.log(ok ? "PUBLICADO no TikTok! (confira em Conteudo: capa + privacidade Todos)" : "Cliquei Publicar; confirme na janela/Conteudo se postou.")
      if (ok) {
        // Link do video: procura o primeiro link /video/ dentro da linha que tem o comeco da legenda.
        const link = await page.evaluate((n) => {
          const norm = (t) => (t || "").replace(/\s+/g, " ")
          const alvo = [...document.querySelectorAll("div,span,p")].find((e) => e.children.length === 0 && n && norm(e.textContent).includes(n))
          for (let el = alvo, i = 0; el && i < 10; el = el.parentElement, i++) {
            const a = el.querySelector('a[href*="/video/"]')
            if (a) return a.href
          }
          return null
        }, needle).catch(() => null)
        if (link && /tiktok\.com\/@[^/]+\/video\/\d+/.test(link)) {
          await registerPublicationSafe({
            client_slug: CLIENT, platform: "tiktok", content_type: "video",
            title: path.basename(path.dirname(resolve(VIDEO_PATH))), url: link.split("?")[0],
            caption, source_agent: "upload-tiktok.mjs",
          })
        } else {
          console.warn(">>> Nao consegui ler o link do video. Registre a peca com o link do TikTok:")
          console.warn(`    node scripts/publishing/register-publication.mjs --platform tiktok --type video --title "<titulo>" --url "<https://www.tiktok.com/@conta/video/ID>"`)
        }
      }
      console.log(">>> NOTA: TikTok pode marcar o video 'Conteudo sob analise' e forcar 'Somente eu'.")
      console.log("    Se acontecer, mude a privacidade pra Todos na lista de Conteudo (dropdown da linha).")
      if (PIN_LINK) console.log(">>> Falta FIXAR o comentario com o link (manual):", PIN_LINK)
      if (!COVER_PATH) console.log(">>> ATENCAO: publicado SEM capa (--cover nao passado). Troque a capa manual no app.")
    } else {
      console.log("Nao achei o botao Publicar habilitado. Publique manual na janela.")
    }
  }
  console.log("\nConcluido.")
  await sleep(3000)
  await context.close()
}

main().catch(err => { console.error("Erro:", err.message); process.exit(1) })
