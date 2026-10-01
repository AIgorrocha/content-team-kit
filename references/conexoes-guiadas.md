# Conexões guiadas: roteiro por rede

Roteiro que o `ct-onboarding` (Fase 9) segue para ligar cada rede conversando. Vale para
qualquer marca. Base: `docs/INTEGRACOES.md` e `docs/CONECTAR-REDES.md`. Nenhum nome de
variável aqui é inventado: todos existem em `.env.local.example`, nesses dois documentos ou
nos scripts citados.

Sinal `(confira na tela)`: o passo depende do site de terceiros (Meta, LinkedIn, Google,
TikTok), que muda de lugar e de nome com frequência. Se a tela for diferente, descreva o que
você vê, escolha a opção de significado mais próximo e avise a pessoa em uma frase.

## Regras que valem para todas as redes

1. **Senha e código de verificação: só a pessoa, na janela do navegador.** O assistente
   abre a página, espera, e continua quando ela disser "pronto". Nunca no chat.
2. **Chave, token e segredo: nunca no chat.** O assistente roda
   `node scripts/kit/checar-chaves.mjs --rede {rede} --criar` (cria as linhas `NOME=` vazias),
   abre o arquivo (Windows: `notepad .env.local`; Mac: `open -e .env.local`), diz qual nome
   preencher e onde colar, e espera. Depois roda `node scripts/kit/checar-chaves.mjs --rede
   {rede}`, que só diz "preenchida" ou "vazia".
3. Se a pessoa colar uma chave no chat por engano: avisar, pedir para gerar outra no portal
   e apagar a antiga, e nunca repetir o valor.
4. **Endereços de retorno (callback)** são endereços que a rede usa para devolver a pessoa ao
   painel depois que ela autoriza. Precisam ser cadastrados no aplicativo da rede, exatamente
   como abaixo. Os exemplos usam a porta 5000 (`SALA_OAUTH_ORIGIN=http://localhost:5000`).
   Se a porta for outra, troque nos dois lugares. Fora do computador local, é obrigatório
   HTTPS.
5. **Painel:** antes de conectar qualquer rede pelo painel, conferir
   `node scripts/kit/checar-chaves.mjs --rede painel`. `SALA_OAUTH_ORIGIN` precisa estar
   preenchida. `CREDENTIALS_ENCRYPTION_KEY` (cofre que guarda os acessos, mínimo 32
   caracteres) é gerada sozinha em instalação local nova; se estiver vazia, não inventar:
   rodar de novo `npm run supabase:start -- --configure` (preserva o `.env.local`) e
   conferir.
6. **Dois caminhos, duas funções.** O painel (tela Conexões, Conectar e Testar) serve para
   CONFERIR a conexão e ler métricas: ele pede só permissão de leitura e guarda o acesso
   criptografado no banco. **Quem publica usa o `.env.local`**, preenchido pelos scripts de
   autorização de `scripts/publishing/` (LinkedIn: `linkedin-auth-local.mjs`; Instagram:
   `instagram-auth-local.mjs`; YouTube: `youtube-auth.mjs`; X: `publish-x.mjs --login`).
   Conectar pelo painel NÃO deixa a rede pronta para publicar. Cada rede abaixo tem os dois
   passos: "Conferir no painel" e "Publicar".
7. **Como testar qualquer rede:** painel `http://localhost:5000`, tela Conexões, botão
   Conectar (ou Renovar) e depois Testar. No terminal: `npm run sala:check-connections`.
   Chave preenchida não prova que funciona: só o Testar prova a leitura, e só um
   `--dry-run` (ou pré-visualização) do publicador prova que o acesso de publicar está no
   `.env.local`. Conectar e testar não publicam nada. Nada é publicado sem o "pode" da pessoa.
8. Atualizar `clients/{slug}/integracoes.md` e `clients/{slug}/configuracao-estado.md` depois
   de cada rede, sem nenhuma chave.

---

## Instagram (Meta)

