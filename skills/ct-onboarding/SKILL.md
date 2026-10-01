---
name: ct-onboarding
description: "Condutor único da configuração do Content Team, só conversando e com prévia de tudo: prepara o computador, cadastra a marca (público, voz, pilares, redes, visual, concorrentes), define legendas, carrossel, reels, stories e design mostrando exemplos reais, e conecta as redes guiando pelo navegador. Retomável entre sessões. Trigger: 'configurar empresa nova', 'onboarding', 'criar cliente', 'implantar o kit', 'continuar configuração', 'conectar o Instagram', 'conectar as redes'."
environment: local
metadata: { "kit": { "emoji": "🧭" } }
---

# ct-onboarding: da pasta vazia ao primeiro plano da semana

Dono: `ct-diretor`. Esta skill é o **único condutor da configuração**. A pessoa do outro lado
pode não saber nada de IA nem de programação: ela abre a pasta no Claude Code ou no Codex e
só conversa em português. Tudo que a skill grava é revisável depois. Nada é publicado.

Arquivos de apoio: `references/conexoes-guiadas.md` (roteiro por rede),
`clients/_template/configuracao-estado.md` (modelo do marcador de página),
`scripts/kit/checar-chaves.mjs` (confere chave sem mostrar valor).

## Regras de conversa (valem em todas as fases)

1. **Uma pergunta por vez.** Espera a resposta antes da próxima. Múltipla escolha quando der.
2. **Sem jargão.** Termo técnico só com explicação entre parênteses na primeira vez. A pessoa
   não é de marketing nem de tecnologia.
3. **Reaproveita o que existe.** Se a empresa tem site, Instagram ou LinkedIn, ler ANTES de
   perguntar (Playwright ou WebFetch) e mostrar o que encontrou para confirmar. Paleta e
   fontes saem do site; tom de voz sai dos posts existentes.
4. **Mostra antes de gravar.** Todo arquivo é exibido em resumo e só é gravado depois do
   "pode" da pessoa. Um bloco por vez.
5. **Nada de travessão** (nem o longo nem o médio) em nenhum texto gerado.
6. **Afirmação sobre público ou concorrente sem fonte fica marcada `[HIPOTESE]`**, igual a
   `references/viral-playbook.md`.
7. **Nunca pula erro.** Se um comando falhar, explica em uma frase o que aconteceu, tenta
   resolver, e só segue quando resolver ou quando a pessoa decidir deixar "para depois".
8. **Segredo nunca no chat.** Senha e código de verificação: a pessoa digita na janela do
   navegador. Chave, token e segredo: a pessoa cola no arquivo `.env.local`, nunca na
   conversa. Se ela colar no chat por engano: avisar, pedir para gerar outra no portal da
   rede e nunca repetir o valor.
9. **Comando pede permissão.** Antes de rodar cada comando, dizer em uma frase simples o que
   ele faz ("vou instalar as peças que o kit precisa"), e rodar só com o "pode".

## Estado e retomada (`configuracao-estado.md`)

O estado vive em `clients/{slug}/configuracao-estado.md` (modelo em
`clients/_template/configuracao-estado.md`). Sem chave, senha ou token dentro.

- **Ao começar:** se a pasta `clients/` não tem nenhuma marca além de `_template`, é
  configuração nova (Fase 0). Se tem, ler `.workspace` ou perguntar qual marca.
- **"continuar configuração":** ler o estado, dizer em duas linhas o que já está feito e o
  que falta, e retomar da primeira fase não concluída. Não refazer o que está `feito`.
- **Depois de cada fase ou sub-fase:** atualizar a tabela de andamento, a data e "Fase
  atual". Item que a pessoa quer deixar para depois entra em "Ficou para depois" com o
  motivo. A pessoa pode pular qualquer fase, menos a parte obrigatória da Fase 0 (Node, Git e
  dependências).
