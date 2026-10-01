#!/usr/bin/env node
/**
 * upload-youtube-short.mjs - Upload de YouTube Short via Playwright (browser automation)
 *
 * Abre o YouTube Studio, faz upload do video e preenche metadata.
 * Usa browser visivel pra permitir login manual se necessario.
 * A sessao fica no perfil do navegador DESTA marca (~/.playwright-youtube-{slug}), entao
 * cada marca entra na sua propria conta. O caminho padrao de publicacao e
 * upload-youtube-api.mjs; este script e o plano B pelo navegador.
 */

import { chromium } from 'playwright'
import { resolve } from 'path'
import { existsSync } from 'fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { playwrightDir } from '../_lib/workspace-client.mjs'
const { registerPublicationSafe } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '_lib/register.mjs')).href)

const VIDEO_PATH = process.argv[2]
const TITLE = process.argv[3] || 'YouTube Short'
const DESCRIPTION = process.argv[4] || ''
const TAGS = process.argv[5] || ''

if (!VIDEO_PATH || !existsSync(VIDEO_PATH)) {
  console.error('Uso: node upload-youtube-short.mjs <video.mp4> "<titulo>" "<descricao>" "<tags>"')
  process.exit(1)
}

const USER_DATA_DIR = playwrightDir('youtube')

async function main() {
  console.log('Abrindo navegador...')

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: 'pt-BR',
    args: ['--disable-blink-features=AutomationControlled']
  })

  const page = context.pages()[0] || await context.newPage()

  // Navegar pro YouTube Studio upload
  console.log('Acessando YouTube Studio...')
  await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle', timeout: 30000 })

  // Verificar se esta logado
  const currentUrl = page.url()
  if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
    console.log('\n========================================')
    console.log('PRECISA FAZER LOGIN NO GOOGLE!')
    console.log('Faca login no navegador que abriu.')
    console.log('Depois o script continua automaticamente.')
    console.log('========================================\n')

    // Aguardar ate chegar no YouTube Studio (max 5 min)
    await page.waitForURL('**/studio.youtube.com/**', { timeout: 300000 })
    console.log('Login detectado! Continuando...')
    await page.waitForTimeout(3000)
  }

  // Clicar no botao de upload (icone de camera com +)
  console.log('Clicando em Upload...')

  // Tentar botao CREATE
  try {
    await page.click('#create-icon', { timeout: 5000 })
    await page.waitForTimeout(1000)
    // Clicar em "Upload videos"
    await page.click('tp-yt-paper-item:has-text("Upload videos"), #text-item-0', { timeout: 5000 })
  } catch {
    // Tentar URL direta
    await page.goto('https://studio.youtube.com/channel/upload', { waitUntil: 'networkidle', timeout: 15000 })
  }

  await page.waitForTimeout(2000)

  // Upload do arquivo
  console.log(`Fazendo upload de: ${VIDEO_PATH}`)
  const fileInput = await page.locator('input[type="file"]')
  await fileInput.setInputFiles(resolve(VIDEO_PATH))

  // Aguardar dialog de detalhes aparecer
  console.log('Aguardando processamento do upload...')
  await page.waitForTimeout(5000)

  // Preencher titulo
  console.log(`Preenchendo titulo: ${TITLE}`)
  try {
    const titleInput = page.locator('#textbox[aria-label*="title"], #textbox').first()
    await titleInput.click()
    await titleInput.fill('')
    await page.keyboard.press('Control+a')
    await page.keyboard.type(TITLE, { delay: 30 })
  } catch (e) {
    console.log('Erro no titulo, tentando alternativa...', e.message)
  }

  await page.waitForTimeout(1000)

  // Preencher descricao
  if (DESCRIPTION) {
    console.log('Preenchendo descricao...')
    try {
      const descInput = page.locator('#textbox[aria-label*="description"], #textbox').nth(1)
      await descInput.click()
      await page.keyboard.type(DESCRIPTION, { delay: 10 })
    } catch (e) {
      console.log('Erro na descricao:', e.message)
    }
  }

  await page.waitForTimeout(1000)

  // Marcar como "Not made for kids"
  try {
    const notForKids = page.locator('tp-yt-paper-radio-button[name="NOT_MADE_FOR_KIDS"], #radioLabel:has-text("No, it")').first()
    await notForKids.click()
  } catch (e) {
    console.log('Radio kids nao encontrado:', e.message)
  }

  // Clicar NEXT ate chegar em Visibility
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(1500)
    try {
      await page.click('#next-button, button:has-text("Next"), #step-badge-' + (i + 1), { timeout: 5000 })
      console.log(`Next ${i + 1}/3`)
    } catch {
      console.log(`Next ${i + 1} nao encontrado, continuando...`)
    }
  }

  await page.waitForTimeout(2000)

  // Selecionar Public
  try {
    const publicRadio = page.locator('tp-yt-paper-radio-button[name="PUBLIC"], #radioLabel:has-text("Public")').first()
    await publicRadio.click()
    console.log('Marcado como Public')
  } catch (e) {
    console.log('Radio public nao encontrado:', e.message)
  }

  await page.waitForTimeout(2000)

  // Aguardar processamento terminar antes de publicar
  console.log('Aguardando video processar...')
  try {
    await page.waitForSelector('.progress-label:has-text("100"), span:has-text("Upload complete"), span:has-text("Checks complete"), span:has-text("SD processing"), span:has-text("HD processing")', { timeout: 120000 })
  } catch {
    console.log('Timeout no processamento, tentando publicar mesmo assim...')
  }

  await page.waitForTimeout(2000)

  // Clicar Publish
  try {
    await page.click('#done-button, button:has-text("Publish"), button:has-text("Save")', { timeout: 10000 })
    console.log('PUBLICADO!')
  } catch (e) {
    console.log('Botao publish nao encontrado:', e.message)
    console.log('O navegador esta aberto. Finalize manualmente se necessario.')
  }

  // Aguardar e pegar link
  await page.waitForTimeout(5000)

  try {
    const linkElement = page.locator('a.style-scope.ytcp-video-info[href*="youtu"]').first()
    const link = await linkElement.getAttribute('href')
    if (link) {
      console.log(`\nLink do video: ${link}`)
      await registerPublicationSafe({
        platform: 'youtube', content_type: 'short', title: TITLE, url: link,
        caption: DESCRIPTION || null, source_agent: 'upload-youtube-short.mjs',
      })
    }
  } catch {
    console.log('Link nao encontrado automaticamente.')
  }

  console.log('\nNavegador permanece aberto por 30s pra voce verificar...')
  await page.waitForTimeout(30000)

  await context.close()
  console.log('Concluido!')
}

main().catch(err => {
  console.error('Erro:', err.message)
  process.exit(1)
})