**Serve para:** publicar e medir a própria conta (`ct-publicar-ig`, `ct-instagram-analyzer`,
`ct-story`). Ler concorrente não precisa de conta conectada.

**A pessoa precisa ter antes:**
- Conta do Instagram **profissional** (Comercial ou Criador de conteúdo). Conta pessoal
  não serve. (Confira na tela: Configurações do Instagram, tipo de conta.)
- Uma **Página do Facebook** e essa conta do Instagram **ligada** a ela.
- Uma conta pessoal no Facebook para entrar no portal de desenvolvedores.

**Variáveis** (`--rede instagram`): `IG_APP_ID`, `INSTAGRAM_APP_SECRET` (app principal, usadas
pelo painel), `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN` (usadas para publicar), e para o
script de publicação `IG_OAUTH_CLIENT_ID` e `IG_OAUTH_CLIENT_SECRET`. Endereço do painel:
`SALA_OAUTH_ORIGIN`.
Só para resposta automática de comentário e DM (opcional): `IG_VERIFY_TOKEN`, `IG_HANDLE`.
Segunda conta da marca (opcional): `INSTAGRAM_BUSINESS_USER_ID`,
`INSTAGRAM_BUSINESS_ACCESS_TOKEN`.

**Passos no portal** (o navegador automático abre `developers.facebook.com`; a pessoa faz
login):
1. Meus aplicativos, Criar aplicativo, tipo que permita usar o Instagram (confira na tela).
   Nome: o nome da marca.
2. Adicionar o produto de API do Instagram (Instagram Graph API) (confira na tela).
3. Configurações do aplicativo, Básico: copiar o **ID do aplicativo** (vai em `IG_APP_ID`) e
   a **Chave secreta do aplicativo** (vai em `INSTAGRAM_APP_SECRET`). A pessoa cola no
   `.env.local`, nunca no chat.
4. No campo de URIs de redirecionamento OAuth válidos (confira na tela), cadastrar:
   `http://localhost:5000/api/sala/oauth/instagram/callback`
5. Em modo de desenvolvimento, adicionar a própria conta como testadora ou administradora se
   a Meta pedir (confira na tela). Para publicar só na própria conta, o acesso padrão
   costuma bastar, sem revisão do aplicativo (confira a regra vigente da Meta).

**Conferir no painel:** Conexões, Instagram, Conectar (a pessoa autoriza na janela da Meta),
Testar. Isso só lê.

**Publicar (gerar o token IGAA de longa duração).** O publicador usa `graph.instagram.com` com
um token que começa com `IGAA` e com o `INSTAGRAM_USER_ID`. Passos:
1. No app da Meta: Instagram, "API setup with Instagram login" (Configuração da API com login
   do Instagram) (confira na tela).
2. Copiar o **ID do app do Instagram** e a **chave secreta do app do Instagram** (não são o ID
   e a chave do app principal) para `IG_OAUTH_CLIENT_ID` e `IG_OAUTH_CLIENT_SECRET`, pelo
   `checar-chaves` (nunca no chat).
3. Em "Valid OAuth redirect URIs", cadastrar `http://localhost:8765/callback`. Em modo de
   desenvolvimento, a conta da pessoa precisa ser administradora, desenvolvedora ou testadora
   do app (confira na tela).
4. Rodar `node scripts/publishing/instagram-auth-local.mjs`. O navegador abre, a pessoa
   autoriza. O script troca pelo token de longa duração (60 dias), grava
   `INSTAGRAM_ACCESS_TOKEN` e `INSTAGRAM_USER_ID` no `.env.local` sem mostrar o token, e
   mostra o @ da conta: confirmar com a pessoa que é a conta certa.
5. Se a Meta recusar o endereço `http://localhost`: na mesma tela há o botão "Generate
   token". A pessoa cola o token em `INSTAGRAM_ACCESS_TOKEN` (no arquivo, nunca no chat) e o
   assistente roda `node scripts/publishing/instagram-auth-local.mjs --completar`, que
   descobre o `INSTAGRAM_USER_ID`.