- **Fase 0 roda antes de existir slug.** Enquanto não houver slug, anotar o andamento em
  `output/configuracao-fase0.md` (pasta temporária, fora do Git). Na Fase 1, copiar para o
  estado da marca.
- **"continuar configuração" sem marca criada:** ler `output/configuracao-fase0.md` e
  retomar a Fase 0 de onde parou (por exemplo, depois de reiniciar o computador).
- **Ao retomar, reconferir antes de confiar no "feito":** rodar de novo as checagens da Fase 0
  (`node --version`, `git --version`, e `npm run sala:check-db` se o painel já foi ligado).
  O computador pode ter mudado desde a última conversa.
- **Se `clients/{slug}/` já existe** na Fase 1: perguntar se é para revisar ou parar.

## Fase 0: ambiente (o computador pronto)

Objetivo: o computador pronto para produzir. A skill roda os comandos sozinha, pedindo
permissão, e confere cada resultado. Dividida em duas partes:

- **Obrigatória (0a):** Node, Git, `npm install` e o navegador automático. Com isso o time já
  produz legendas, carrosséis, stories e roteiros.
- **Opcional (0b), pode ficar para depois:** Docker e o banco local, que ligam o painel (Sala de
  Comando) e o histórico de métricas. Perguntar se a pessoa quer agora ou depois.

Antes, descobrir o sistema (Windows ou Mac) e onde a pessoa usa o assistente (anotar no
estado). Conferir um por um, dizendo o que é cada programa:

| Conferir | O que é, em uma frase | Comando de checagem |
|---|---|---|
| Node 22 ou superior | o "motor" que roda os scripts do kit | `node --version` |
| Git | guarda o histórico da pasta | `git --version` |
| Docker Desktop (só 0b) | roda o banco de dados no seu computador | `docker --version` |
| ffmpeg e uv | só se for fazer vídeo (Fase 8c); pode ficar para depois | `ffmpeg -version`, `uv --version` |

**Programa faltando:** oferecer instalar, sempre com permissão. Windows, pelo winget:
`winget install OpenJS.NodeJS.LTS`, `winget install Git.Git`,
`winget install Docker.DockerDesktop`, `winget install Gyan.FFmpeg`,
`winget install astral-sh.uv`. Mac, pelo brew: `brew install node git ffmpeg uv` (Docker
Desktop no Mac se instala pelo site). Se a pessoa preferir instalar sozinha, dar o link
(nodejs.org, git-scm.com, docker.com/products/docker-desktop) e esperar.

Avisos antes de instalar (dizer antes, não depois):
- Depois de instalar o Node ou o Git, o terminal atual pode não enxergar o programa novo. Antes
  de pedir para fechar e abrir de novo, **gravar o andamento** (`output/configuracao-fase0.md`)
  e dizer: "quando voltar, abra o assistente nesta mesma pasta e diga **continuar configuração**".
- O Docker Desktop no Windows pede permissão de administrador, pode instalar o WSL2 (um
  componente do Windows) e costuma **pedir para reiniciar o computador**. Avisar, gravar o
  andamento e combinar a volta com "continuar configuração".
- O `npm install` pode levar vários minutos: avisar que é normal.
- O Docker Desktop precisa estar **aberto e pronto** antes do banco: pedir para a pessoa abrir.

**0a, dependências** (na pasta do kit, cada um com a explicação ao lado):

1. `npm install`: baixa as peças que o kit usa.
2. `npx playwright install chromium`: instala o navegador automático que gera imagens e lê
   sites. (A pasta `remotion/` tem as próprias dependências: `cd remotion && npm ci`, só
   quando chegar em vídeo.)

**0b, painel e banco (opcional):**

3. `npm run supabase:start -- --configure`: liga o banco no seu computador e cria o arquivo
   privado `.env.local` (onde ficam as chaves). Se o arquivo já existe, é preservado.
4. `npm run sala:migrate -- --all`: cria as tabelas do banco.
5. `npm run sala:check-db`: confere se o banco responde.
6. Conferir as chaves obrigatórias do banco, sem mostrar valor:
   `node scripts/kit/checar-chaves.mjs --rede supabase`. Tudo "preenchida" é o esperado.

