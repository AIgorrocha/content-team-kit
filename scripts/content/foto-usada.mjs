#!/usr/bin/env node
// Confere se uma foto ja saiu em peca publicada (regra 1.4c). Registro: clients/{slug}/fotos-usadas.md
// uso: node scripts/content/foto-usada.mjs <foto> [--client {slug-do-cliente}]
//      node scripts/content/foto-usada.mjs <foto> --registrar "<peca>" "<rede>" [--client slug]
import { createHash } from 'node:crypto'
import { readFileSync, appendFileSync } from 'node:fs'
import { basename } from 'node:path'
import { resolveClient } from '../_lib/workspace-client.mjs'

const args = process.argv.slice(2)
const ci = args.indexOf('--client')
const client = ci >= 0 ? args[ci + 1] : resolveClient()
const foto = args[0]
if (!foto) { console.error('uso: foto-usada.mjs <foto> [--registrar "<peca>" "<rede>"] [--client slug]'); process.exit(2) }

const md5 = createHash('md5').update(readFileSync(foto)).digest('hex')
const reg = `clients/${client}/fotos-usadas.md`
const linhas = readFileSync(reg, 'utf8').split('\n').filter(l => l.startsWith('| ') && l.includes(md5))

const ri = args.indexOf('--registrar')
if (ri >= 0) {
  const peca = args[ri + 1], rede = args[ri + 2] || ''
  const data = new Date().toLocaleDateString('pt-BR')
  appendFileSync(reg, `| ${md5} | ${basename(foto)} | ${peca} | ${rede} | ${data} |\n`)
  console.log(`registrado: ${basename(foto)} -> ${peca}`)
  process.exit(0)
}
if (linhas.length) {
  console.log(`JA USADA (${md5}):`); linhas.forEach(l => console.log('  ' + l)); process.exit(1)
}
console.log(`livre (${md5}): ${basename(foto)}`)