6. Renovar a cada cerca de 50 dias: `node scripts/publishing/instagram-auth-local.mjs --renovar`.
7. Segunda conta da marca: `--account business` no script de autorização e em todos os
   publicadores de Instagram (`--account principal` é o padrão). Token de usuário do sistema
   (EAAN, Business Manager) vai colado em `INSTAGRAM_BUSINESS_ACCESS_TOKEN` (ou
   `META_ACCESS_TOKEN`) com o id da conta em `INSTAGRAM_BUSINESS_USER_ID`.

**Testar a publicação sem publicar:** `node scripts/publishing/publish-ig-image.mjs <imagem.png>
--caption-file <legenda.txt> --dry-run`.

**Se falhar:** "URL de redirecionamento inválida" = o endereço cadastrado está diferente do usado
(porta, http ou https, barra no fim; painel: `SALA_OAUTH_ORIGIN`; script: `localhost:8765`).
"Permissão negada" = a conta não é profissional ou não está ligada a uma Página.

## Meta Ads (anúncios pagos)

**Serve para:** ler a conta de anúncios (`ct-ads-*`). Só para quem roda anúncio pago.

**A pessoa precisa ter antes:** conta de anúncios ativa e acesso de administrador no
Gerenciador de Negócios (Business Manager) (confira na tela).

**Variáveis** (`--rede meta-ads`): `IG_APP_ID` e `INSTAGRAM_APP_SECRET` (as mesmas do
Instagram), `META_ACCESS_TOKEN` (token de usuário do sistema, sem expiração).

**Passos** (`business.facebook.com`, a pessoa faz login) (confira na tela):
1. Configurações do negócio, Usuários, Usuários do sistema, Adicionar.
2. Atribuir a conta de anúncios ao usuário do sistema com permissão de leitura.
3. Gerar novo token escolhendo o aplicativo e a permissão `ads_read` (só ler). Se a marca
   quiser que o time também execute ações (pausar, ativar, mudar orçamento), o token precisa
   de `ads_management` e o usuário do sistema precisa de permissão de gerenciar a conta. A
   pessoa cola o token em `META_ACCESS_TOKEN` no `.env.local`.
4. Pelo painel (alternativa ao token fixo): cadastrar o retorno
   `http://localhost:5000/api/sala/oauth/meta_ads/callback` no mesmo aplicativo da Meta.

**Testar:** Conexões, Meta Ads, Conectar e Testar; ou `npm run sala:check-connections`.

## LinkedIn

**Serve para:** publicar e medir (`ct-publicar-li`, `ct-linkedin-analyzer`). Regra do kit:
post do LinkedIn sai sem hashtag.

**A pessoa precisa ter antes:** perfil no LinkedIn. Para publicar como **página de empresa**,
ser administradora da página.

**Variáveis** (`--rede linkedin`): `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
`LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_ID` (perfil pessoal). Página de empresa
(opcional): `LINKEDIN_ORG_ID` (número da página). Opcional para análises: `LINKEDIN_HANDLE`.

**Passos** (`linkedin.com/developers`, a pessoa faz login) (confira na tela):
1. Criar aplicativo: nome da marca, a Página do LinkedIn da empresa associada (o LinkedIn
   exige) e o logotipo.
2. Aba Produtos: pedir **Share on LinkedIn** (publicar no perfil). Para página de empresa,
   **Community Management API** (a análise de acesso pode demorar) (confira na tela).
3. Aba Autenticação: copiar o **ID do cliente** (`LINKEDIN_CLIENT_ID`) e a **chave secreta
   primária** (`LINKEDIN_CLIENT_SECRET`). Colar só no `.env.local`.
4. Em URLs de redirecionamento autorizadas, cadastrar os dois:
   `http://localhost:5000/api/sala/oauth/linkedin/callback` (painel) e
   `http://localhost:8765/callback` (script de publicação).