**Login do painel:** orientar a pessoa a criar o acesso dela (e-mail e senha) em
`docs/SETUP.md`, passo 3.4, digitando a senha ela mesma. Nunca receber a senha no chat.

Erro comum: Docker fechado ("cannot connect to the Docker daemon"): pedir para abrir o
Docker Desktop, esperar ficar pronto e repetir o passo 3.

## Fases 1 a 7: a marca (mesmos blocos de sempre)

### Fase 1: identidade
- Nome da empresa, o que vende de verdade (além do produto óbvio), cidade, site.
- Gera o `slug` (kebab-case, sem acento) e confirma com a pessoa. Cria `clients/{slug}/`
  copiando `clients/_template/`, grava `.workspace` com `client: {slug}`, roda
  `npm run workspace:boot` e cria o estado (trazendo o que estava em
  `output/configuracao-fase0.md`). Assim a retomada já funciona a partir daqui.

### Fase 2: público
- Quem compra (cargo, tamanho de empresa, momento de vida), quem influencia, quem NÃO é
  cliente.
- As 3 dores que a pessoa mais ouve do cliente, nas palavras do cliente.
- O que o cliente já tentou antes e não deu certo.

### Fase 3: persona e voz
- Quem assina o conteúdo: a empresa (página) ou uma pessoa (rosto)?
- 3 frases que a pessoa fala sempre. Se houver posts antigos, extrair de lá.
- O que nunca dizer (palavras proibidas, promessas que não pode fazer, temas sensíveis).
- Formal ou informal; técnico ou acessível; usa humor ou não.

### Fase 4: pilares e prova
- 3 a 5 assuntos que a empresa pode falar toda semana sem esgotar.
- Provas concretas: números, casos, antes e depois, certificações. Sem prova = pilar fraco.
- Diferenciais reais (o que o concorrente não consegue copiar amanhã).

### Fase 5: redes e ritmo
- Quais redes existem hoje (nome de usuário de cada uma) e qual é a principal.
- Quantas peças por semana a empresa aguenta **aprovar** (não produzir: aprovar).
- Quem aprova, por onde (terminal, Telegram) e em quanto tempo.
- Formatos que a pessoa topa: carrossel, reel com rosto, reel sem rosto, story, artigo.
  (O detalhe de cada um vem na Fase 8, com exemplos.)

### Fase 6: visual
- Logo (arquivo), 2 cores principais, fonte (se souber). Se tiver site, extrair e confirmar.
- Tem foto profissional da pessoa que assina? Onde está?
- Referências visuais que gosta (3 perfis) e que odeia (1 basta).

### Fase 7: concorrentes e inspiração
- 3 a 8 perfis do mesmo nicho para monitorar. Se a pessoa não souber, sugerir por busca e
  confirmar.

## Fase 8: preferências de conteúdo, COM PRÉVIA

Regra central: **nada de perguntar "como você quer?" no abstrato.** Para cada item, o
assistente usa a marca já configurada (Fases 1 a 7), gera 2 ou 3 variações reais, mostra, a
pessoa escolhe ou pede ajuste, e só então grava. A pessoa reage ao que vê, não escreve
especificação.

Ritual de cada item:
1. Gerar 2 ou 3 variações com a marca dela (assunto real, tom real, cores reais).
2. Mostrar. Imagem: **abrir o arquivo para a pessoa ver** (Windows: `start "" "caminho"`;
   Mac: `open "caminho"`) e descrever em uma frase a diferença entre as opções.
3. Ela escolhe ("a segunda"), mistura ("a segunda, mas com menos emoji") ou pede outra rodada.
   Máximo de 2 rodadas por item; depois, propor a melhor e seguir.
4. Só com o "pode": gravar e marcar o item no estado.

