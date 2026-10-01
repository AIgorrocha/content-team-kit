# Conectar redes: conferir pelo painel, publicar pelos scripts

Existem dois caminhos, e eles fazem coisas diferentes. Vale entender antes de começar.

| | O que faz | Permissão que pede | Onde o acesso fica |
|---|---|---|---|
| **Painel** (tela Conexões, botões Conectar e Testar) | CONFERE se a conexão está viva e lê métricas | Só leitura | Cofre criptografado no banco |
| **Scripts de autorização** (este documento, seção "Publicar") | Geram o acesso que PUBLICA | Permissão de publicar | `.env.local` (arquivo privado) |

Na prática: o painel mostra "conectado", mas quem publica são os scripts de `scripts/publishing/`,
e eles leem o `.env.local`. Conectar pelo painel NÃO basta para publicar. Para publicar, rode o
script de autorização da rede uma vez (e de novo quando o acesso vencer).

## 1. Conferir pelo painel

Na tela Conexões, use Conectar ou Renovar. A rede abre sua própria tela de autorização. Ao concluir, a Sala guarda os tokens criptografados no banco. O fluxo não publica conteúdo.

Antes do primeiro uso, configure no arquivo privado .env.local:

- LinkedIn: LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET.
- YouTube: YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET.
- Instagram e Meta Ads: IG_APP_ID e INSTAGRAM_APP_SECRET (o app principal da Meta).
- Endereço do painel: SALA_OAUTH_ORIGIN, por exemplo http://localhost:5000.
- Cofre: CREDENTIALS_ENCRYPTION_KEY, com pelo menos 32 caracteres. Instalações locais novas geram essa chave automaticamente.

Cadastre os endereços de retorno no aplicativo de cada rede. Para o exemplo acima:

- LinkedIn: http://localhost:5000/api/sala/oauth/linkedin/callback
- YouTube: http://localhost:5000/api/sala/oauth/youtube/callback
- Instagram: http://localhost:5000/api/sala/oauth/instagram/callback
- Meta Ads: http://localhost:5000/api/sala/oauth/meta_ads/callback

Se usar outra porta, altere SALA_OAUTH_ORIGIN e cadastre os endereços com a mesma porta. Fora do computador local, use HTTPS. O aplicativo de cada rede precisa permitir o acesso da conta e as permissões solicitadas. Sem essas configurações, a rede pode recusar a autorização.

Use Testar para consultar a validade do acesso. O prazo só aparece quando foi informado pela rede. A checagem não inventa datas antigas. TikTok e X dependem de sessão local no navegador (veja abaixo).

## 2. Publicar: gerar os acessos de publicação

Os scripts abaixo abrem o navegador, você autoriza, e o acesso é gravado no `.env.local` sem ser
mostrado na tela. Eles usam o endereço de retorno `http://localhost:8765/callback` (porta 8765,
diferente da porta 5000 do painel, então podem rodar com o painel aberto).

| Rede | Comando | Grava no `.env.local` |
|---|---|---|
| LinkedIn | `node scripts/publishing/linkedin-auth-local.mjs` | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_ID` |
| Instagram | `node scripts/publishing/instagram-auth-local.mjs` | `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID` |
| YouTube | `node scripts/publishing/youtube-auth.mjs` | `YOUTUBE_REFRESH_TOKEN` |
| X | `node scripts/publishing/publish-x.mjs --login` | nada (sessão no navegador) |
| TikTok | o login acontece na primeira vez que `upload-tiktok.mjs` abre o navegador | nada (sessão no navegador) |
| Threads | token gerado no portal da Meta e colado por você | `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN` |

Regras que valem para todos: senha e código de verificação só você digita, na janela do
navegador. Token nunca vai no chat. Depois de gerar, teste sem publicar: todo publicador aceita
`--dry-run` (ou mostra uma pré-visualização) antes do "pode".

### LinkedIn

1. Em `linkedin.com/developers`, no seu app: aba Produtos, peça **Share on LinkedIn** e **Sign In with LinkedIn using OpenID Connect** (confira na tela).
2. Aba Autenticação: copie o ID do cliente e a chave secreta para `LINKEDIN_CLIENT_ID` e `LINKEDIN_CLIENT_SECRET` no `.env.local`. Em URLs de redirecionamento autorizadas, cadastre `http://localhost:8765/callback` (pode manter também o do painel).
3. Rode `node scripts/publishing/linkedin-auth-local.mjs`, entre no LinkedIn e clique em Permitir.
4. O script grava `LINKEDIN_ACCESS_TOKEN` (vale cerca de 60 dias) e descobre sozinho o `LINKEDIN_PERSON_ID` (o número do seu perfil). Para renovar, rode de novo.