5. Aba Produtos: confirmar também **Sign In with LinkedIn using OpenID Connect** (o script usa
   para descobrir o número do perfil).

**Conferir no painel:** Conexões, LinkedIn, Conectar, Testar (só lê; o painel pede apenas
`openid profile`).

**Publicar:** rodar `node scripts/publishing/linkedin-auth-local.mjs`. A pessoa entra no
LinkedIn e clica Permitir. O script grava `LINKEDIN_ACCESS_TOKEN` (escopo `w_member_social`,
vale cerca de 60 dias) e descobre o `LINKEDIN_PERSON_ID` sozinho, sem mostrar o token. Renovar
= rodar de novo. Teste sem publicar: `node scripts/publishing/post-linkedin.mjs --caption-file
<texto.txt> --dry-run`. Página de empresa (opcional): produto Community Management API,
`LINKEDIN_SCOPES="w_member_social w_organization_social openid profile"` e `LINKEDIN_ORG_ID`;
os scripts publicam no perfil pessoal.

## YouTube

**Serve para:** publicar Shorts e vídeos (`ct-publicar-yt`). Opcional.

**A pessoa precisa ter antes:** um canal no YouTube e uma conta Google.

**Variáveis** (`--rede youtube`): `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`,
`YOUTUBE_REFRESH_TOKEN`. Opcional (bot de comentário): `YT_VIDEO_IDS`.

**Passos** (`console.cloud.google.com`, a pessoa faz login) (confira na tela):
1. Criar um projeto novo (nome da marca).
2. APIs e serviços, Biblioteca: ativar **YouTube Data API v3**.
3. Tela de permissão OAuth (OAuth consent screen): tipo Externo, nome do aplicativo, e-mail
   da pessoa; adicionar a própria conta como usuária de teste.
4. Credenciais, Criar credenciais, ID do cliente OAuth, tipo **Aplicativo para computador**
   (Desktop). Se quiser também conferir pelo painel, crie (ou use) um de tipo Aplicativo da Web
   com o retorno `http://localhost:5000/api/sala/oauth/youtube/callback`.
5. Copiar o ID do cliente e a chave secreta para o `.env.local` (a pessoa cola).

**Publicar (caminho obrigatório):** rodar `node scripts/publishing/youtube-auth.mjs` uma vez.
A pessoa entra na conta do canal e autoriza o envio de vídeo. O script grava
`YOUTUBE_REFRESH_TOKEN`. O painel pede só leitura (`youtube.readonly`) e NÃO gera o acesso
de publicar.

**Conferir no painel:** Conexões, YouTube, Conectar e Testar (só lê). Aplicativo em modo de
teste pode perder o acesso em poucos dias: se acontecer, é esperado, rode o script de novo.

## TikTok

**Serve para:** publicar (`ct-publicar-tiktok`) e analisar (`ct-tiktok-analyzer`).

**Estado atual:** a publicação real roda pelo **navegador**, com a sessão da pessoa já logada
no TikTok (`scripts/publishing/upload-tiktok.mjs`). As variáveis de API ficam reservadas.
O painel também avisa que o TikTok depende de sessão local.

**A pessoa precisa ter antes:** conta no TikTok com a qual ela consegue entrar no
navegador.

**Passos:**
1. O navegador automático abre `tiktok.com` e a pessoa faz login na janela (inclusive código
   de verificação). A sessão fica no perfil do navegador desta marca
   (`~/.playwright-tiktok-{slug}`), então cada marca entra na sua própria conta. Depois de
   publicar, registrar a peça com o link:
   `node scripts/publishing/register-publication.mjs --platform tiktok ...` (o
   `upload-tiktok.mjs` tenta registrar sozinho).
2. Só se a marca quiser usar a API oficial: portal `developers.tiktok.com`, criar
   aplicativo e pedir acesso de publicação (aprovação do TikTok, pode demorar) (confira na
   tela). Variáveis reservadas (`--rede tiktok`): `TIKTOK_CLIENT_KEY`,
   `TIKTOK_CLIENT_SECRET`, `TIKTOK_ACCESS_TOKEN`.