Prévias ficam em `output/previas/{slug}/` (e nunca em `content/{slug}/` direto, para não
parecerem peças prontas). Prévia não é peça: nunca entra em calendário nem em publicação.

### 8a. Legendas
Gerar **3 legendas de exemplo**, sobre um assunto real da marca, em estilos diferentes
(por exemplo: curta e direta; conversa com história; lista com passos). Em cada uma, variar
tamanho, tom, uso de emoji, hashtags e chamada para ação (CTA).
Perguntar o que gostou em cada ponto: tamanho, tom, emojis (nenhum, poucos, à vontade),
hashtags (respeitar a regra da marca em `brand-profile.md`; LinkedIn sem hashtag) e CTA
(que tipo e onde).
Grava em `voice-patterns.md` (seção "Legendas aprovadas": a legenda escolhida vira
post-gabarito, mais as regras de tamanho, emoji, hashtag e CTA) e resume em
`brand-profile.md`, "Preferências de formato".

### 8b. Carrossel
Mostrar **estrutura e estilo** com prévia real (antes, conferir o navegador automático como no 8c): gerar **1 ou 2 slides** de verdade com
`ct-carrossel-gen` (HTML mais Playwright, nas cores e fontes da marca), em 2 estilos
(por exemplo: texto corrido minimalista; destaque com número grande). Salvar em
`output/previas/{slug}/carrossel/` e **abrir a imagem** para a pessoa ver.
Perguntar: estilo escolhido, quantidade típica de slides (respeitar o máximo de 10), se leva
foto ou logo no topo, como termina (pergunta, resumo ou convite).
Grava em `design-system.md` (tabela "Carrossel Instagram": estilo, slides, foto) e em
`brand-profile.md`, "Preferências de formato".

### 8c. Reels
Primeiro perguntar **quais tipos a marca vai usar**, explicando cada um em uma frase:

| Tipo | Em uma frase | Skill que executa |
|---|---|---|
| Com rosto falando | a pessoa grava, o time edita com legenda e cortes | `ct-video-editor` |
| Sem rosto, narrado | imagens e vídeos de banco com voz narrando | `ct-video-mpt` |
| Motion e animação | textos e gráficos animados, sem gravação | `ct-motion-code`, `ct-remotion` |
| Cortes de vídeo longo | pedaços de um vídeo longo (podcast, palestra, YouTube) | `ct-video-editor`, `ct-openshorts` |
| Avatar digital (opcional, pago) | um avatar de IA fala o roteiro (HeyGen) | `ct-video`, `ct-reel` |
| Cinematográfico com IA (opcional, pago) | cenas geradas por IA a partir de imagens (Higgsfield) | `ct-video-higgsfield`, `ct-reel-narrado-higgsfield` |
| Clonar estrutura de viral (opcional) | copia o formato de um vídeo que performa bem, com o conteúdo da marca (Hypit, ferramenta externa) | `ct-video-hypit` |

Os opcionais só aparecem se a pessoa se interessar: dizer que dependem de conta em serviço de
terceiro (e, nos pagos, de créditos).

Depois, o **estilo de edição** dos tipos escolhidos: legenda palavra a palavra (estilo
CapCut) ou por frase, ritmo de cortes (calmo, médio, acelerado), zoom (sem, suave,
marcante), trilha (sem, suave, animada).
**Prévia:** antes, conferir se o navegador automático está instalado (`npx playwright install
chromium`, com permissão). Gerar um **quadro** (imagem 9:16, 1080x1920, feita por HTML e Playwright como no
carrossel) mostrando a legenda no estilo proposto nas cores da marca, e um **roteiro curto
de exemplo** (15 a 30 segundos) de um assunto real da marca. Salvar em
`output/previas/{slug}/reels/` e abrir a imagem. Não renderizar vídeo completo só para
prévia.
Se o tipo escolhido precisa de programa que faltou na Fase 0 (ffmpeg, uv), oferecer instalar
agora ou deixar "para depois" no estado.
Grava em `brand-profile.md`, "Preferências de formato" (tipos e estilo de edição) e em
`design-system.md`, "Legenda de reel" (estilo, cor, posição).

