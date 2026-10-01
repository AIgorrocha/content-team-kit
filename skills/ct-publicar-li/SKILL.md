---
name: ct-publicar-li
description: "Publica posts no LinkedIn via API oficial (texto, texto com imagem, video e cartao de link) e registra a peca com o link real. Usar quando o pedido for publicar no LinkedIn."
homepage: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
metadata: { "kit": { "emoji": "💼", "requires": { "bins": ["curl", "jq"], "env": ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_PERSON_ID", "LINKEDIN_ORG_ID", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] } } }
---
# LinkedIn Publisher - Publicar no LinkedIn via API

Publica posts no LinkedIn usando a API oficial. Suporta texto puro, texto com imagem, video e cartao de link.
Registra cada peca publicada em `ct_content_items` com o link real.

## Usage

Quando o Content Team ou o usuario pedir para publicar no LinkedIn.
Para posts com imagem, a imagem precisa estar acessivel como arquivo local ou URL publica.

## Como publicar (scripts do kit)

Use sempre os scripts: eles aplicam as portas bloqueantes (UTF-8, mojibake, escape do Little Text,
hashtag) e registram a peca com o link real. As receitas `curl` mais abaixo sao so referencia.

| Formato | Comando |
|---|---|
| Texto puro | `node scripts/publishing/post-linkedin.mjs --caption-file <post.txt>` |
| Texto + 1 imagem | `node scripts/publishing/publish-linkedin-image.mjs --text-file <post.txt> --image <img.png\|url>` |
| Texto + video | `node scripts/publishing/publish-linkedin-video.mjs --text-file <post.txt> --video <v.mp4>` |
| Texto + cartao de link (ex: YouTube) | `node scripts/publishing/publish-linkedin-link.mjs --text-file <post.txt> --url <https://...> --title "<titulo>"` |

Flags comuns: `--dry-run` (mostra o que faria, nada vai pro ar), `--client <slug>` e `--slug <nome>`
(marca e nome da peca no registro; `--client` padrao = marca ativa), `--allow-hashtags` (veja abaixo).

Depois de publicar, cada script chama `registerPublication()` com o link real e grava a peca em
`ct_content_items`. Sem banco configurado, a publicacao nao falha: o script avisa e imprime o comando
`node scripts/publishing/register-publication.mjs ...` para registrar depois.

Antes do primeiro uso, gere o token de publicacao: `node scripts/publishing/linkedin-auth-local.mjs`
(grava `LINKEDIN_ACCESS_TOKEN` e `LINKEDIN_PERSON_ID` no `.env.local`; passo a passo em
`docs/CONECTAR-REDES.md`). O painel (Conexoes) so confere e le metricas: conectar por la nao habilita
publicar.

## PORTA BLOQUEANTE: acentuacao e formatacao (rodar SEMPRE antes de publicar)

Sem esses 5 checks passando, NAO publica.

1. Texto vai por ARQUIVO UTF-8, NUNCA inline no comando.
2. DRY-RUN provando os acentos integros: `á ã ç é ê ó õ ú`.
3. Formatacao: quebras de linha preservadas, sem hashtag (padrao do kit, veja abaixo), sem caractere de controle.
4. Zero mojibake (`Ã¡`, `Ã£`, `Ã§`).
5. `escapeLittleText` aplicado no `commentary` (a `/rest/posts` CORTA a legenda no 1o char
   especial nao escapado). Conferir no dry-run que o texto escapado termina onde deve.

## Hashtag: padrao do kit e ZERO (a marca pode mudar)

Padrao do kit: post de LinkedIn sai sem hashtag. A marca pode liberar no `brand-profile.md`, na secao
`## LinkedIn`, com a linha `hashtags: sim`. Antes de publicar, leia essa secao:

- sem a linha, ou `hashtags: nao`: texto sem `#`. Os scripts recusam texto com hashtag
  (`ABORT hashtag-fora-do-padrao`).
- `hashtags: sim`: rode o script com `--allow-hashtags`. Ai vale o gate `assertHashtagsPreserved`
  (toda hashtag do arquivo tem que chegar no payload) e, se quiser conferir o post ao vivo,
  `verifyHashtagsLive` de `scripts/publishing/_lib/linkedin-text.mjs`.

Regra dura, nos dois casos: `#` (quando aparecer por outro motivo, ex: "C#") e `@` (mention) NUNCA sao escapados no Little Text.

Conferir o texto antes de publicar:

```bash
node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');console.log(s);console.log('MOJIBAKE:',/Ã.|Â./.test(s),'CHARS:',s.length)" post.txt
```
Aceite: acentos legiveis, `MOJIBAKE: false`, e o `CHARS` do payload final bate com o do arquivo
(nao truncou). Canone: `references/platform-specs.md`.

## CRITICO - API

- **NUNCA usar rest/posts com imagem**, trunca texto em ~700 chars!
- **SEMPRE usar v2/ugcPosts** pra posts com imagem (texto completo + imagem funciona)
- **ESCAPAR Little Text** ao usar `/rest/posts` (campo `commentary`): os chars `\ ( ) { } [ ] < > @ * _ ~ |` precisam de `\` antes, SENAO o LinkedIn CORTA o post no caractere (ex: parenteses cortam o post). NAO escapar `#` (hashtags). Funcao de referencia: `escapeLittleText` em `scripts/publishing/_lib/linkedin-text.mjs`. Remover parenteses nao resolve: o certo e escapar.
- Sanitizar tambem aspas curvas e travessoes (sem travessao)
- **Qualquer clone/oneoff que publique texto via `/rest/posts` (campo `commentary`) DEVE reusar `escapeLittleText`.** Nao reescrever a mao um publish novo sem escape: e o mesmo bug que trunca o post. Importar a funcao de `scripts/publishing/_lib/linkedin-text.mjs`.
- No repurpose de reel, o 1o paragrafo do post NAO referencia "esse video"/"assista": hook autonomo no problema/insight. (O video do reel nao vai pro LinkedIn; o que vai e o texto tecnico + o card visual, ver regra abaixo.)
- LinkedIn-Version atual nos scripts: 202606

## PORTAS BLOQUEANTES antes de publicar (clientes com essa regra em brand-profile.md)

0. **TEXTO NO CHAT ANTES DE QUALQUER COMANDO.** Colar o `post-linkedin.txt` inteiro na
   conversa. PARAR. Sem "pode" / "ficou perfeito" nesse texto, PROIBIDO `publish-linkedin-*.mjs`,
   PATCH, republicar. Aprovar o IG nao aprova o LinkedIn.
1. **NUNCA publicar post so texto quando o brand-profile do cliente exigir imagem.** Post e SEMPRE texto +
   IMAGEM horizontal 1920x1080. Quando o cliente usa diagrama como card, a imagem e o **diagrama** (skill `diagram-design`,
   passo a passo do que a pessoa faz, arquivo `linkedin-diagrama.png`), nao a animacao do Reel.
   Se o diagrama nao existe, GERAR PRIMEIRO e so depois publicar. Post sem card = publicacao
   invalida, nao mandar pra API.
2. **NUNCA publicar sem aprovacao explicita do usuario.** Gerar o card + o texto, MOSTRAR os
   dois pra ele, esperar o "pode postar". Aprovacao de uma peca anterior (ex: o reel) NAO
   vale como aprovacao do post do LinkedIn.
3. Ordem correta e sempre: gerar infografico, mostrar card + texto, aprovacao do usuario, publicar.

Contexto: publicar so texto e sem aprovacao no repurpose de um reel e o erro tipico que estas
portas evitam.

## Limites LinkedIn (2026)

O limite de 1.300 chars se aplica a "Company Update" (tipo antigo), NAO ao post normal.

Limites reais (fontes: socialrails, powerin, authoredup, typecount, 2026):

| Superficie | Limite hard | Sweet spot |
|------------|-------------|------------|
| Company Page post (normal) | **3.000 chars** | 1.500-2.000 pra denso |
| Perfil pessoal post | 3.000 chars | 1.500-2.000 |
| Company Update (antigo) | 1.300 chars | - |
| Article (Pulse) | 110.000+ chars | sem preocupacao |
| Comentario | 1.250 chars | - |

Hook forte nos primeiros 140 chars (antes do "Ver mais" mobile).

REGRA: meta padrao 1.500-2.000 chars pra posts densos (artigo com link, anuncio importante). Para artigos-ancora / temas tecnicos/educacionais densos (decretos, leis, cases com muito dado), pode estender pra 2.700-2.900 chars. CTAs simples: 100-300 chars.

## IMPORTANTE - Regras

- **NUNCA** publicar sem confirmacao do usuario (a menos que seja um cron agendado)
- Sem hashtag por padrao (o algoritmo do LinkedIn le keywords do texto mesmo sem hashtag); a marca pode liberar no brand-profile
- Terminar com pergunta (incentiva comentarios)
- "Link nos comentarios" (nunca link no corpo do post)
- Paragrafos curtos (2-3 linhas)
- 1.200-2.000 caracteres pra melhor performance (ate 2.700-2.900 pra artigos-ancora densos)
- Nunca PDF de prancha ou folha tecnica: a UI do LinkedIn recusa. JPG paisagem. Document post PDF de artigo e outro caso.
- Conteudo denso e tecnico performa melhor ("dar o ouro")
- Acentuacao correta em PT-BR sempre

## Variaveis de Ambiente Necessarias

| Variavel | Onde Conseguir |
|----------|---------------|
| `LINKEDIN_ACCESS_TOKEN` | `node scripts/publishing/linkedin-auth-local.mjs` (token de 60 dias; para a Company Page, o usuario precisa ser admin) |
| `LINKEDIN_PERSON_ID` | gravado pelo mesmo script (campo `sub` de `/v2/userinfo`) |
| `LINKEDIN_ORG_ID` | So para publicar como Company Page: numero da pagina (ex: `12345678`), de `/v2/organizationAcls`; exige Community Management API |
| `SUPABASE_URL` | Dashboard Supabase > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard Supabase > Settings > API > service_role |

## Escolher Autor pelo Cliente Ativo

Padrao: perfil pessoal, com `LINKEDIN_PERSON_ID`. A secao `## LinkedIn` do
`clients/{slug}/brand-profile.md` e OPCIONAL: sem ela, vale o padrao. Com ela, muda o autor:

```
## LinkedIn
author_type: person            # person (padrao) ou organization
id_env_var: LINKEDIN_PERSON_ID # nome da variavel do .env.local com o id (organization: LINKEDIN_ORG_ID)
hashtags: nao                  # nao (padrao do kit) ou sim
```

```bash
# Marca ativa: CT_CLIENT ou a linha "client:" do .workspace
CLIENT_SLUG="${CT_CLIENT:-$(grep -oP '^\s*client:\s*\K[a-z0-9-]+' .workspace 2>/dev/null)}"
BP="clients/$CLIENT_SLUG/brand-profile.md"

AUTHOR_TYPE=$(grep -A4 '^## LinkedIn' "$BP" 2>/dev/null | grep -oP 'author_type:\s*\K\w+')
LINKEDIN_ID_VAR=$(grep -A4 '^## LinkedIn' "$BP" 2>/dev/null | grep -oP 'id_env_var:\s*\K\w+')
AUTHOR_TYPE="${AUTHOR_TYPE:-person}"
LINKEDIN_ID_VAR="${LINKEDIN_ID_VAR:-LINKEDIN_PERSON_ID}"

if [ -z "${!LINKEDIN_ID_VAR}" ]; then
  echo "ERRO: ${LINKEDIN_ID_VAR} vazio no .env.local. Rode: node scripts/publishing/linkedin-auth-local.mjs"
  exit 1
fi

if [ "$AUTHOR_TYPE" = "person" ]; then
  AUTHOR_URN="urn:li:person:${!LINKEDIN_ID_VAR}"          # escopo do token: w_member_social
elif [ "$AUTHOR_TYPE" = "organization" ]; then
  AUTHOR_URN="urn:li:organization:${!LINKEDIN_ID_VAR}"    # escopo: w_organization_social (ADMIN da pagina)
else
  echo "ERRO: author_type invalido no brand-profile.md (use person ou organization)"
  exit 1
fi
echo "Publicando como: $AUTHOR_URN"
```

Nos exemplos `curl` abaixo, `$AUTHOR_URN` faz o papel do autor. Os scripts de `scripts/publishing/`
publicam no perfil pessoal (`LINKEDIN_PERSON_ID`); publicar como pagina de empresa e manual ou pela
receita `curl`, e exige o produto Community Management API no app do LinkedIn.

## Referencia curl: texto puro (ugcPosts)

So referencia; prefira os scripts. Feito na mao, registre a peca no fim com `register-publication.mjs`.

```bash
RESPONSE=$(curl -s -X POST "https://api.linkedin.com/v2/ugcPosts" \
  -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Restli-Protocol-Version: 2.0.0" \
  -d "{
    \"author\": \"$AUTHOR_URN\",
    \"lifecycleState\": \"PUBLISHED\",
    \"specificContent\": {
      \"com.linkedin.ugc.ShareContent\": {
        \"shareCommentary\": { \"text\": $(echo "$CAPTION" | jq -Rs .) },
        \"shareMediaCategory\": \"NONE\"
      }
    },
    \"visibility\": {
      \"com.linkedin.ugc.MemberNetworkVisibility\": \"PUBLIC\"
    }
  }")

POST_URN=$(echo "$RESPONSE" | jq -r '.id // empty')
ERROR=$(echo "$RESPONSE" | jq -r '.message // empty')

if [ -z "$POST_URN" ] || [ "$POST_URN" = "null" ]; then
  echo "ERRO ao publicar: $ERROR"
  exit 1
fi

echo "PUBLICADO com sucesso! URN: $POST_URN"
```

## Referencia curl: texto com imagem (ugcPosts)

### 3B.1 - Registrar Upload da Imagem

```bash
REGISTER=$(curl -s -X POST "https://api.linkedin.com/v2/assets?action=registerUpload" \
  -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"registerUploadRequest\": {
      \"recipes\": [\"urn:li:digitalmediaRecipe:feedshare-image\"],
      \"owner\": \"$AUTHOR_URN\",
      \"serviceRelationships\": [{
        \"relationshipType\": \"OWNER\",
        \"identifier\": \"urn:li:userGeneratedContent\"
      }]
    }
  }")

UPLOAD_URL=$(echo "$REGISTER" | jq -r '.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl')
ASSET_URN=$(echo "$REGISTER" | jq -r '.value.asset')

echo "Upload URL obtida. Asset: $ASSET_URN"
```

### 3B.2 - Upload do Binario da Imagem

```bash
curl -s -X PUT "$UPLOAD_URL" \
  -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" \
  -H "Content-Type: image/png" \
  --upload-file "$IMAGE_PATH"

echo "Imagem enviada com sucesso!"
```

### 3B.3 - Criar Post com Imagem

```bash
RESPONSE=$(curl -s -X POST "https://api.linkedin.com/v2/ugcPosts" \
  -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Restli-Protocol-Version: 2.0.0" \
  -d "{
    \"author\": \"$AUTHOR_URN\",
    \"lifecycleState\": \"PUBLISHED\",
    \"specificContent\": {
      \"com.linkedin.ugc.ShareContent\": {
        \"shareCommentary\": { \"text\": $(echo "$CAPTION" | jq -Rs .) },
        \"shareMediaCategory\": \"IMAGE\",
        \"media\": [{
          \"status\": \"READY\",
          \"media\": \"$ASSET_URN\"
        }]
      }
    },
    \"visibility\": {
      \"com.linkedin.ugc.MemberNetworkVisibility\": \"PUBLIC\"
    }
  }")

POST_URN=$(echo "$RESPONSE" | jq -r '.id // empty')
ERROR=$(echo "$RESPONSE" | jq -r '.message // empty')

if [ -z "$POST_URN" ] || [ "$POST_URN" = "null" ]; then
  echo "ERRO ao publicar com imagem: $ERROR"
  exit 1
fi

echo "PUBLICADO com imagem! URN: $POST_URN"
```

## Video nativo no post (nao e Reel, e post do feed com video anexado)

Regra padrao do kit: o LinkedIn NAO leva video, so
texto + card ou so texto (ou a regra do `regras-cliente.md` do cliente ativo). Mas quando o usuario pedir a excecao
explicitamente pra uma peca especifica,
o caminho ja existe pronto e testado, nao precisa reinventar nem tentar via imagem+video juntos
(LinkedIn nao aceita mistura):

```
node scripts/publishing/publish-linkedin-video.mjs --text-file <post.txt> --video <v.mp4> [--title "..."] [--dry-run]
```

Fluxo (perfil PESSOAL, `LINKEDIN_PERSON_ID`, escopo `w_member_social`, testado e funcionando):
1. `POST /v2/assets?action=registerUpload` com `recipes: ["urn:li:digitalmediaRecipe:feedshare-video"]`
2. `PUT` do binario do MP4 original (sem re-encode) na `uploadUrl` retornada
3. Poll em `GET /v2/assets/{assetId}` ate `status=AVAILABLE` (ate 10min, 60 tentativas de 10s)
4. `POST /v2/ugcPosts` com `shareMediaCategory: "VIDEO"` e `media: [{status: "READY", media: <asset urn>}]`

Mesmas portas bloqueantes do resto desta skill (UTF-8, hashtag conforme o padrao, `--allow-hashtags` se a marca libera) e registro da peca ja embutidos no script.

**So validado pro perfil PESSOAL.** A Company Page pode ter o erro de escopo
`unauthorized_scope_error w_organization_social` (ver "Error Handling" abaixo); nao testado se
o mesmo fluxo de video funciona por organizacao.

**Nao ficou definido se a excecao "video no LinkedIn" e permanente ou so daquela peca.** Na
proxima peca com pedido de video no LinkedIn, perguntar de novo ate o usuario confirmar
explicitamente se quer virar regra nova (e nesse caso, registrar em
`clients/{slug}/regras-cliente.md`).

## Error Handling

- **401 Unauthorized / EXPIRED_ACCESS_TOKEN:** token de 60 dias venceu. Renovar: rodar `node scripts/publishing/linkedin-auth-local.mjs` (abre o navegador, o usuario clica Permitir, o novo token vai pro `.env.local`).
- **unauthorized_scope_error `w_organization_social`:** o app nao tem o produto Community Management. Perfil pessoal funciona so com `w_member_social`. Publicar na PAGINA da empresa por API exige ativar o produto no portal de desenvolvedor do LinkedIn antes; ate la, a pagina e manual.
- **Post com video do YouTube:** nao colar o link no corpo; usar `scripts/publishing/publish-linkedin-link.mjs --url <youtube> --title <titulo>` que manda como cartao de previa (`content.article`)
- **403 Forbidden:** App sem permissao `w_member_social` - verificar scopes
- **429 Rate Limit:** Maximo ~100 posts/dia - aguardar
- **422 Unprocessable:** Texto vazio ou imagem invalida - verificar payload
- Falhou no meio: nada foi registrado; corrija a causa e rode de novo. Se o post chegou a sair, registre com `register-publication.mjs`.

## Token OAuth - Como Obter

O token do LinkedIn dura 60 dias. Quem gera e o script (abre o navegador, a pessoa clica Permitir,
o token vai para o `.env.local` sem aparecer na tela):

```bash
node scripts/publishing/linkedin-auth-local.mjs
```

Pre-requisitos (app em https://www.linkedin.com/developers/apps):
1. Produtos "Share on LinkedIn" e "Sign In with LinkedIn using OpenID Connect".
2. `LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET` no `.env.local`.
3. Redirect URI cadastrado: `http://localhost:8765/callback`.

Escopos pedidos por padrao: `w_member_social openid profile`. Para mudar, defina `LINKEDIN_SCOPES`
no `.env.local`:
- `w_member_social` publica como pessoa
- `w_organization_social` publica como organizacao (Company Page; exige Community Management API)
- `r_organization_admin` lista as organizacoes que o usuario administra (pra descobrir `LINKEDIN_ORG_ID` via /v2/organizationAcls)

O script tambem grava o `LINKEDIN_PERSON_ID` (campo `sub` de `/v2/userinfo`). Renovar = rodar de novo.

## Workflow Completo

1. Content Team gera o post (ct-redator ou ct-otimizador) em `content/{slug}/.../post-linkedin.txt`
2. Texto colado no chat e aprovado ("pode"), com o card/imagem quando a marca exige
3. O script de `scripts/publishing/` roda as portas (UTF-8, mojibake, Little Text, hashtag) e publica
4. O script registra a peca em `ct_content_items` com o link do post
5. Confirma para o usuario com o link do post

O script ja grava o `LINKEDIN_PERSON_ID`. Na mao: `curl -s https://api.linkedin.com/v2/userinfo -H "Authorization: Bearer $LINKEDIN_ACCESS_TOKEN" | jq -r '.sub'`.
