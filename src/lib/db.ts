import { Pool, type QueryResultRow } from "pg"

const databaseUrl = process.env.DATABASE_URL ?? ""
let isLocalDb = false
try { isLocalDb = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname) } catch { /* URL ausente */ }
const useSsl = !isLocalDb && process.env.DATABASE_SSL !== "false"

// O Next recarrega módulos no desenvolvimento. Reutilizar o pool evita multiplicar
// conexões a cada compilação e permite substituir conexões ociosas interrompidas.
const runtime = globalThis as typeof globalThis & { contentTeamPool?: Pool }
const pool = runtime.contentTeamPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 3000,
  statement_timeout: 15000,
  query_timeout: 16000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  maxLifetimeSeconds: 300,
})
if (!runtime.contentTeamPool) {
  pool.on("error", () => {
    // Não registrar o objeto de erro: ele pode carregar dados da conexão.
    console.warn("Banco: conexão ociosa interrompida; uma nova conexão será aberta quando necessário.")
  })
  runtime.contentTeamPool = pool
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<T>(text, params)
  return result.rows
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

export async function transaction<T>(
  fn: (client: { query: typeof query }) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  let descartarConexao = false
  try {
    await client.query("BEGIN")
    const clientQuery = async <R extends QueryResultRow>(text: string, params?: unknown[]) => {
      const result = await client.query<R>(text, params)
      return result.rows
    }
    const result = await fn({ query: clientQuery as typeof query })
    await client.query("COMMIT")
    return result
  } catch (error) {
    // Uma queda pode impedir também o rollback. Preserve o erro da operação original.
    try { await client.query("ROLLBACK") } catch { descartarConexao = true }
    throw error
  } finally {
    client.release(descartarConexao)
  }
}

export default pool