### 8d. Stories
O tipo segue `references/stories-playbook.md` (BASTIDOR, ROTINA, DISCUSSAO, INSIGHT). Mostrar
o que cada um é com um exemplo da marca e perguntar quais combinam. Perguntar tamanho da
sequência (3 a 5 telas costuma ser o ponto de partida).
**Prévia:** um **roteiro de exemplo** completo de uma sequência, tela por tela, em texto.
Se a pessoa quiser ver o visual, gerar 1 tela com `ct-story` em `previas/stories/` e abrir.
Grava em `brand-profile.md`, "Preferências de formato".

### 8e. Design (identidade aplicada)
**Prévia:** um post ou card (1080x1350) com as cores, fontes e logo aplicados, em 2
versões (por exemplo fundo escuro e fundo claro). Abrir as imagens. A pessoa confirma ou
pede ajuste de cor, fonte ou espaçamento.
Grava o que mudou em `design-system.md`, `design-tokens.css` e, se houver correção
permanente ("nunca use vermelho"), em `regras-cliente.md`.

### Onde as escolhas ficam gravadas (os agentes já leem esses arquivos)

Os agentes (`ct-diretor`, `ct-redator`, `ct-carrossel`, `ct-story`, vídeo) já leem
`brand-profile.md`, `design-system.md` e `voice-patterns.md` inteiros do cliente ativo. Por
isso as escolhas ficam lá, sem arquivo novo:

| Arquivo | Seção | O que entra |
|---|---|---|
| `brand-profile.md` | **Preferências de formato** (seção nova, no fim do arquivo) | legenda (tamanho, tom, emoji, hashtag, CTA); carrossel (estrutura, nº de slides, fecho); reels (tipos e estilo de edição); stories (tipos e tamanho); em 1 ou 2 linhas cada |
| `voice-patterns.md` | **Legendas aprovadas** | a legenda escolhida como post-gabarito e as regras de escrita |
| `design-system.md` | tabela "Carrossel Instagram" e seção **Legenda de reel** (nova) | estilo de carrossel, foto ou logo, estilo e posição da legenda de vídeo, cores |

Modelo da seção nova em `brand-profile.md`:

```
## Preferências de formato
- Legendas: [tamanho], [tom], emoji [nenhum/poucos/muitos], hashtags [regra], CTA [tipo]
- Carrossel: [estilo], [N] slides, termina com [pergunta/resumo/convite]
- Reels: tipos [lista]; edição [legenda palavra a palavra/por frase], cortes [ritmo], zoom [nível], trilha [nível]
- Stories: tipos [lista], sequência de [N] telas
- Escolhido em [data], com prévia aprovada pela pessoa
```

## Fase 9: conexões guiadas (as redes)

Para cada rede que a pessoa usa (Fase 5), seguir o roteiro de
`references/conexoes-guiadas.md`: Instagram e Meta Ads, LinkedIn, YouTube, TikTok, X,
Threads e Telegram. Uma rede por vez, e só as que ela quer agora; as outras ficam "para
depois" no estado. Antes de cada rede, dizer em uma frase o que ela passa a permitir ("o time
consegue medir o que você já publicou") e o que **não** faz ("conectar não publica nada").

Como conduzir cada rede:

1. **Conferir o que a pessoa precisa ter antes** (por exemplo: conta profissional do Instagram
   ligada a uma Página do Facebook) e perguntar se já tem. Se não tem, explicar como criar e
   esperar.
2. **Assumir o navegador** (ver seção seguinte), abrir o portal do desenvolvedor da rede
   (Meta for Developers, LinkedIn Developers, Google Cloud Console, TikTok) e guiar **tela por
   tela**: "agora clique em Criar aplicativo", "me diga o que aparece". Depois de cada tela,
   olhar o resultado e confirmar com a pessoa antes de avançar.
