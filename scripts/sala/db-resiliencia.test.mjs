import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { setTimeout as esperar } from 'node:timers/promises'
import { Client } from 'pg'

const executar = promisify(execFile)
const require = createRequire(import.meta.url)

test('inicialização local rejeita banco remoto e substituição de host na URL', async () => {
  for (const url of ['postgresql://fixture:fixture@database.example.invalid/fixture', 'postgresql://fixture:fixture@localhost/fixture?host=database.example.invalid']) {
    await assert.rejects(
      executar(process.execPath, ['scripts/sala/dev-local.mjs', '--sem-vigia'], {
        env: { ...process.env, SALA_LOCAL_DATABASE_URL: url }, timeout: 3000,
      }),
      erro => erro.code === 1 && /deve apontar para o PostgreSQL local/.test(erro.stderr),
    )
  }
})

test('conexão ociosa perdida é substituída sem derrubar o processo', { skip: process.env.SALA_LIVE !== '1' }, async () => {
  const url = new URL(process.env.DATABASE_URL)
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'a prova exige banco local')
  const { default: pool, query, transaction } = require('../../src/lib/db.ts')
  const admin = new Client({ connectionString: url.href, connectionTimeoutMillis: 3000 })
  try {
    assert.ok(pool.listenerCount('error') > 0)
    await admin.connect()
    const [{ pid }] = await query('select pg_backend_pid() as pid')
    // Encerra somente a conexão que este processo de teste acabou de criar.
    await admin.query('select pg_terminate_backend($1)', [pid])
    for (let i = 0; i < 100 && pool.totalCount > 0; i++) await esperar(10)
    assert.equal(pool.totalCount, 0)
    const [{ pid: novo }] = await query('select pg_backend_pid() as pid')
    assert.notEqual(novo, pid)
    await assert.rejects(transaction(async client => {
      const [{ pid: emTransacao }] = await client.query('select pg_backend_pid() as pid')
      await admin.query('select pg_terminate_backend($1)', [emTransacao])
      throw new Error('Falha original da operação')
    }), /Falha original da operação/)
    assert.equal(pool.totalCount, 0, 'rollback sem conexão deve descartar o cliente')
    assert.equal((await query('select 1 as ok'))[0].ok, 1)
  } finally {
    await admin.end()
    await pool.end()
  }
})

test('porta aberta sem PostgreSQL não trava consulta nem inicia o Next', async () => {
  const sockets = new Set()
  const servidor = createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  await new Promise(resolve => servidor.listen(0, '127.0.0.1', resolve))
  const url = `postgresql://fixture:fixture@127.0.0.1:${servidor.address().port}/fixture`
  const env = { ...process.env, DATABASE_URL: url, SALA_LOCAL_DATABASE_URL: url, DATABASE_SSL: 'false' }
  const consulta = `const {query,default:pool}=require('./src/lib/db.ts');const t=Date.now();query('select 1').then(()=>{process.exitCode=2}).catch(()=>console.log(JSON.stringify({ms:Date.now()-t}))).finally(()=>pool.end())`
  try {
    const { stdout } = await executar(process.execPath, ['--import', 'tsx', '-e', consulta], { env, timeout: 6000 })
    assert.ok(JSON.parse(stdout).ms < 4500)
    await assert.rejects(
      executar(process.execPath, ['scripts/sala/dev-local.mjs', '--sem-vigia'], { env, timeout: 6000 }),
      erro => erro.code === 1 && /não respondeu à consulta/.test(erro.stderr),
    )
  } finally {
    for (const socket of sockets) socket.destroy()
    await new Promise(resolve => servidor.close(resolve))
  }
})
