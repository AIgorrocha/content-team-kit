---
name: ct-publicar-ig
description: "Publica imagem, carrossel, reel e stories no Instagram pela API oficial da Meta (Graph API), na conta principal ou business, e registra a peca com o link real. Usar quando o pedido for publicar no Instagram."
homepage: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api
metadata: { "kit": { "emoji": "📲", "requires": { "bins": ["curl", "jq"], "env": ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_USER_ID", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] } } }
---
# Instagram Poster - Publicar no Instagram via Graph API

Publica fotos, carrosseis, reels e stories no Instagram usando a API oficial do Meta (Graph API).
Registra cada peca publicada em `ct_content_items` com o link real.

## Usage

Quando o Content Team ou o usuario pedir para publicar no Instagram.
A imagem PRECISA estar em uma URL publica acessivel (Supabase Storage, Imgur, etc).

## Como publicar (scripts do kit)

Use sempre os scripts: eles aplicam as portas bloqueantes, escolhem a conta e registram a peca.
As receitas `curl` mais abaixo sao so referencia da Graph API.

| Formato | Comando |
|---|---|
| Imagem unica | `node scripts/publishing/publish-ig-image.mjs <img.png> --caption-file <legenda.txt> --pode` |
| Carrossel (2 a 20) | `node scripts/publishing/post-carousel.mjs img1.png img2.png ... --caption-file=<legenda.txt> --pode` |
| Reel (com capa) | `node scripts/publishing/publish-ig-reel.mjs --video-url <url.mp4> --cover <capa.png> --caption-file <legenda.txt> --pode` |
| Stories | `node scripts/publishing/publish-ig-stories.mjs --image-url <url> --image-url <url> --slug <nome> [--arc <nome>] --pode` |

TRAVA NO CODIGO: sem `--pode` o comando so mostra o que publicaria (pre-visualizacao) e nao publica. O assistente so acrescenta `--pode` DEPOIS do "pode" explicito do usuario.

Flags que valem para os quatro:

- `--account principal|business` escolhe a conta pela chave. Padrao `principal` (`INSTAGRAM_ACCESS_TOKEN`
  e `INSTAGRAM_USER_ID`). `business` usa `INSTAGRAM_BUSINESS_ACCESS_TOKEN` (ou `META_ACCESS_TOKEN`) e
  `INSTAGRAM_BUSINESS_USER_ID`; token IGAA usa graph.instagram.com e token EAAN usa graph.facebook.com.
  Conta nao configurada = o script para e diz quais variaveis faltam.
- `--client <slug>` e `--slug <nome>`: marca e nome da peca no registro (`--client` padrao = marca ativa).
- `--dry-run` (quando existir) prova o payload sem publicar.

Depois de publicar, o proprio script chama `registerPublication()` com o permalink real e grava a peca
em `ct_content_items` (carrossel, imagem, reel e cada story). Sem banco configurado, a publicacao
nao falha: o script avisa e imprime o comando para registrar depois
(`node scripts/publishing/register-publication.mjs ...`).

Antes do primeiro uso, gere o token de publicacao: `node scripts/publishing/instagram-auth-local.mjs`
(passo a passo em `docs/CONECTAR-REDES.md`). O painel (Conexoes) so confere e le metricas.

## PORTA BLOQUEANTE: acentuacao e formatacao (rodar SEMPRE antes de publicar)

Nao e recomendacao. Sem esses 4 checks passando, NAO publica.

1. Legenda vai por ARQUIVO UTF-8 (`--caption-file` / `@arquivo`), NUNCA inline no comando.
2. DRY-RUN provando que os acentos chegam integros: `á ã ç é ê ó õ ú`.
3. Formatacao: quebras de linha preservadas, hashtags no fim, sem caractere de controle.
4. Zero mojibake (`Ã¡`, `Ã£`, `Ã§`).

```bash
node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');console.log(s);console.log('MOJIBAKE:',/Ã.|Â./.test(s))" legenda.txt
```
Aceite: acentos legiveis na saida E `MOJIBAKE: false`. Falhou = corrigir o arquivo/encoding e repetir.

Canone: `references/platform-specs.md`, secao "Acentuacao e formatacao na publicacao".

Video: se o MP4 for entregavel renderizado por nos, conferir tambem a porta de bitrate/tamanho
(alvo 10 a 12 Mbps, 80 a 100 MB em ~60s) via `ffprobe` antes de subir.

## PORTA BLOQUEANTE: reel grande na Graph

O HQ 10-12 Mbps (~86 MB / ~66s) **nao sobe** por rupload nem por POST no bucket
`ct-temp-media` acima de ~50 MB. Nao substituir o HQ. Caminho que publicou:

1. Copia Graph **so pra API**, 1080x1920, bitrate baixo, **<= 49 MB**. HQ continua
   na pasta de entrega `POSTAR-{slug}/reel-{slug}.mp4` (o original nao some).
   **NUNCA mudar a cor nessa copia.** So `-c:v libx264 -crf 18` (ou similar) e
   audio AAC. Sem `setparams`, sem `colorspace`/`color_trc` bt709, sem `tonemap`.
   Caso real: a conversao de cor fez o post sair lavado e ele foi apagado. Se a Graph
   recusar o arquivo com a cor original, parar e avisar, nao converter.
2. Subir essa copia no Supabase (`x-upsert`). 48.6 MB passou; 56 MB deu 413.
3. Capa **JPEG** publica (`cover_url`). PNG no rupload/container quebrava.
4. Publicar com `publish-ig-reel.mjs --video-url --cover-url --caption-file --pode`.
   Graph `video_url` + caption + cover_url funciona.
5. **Nao usar rupload com caption ou cover no container.** Container resumable so
   com `media_type=REELS` + `upload_type=resumable` sobe o binario; com `caption`
   ou `cover_url` o rupload volta `ProcessingFailedError`. Rupload ainda capou
   em ~60 MB (56 MB ok, 66 MB falha) mesmo sem caption.
6. GET `thumbnail_url`, baixar, LER a imagem. Capa tem que ser a foto, nao frame
   do video. Permalink (`instagram.com/reel/{shortcode}`), nunca id de midia.
7. Trial no **mesmo** MP4 da Graph, `--trial`, `graduation_strategy=MANUAL`.
8. `registerPublication()` com o permalink.

## IMPORTANTE - Regras

- **NUNCA** publicar sem confirmacao do usuario (a menos que seja um cron agendado)
- A legenda (caption) pode ter ate 2200 caracteres
- Hashtags: **maximo 5 por post**, limite da propria plataforma desde 18/dez/2025. O antigo teto de 30 nao existe mais: post com mais de 5 e recusado ou truncado. Poucas e especificas, e o valor delas e BUSCA, nao alcance. Os scripts recusam legenda com mais de 5. Canone: `references/instagram-algoritmo.md`
- Imagens: JPEG ou PNG, max 8MB, min 320x320px
- A URL da imagem precisa ser publica (acessivel sem login)

## Referencia: imagem unica pela Graph API (curl)

Quem usa os scripts acima nao precisa disto. Serve para entender ou depurar. Variaveis: `GRAPH`
(`https://graph.instagram.com/v21.0` para token IGAA), `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`.

```bash
# 1. Criar o container (foto + legenda juntos)
CONTAINER=$(curl -s -X POST "$GRAPH/$INSTAGRAM_USER_ID/media" \
  -d "image_url=$IMAGE_URL" \
  --data-urlencode "caption=$CAPTION" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN")
CREATION_ID=$(echo "$CONTAINER" | jq -r '.id')
ERROR=$(echo "$CONTAINER" | jq -r '.error.message // empty')
[ -n "$ERROR" ] || [ "$CREATION_ID" = "null" ] && { echo "ERRO ao criar container: $ERROR"; exit 1; }

# 2. Esperar ficar pronto
for i in 1 2 3 4 5; do
  STATUS_CODE=$(curl -s "$GRAPH/$CREATION_ID?fields=status_code&access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.status_code')
  [ "$STATUS_CODE" = "FINISHED" ] && break
  [ "$STATUS_CODE" = "ERROR" ] && { echo "ERRO no processamento da imagem"; exit 1; }
  sleep 3
done

# 3. Publicar
MEDIA_ID=$(curl -s -X POST "$GRAPH/$INSTAGRAM_USER_ID/media_publish" \
  -d "creation_id=$CREATION_ID" -d "access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.id')

# 4. Permalink real (nunca o id de midia)
PERMALINK=$(curl -s "$GRAPH/$MEDIA_ID?fields=permalink&access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.permalink')
echo "Link do post: $PERMALINK"
```

Feito na mao, registre a peca com o permalink:
`node scripts/publishing/register-publication.mjs --platform instagram --type image --title "<nome>" --url "$PERMALINK"`.

## Carousel (Carrossel - Multiplas Imagens)

Para postar carrossel, o fluxo muda um pouco:

```bash
# 1. Criar container para CADA imagem (sem caption)
IMG1_ID=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media" \
  -d "image_url=$IMAGE_URL_1" \
  -d "is_carousel_item=true" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.id')

IMG2_ID=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media" \
  -d "image_url=$IMAGE_URL_2" \
  -d "is_carousel_item=true" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.id')

# 2. Criar container do carrossel (com caption aqui)
CAROUSEL_ID=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media" \
  -d "media_type=CAROUSEL" \
  -d "children=$IMG1_ID,$IMG2_ID" \
  --data-urlencode "caption=$CAPTION" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.id')

# 3. Publicar
curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media_publish" \
  -d "creation_id=$CAROUSEL_ID" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN"
```

## Reels (Video)

```bash
# Container para video
# COVER_URL = URL publica JPEG da capa (PNG falhou na pratica)
# THUMB_OFFSET = tempo em milissegundos do video para usar como capa (opcional, padrao 0)
# Use COVER_URL *ou* THUMB_OFFSET, nao ambos

COVER_ARGS=""
if [ -n "$COVER_URL" ]; then
  COVER_ARGS="-d cover_url=$COVER_URL"
elif [ -n "$THUMB_OFFSET" ]; then
  COVER_ARGS="-d thumb_offset=$THUMB_OFFSET"
fi

REEL_ID=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media" \
  -d "video_url=$VIDEO_URL" \
  -d "media_type=REELS" \
  --data-urlencode "caption=$CAPTION" \
  $COVER_ARGS \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.id')

# Aguardar processamento (videos demoram mais)
for i in $(seq 1 20); do
  STATUS_CODE=$(curl -s "https://graph.instagram.com/v21.0/$REEL_ID?fields=status_code&access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.status_code')
  [ "$STATUS_CODE" = "FINISHED" ] && break
  sleep 5
done

# Publicar
curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media_publish" \
  -d "creation_id=$REEL_ID" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN"
```

## Trial Reels (reel de teste, alcanca nao-seguidores)

Trial reel e um reel entregue SO pra nao-seguidores. Nao aparece no feed nem no grid do perfil,
entao republicar o MESMO reel como trial depois do post normal nao duplica nada pra quem ja segue.
Validado na pratica.

### Padrao recomendado: TODO reel sai em DUAS versoes

Todo reel publicado no Instagram vai:
1. **Normal** (com capa, verificada pos-publicacao)
2. **Cross-post** mesmo dia (TikTok / YT Shorts / post de texto+card no LinkedIn)
3. **Trial reel** do MESMO MP4, `graduation_strategy=MANUAL`

Vale SO pra reel: carrossel e imagem nao tem trial no Instagram.
Se o trial falhar (limite diario ~20, requisito de conta), reportar o gap explicito; nao
silenciar e nao dar a publicacao por completa sem dizer que faltou o trial.

Promover o trial e decisao do usuario, no app, com os numeros na mao. Por isso o default e
`MANUAL` e nunca `SS_PERFORMANCE` sem ele pedir.

Como fazer: no container do reel, adicionar o parametro `trial_params` junto dos params normais.

```bash
# Container REELS com trial_params
curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media" \
  -d "media_type=REELS" \
  -d "video_url=$VIDEO_URL" \
  --data-urlencode "caption=$CAPTION" \
  -d "cover_url=$COVER_URL" \
  --data-urlencode 'trial_params={"graduation_strategy":"MANUAL"}' \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN"
```

`graduation_strategy`:

| Valor | O que faz |
|---|---|
| `MANUAL` (nosso padrao) | Fica trial ate o usuario promover no app. Conservador: ele decide |
| `SS_PERFORMANCE` | A Meta promove sozinha se o reel performar bem com nao-seguidores |

Requisitos (fonte SECUNDARIA, **a confirmar** na doc oficial, nao afirmar como fato):
conta publica, 1.000+ seguidores, sem colaboradores no post, ~20 trial reels/dia via API.
Se o container falhar por requisito, tratar como erro normal e reportar.

**Capa e legenda valem igual no trial:** mesma regra de `cover_url` obrigatorio + verificacao
pos-publicacao da capa, e mesma porta bloqueante de acentuacao/UTF-8 da legenda.

### Via script (recomendado)

```bash
# sem --pode (ou com --dry-run): mostra o payload sem chamar a API
node scripts/publishing/publish-ig-reel.mjs \
  --video-url <url_publica_mp4> \
  --cover content/{slug}/reels/<slug>/capa.png \
  --caption-file content/{slug}/reels/<slug>/legenda-instagram.txt \
  --client {slug} --slug <slug> \
  --trial --dry-run

# publicar de verdade, so depois do "pode" (--graduation-strategy opcional, default MANUAL)
node scripts/publishing/publish-ig-reel.mjs ... --trial --pode
```

## Stories

```bash
# Criar container de Story (imagem)
STORY_ID=$(curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media" \
  -d "image_url=$IMAGE_URL" \
  -d "media_type=STORIES" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN" | jq -r '.id')

# Publicar Story
curl -s -X POST "https://graph.instagram.com/v21.0/$INSTAGRAM_USER_ID/media_publish" \
  -d "creation_id=$STORY_ID" \
  -d "access_token=$INSTAGRAM_ACCESS_TOKEN"
```

Para múltiplos Stories em sequência, use `publish-ig-stories.mjs` (publica em ordem, um por vez, com intervalo).
Stories NÃO suportam caption/legenda via API, o texto deve estar na imagem.

## Token: gerar e renovar (60 dias)

O token de publicacao e o IGAA (login do Instagram), gravado no `.env.local` por script, sem aparecer na tela:

```bash
node scripts/publishing/instagram-auth-local.mjs            # gera (conta principal)
node scripts/publishing/instagram-auth-local.mjs --renovar  # renova; rode a cada ~50 dias
node scripts/publishing/instagram-auth-local.mjs --account business   # grava nas variaveis INSTAGRAM_BUSINESS_*
```

Pre-requisitos e o plano B (gerar o token pelo botao da Meta e rodar `--completar`):
`docs/CONECTAR-REDES.md`, secao Instagram. `FB_APP_ID`/`FB_APP_SECRET` (troca `fb_exchange_token`)
so servem para um token curto de Facebook Login (EAA); quem usa IGAA nao precisa. Usar um par que
nao casa produz um erro que parece ser do token e e da credencial. Token de usuario do sistema
(EAAN, Business Manager) nao expira e vai em `INSTAGRAM_BUSINESS_ACCESS_TOKEN`.

## Error Handling

- **OAuthException (code 190):** token expirado, renovar com `instagram-auth-local.mjs --renovar` (ou gerar de novo)
- **Invalid image:** URL inacessivel ou formato invalido, verificar a URL
- **Rate limit (code 4):** limite da plataforma por dia, aguardar
- **Permission denied (code 10):** app sem permissao `instagram_business_content_publish` (login do Instagram) ou `instagram_content_publish`
- Falhou no meio: nada foi registrado; corrija a causa e rode de novo. Se o post chegou a sair, registre com `register-publication.mjs`.

## Workflow Completo

1. Content Team gera legenda (ate 5 hashtags) + imagem
2. A pessoa aprova ("pode")
3. O script sobe a midia (Supabase Storage, URL publica), cria o container na Graph API e aguarda
4. Publica
5. Busca o permalink e registra a peca em `ct_content_items`
6. Confirma para a pessoa com o link do post

## Variaveis de Ambiente Necessarias

| Variavel | Onde conseguir |
|----------|---------------|
| `INSTAGRAM_ACCESS_TOKEN` | `node scripts/publishing/instagram-auth-local.mjs` (token IGAA) |
| `INSTAGRAM_USER_ID` | gravado pelo mesmo script |
| `INSTAGRAM_BUSINESS_ACCESS_TOKEN` ou `META_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_USER_ID` | so para a segunda conta (`--account business`) |
| `IG_OAUTH_CLIENT_ID`, `IG_OAUTH_CLIENT_SECRET` | ID e chave do app do Instagram (so para rodar o script de autorizacao) |
| `SUPABASE_URL` | Dashboard Supabase > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard Supabase > Settings > API > service_role |

## Registro da peca

Todo publicador de Instagram chama `registerPublication()` (em `scripts/publishing/_lib/register.mjs`)
com o permalink real, inclusive `publish-ig-reel.mjs` e `publish-ig-stories.mjs`. Stories: um registro
por tela, com o arco (`--arc`, padrao = `--slug`) no `metadata`. Permalink de story nao vira chave de
join com metrica: o registro avisa, mas grava.
