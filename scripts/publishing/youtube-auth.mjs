#!/usr/bin/env node
/**
 * youtube-auth.mjs - Gera (ou renova) o YOUTUBE_REFRESH_TOKEN de PUBLICAR via OAuth local.
 * Escopos de upload (youtube.upload, youtube, youtube.force-ssl). O painel (Conectar) pede so
 * leitura (youtube.readonly) e NAO serve para publicar: o caminho de publicacao e este script.
 *
 * Pre-requisito: YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET no .env.local. Com o ID do cliente OAuth
 * do tipo "Aplicativo para computador" (Desktop) o Google aceita http://localhost sem cadastro.
 * Se o seu for do tipo Web, cadastre em URIs de redirecionamento: http://localhost:8765/callback
 *
 * Uso: node scripts/publishing/youtube-auth.mjs
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { google } from 'googleapis'
import http from 'node:http'
import { exec } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolveClient } from '../_lib/workspace-client.mjs'
import { registrarConexao, encerrarPool } from '../sala/connections-lib.mjs'

const PORT = 8765 // nao use 5000: e a porta do painel
const REDIRECT_PATH = '/callback'
const REDIRECT = `http://localhost:${PORT}${REDIRECT_PATH}`
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube', 'https://www.googleapis.com/auth/youtube.force-ssl']

const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET } = process.env
if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
  console.error('Missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET')
  process.exit(1)
}

const oauth2 = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, REDIRECT)

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES
})

console.log('\n========================================')
console.log('YOUTUBE OAUTH RE-AUTH')
console.log('========================================')
console.log('\nServidor local rodando em', REDIRECT)
console.log('\nABRINDO BROWSER... se nao abrir, cola no navegador:')
console.log(authUrl)
console.log('\nIMPORTANTE:')
console.log('  - Loga na conta YT do canal do cliente ativo')
console.log('  - Autoriza permissao de upload')
console.log('  - Se erro "redirect_uri_mismatch":')
console.log('    Google Cloud Console -> OAuth Client -> adiciona', REDIRECT)
console.log('========================================\n')

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, REDIRECT)
    const code = url.searchParams.get('code')
    const error = url.searchParams.get('error')

    if (error) {
      res.end(`Erro: ${error}`)
      console.error('Autorizacao nao concluida.')
      process.exit(1)
    }
    if (!code) {
      res.end('Aguardando autorizacao...')
      return
    }

    res.end('<h1>Auth OK!</h1><p>Pode fechar essa aba e voltar pro terminal.</p>')

    const { tokens } = await oauth2.getToken(code)
    console.log('\n✅ TOKENS RECEBIDOS')
    console.log('scope:', tokens.scope)

    if (!tokens.refresh_token) {
      console.error('\n❌ Sem refresh_token. Revoga acesso em https://myaccount.google.com/permissions e tenta de novo.')
      process.exit(1)
    }

    // Atualizar .env.local
    const envPath = '.env.local'
    if (existsSync(envPath)) {
      let env = readFileSync(envPath, 'utf8')
      if (env.match(/^YOUTUBE_REFRESH_TOKEN=.*$/m)) {
        env = env.replace(/^YOUTUBE_REFRESH_TOKEN=.*$/m, `YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`)
      } else {
        env += `\nYOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`
      }
      writeFileSync(envPath, env)
      console.log(`\n✅ ${envPath} atualizado`)
    }

    try {
      await registrarConexao({
        client_slug: resolveClient(),
        service: 'youtube',
        obtained_at: new Date().toISOString(),
        renew_kind: 'never',
        status: 'ok',
      })
    } catch (erroRegistro) {
      console.error('Falha ao registrar a conexao no banco.')
    } finally {
      await encerrarPool()
    }

    console.log('\nProximo passo: rodar upload')
    console.log('  node scripts/publishing/upload-youtube-api.mjs <video> content/.../titulo.txt content/.../descricao.txt content/.../tags.txt')

    server.close()
    process.exit(0)
  } catch (e) {
    console.error('Falha na autorizacao.')
    if (!res.writableEnded) res.end('Falha na autorizacao.')
    process.exit(1)
  }
})

server.listen(PORT, () => {
  // Abrir browser
  const cmd = process.platform === 'win32' ? `start "" "${authUrl}"`
    : process.platform === 'darwin' ? `open "${authUrl}"`
    : `xdg-open "${authUrl}"`
  exec(cmd)
})
