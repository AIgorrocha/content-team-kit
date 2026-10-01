import { Pool, type QueryResultRow } from "pg"

const pools = new Map<string, Pool>()

function getPool(databaseUrl: string): Pool {
  const existing = pools.get(databaseUrl)
  if (existing) return existing

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
  })

  pools.set(databaseUrl, pool)
  return pool
}

export interface TenantDB {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<T[]>
  queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<T | null>
}

export function getTenantDB(databaseUrl: string): TenantDB {
  const pool = getPool(databaseUrl)

  return {
    async query<T extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: unknown[]
    ): Promise<T[]> {
      const result = await pool.query<T>(text, params)
      return result.rows
    },

    async queryOne<T extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: unknown[]
    ): Promise<T | null> {
      const result = await pool.query<T>(text, params)
      return result.rows[0] ?? null
    },
  }
}