3. **A pessoa faz login e digita senhas e códigos ela mesma**, na janela do navegador. O
   assistente espera ela dizer "pronto". Nunca pedir nem receber senha no chat.
4. **Chaves: nunca pedir no chat.**
   - Rodar `node scripts/kit/checar-chaves.mjs --rede {rede} --criar`: acrescenta ao
     `.env.local` só as linhas `NOME=` que faltam, vazias, sem tocar no que já existe.
   - Abrir o arquivo no editor (Windows: `notepad .env.local`; Mac: `open -e .env.local`) e
     dizer **qual nome** preencher e **onde** colar o valor que ela copiou do portal
     ("ao lado de `IG_APP_ID=`, cole e salve").
   - Quando ela disser "salvei": `node scripts/kit/checar-chaves.mjs --rede {rede}`. Só
     diz "preenchida" ou "vazia" e nunca mostra valor. Se "vazia", perguntar se salvou o
     arquivo (Ctrl+S) e repetir.
5. **Endereços de retorno (callback):** dizer o endereço exato a cadastrar no aplicativo da
   rede (estão em `references/conexoes-guiadas.md`), copiando do arquivo, não de memória.
6. **Testar:** abrir o painel (`npm run dev`, endereço `http://localhost:5000`), tela
   Conexões, Conectar e depois Testar; e rodar `npm run sala:check-connections`. Só marcar
   "conectada e testada" depois do Testar dar certo. Chave preenchida não prova conexão.
7. Anotar em `integracoes.md` (status por rede, sem chave) e no estado.

Interface de terceiros muda. Quando um nome de botão ou menu não bater com o roteiro, dizer
"essa tela pode ter mudado, vou seguir pelo que vejo", descrever o que vê e escolher a opção
de significado mais próximo. Nunca inventar caminho de menu.

**Opcionais, oferecer no fim:**
- **Telegram** (aprovar peças pelo celular): recomendado, porque o "pode" fica a um toque.
  Roteiro em `references/conexoes-guiadas.md`.
- **Memória dos agentes** (os agentes lembram decisões entre conversas): precisa de Docker;
  se a pessoa topar, `npm run memory:setup`.

## Navegador, computer use e extensão do Chrome

O assistente precisa de um "olho e mão" no navegador para guiar os portais. Há três jeitos.
Usar o primeiro que estiver disponível, sem exigir que a pessoa entenda a diferença.

Onde cada jeito existe: no **Claude Code de terminal** e no **Codex**, só o jeito 1
(navegador automático). Os jeitos 2 e 3 existem só no **aplicativo Claude** (desktop) ou com a
extensão do Chrome. Se a pessoa está no terminal, usar o jeito 1 sem oferecer os outros.

1. **Navegador automático do kit (MCP Playwright, padrão).** O arquivo `.mcp.json` na raiz
   do kit já declara esse servidor. No **Claude Code**, na primeira vez ele pergunta se
   pode usar o servidor "playwright": a pessoa aprova. Avisar antes: "vai aparecer uma
   pergunta pedindo permissão para o navegador automático, pode aprovar". Ele abre uma
   janela de navegador que a pessoa enxerga e na qual ela faz o login.
   No **Codex**, rodar (com permissão):
   `codex mcp add playwright -- npx @playwright/mcp@latest`
   e pedir para reiniciar a sessão do Codex se o navegador não aparecer.
2. **Claude in Chrome (extensão).** Se a pessoa já usa a extensão Claude in Chrome ligada, o
   assistente pode usar o Chrome dela, que já está logado nos sites. Se ela quiser e não
   tiver, orientar a procurar "Claude in Chrome" na loja de extensões do Chrome e instalar.
3. **Uso do computador (computer use) no app Claude.** Se a pessoa está no aplicativo
   Claude com uso do computador ligado, o assistente pode enxergar e controlar a tela. Se ela
   quer usar e não está ligado, dizer para **procurar nas configurações do aplicativo Claude
   a opção de uso do computador** e ligá-la. Não descrever caminho exato de menu, porque muda
   de versão para versão: se ela não achar, oferecer o navegador automático (jeito 1) como
   alternativa, que já resolve tudo aqui.

