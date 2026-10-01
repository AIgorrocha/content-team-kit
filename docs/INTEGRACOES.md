# Integracoes: chave por chave

Cada integracao e opcional e independente. A variavel vai no `.env.local` (nunca no Git).
Sem a chave, a skill que depende dela fica desabilitada e avisa; o resto do framework segue.

Importante: o painel (tela Conexoes) so CONFERE a conexao e le metricas. Quem PUBLICA usa o
`.env.local`, preenchido pelos scripts de autorizacao de `scripts/publishing/` (passo a passo em
`docs/CONECTAR-REDES.md`). Conectar pelo painel nao deixa a rede pronta para publicar.

Legenda: **Obrigatoria** = sem ela o kit nao funciona. **Por capacidade** = so se a empresa
quiser aquela capacidade. **Opcional** = motor alternativo ou conveniencia.

## Obrigatoria

### Supabase (banco e painel)
Variaveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.
Como obter: projeto em supabase.com, Settings > API e Settings > Database.
Usa: todo script e o painel local. Passo a passo em `docs/SETUP.md`.

## Por capacidade

### Telegram (aprovacao humana e avisos)
Variaveis: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
Como obter: crie o bot com @BotFather (token); descubra seu chat id com @userinfobot.
Usa: `scripts/publishing/telegram-approve.mjs`, avisos de agendamento e crons.
Sem isso: aprovacao acontece so no terminal.

### Instagram (publicar e medir a propria conta)
Variaveis do painel (conferir e ler): `IG_APP_ID`, `INSTAGRAM_APP_SECRET` (o app principal da Meta).
Variaveis para PUBLICAR: `INSTAGRAM_ACCESS_TOKEN` (token IGAA, graph.instagram.com) e
`INSTAGRAM_USER_ID`, gerados por `node scripts/publishing/instagram-auth-local.mjs`, que usa
`IG_OAUTH_CLIENT_ID` e `IG_OAUTH_CLIENT_SECRET` (ID e chave do "app do Instagram" em API setup
with Instagram login, que NAO sao os do app principal). O endereco de retorno do script e fixo:
`http://localhost:8765/callback`.
Segunda conta da marca (opcional, `--account business` nos publicadores):
`INSTAGRAM_BUSINESS_ACCESS_TOKEN` (ou `META_ACCESS_TOKEN`) e `INSTAGRAM_BUSINESS_USER_ID`.
Pra DM automatica e webhook: `IG_VERIFY_TOKEN`, `IG_HANDLE` (`IG_HANDLE` tambem serve de
nome da marca para o Threads).
Como obter: app em developers.facebook.com, conta Instagram profissional (e, para o app principal
e a segunda conta, ligada a uma Pagina do Facebook). O token de longa duracao vale 60 dias: renove
com `instagram-auth-local.mjs --renovar` a cada ~50 dias.
Opcional: `FB_APP_ID` e `FB_APP_SECRET` (ID e chave do app principal) so servem para trocar um
token curto de Facebook Login (EAA) por um de longa duracao. Quem usa o token IGAA nao precisa.
Standard Access costuma bastar pra publicar na propria conta, sem App Review (confira a regra vigente da Meta).
Usa: `scripts/publishing/publish-ig-*.mjs`, `post-carousel.mjs`, `scripts/infra/ig-daily-snapshot.mjs`,
skills `ct-publicar-ig`, `ct-instagram-analyzer`, `ct-story`.
Leitura de concorrente nao precisa de token (Playwright), so a propria conta.

### Meta Ads (trafego pago)
Variavel: `META_ACCESS_TOKEN` (token de system user, sem expiracao).
Como obter: Business Manager > Usuarios do sistema > gerar token com `ads_read` (so ler). Se a
marca quiser que o time tambem EXECUTE acoes (pausar, ativar, mudar orcamento), o token precisa de
`ads_management` e o usuario do sistema precisa de permissao de gerenciar a conta de anuncios.
Usa: `scripts/infra/ads-sync-daily.mjs`, familia `ct-ads-*`.

### LinkedIn (publicar)
Variaveis: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` (do app), `LINKEDIN_ACCESS_TOKEN` e
`LINKEDIN_PERSON_ID` (perfil pessoal; os dois sao gravados por
`node scripts/publishing/linkedin-auth-local.mjs`).
`LINKEDIN_SCOPES` (opcional): escopos que o script pede. Padrao: `w_member_social openid profile`.
`LINKEDIN_ORG_ID` (opcional): numero da pagina de empresa. So vale para publicar COMO a pagina, o
que exige o produto Community Management API no app (o LinkedIn analisa o pedido) e o escopo
`w_organization_social` em `LINKEDIN_SCOPES`. Os scripts publicam no perfil pessoal.
`LINKEDIN_HANDLE` (opcional): usado nas analises.
Como obter: app em linkedin.com/developers com os produtos Share on LinkedIn e Sign In with
LinkedIn using OpenID Connect, e o retorno `http://localhost:8765/callback` cadastrado. Token
expira em 60 dias: rode o script de novo para renovar.
Usa: `scripts/publishing/post-linkedin.mjs` e `publish-linkedin-*.mjs`, skills `ct-publicar-li`,
`ct-linkedin-analyzer`.
Regra padrao do framework: post no LinkedIn sai sem hashtag. A marca pode liberar no
`brand-profile.md`; nesse caso o publicador roda com `--allow-hashtags`.

