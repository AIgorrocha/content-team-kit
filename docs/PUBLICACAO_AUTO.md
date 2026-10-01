# Publicação Automática no Instagram

Infra permanente de publicação automática de posts agendados em `ct_content_items`
no Instagram via Graph API, com hospedagem temporária no Supabase Storage.

## Arquitetura

```
┌──────────────────────┐   5 min    ┌────────────────────────────────┐
│ Agendador (cron)     │──curl────▶ │ POST /api/cron/publish-scheduled│
│ (*/5 * * * *)        │            └────────────┬───────────────────┘
└──────────────────────┘                         │ status='scheduled'
                                                 │ scheduled_at <= NOW()
                                                 ▼
                                  ┌──────────────────────────────────┐
                                  │ POST /api/publish/instagram      │
                                  │  1. Le ct_content_items          │
                                  │  2. Cria containers Graph API    │
                                  │  3. Publica carrossel            │
                                  │  4. UPDATE status='published'    │
                                  │  5. Delete bucket ct-temp-media  │
                                  └──────────────────────────────────┘
```

## Componentes

| Arquivo | Função |
|---------|--------|
| `src/lib/integrations/instagram.ts` | Publica no IG via Graph API v21.0 (`publishToInstagram`, `publishCarousel`, `publishImage`, `publishReel`) |
| `src/lib/integrations/supabase-storage.ts` | Upload/delete no bucket `ct-temp-media` |
| `src/app/api/publish/instagram/route.ts` | Endpoint que publica 1 item por vez |
| `src/app/api/cron/publish-scheduled/route.ts` | Endpoint chamado pelo agendador, pega agendados vencidos e dispara o publish |
| `scripts/publishing/publish-ig-reel.mjs` | Publica UM reel direto, fora da fila `ct_content_items` acima |

## Bucket Supabase Storage

- **Nome:** `ct-temp-media`
- **Público:** sim (URLs `storage/v1/object/public/...`)
- **Limite:** 10 MB por arquivo
- **Mime types permitidos:** `image/png`, `image/jpeg`, `image/webp`, `video/mp4`, `video/quicktime`
- **Estrutura:** `{client-slug}/{conteudo-slug}/slide-NN.png`

## Fluxo pra Agendar um Post

1. **Upload das mídias** pro bucket:
   ```bash
   curl -X POST "$SUPABASE_URL/storage/v1/object/ct-temp-media/{slug}/meu-post/slide-01.png" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Content-Type: image/png" \
     -H "x-upsert: true" \
     --data-binary @slide-01.png
   ```

2. **Registrar em `ct_content_items`** com:
   - `status = 'scheduled'`
   - `scheduled_at = <timestamp UTC>` (18h BRT = 21h UTC)
   - `client_slug = '{slug}'` (obrigatório, slug do cliente ativo)
   - `caption` = legenda
   - `media_urls` = array de URLs públicas (`https://.../storage/v1/object/public/ct-temp-media/...`)

3. **Aguardar o cron** (a cada 5 min). Quando `scheduled_at <= NOW()`, publica.

## Status Transitions

```
draft ──(usuário agenda)──▶ scheduled ──(cron publica OK)──▶ published
                             │
                             └──(falhou)──▶ failed (metadata.error preenchido)
```

- `published`: `published_at`, `publish_url`, `metadata.external_id` setados. Arquivos do bucket **apagados**.
- `failed`: `metadata.error` + `metadata.failed_at`. Arquivos **mantidos** no bucket pra retry manual.

## Retry Manual

```bash
# Reverter pra scheduled
UPDATE ct_content_items SET status='scheduled' WHERE id='<id>';

# Ou disparar manualmente:
curl -X POST https://<app>/api/publish/instagram \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"content_item_id":"<id>"}'
```

## Dry-Run (Teste sem publicar)

```bash
curl -X POST https://<app>/api/publish/instagram \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"content_item_id":"<id>","dry_run":true}'
```

## Debug de Falhas

```sql
SELECT id, title, status, metadata->>'error' AS erro, metadata->>'failed_at' AS quando
FROM ct_content_items
WHERE status = 'failed'
ORDER BY (metadata->>'failed_at')::timestamp DESC;
```

## Secrets Necessários

No `.env.local` (dev) e no ambiente de produção (por exemplo, variáveis de ambiente da Vercel):

| Variável | Pra que serve |
|----------|---------------|
| `INSTAGRAM_USER_ID` | ID da conta business do cliente ativo |
| `INSTAGRAM_ACCESS_TOKEN` | Token de acesso Graph API (expira em 60 dias, renovar no Meta for Developers) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service key (upload/delete no Storage) |
| `DATABASE_URL` | Postgres direto (pool) |
| `CRON_SECRET` | Auth do endpoint de cron e publish |

## Como Renovar o Token Instagram

O token IG **expira em 60 dias** mas também invalida antes se:
- Senha da conta FB/IG mudar
- App FB reconfigurado
- Usuário revogar permissão no Meta
- Rate limit grave

Testar se está válido:
```bash
curl "https://graph.instagram.com/v21.0/me?access_token=$INSTAGRAM_ACCESS_TOKEN"
```

Se retornar `OAuthException code 190`:

Caminho simples (token IGAA, o mesmo que os publicadores de `scripts/publishing/` usam):

1. Renovar antes de vencer: `node scripts/publishing/instagram-auth-local.mjs --renovar`.
2. Se já venceu ou foi invalidado: `node scripts/publishing/instagram-auth-local.mjs` (abre o navegador, você autoriza).
3. O script grava o token novo no `.env.local`. Em produção, atualize também: `vercel env add INSTAGRAM_ACCESS_TOKEN production`.

Passo a passo completo e pré-requisitos: `docs/CONECTAR-REDES.md`, seção Instagram.

## Agendador

O kit não traz agendador ativo: quem chama `/api/cron/publish-scheduled` a cada 5 minutos é você. Duas opções:

- **Vercel Cron:** crie um `vercel.json` com um bloco `crons` apontando pra `/api/cron/publish-scheduled`
  (`*/5 * * * *`). A Vercel envia o header `Authorization: Bearer $CRON_SECRET` sozinha.
- **Cron em servidor ou computador sempre ligado:** um `curl` a cada 5 minutos com o mesmo header.

Use só UM dos dois, pra não publicar em duplicidade.

### Pré-requisitos (ambiente de produção)

```bash
CRON_SECRET=<string aleatoria forte>
NEXT_PUBLIC_APP_URL=https://<dominio-producao>
```

### Checklist pra ativar

- [ ] Criar `CRON_SECRET` (string aleatória forte) e adicionar no ambiente de produção
- [ ] Fazer o deploy
- [ ] Confirmar que `GET /api/cron/publish-scheduled` com header `Authorization: Bearer $CRON_SECRET` retorna HTTP 200

## Limites

- **Instagram Content Publishing API:** 100 posts/24h por conta (limite da Meta)
- **Carrossel:** 2-10 imagens, cada uma max 8 MB
- **Função na Vercel:** 300s de timeout máximo (configurável no `vercel.json`, se você usar um)