Escopos: por padrão `w_member_social openid profile` (publicar no perfil pessoal). Para mudar, defina `LINKEDIN_SCOPES` no `.env.local`. Publicar como **página de empresa** exige o produto Community Management API no app (a análise do LinkedIn pode demorar), o escopo `w_organization_social` em `LINKEDIN_SCOPES`, e o número da página em `LINKEDIN_ORG_ID`. Sem isso, a página fica manual. Os scripts publicam no perfil pessoal.

### Instagram

O Instagram tem dois tokens que não se misturam. O painel usa o app principal da Meta
(`IG_APP_ID` e `INSTAGRAM_APP_SECRET`). Quem publica usa um token **IGAA** (login do Instagram,
endereço graph.instagram.com), gerado assim:

1. No app da Meta (`developers.facebook.com`): Instagram, "API setup with Instagram login" (Configuração da API com login do Instagram) (confira na tela).
2. Copie o **ID do app do Instagram** e a **chave secreta do app do Instagram** (não são o ID e a chave do app principal) para `IG_OAUTH_CLIENT_ID` e `IG_OAUTH_CLIENT_SECRET` no `.env.local`.
3. Em "Valid OAuth redirect URIs" (URIs de redirecionamento válidas), cadastre `http://localhost:8765/callback`.
4. Em modo de desenvolvimento, sua conta precisa ser administradora, desenvolvedora ou testadora do app (confira na tela).
5. Rode `node scripts/publishing/instagram-auth-local.mjs`, entre no Instagram e autorize.
6. O script troca pelo token de longa duração (60 dias) e grava `INSTAGRAM_ACCESS_TOKEN` e `INSTAGRAM_USER_ID`. Ele mostra só o @ da conta, para você conferir que é a certa.
7. A cada cerca de 50 dias: `node scripts/publishing/instagram-auth-local.mjs --renovar`.

Se a Meta recusar o endereço `http://localhost`: na mesma tela do item 1 há o botão para gerar o
token direto ("Generate token"). Cole o token em `INSTAGRAM_ACCESS_TOKEN` no `.env.local` e rode
`node scripts/publishing/instagram-auth-local.mjs --completar`, que descobre o `INSTAGRAM_USER_ID`.

**Segunda conta da marca (business).** Quem tem duas contas usa a chave `--account`:
`--account principal` (padrão) usa `INSTAGRAM_*`; `--account business` usa
`INSTAGRAM_BUSINESS_ACCESS_TOKEN` (ou `META_ACCESS_TOKEN`) e `INSTAGRAM_BUSINESS_USER_ID`. Para a
conta business com login do Instagram, `instagram-auth-local.mjs --account business` preenche essas
variáveis. Com token de usuário do sistema do Business Manager (começa com EAAN), cole o token e o
id da conta do Instagram na mão. Os quatro publicadores (`post-carousel`, `publish-ig-image`,
`publish-ig-reel`, `publish-ig-stories`) aceitam `--account principal|business`.

### YouTube

O painel pede só leitura (`youtube.readonly`) e não serve para publicar. O caminho de publicação é
o script: no Google Cloud, crie o ID do cliente OAuth do tipo **Aplicativo para computador**
(Desktop), copie o ID e a chave para `YOUTUBE_CLIENT_ID` e `YOUTUBE_CLIENT_SECRET`, e rode
`node scripts/publishing/youtube-auth.mjs` uma vez. Ele pede permissão de envio de vídeo e grava
`YOUTUBE_REFRESH_TOKEN`. Aplicativo em modo de teste pode perder o acesso em poucos dias: é
esperado, basta rodar de novo.

### TikTok e X

Nenhum dos dois usa chave. A publicação roda pelo navegador, numa sessão que fica guardada por
marca no seu computador. Na primeira vez, o navegador abre e você entra (TikTok: QR code pelo app
é o mais rápido; X: usuário e senha, nunca "Entrar com Google"). Para o X, rode antes
`node scripts/publishing/publish-x.mjs --login`.

### Threads

O Threads tem token próprio, que não é o do Instagram. No app da Meta, adicione o produto Threads
com as permissões de publicação, gere o token no portal (confira na tela) e preencha
`THREADS_USER_ID` e `THREADS_ACCESS_TOKEN`. `THREADS_HANDLE` (ou `IG_HANDLE`) é opcional.

## Cofre e segurança

Não compartilhe tokens nem a chave do cofre. Preserve a chave no backup privado junto do banco. Trocar ou perder essa chave impede a leitura das credenciais já guardadas. O `.env.local` é privado: nunca vai para o Git.