### YouTube (publicar Shorts e videos)
Variaveis: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`.
Como obter: Google Cloud Console, ativar YouTube Data API v3, OAuth client tipo Desktop,
rodar `node scripts/publishing/youtube-auth.mjs` uma vez pra gerar o refresh token (escopo de
envio de video). Esse e o caminho de publicacao: o painel pede so leitura e nao serve pra publicar.
Usa: `scripts/publishing/upload-youtube-*.mjs`, skill `ct-publicar-yt`.

### TikTok (publicar)
Variaveis: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_ACCESS_TOKEN`.
Estado atual: a publicacao roda por Playwright com a sessao logada do Chrome
(`scripts/publishing/upload-tiktok.mjs`); as variaveis de API ficam reservadas.
Usa: skills `ct-publicar-tiktok`, `ct-tiktok-analyzer`.
A sessao logada fica guardada por marca (`~/.playwright-tiktok-{slug}`).

### X / Twitter (publicar por navegador)
Sem chave de API. `node scripts/publishing/publish-x.mjs --login` abre o X para voce entrar (1 vez;
sessao guardada por marca em `~/.playwright-x-{slug}`). Variavel opcional: `X_HANDLE` (conta da
marca, sem @), so pra capturar o link do post.
Usa: `scripts/publishing/publish-x.mjs`, skills `ct-republicar-twitter`, `ct-twitter-research`.

### Threads (publicar)
Variaveis: `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN` (obrigatorias: o Threads tem token proprio e
NAO usa o do Instagram). Opcional: `THREADS_HANDLE` (ou `IG_HANDLE`).
Como obter: no app da Meta, produto Threads com permissao de publicar; o token e gerado no portal.
Usa: `scripts/publishing/publish-threads.mjs`.

### Transcricao (inbox de video e legenda automatica)
Variavel: `OPENAI_API_KEY` (Whisper, cobrado por minuto).
Alternativa gratis: WhisperX local dentro de `integrations/video-editor/` (venv via uv).
Usa: `scripts/infra/icloud-watch.mjs`, `ct-video-editor`.

### Video local (ffmpeg, Remotion, MoneyPrinterTurbo)
Variaveis: `FFMPEG_BIN` (caminho do binario, se nao estiver no PATH).
Remotion roda local sem chave. MoneyPrinterTurbo usa chave Pexels no `config.toml` dele
(gratis), ver `docs/MPT_SETUP.md`.
Usa: `ct-video-remotion`, `ct-video-editor`, `ct-video-mpt`.

## Opcional

### Remotion na nuvem (AWS Lambda)
Variaveis: `REMOTION_AWS_REGION`, `REMOTION_AWS_ACCESS_KEY_ID`,
`REMOTION_AWS_SECRET_ACCESS_KEY`, `REMOTION_AWS_BUCKET`, `REMOTION_SERVE_URL`,
`REMOTION_LAMBDA_FUNCTION_NAME`. Guia: `docs/SETUP-AWS-REMOTION.md`.
So vale a pena se a maquina local nao aguenta renderizar.

### HeyGen (avatar digital)
Variavel: `HEYGEN_API_KEY`. Conta paga em heygen.com. Usa: `ct-video`.

### Higgsfield (video cinematografico)
Variaveis: `HIGGSFIELD_API_KEY`, `HIGGSFIELD_SECRET`, `HIGGSFIELD_BIN`.
CLI `npm i -g @higgsfield/cli` + `higgsfield auth login`. Creditos pagos.
Guia: `docs/HIGGSFIELD_SETUP.md`. Usa: `ct-video-higgsfield`.

### Cloudflare R2 (storage S3 pra criativos)
Variaveis: `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`. Painel Cloudflare > R2 > token S3 compativel.
So se a empresa quiser hospedar as artes fora do Supabase Storage.

### RapidAPI (scrapers alternativos)
Variavel: `RAPIDAPI_KEY`. Usada por alguns analyzers quando o Playwright nao basta.

### Notion (exportar guias)
Variavel: `NOTION_TOKEN`. notion.so/my-integrations, compartilhar a pagina com a integracao.

### Memoria dos agentes (ai-memory)
Variavel: `AI_MEMORY_AUTH_TOKEN` (gerado na instalacao, nunca no Git).
Docker + Ollama. Ver `integrations/ai-memory/` e `docs/SETUP.md` secao 6.

### Automacao 24h fora do PC (servidor sempre ligado)
Nenhuma variavel especifica. Da pra viver 100% local. Se quiser que crons rodem sem o seu computador
ligado (por exemplo o `ads-approval-worker`, ver `docs/ADS-APPROVAL-WORKER.md`, ou o agendador de
publicacao, ver `docs/PUBLICACAO_AUTO.md`), use um servidor ou computador sempre ligado com este repo
instalado e o mesmo `.env.local`.

## Infra do proprio kit

| Variavel | Pra que |
|---|---|
| `CT_CLIENT` | Slug do cliente ativo (alternativa ao `.workspace`) |
| `CT_ICLOUD_INBOX` | Pasta vigiada pra fotos e videos vindos do celular |
| `CRON_SECRET` | Protege o endpoint `/api/cron/publish-scheduled` do painel |
| `NEXT_PUBLIC_APP_URL` | URL do painel local (padrao `http://localhost:5000`) |
| `SEARXNG_URL` | Busca local, se a empresa tiver um SearXNG |

## Regras que valem pra toda integracao

1. Chave vai no `.env.local` da maquina. Nunca em commit, log, doc ou print.
2. Token que expira (Instagram, LinkedIn) precisa de renovacao: rode de novo o script de
   autorizacao da rede (`instagram-auth-local.mjs --renovar`, `linkedin-auth-local.mjs`); o kit avisa
   pelo Telegram quando o `alerta-token` estiver ligado.
3. Nada e publicado sem aprovacao humana explicita, em qualquer rede.
4. Toda peca publicada grava o link real em `ct_content_items.publish_url`; sem isso a
   metrica dela nunca cruza (`npm run check:join`).
