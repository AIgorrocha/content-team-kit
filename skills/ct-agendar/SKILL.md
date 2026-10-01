---
name: ct-agendar
description: "Publica conteudo automaticamente no Instagram (feed, carrossel, stories, reels) e LinkedIn. Gerencia agendamento e execucao."
homepage: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api
metadata: { "kit": { "emoji": "🚀", "requires": { "bins": ["curl", "jq"], "env": ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_USER_ID", "LINKEDIN_ACCESS_TOKEN", "LINKEDIN_PERSON_ID", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] } } }
---
# Auto Publisher - Publicacao Automatica Multi-Plataforma

Publica conteudo automaticamente no Instagram (feed, carrossel, stories, reels) e LinkedIn.
Busca conteudos agendados no banco, valida, publica e atualiza o status.

## Usage

Para publicar UM item, prefira os scripts de `scripts/publishing/` (skills `ct-publicar-ig` e `ct-publicar-li`): eles aplicam as portas, escolhem a conta (`--account principal|business` no Instagram) e registram a peca com o link real. As receitas `curl` abaixo sao o que um agendador faz por baixo.

Executar como cron agendado ou manualmente quando o usuario pedir para publicar conteudos pendentes.

## PORTA BLOQUEANTE: acentuacao e formatacao (roda no agendamento E na execucao)

Sem esses 4 checks passando, o item NAO sai da fila. Vale tambem no cron (nao ha humano pra pegar).

1. Legenda vai por ARQUIVO UTF-8, NUNCA inline no comando.
2. DRY-RUN provando os acentos integros: `á ã ç é ê ó õ ú`.
3. Formatacao: quebras de linha preservadas, hashtags no fim, sem caractere de controle.
4. Zero mojibake (`Ã¡`, `Ã£`, `Ã§`). LinkedIn: `escapeLittleText` no `commentary`.

```bash
node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');console.log(s);console.log('MOJIBAKE:',/Ã.|Â./.test(s))" legenda.txt
```
Aceite: acentos legiveis E `MOJIBAKE: false`. Falhou = marcar o item como `failed` com o motivo,
nao publicar degradado.

Video: entregavel renderizado por nos passa antes pela porta de bitrate/tamanho
(`ffprobe`, alvo 10 a 12 Mbps, 80 a 100 MB em ~60s). Canone: `references/platform-specs.md`.

## IMPORTANTE - Regras

- **NUNCA** publicar sem confirmacao do usuario (exceto quando executado via cron agendado)
- Sempre validar conteudo antes de publicar (acentuacao, URLs, tokens)
- UTF-8 obrigatorio em todas as legendas (acentos PT-BR)
- Registrar TUDO no banco (sucesso e falha)

## Onde cada rede publica (esta skill agenda so IG + LinkedIn) `[MECANICA]`

- **IG** = cron do servidor onde o framework roda, via esta skill.
- **LinkedIn** = API local (texto). Leitura via GET da 403 (falta scope): confirmar visual no feed.
- **TikTok** = Playwright local (browser visivel, maquina acordada), skill `ct-publicar-tiktok`. NAO agendavel local confiavel.
- **YouTube** = Data API local (app auditado, sai publico); thumbnail custom = manual no Studio.
- **Nao existe agendador local confiavel pras 3 (TikTok/YT/LinkedIn).** Se precisar sincronizar horario, publicar direto ou disparar na propria sessao, nao agendar local.
- Video: publicar sempre o MP4 HQ byte-a-byte (sem re-encode) e com capa. Detalhe em `references/platform-specs.md` (secao "Publicacao de video").

## Variaveis de Ambiente

| Variavel | Plataforma | Onde Conseguir |
|----------|------------|----------------|
| `INSTAGRAM_ACCESS_TOKEN` | Instagram | `node scripts/publishing/instagram-auth-local.mjs` (token IGAA, 60 dias) |
| `INSTAGRAM_USER_ID` | Instagram | gravado pelo mesmo script |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn | `node scripts/publishing/linkedin-auth-local.mjs` (60 dias) |
| `LINKEDIN_PERSON_ID` | LinkedIn | gravado pelo mesmo script (so o id, sem `urn:li:person:`) |
| `SUPABASE_URL` | Banco | Dashboard Supabase > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Banco | Dashboard Supabase > Settings > API > service_role |
| `FB_APP_ID`, `FB_APP_SECRET` | Instagram | **Opcionais.** So servem para trocar um token curto de Facebook Login (EAA) por um longo. O token IGAA se renova com `instagram-auth-local.mjs --renovar`, sem app secret |

---

## Fluxo Principal - Publicar Conteudos Agendados

### Step 1: Buscar conteudos agendados

```bash
SCHEDULED=$(curl -s "$SUPABASE_URL/rest/v1/ct_content_items?status=eq.scheduled&scheduled_at=lte.$(date -u +%Y-%m-%dT%H:%M:%SZ)&order=scheduled_at.asc" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

COUNT=$(echo "$SCHEDULED" | jq 'length')
echo "Encontrados $COUNT conteudos para publicar"
```

### Step 2: Para cada conteudo, executar pre-validacao

```bash
# Extrair dados do conteudo
PLATFORM=$(echo "$ITEM" | jq -r '.platform')
CAPTION=$(echo "$ITEM" | jq -r '.caption')
MEDIA_URLS=$(echo "$ITEM" | jq -r '.media_urls[]')
CONTENT_TYPE=$(echo "$ITEM" | jq -r '.content_type')
ITEM_ID=$(echo "$ITEM" | jq -r '.id')
```

### Step 3: Publicar na plataforma correspondente

Baseado no campo `platform`, direcionar para o fluxo correto:
- `instagram_feed` -> Imagem unica ou Carrossel
- `instagram_stories` -> Stories
- `instagram_reels` -> Reels
- `linkedin` -> Post texto ou Post com imagem

### Step 4: Atualizar status no banco

```bash
curl -s "$SUPABASE_URL/rest/v1/ct_content_items?id=eq.$ITEM_ID" \
  -X PATCH \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"published\",
    \"published_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"publish_url\": \"$PERMALINK\",
    \"updated_at\": \"now()\"
  }"
```

---

## Pre-Publicacao (Validacao)

Executar ANTES de qualquer publicacao:

### 1. Verificar acentuacao

```bash
# Verificar se caption contem caracteres PT-BR corretamente encodados
echo "$CAPTION" | iconv -f UTF-8 -t UTF-8 > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "ERRO: Caption com encoding invalido"
  exit 1
fi
```

### 2. Verificar se media_urls sao acessiveis

```bash
for URL in $MEDIA_URLS; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --head "$URL")
  if [ "$HTTP_CODE" != "200" ]; then
    echo "ERRO: Media inacessivel ($HTTP_CODE): $URL"
    # Atualizar status para failed
    curl -s "$SUPABASE_URL/rest/v1/ct_content_items?id=eq.$ITEM_ID" \
      -X PATCH \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"status\": \"failed\", \"metadata\": {\"error\": \"Media inacessivel: $URL\"}, \"updated_at\": \"now()\"}"
    exit 1
  fi
done
echo "Todas as medias acessiveis"
```

### 3. Verificar se tokens sao validos

```bash
# Instagram
IG_CHECK=$(curl -s "https://graph.instagram.com/v21.0/me?access_token=$INSTAGRAM_ACCESS_TOKEN")
IG_ERROR=$(echo "$IG_CHECK" | jq -r '.error.message // empty')
if [ -n "$IG_ERROR" ]; then
  echo "ERRO: Token Instagram invalido: $IG_ERROR"
  exit 1
fi

# LinkedIn
LI_CHECK=$(curl -s -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" "https://api.linkedin.com/v2/userinfo")
LI_ERROR=$(echo "$LI_CHECK" | jq -r '.message // empty')
if [ -n "$LI_ERROR" ]; then
  echo "ERRO: Token LinkedIn invalido: $LI_ERROR"
  exit 1
fi
```

### 4. Preview visual via Playwright

Gerar screenshot simulando como o conteudo vai aparecer na plataforma:

```javascript
// Usar Playwright MCP para gerar preview
// Navegar para template HTML local que simula feed do Instagram/LinkedIn
// Injetar caption + imagens
// Capturar screenshot para aprovacao visual
```

---

## Instagram Feed - Imagem Unica (Graph API v21.0)

```bash
# 1. Criar container
CONTAINER=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media" \
  -d "image_url=$IMAGE_URL" \
  --data-urlencode "caption=$CAPTION" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN")

CREATION_ID=$(echo "$CONTAINER" | jq -r '.id')
ERROR=$(echo "$CONTAINER" | jq -r '.error.message // empty')

if [ -n "$ERROR" ] || [ "$CREATION_ID" = "null" ]; then
  echo "ERRO ao criar container: $ERROR"
  exit 1
fi

# 2. Aguardar processamento
for i in 1 2 3 4 5; do
  STATUS_CODE=$(curl -s "https://graph.instagram.com/v21.0/$CREATION_ID?fields=status_code&access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.status_code')
  [ "$STATUS_CODE" = "FINISHED" ] && break
  [ "$STATUS_CODE" = "ERROR" ] && echo "ERRO no processamento" && exit 1
  sleep 3
done

# 3. Publicar
PUBLISH=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media_publish" \
  -d "creation_id=$CREATION_ID" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN")

MEDIA_ID=$(echo "$PUBLISH" | jq -r '.id')

# 4. Buscar permalink
PERMALINK=$(curl -s "https://graph.instagram.com/v21.0/$MEDIA_ID?fields=permalink&access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.permalink')
echo "Publicado: $PERMALINK"
```

---

## Instagram Feed - Carrossel (Graph API v21.0)

```bash
# 1. Criar container para CADA imagem (is_carousel_item=true, sem caption)
CHILDREN_IDS=""
for IMG_URL in $MEDIA_URLS; do
  CHILD_ID=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media" \
    -d "image_url=$IMG_URL" \
    -d "is_carousel_item=true" \
    -d "access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.id')

  if [ "$CHILD_ID" = "null" ]; then
    echo "ERRO ao criar item do carrossel: $IMG_URL"
    exit 1
  fi

  if [ -z "$CHILDREN_IDS" ]; then
    CHILDREN_IDS="$CHILD_ID"
  else
    CHILDREN_IDS="$CHILDREN_IDS,$CHILD_ID"
  fi
done

# 2. Criar container do carrossel (media_type=CAROUSEL, children={ids}, caption aqui)
CAROUSEL_ID=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media" \
  -d "media_type=CAROUSEL" \
  -d "children=$CHILDREN_IDS" \
  --data-urlencode "caption=$CAPTION" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.id')

# 3. Aguardar processamento
for i in 1 2 3 4 5; do
  STATUS_CODE=$(curl -s "https://graph.instagram.com/v21.0/$CAROUSEL_ID?fields=status_code&access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.status_code')
  [ "$STATUS_CODE" = "FINISHED" ] && break
  sleep 3
done

# 4. Publicar
PUBLISH=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media_publish" \
  -d "creation_id=$CAROUSEL_ID" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN")

MEDIA_ID=$(echo "$PUBLISH" | jq -r '.id')
PERMALINK=$(curl -s "https://graph.instagram.com/v21.0/$MEDIA_ID?fields=permalink&access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.permalink')
echo "Carrossel publicado: $PERMALINK"
```

---

## Instagram Stories (Graph API v21.0)

Cada story e uma publicacao separada. Se tiver multiplos stories, publicar sequencialmente.

```bash
# Para cada story (imagem ou video)
for STORY_URL in $MEDIA_URLS; do
  # Detectar tipo (imagem ou video)
  CONTENT_TYPE_HEADER=$(curl -s -o /dev/null -w "%{content_type}" --head "$STORY_URL")

  if echo "$CONTENT_TYPE_HEADER" | grep -q "video"; then
    # Story de video
    STORY_ID=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media" \
      -d "video_url=$STORY_URL" \
      -d "media_type=STORIES" \
      -d "access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.id')

    # Aguardar processamento (videos demoram mais)
    for i in $(seq 1 20); do
      STATUS_CODE=$(curl -s "https://graph.instagram.com/v21.0/$STORY_ID?fields=status_code&access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.status_code')
      [ "$STATUS_CODE" = "FINISHED" ] && break
      sleep 5
    done
  else
    # Story de imagem
    STORY_ID=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media" \
      -d "image_url=$STORY_URL" \
      -d "media_type=STORIES" \
      -d "access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.id')

    sleep 3
  fi

  # Publicar story
  curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media_publish" \
    -d "creation_id=$STORY_ID" \
    -d "access_token=$INSTAGRAM_ACCESS_TOKEN"

  echo "Story publicado: $STORY_URL"
  sleep 2  # Intervalo entre stories
done
```

---

## Instagram Reels (Graph API v21.0)

```bash
# 1. Criar container (video_url, media_type=REELS)
REEL_ID=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media" \
  -d "video_url=$VIDEO_URL" \
  -d "media_type=REELS" \
  --data-urlencode "caption=$CAPTION" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.id')

ERROR=$(echo "$REEL_ID" | jq -r '.error.message // empty' 2>/dev/null)
if [ -n "$ERROR" ]; then
  echo "ERRO ao criar reel: $ERROR"
  exit 1
fi

# 2. Aguardar processamento (videos demoram mais, ate 20 tentativas)
for i in $(seq 1 20); do
  STATUS_CODE=$(curl -s "https://graph.instagram.com/v21.0/$REEL_ID?fields=status_code&access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.status_code')
  [ "$STATUS_CODE" = "FINISHED" ] && break
  [ "$STATUS_CODE" = "ERROR" ] && echo "ERRO no processamento do reel" && exit 1
  echo "Processando reel... tentativa $i/20 (status: $STATUS_CODE)"
  sleep 5
done

# 3. Publicar
PUBLISH=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media_publish" \
  -d "creation_id=$REEL_ID" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN")

MEDIA_ID=$(echo "$PUBLISH" | jq -r '.id')
PERMALINK=$(curl -s "https://graph.instagram.com/v21.0/$MEDIA_ID?fields=permalink&access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.permalink')
echo "Reel publicado: $PERMALINK"
```

---

## LinkedIn - Post Texto (UGC Posts API)

```bash
RESPONSE=$(curl -s -X POST "https://api.linkedin.com/v2/ugcPosts" \
  -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Restli-Protocol-Version: 2.0.0" \
  -d "{
    \"author\": \"urn:li:person:$LINKEDIN_PERSON_ID\",
    \"lifecycleState\": \"PUBLISHED\",
    \"specificContent\": {
      \"com.linkedin.ugc.ShareContent\": {
        \"shareCommentary\": {
          \"text\": $(echo "$CAPTION" | jq -Rs .)
        },
        \"shareMediaCategory\": \"NONE\"
      }
    },
    \"visibility\": {
      \"com.linkedin.ugc.MemberNetworkVisibility\": \"PUBLIC\"
    }
  }")

POST_URN=$(echo "$RESPONSE" | jq -r '.id // empty')
ERROR=$(echo "$RESPONSE" | jq -r '.message // empty')

if [ -n "$ERROR" ]; then
  echo "ERRO ao publicar no LinkedIn: $ERROR"
  exit 1
fi

echo "LinkedIn post publicado: $POST_URN"

# Construir URL do post
ACTIVITY_ID=$(echo "$POST_URN" | sed 's/urn:li:share://')
PERMALINK="https://www.linkedin.com/feed/update/urn:li:share:$ACTIVITY_ID"
echo "Link: $PERMALINK"
```

---

## LinkedIn - Post com Imagem (UGC Posts API)

```bash
# 1. Registrar upload
REGISTER=$(curl -s -X POST "https://api.linkedin.com/v2/assets?action=registerUpload" \
  -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"registerUploadRequest\": {
      \"recipes\": [\"urn:li:digitalmediaRecipe:feedshare-image\"],
      \"owner\": \"urn:li:person:$LINKEDIN_PERSON_ID\",
      \"serviceRelationships\": [{
        \"relationshipType\": \"OWNER\",
        \"identifier\": \"urn:li:userGeneratedContent\"
      }]
    }
  }")

UPLOAD_URL=$(echo "$REGISTER" | jq -r '.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl')
ASSET=$(echo "$REGISTER" | jq -r '.value.asset')

# 2. Upload binario da imagem
curl -s -X PUT "$UPLOAD_URL" \
  -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary "@$LOCAL_IMAGE_PATH"

# 3. Criar post com media asset
RESPONSE=$(curl -s -X POST "https://api.linkedin.com/v2/ugcPosts" \
  -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Restli-Protocol-Version: 2.0.0" \
  -d "{
    \"author\": \"urn:li:person:$LINKEDIN_PERSON_ID\",
    \"lifecycleState\": \"PUBLISHED\",
    \"specificContent\": {
      \"com.linkedin.ugc.ShareContent\": {
        \"shareCommentary\": {
          \"text\": $(echo "$CAPTION" | jq -Rs .)
        },
        \"shareMediaCategory\": \"IMAGE\",
        \"media\": [{
          \"status\": \"READY\",
          \"media\": \"$ASSET\"
        }]
      }
    },
    \"visibility\": {
      \"com.linkedin.ugc.MemberNetworkVisibility\": \"PUBLIC\"
    }
  }")

POST_URN=$(echo "$RESPONSE" | jq -r '.id // empty')
echo "LinkedIn post com imagem publicado: $POST_URN"
```

---

## LinkedIn - Comentario com Link

Se o conteudo tiver um link para publicar como comentario (ex: link do YouTube):

```bash
# Publicar comentario no post recem-criado
curl -s -X POST "https://api.linkedin.com/v2/socialActions/$POST_URN/comments" \
  -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"actor\": \"urn:li:person:$LINKEDIN_PERSON_ID\",
    \"message\": {
      \"text\": \"$COMMENT_TEXT\"
    }
  }"

echo "Comentario com link publicado no post LinkedIn"
```

---

## Pos-Publicacao

Apos cada publicacao bem-sucedida:

### 1. Atualizar ct_content_items

```bash
curl -s "$SUPABASE_URL/rest/v1/ct_content_items?id=eq.$ITEM_ID" \
  -X PATCH \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"published\",
    \"published_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"publish_url\": \"$PERMALINK\",
    \"updated_at\": \"now()\"
  }"
```

### 2. Registrar em ct_publications

```bash
curl -s "$SUPABASE_URL/rest/v1/ct_publications" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"content_item_id\": \"$ITEM_ID\",
    \"platform\": \"$PLATFORM\",
    \"external_id\": \"$MEDIA_ID\",
    \"external_url\": \"$PERMALINK\",
    \"published_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"status\": \"published\"
  }"
```

### 3. Se tiver comentario com link (LinkedIn)

```bash
if [ -n "$COMMENT_LINK" ]; then
  # Publicar comentario separado com o link
  # (ver secao "LinkedIn - Comentario com Link" acima)
fi
```

---

## Renovar tokens

- **Instagram (IGAA, 60 dias):** `node scripts/publishing/instagram-auth-local.mjs --renovar`, agendado a cada ~50 dias (Agendador de Tarefas no Windows ou cron). Vencido de vez: rode sem `--renovar` e autorize de novo.
- **LinkedIn (60 dias):** exige a pessoa. Rode `node scripts/publishing/linkedin-auth-local.mjs` e clique em Permitir. Nao existe renovacao silenciosa.

---

## Error Handling

| Erro | Plataforma | Causa | Solucao |
|------|-----------|-------|---------|
| OAuthException (code 190) | Instagram | Token expirado | `instagram-auth-local.mjs --renovar` (ou gerar de novo) |
| Invalid image | Instagram | URL inacessivel ou formato invalido | Verificar URL publica |
| Rate limit (code 4) | Instagram | Max ~25 posts/dia | Aguardar 24h |
| Permission denied (code 10) | Instagram | App sem `instagram_content_publish` | Configurar permissoes no Meta Dev |
| 401 Unauthorized | LinkedIn | Token expirado | Rodar `linkedin-auth-local.mjs` |
| 403 Forbidden | LinkedIn | Sem permissao `w_member_social` | Reconfigurar scopes |
| 422 Unprocessable | LinkedIn | Payload invalido | Verificar formato do UGC |
| Encoding error | Ambos | Caracteres PT-BR quebrados | Garantir UTF-8 no caption |

Para qualquer erro, atualizar o conteudo no banco com `status=failed` e o motivo em `metadata.error` (e o que o cron do painel grava):

```bash
curl -s "$SUPABASE_URL/rest/v1/ct_content_items?id=eq.$ITEM_ID" \
  -X PATCH \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"failed\",
    \"metadata\": {\"error\": \"$ERROR_MSG\"},
    \"updated_at\": \"now()\"
  }"
```

---

## Workflow Completo (Resumo)

1. **Buscar** conteudos com `status=scheduled` e `scheduled_at <= NOW()`
2. **Validar** cada conteudo (encoding, URLs, tokens)
3. **Publicar** na plataforma correspondente (Instagram feed/carrossel/stories/reels ou LinkedIn)
4. **Atualizar** `ct_content_items` com `status=published`, `published_at`, `publish_url` (o link real)
5. **Registrar** em `ct_publications` com `external_id` e `external_url`
6. **Comentario** se tiver link para publicar como comentario (LinkedIn)
7. **Reportar** resultado ao usuario ou log
