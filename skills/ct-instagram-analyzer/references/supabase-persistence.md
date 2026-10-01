# Persistência de Métricas Instagram no Supabase

## Contexto

Em set/2026, o `metrics-writer` do analyzer falhou com:
```
upsert falhou 404: {"code":"PGRST205","message":"Could not find the table 'public.ct_metrics_snapshots' in the schema cache"}
```

**Causa raiz:** PostgREST com schema cache desatualizado. A tabela `ct_metrics_snapshots` existia no PostgreSQL, mas o PostgREST não a reconhecia.

## Schema real da tabela (set/2026)

```sql
CREATE TABLE ct_metrics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_slug text NOT NULL,
  platform text NOT NULL,
  account_handle text,
  grain text NOT NULL,              -- 'post' | 'account'
  post_id text NOT NULL,
  post_url text,
  post_type text,
  published_at timestamptz,
  snapshot_date date NOT NULL,
  followers integer,
  reach integer,
  impressions integer,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  views integer,
  engagement_rate numeric,
  metrics jsonb NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Constraints
PRIMARY KEY (id)
UNIQUE (platform, post_id, snapshot_date)  -- uq_ct_metrics_post_day

-- Indexes
idx_ct_metrics_client_platform_date
idx_ct_metrics_bucket
uq_ct_metrics_post_day
```

**Notas críticas:**
- `post_id` é `NOT NULL` mesmo para `grain='account'` → usar valor sintético como `ACCOUNT-{handle}-{date}`
- `metrics` é `jsonb NOT NULL` → sempre passar JSON válido
- `snapshot_date` é `date` (não timestamptz)
- Unique constraint é `(platform, post_id, snapshot_date)`: não inclui `account_handle`

## Workaround: Inserção via pg (conexão direta)

Quando PostgREST falha com PGRST205, usar `pg` direto:

```javascript
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Idempotent: delete rows for the snapshot_date first
await client.query(
  "DELETE FROM ct_metrics_snapshots WHERE snapshot_date = $1 AND platform = 'instagram'",
  ['2026-09-21']
);

// Insert per-post rows
for (const post of media) {
  const insights = post.insights || {};
  const reach = insights.reach || 0;
  const er = reach > 0
    ? parseFloat(((post.like_count + post.comments_count) / reach * 100).toFixed(2))
    : 0;

  await client.query(`
    INSERT INTO ct_metrics_snapshots
    (client_slug, platform, account_handle, grain, post_id, post_url, post_type,
     published_at, snapshot_date, followers, reach, impressions, likes, comments,
     shares, saves, views, engagement_rate, metrics, source, created_at)
    VALUES ($1,'instagram',$2,'post',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'graph_api',NOW())
    ON CONFLICT (platform, post_id, snapshot_date) DO UPDATE SET
      reach=EXCLUDED.reach, impressions=EXCLUDED.impressions,
      likes=EXCLUDED.likes, comments=EXCLUDED.comments,
      shares=EXCLUDED.shares, saves=EXCLUDED.saves,
      views=EXCLUDED.views, engagement_rate=EXCLUDED.engagement_rate,
      metrics=EXCLUDED.metrics
  `, [
    clientSlug, handle, post.id, post.permalink, post.media_type,
    post.timestamp, snapshotDate, followers,
    reach, insights.impressions || 0, post.like_count || 0, post.comments_count || 0,
    insights.shares || 0, insights.saved || 0, insights.plays || 0,
    er, JSON.stringify(post)
  ]);
}

// Insert account-level summary (grain='account', post_id sintético)
const accountPostId = `ACCOUNT-${handle}-${snapshotDate}`;
await client.query(`
  INSERT INTO ct_metrics_snapshots
  (client_slug, platform, account_handle, grain, post_id, snapshot_date,
   followers, reach, impressions, likes, comments, shares, saves, views,
   engagement_rate, metrics, source, created_at)
  VALUES ($1,'instagram',$2,'account',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'graph_api',NOW())
`, [
  clientSlug, handle, accountPostId, snapshotDate, followers,
  totals.reach, totals.impressions, totals.likes, totals.comments,
  totals.shares, totals.saves, totals.views, accountER,
  JSON.stringify({ posts_count: media.length, reels: reelsCount, carousels: carouselsCount, images: imagesCount })
]);
```

## Como diagnosticar PGRST205

1. **Verificar se tabela existe no PostgreSQL direto:**
```javascript
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const res = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name = 'ct_metrics_snapshots'
`);
console.log(res.rows); // Se retornar 1 row, tabela existe
```

2. **Verificar constraints:**
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'ct_metrics_snapshots'::regclass;
```

3. **Verificar null constraints:**
```sql
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'ct_metrics_snapshots';
```

## Sinais de schema cache stale no PostgREST

- `PGRST205` com hint "Perhaps you meant the table 'public.ct_tenants'"
- Tabela existe no `information_schema.tables` mas PostgREST devolve 404
- Outras tabelas do mesmo prefixo funcionam normalmente

**Fix:** O schema cache do PostgREST recarrega automaticamente em alguns minutos. Se não recarregar, pode forçar via `NOTIFY pgrst, 'reload schema';` no PostgreSQL (requer permissão).

## Env vars necessárias

- `DATABASE_URL` ou `POSTGRES_URL`: connection string PostgreSQL direta
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`: para Supabase client (quando PostgREST funciona)