Regras do navegador, em qualquer jeito:
- Login, senha, código de verificação e pagamentos: sempre a pessoa, nunca o assistente.
- Nunca clicar em "Publicar", "Enviar" ou equivalente numa conta real sem "pode" explícito.
- Se a janela pedir captcha ou confirmação humana, parar e pedir para a pessoa resolver.
- Se nenhum dos jeitos funcionar, cair para o modo manual: explicar os passos em texto, e a
  pessoa faz na tela dela, contando o que vê.

## Fechamento (Fase 10)

Entregar em poucas linhas, em português simples:
1. **O que foi configurado** (marca, preferências de formato, redes conectadas e testadas).
2. **O que ficou para depois** (lido de `configuracao-estado.md`), com como retomar:
   "diga **continuar configuração**".
3. **O que ficou `[HIPOTESE]`** e será corrigido pelo primeiro relatório de desempenho.
4. A frase: **"Nada é publicado sem o seu pode."**
5. Se `git remote get-url origin` ainda aponta para o kit público
   (`AIgorrocha/content-team-kit`), oferecer guardar a marca: "sua marca está só neste
   computador; quer que eu crie um repositório privado seu no GitHub?". Com o "sim", seguir a
   seção do repositório privado de `skills/ct-atualizar-kit/SKILL.md`.
6. Oferecer o **primeiro plano da semana**: "quer que eu monte o plano desta semana?". Com o
   "sim", delegar a `ct-plano-semanal` com o ritmo da Fase 5.

Depois de gravar tudo: `npm run workspace:boot` e conferir que `clients/active-client.md`
aponta para o slug.

## Saída (gravada fase a fase, após "pode")

| Arquivo | Origem |
|---|---|
| `clients/{slug}/configuracao-estado.md` | atualizado ao fim de cada fase |
| `clients/{slug}/brand-profile.md` | fases 1 a 5 e "Preferências de formato" (fase 8) |
| `clients/{slug}/voice-patterns.md` | fase 3 e "Legendas aprovadas" (8a), com exemplos reais ou `[HIPOTESE]` |
| `clients/{slug}/design-system.md` e `design-tokens.css` | fase 6 e 8b, 8c, 8e; tokens no padrão `--bg`, `--surface`, `--text-primary`, `--accent` |
| `clients/{slug}/competitors.md` | fase 7 |
| `clients/{slug}/integracoes.md` | fase 9 (status por rede, sem chave) |
| `clients/{slug}/regras-cliente.md` | copiado do modelo, vazio, para correções futuras |
| `clients/{slug}/assets/` | logo e foto copiados |
| `output/previas/{slug}/` | prévias da fase 8 (não são peças) |
| `.workspace` (raiz, ignorado pelo Git) | `client: {slug}` |
| `content/{slug}/planejamento/{ano}-semana-{NN}.md` | delega `ct-plano-semanal` |
| Memória (se `integrations/ai-memory/` estiver no ar) | páginas semente `marca`, `publico`, `redes`, `regras` via `memory_write_page` |

## O que esta skill NÃO faz

- Não publica nem agenda nada. Conectar uma rede não publica.
- Não cria chave de API nem recebe chave, senha ou token no chat. Ela mexe em `.env.local`
  **só para escrever NOMES de variáveis vazias** (`checar-chaves.mjs --criar`) e abri-lo no
  editor; **os valores quem cola é a pessoa**. Nunca lê nem mostra um valor.
- Não digita senha por ninguém, nem resolve captcha ou código de verificação.
- Não produz peça: isso é `ct-peca`, depois do plano aprovado. Prévia não é peça.
- Não instala programa sem permissão da pessoa.
- Não configura outra marca na mesma pasta: uma pasta, uma marca (ver `.workspace`).