**Testar:** o `ct-tiktok-analyzer` abrir o perfil da marca já logado. No
`npm run sala:check-connections` o TikTok pode aparecer como validade desconhecida, é
esperado.

## X (antigo Twitter)

**Serve para:** `ct-republicar-twitter` (adapta o LinkedIn para thread, coloca numa fila e
publica com o "pode") e `ct-twitter-research`. O kit não usa chave de API do X: usa a sessão
logada no navegador, guardada por marca em `~/.playwright-x-{slug}`.

**A pessoa precisa ter antes:** conta no X.

**Variável** (`--rede x`, opcional): `X_HANDLE` (conta da marca, sem @), usada para capturar o
endereço do post depois.

**Passos:** rodar `node scripts/publishing/publish-x.mjs --login`. O navegador abre `x.com` e
a pessoa faz login na janela (usuário e senha, nunca "Entrar com Google"). Não há chave para
preencher. A fila em `content/{slug}/fila-x/pending` é publicada por
`publish-x.mjs --slug {peça}`, que primeiro só MOSTRA a thread; só com o "pode" da pessoa se
roda de novo com `--pode`.

**Testar:** `node scripts/publishing/publish-x.mjs --slug {peça}` (pré-visualização, não
publica) e pedir ao `ct-twitter-research` uma busca simples para ver se abre já logado.

## Threads

**Serve para:** publicar no Threads (`scripts/publishing/publish-threads.mjs`).

**A pessoa precisa ter antes:** conta do Threads ligada ao Instagram da marca.

**Variáveis** (`--rede threads`): `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN`. Elas são
obrigatórias: o Threads tem token próprio e o script NÃO usa o token do Instagram. Opcional:
`THREADS_HANDLE` (ou `IG_HANDLE`, nome de usuário sem @), só para montar o link se a API não
devolver o endereço do post.

**Passos:** o acesso do Threads sai do mesmo aplicativo da Meta do Instagram, com o produto
Threads adicionado e as permissões de publicação (confira na tela). O painel não tem retorno
(callback) cadastrado para Threads: o token é gerado no portal da Meta e colado pela pessoa
no `.env.local`.

**Testar:** `npm run sala:check-connections` e, depois, uma peça de teste só com o "pode"
explícito da pessoa. Se ela não tiver certeza de que o token serve, deixar como "para
depois".

## Telegram (aprovação pelo celular)

**Serve para:** a pessoa aprovar peças e receber avisos no celular, em vez de só no terminal.
Opcional, e vale oferecer: facilita muito o "pode".

**A pessoa precisa ter antes:** Telegram no celular.

**Variáveis** (`--rede telegram`): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

**Passos (no celular, a pessoa faz):**
1. No Telegram, procurar `@BotFather`, mandar `/newbot`, escolher nome e usuário do bot. O
   BotFather responde com o **token**. A pessoa cola o token no `.env.local` no computador,
   nunca no chat com o assistente.
2. Abrir o bot novo e mandar um "oi" para ele.
3. Procurar `@userinfobot` e mandar um "oi": ele responde o número do chat. A pessoa cola em
   `TELEGRAM_CHAT_ID`.

**Testar:** `node scripts/kit/checar-chaves.mjs --rede telegram` (as duas "preenchida") e
depois o `scripts/publishing/telegram-approve.mjs` com uma mensagem de teste, só se a pessoa
topar. Se o bot não responde: ela esqueceu de mandar o "oi" para ele no passo 2.

## Memória dos agentes (opcional)

Faz os agentes lembrarem decisões de uma conversa para outra. Precisa de Docker. O
assistente oferece e, se a pessoa quiser, roda `npm run memory:setup` (pedindo permissão).
Detalhe: `docs/INTEGRACOES.md`, seção "Memória dos agentes", e `integrations/ai-memory/`.
Sem ela o kit funciona.
