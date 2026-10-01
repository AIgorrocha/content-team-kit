---
name: ct-video-editor
description: "Edita video gravado pelo talento (talking head) no estilo CapCut por codigo: transcricao palavra-a-palavra (WhisperX), legenda no estilo da marca (padrao do kit: branca classica), e tela sincronizada com a fala. Layout: split (close/proposta) OU janela na camisa (contra-plongée, secao 1g). White-label, local, gratis. Use quando o cliente manda um video gravado e quer um Reel/Short editado com legenda automatica e a tela mostrando o que ele fala."
environment: local
---

# ct-video-editor - "CapCut com agentes" (white-label)

Pipeline de edicao de Reel a partir de um video gravado (talking head) + a tela de
um produto (proposta, app, dashboard, site). Tudo por codigo, local, gratis,
reprodutivel. Motor de composicao = Remotion (`remotion/`). Funciona pra QUALQUER
cliente do Content Team (le a identidade do cliente ativo).

> Produto vendavel junto com o Content Team: "editor de Reels com legenda
> automatica + demonstracao de tela", sem ferramenta paga (CapCut/submagic).

## PADRAO CANONICO: REEL TALKING-HEAD

Este e o PADRAO DO KIT. Quando o pedido for editar um video talking-head da marca ativa
neste terminal, seguir isto automaticamente, sem perguntar o basico e sem repetir os erros.
Os videos variam um pouco (assunto, ferramentas citadas, duracao), mas a espinha e esta. So
perguntar o que for especifico do video novo (qual gravacao, qual ferramenta ou repo aparece,
algum trecho a destacar).

**A marca manda.** Antes de editar, ler da marca ativa (`.workspace`):
- `clients/{slug}/brand-profile.md`, secao **Preferencias de formato** (tipos de reel, estilo
  de edicao, ritmo de cortes, zoom, trilha);
- `clients/{slug}/design-system.md`, secao **Legenda de reel** (estilo, cor do texto, cor de
  destaque da palavra falada, caixa e peso, posicao, fonte, tamanho, espacamento entre letras e
  entre linhas, linhas no maximo, palavras por pagina, contorno) e as cores e fontes;
- `clients/{slug}/regras-cliente.md` (correcoes permanentes da marca).
Tudo o que essas tres fontes definirem SOBREPOE o padrao descrito abaixo (por exemplo, marca
que escolheu legenda palavra a palavra com destaque, ou fala direta sem split). O codigo ja
respeita o que suporta: `run-editor.mjs` le a "Legenda de reel" e passa estilo, cor, destaque,
caixa, peso, posicao, fonte, tamanho, espacamentos, linhas, palavras por pagina e contorno para a
composicao. Para mudar: editar o valor na secao e gerar a previa de novo. Onde a marca nao escolheu, vale o padrao do kit.
Uma correcao nova do usuario vira regra da marca em `regras-cliente.md`, nao regra do kit.

### 1. Layout (split sob demanda, nao flip constante)
- Split horizontal cima/baixo **quando a tela mostra o que a fala diz**. Nao
  alternar cima/baixo o tempo todo: fica confuso e dificil de assistir. O rosto pode trocar de
  lado de um bloco para o outro (`CapCutSplitAlt`), nunca dentro do mesmo bloco.
- Quando split: **bandas ASSIMETRICAS**. Faixa do ROSTO maior (boca/queixo com
  folga); faixa da tela menor.
- As vezes rosto em **PiP** no canto superior direito (tela precisa de tela cheia).
- **Gancho (abertura) e fecho (CTA) em TELA CHEIA** (talento full, sem split).
- **Take em contra-plongée / camisa no miolo:** NAO usar split. Usar secao **1g
  (janela na camisa)**. Split nesse enquadramento cobre o rosto ou deixa a tela
  minuscula.

### 1b. Legenda queimada por app externo NAO cancela o split alternado
Erro tipico, reprovado pelo cliente numa primeira versao.
O erro: o talento tinha gravado close com legenda QUEIMADA pelo app Captions, e a
conclusao foi "nao cabe split, entao b-roll vira um card na faixa morta de baixo".
Resultado: b-roll minusculo, fixo, sem alternancia. Reprovado na hora.

**Regra correta: legenda queimada por app externo NAO e restricao de projeto, e
material SUBSTITUIVEL.** Ordem de ataque, nessa sequencia:
1. **PROCURAR O MASTER CRU.** Antes de qualquer contorno criativo, perguntar/procurar
   a gravacao original sem legenda (costuma estar na pasta de arquivos do cliente, em 4K). Master cru resolve tudo de uma vez
   e ainda da margem de crop. Copiar byte-a-byte (nunca recomprimir o master, `references/aprendizados-de-producao.md` item 5.1; provar igualdade por hash).
2. Sem master: **CROPAR** a faixa da legenda queimada pra fora do frame do talento e
   gerar legenda nova nossa (WhisperX) no padrao canonico.
3. Ultimo recurso: cobrir a faixa com scrim opaco e legendar por cima.
Nunca "desistir do split por causa da legenda". Duas camadas de legenda continuam
proibidas: se a nossa entra, a antiga sai (crop ou scrim), sem resquicio, e o QA
confere que nao sobrou nem meio caractere.

**Fonte horizontal (16:9) com `rotation=-90`:** `ffprobe` mostra 3840x2160, mas o frame
DECODIFICADO ja vem autorotacionado em 2160x3840 (retrato). Medir geometria em
frame extraido, nunca no numero do ffprobe, senao o crop sai todo errado.

**Geometria do split quando o talento gravou close:** exportar o talento ja cropado
na altura EXATA da faixa (um asset separado, ex 1080x1180) e um segundo asset
full-frame 1080x1920 so pros trechos de tela cheia. O componente so posiciona a
faixa, nao faz crop em runtime.

### 1b-2. Transicao entre blocos: NUNCA fade-out do b-roll pra opacidade 0
Blocos contiguos + fade-out = a faixa fica preta por ~N frames em CADA troca (pego no
QA). Animar so a ENTRADA (slide + ease), sem fade de saida.

### 1b-3. O pan tem que COBRIR a faixa (checagem numerica, nao no olho)
Com `renderW`/`renderH` da imagem e a faixa de `BROLL_H`, o centro do pan (`fromY/toY`,
`fromX/toX`) precisa estar dentro de `[ (BROLL_H/2)/renderH , 1 - (BROLL_H/2)/renderH ]`
(idem em X com W/2). Fora disso sobra fundo vazio na faixa. Rodar essa verificacao em
TODOS os blocos antes de renderizar.

### 1c. Motion vem de pan/zoom programatico, nunca de screen recording
Gravar scroll do Chrome entrega **25fps VFR**; ao reamostrar pra 30fps o resultado
**judder** (tranco visivel). Regra: capturar a tela como **screenshot estatico real**
(Playwright) e animar pan/zoom **programaticamente a 30fps** no Remotion. Screen
recording de scroll so como ultimo recurso, e nunca sem conferir fps/VFR no ffprobe.

### 1d. Legenda = cor da marca com SOMBRA, SEM fundo preto (padrao do kit)
Padrao do kit: letra branca `#FFFFFF` (ou a "Cor do texto" da marca) com sombra preta suave.
**Sem scrim, caixa ou faixa preta atras do bloco de legenda** (polui): tirar o preto do fundo e
deixar so a cor com sombra na letra. A marca pode escolher outro estilo (secao "Legenda de reel").

Excecao UNICA, e so quando comprovada por frame: legenda branca caindo sobre area
predominantemente BRANCA (print de pagina clara). Nesse caso, antes de pensar em scrim:
1. reposicionar o bloco pra area escura do frame (preferido);
2. reforcar a sombra (raio maior, opacidade maior) mantendo zero caixa;
3. so em ultimo caso, scrim em gradiente MUITO sutil, nunca faixa opaca.
QA tem que checar isso frame-a-frame e nunca aplicar scrim "por padrao".

### 1e. HDR iPhone: dois caminhos, nao misturar `[REINCIDENTE]`
iPhone 15 HEVC 10-bit sai `bt2020` / HLG (`arib-std-b67`) / Dolby Vision.

**Caminho concat (talking-head + Replay/tela SDR):** o concat NUNCA herda tag HDR.
O clipe SDR fica vermelho. Tonemap do HDR pra Rec.709 (`zscale` + `tonemap=hable`)
no clipe iPhone. SDR fica SDR. Entregavel tagged bt709. Conferir ffprobe.

**Caminho overlay-only (janela na camisa em cima do talking-head iPhone, SEM
concat com SDR):** NAO tonemap. `hable` lava camisa e pele. Overlay no
`talking-clean` com as tags do master, CRF 14, audio copy. A cor original nao pode mudar.

### 1f. Formato "tela dupla" / camera-bolha (dual camera, distinto do split alternado)

Formato diferente do split alternado (secao 1): gravacao de tela do celular/iPad
com a camera frontal em bolha flutuante por cima (ex: `RPReplay_Final*.MP4` do
iOS), tipico de demo de app/fluxo. Regra dura:

- **Legenda em POSICAO FIXA embaixo do queixo do talento, sempre, o video inteiro.**
  Nao mover a legenda pra outro lugar (ex: pro topo) so porque a bolha da camera
  ainda esta em transicao/animando pra posicao final nos primeiros segundos.
  Escolher a posicao final (onde a bolha se acomoda) e manter a legenda la desde
  o frame 1, mesmo que a bolha ainda esteja se movendo por baixo. Posicao
  inconsistente (pular de rodape pra topo e voltar) costuma ser reprovado: o texto tem que ficar sempre embaixo do queixo.
- Legenda em 2 linhas, padrao branco com sombra ja estabelecido (secao 1d),
  sem caixa, sem enfeite.

### 1g. Formato "janela na camisa" `[PADRAO DO KIT]`

Quando o talento gravou em contra-plongée (rosto em cima, camisa ou tronco preenchendo o
miolo e a base): a tela que ilustra a fala vai numa **janela pequena sobre o tronco**, abaixo
da legenda, sem cobrir boca nem olhos. NAO e split. NAO e card HTML estatico. NAO e print de
login, pagina de marketing ou tela de bloqueio.

Receita generica (o kit nao traz uma composicao pronta desta janela: monte a sua por video):
1. `talking-clean.mp4` 1080x1920: talento com a cor original, SEM janela (passe unico, regra 2).
2. Composicao Remotion da janela, por exemplo 1100x700 a 30fps, com a duracao exata do
   talking-head. Crie um arquivo novo em `remotion/src/`, registre em `Root.tsx` (copie o
   padrao de `StoryScenes.tsx`: tudo por `useCurrentFrame`, tema da marca com `getTheme`) e
   desenhe o chrome de janela (3 pontos + nome do app) com uma cena por beat da fala (porta 6b).
3. ffmpeg: escalar a demo para **820 px** de largura e `overlay` centrado horizontalmente, com
   `y` perto de 1276 (abaixo da legenda), `eof_action=pass`. Ajuste o `y` medindo um frame real.
4. Legenda no mesmo passe: gerar um `.ass` a partir do `captions.json` (`build-captions.mjs`)
   com 2 linhas, `Alignment: 8`, `\pos` fixo e `WrapStyle: 2` (`references/aprendizados-de-producao.md`
   item 5.4), e queimar junto. Audio em copy. Sem `-r 30`. Sem teto de 11M (caminho B da 7b).
5. QA nos FRAMES DO COMPOSITE (janela ja sobre o tronco), nao so no still da demo.

Regras da janela:
- **Letra grande o bastante para ler no recorte.** Corpo de 32 a 44 px na composicao de
  1100x700. Se no composite nao da para ler, a peca esta ERRADA: aumentar o tipo ou encolher o
  chrome. Nunca "cabe mais coisa" com 16 px.
- **Produto citado = a interface daquele produto**, no tamanho da janela, conforme a
  documentacao oficial: kanban com colunas, conversa com bolhas, agenda com eventos, fatura com
  vencimento, tarefa agendada com frequencia. Print de marketing ou de login nao e o produto.
  Exemplo de assistente de chat: tela inicial vazia, caixa de texto que CRESCE e digita
  enquanto a pessoa dita o prompt. Proibido `scale()` no frame inteiro (corta a moldura e come
  a palavra) e proibido inventar barra lateral que o produto nao tem.
- **Sincronizado com o audio.** Cada beat da fala troca a tela. Tabela 6b obrigatoria.
- **Anonimizar** valores reais e nomes de cliente (regra 8) e varrer conforme a secao 6c.

### 2. Rosto NUNCA coberto (regra sagrada)
- Animacao / b-roll / tela fica CONTIDO na metade dele. O rosto renderiza SEMPRE
  por cima do b-roll. Boca, queixo e olhos SEMPRE visiveis.
- Enquadramento com folga: objectPosition deixa a boca longe da borda do split.
- O divisor e o texto interno das animacoes nunca invadem a faixa do rosto.

### 3. Legenda (branca fixa classica, posicao condicional)
- **PRINCIPIO GERAL, vale pra qualquer formato: texto sempre
  embaixo de onde o talento fala, embaixo do queixo, sem cobrir o rosto (usar bom senso
  nos outros formatos).** Ou seja: a
  legenda tem que ficar colada logo ABAIXO do queixo/boca do talento sempre que o
  rosto dele estiver em quadro, nao numa "zona livre" generica e distante. Isso e
  o objetivo; as regras condicionais abaixo (por faixa do split) sao a
  implementacao pratica desse objetivo pra cada layout, e devem ser lidas com
  essa lente: quando o rosto esta em cima do quadro, "no RODAPE" quer dizer logo
  abaixo da faixa do rosto (a base do proprio bloco onde a cabeca dele esta), nao
  necessariamente o rodape absoluto do frame inteiro se isso deixar a legenda
  longe demais do queixo. So quando o formato nao mostra o rosto dele em quadro
  (ex: tela cheia sem PiP) a posicao fica livre por bom senso, sem essa ancora.
- **SEMPRE em 2 linhas** (ver tambem `clients/{slug}/regras-cliente.md`).
  Nunca 1 linha só nem 3+: dividir o texto em 2 linhas equilibradas (~27
  caracteres/linha em 1080px com Arial 64), posição ancorada no topo do
  bloco (`Alignment: 8` + `\pos` fixo em ASS) pra primeira linha não pular de
  altura quando o texto cresce.
- **Padrao do kit: BRANCA, maiusculas, negrito, sombra preta suave, sem cor piscando, sem
  stroke, sem realce da palavra ativa** ("tracos estranhos" e piscar costumam ser reprovados).
  A "Legenda de reel" da marca sobrepoe: estilo palavra a palavra com cor de destaque, caixa
  normal, peso normal, posicao no centro. Cor de destaque so vale se a marca definiu uma.
- **Posicao CONDICIONAL a faixa do rosto:**
  - Rosto EMBAIXO -> legenda ACIMA do rosto (na zona livre entre a animacao de
    cima e a cabeca).
  - Rosto EM CIMA / tela cheia / PiP -> legenda no RODAPE, ou seja, logo abaixo
    do queixo dele (ver principio geral acima).
- **NUNCA sobre a boca, olho, nariz ou barba.** Capa e legenda queimada: se o texto
  cai no rosto, a peca esta ERRADA. Nao entregar.
- **NUNCA sobre a boca.** Nunca sobrepor a legenda da FALA com o TEXTO INTERNO das
  animacoes: o texto da animacao fica contido na metade dela; a legenda da fala na
  zona livre do rosto. Duas camadas de texto jamais se cruzam.

### 4. Sync: SEMPRE WhisperX real (nunca estimativa)
- Timing palavra-a-palavra vem do audio real via WhisperX. NUNCA cronometrar "no
  olho". A legenda tem que bater exatamente com a fala.
- Corrigir termos que o WhisperX alucina (nomes tecnicos/IA) mantendo os timestamps
  por palavra. Ex: SQL->SKILL, Cloud Code->Claude Code, HTPT->GPT, mostra->amostra,
  **formas de trabalho -> area de trabalho** (exemplo de termo trocado).
- ASS desta peca: sempre **2 linhas**. Overlay claro por cima de caption branca =
  ilegivel: escurecer a faixa da tela, nao a letra.
- **Versao 1.1x:** acelerar video e audio PRIMEIRO (`setpts` + `atempo`), WhisperX
  nesse audio, depois queimar ASS. NUNCA escalar timestamp da ASS 1.0. Talking-head
  ate passa; o fluxograma/Replay dessincroniza.
- Se pedir 1.0 e 1.1x, as duas ficam. Cada uma tem WhisperX e ASS proprios.
- ASS 1080x1920, Alignment 2. Talking-head `MarginV` 560. Fluxograma/PiP `MarginV` 610
  (540 cobria o PiP). Branco + sombra, sem caixa.

### 5. Cortar silencio / pausa (fala acaba -> video acaba)
- Cortar TODO trecho sem fala: silencio no INICIO (antes da primeira palavra,
  quando o talento ainda vai comecar a falar), pausas longas no meio, e silencio no
  fim. Regra dura: trecho mudo sempre se corta, nos tres lugares (inicio, meio, fim),
  nunca so o fim.
- Usar `silencedetect` (ffmpeg) + a transcricao pra achar o fim real da fala,
  mas **nao confiar so no limiar automatico** (ex: -35dB/0,15s pode nao pegar
  respiracao/ruido de ambiente que ainda "nao e fala"). Caso tipico: `silencedetect` nao acusa nada no
  segundo inicial, mas o talento ainda nao tinha comecado a falar naquele trecho e
  ele fica sem cortar. Decisao e por OUVIR o inicio real da fala, o detector so
  ajuda a marcar o candidato.
- Cortar o hold da ultima palavra. O video termina quando a fala termina, nunca
  fica lingerindo em silencio nem em preto.
- **Nao capar o fim no ultimo word do WhisperX antigo.** Se o Replay ainda tem
  fala (silence_start depois do cap), a ultima frase some (um `trim=duration` fixo
  pode comer a frase final). Usar o silence_start
  real do Replay no timeline concatenado. Junction mudo talking-head→Replay tambem
  corta.
- **Tampouco deixar cauda muda depois da ultima palavra.** Exemplo: no fim, o
  talento para, olha pra baixo, "fechando o video": cortar o `-t` antes desse trecho.
  Assistir o video INTEIRO depois de gerar, nao 2 timestamps.

### 6. Conteudo visual = o REAL (nao card generico)
- Quando ele cita uma ferramenta / produto / repo, mostrar o REAL: ex screenshot
  de verdade do repositorio no GitHub (via Playwright), do app, do dashboard.
  Nada de card/icone generico inventado.
- Itens irmaos aparecem JUNTOS (ex Playwright em cima + Obscura embaixo, na mesma
  tela), nao alternando um por vez com espaco vazio sobrando.
- **HTML de produto: so o que a documentacao oficial mostra.** Overlays inventados
  de interface de produto sao reprovados. Conferir a documentacao oficial do produto
  na hora. Se for criar visual didatico, criar DEPOIS de ler a fonte.

### 6b. PORTA DE QA: alinhamento FALA <-> TELA (BLOQUEANTE, antes de renderizar)

Regra dura. Nao e gosto, e processo: o b-roll de um bloco tem que mostrar
EXATAMENTE o assunto que a fala daquele bloco esta dizendo, no mesmo instante.
"Bonito", "oficial" e "em movimento" NAO substituem "bate com a fala".

ANTES de mandar renderizar, montar esta tabela lendo o `audio.json` do WhisperX
(trecho LITERAL, copiado, nunca de memoria) e conferindo o asset com os olhos:

| bloco | timestamp | trecho literal da fala (audio.json) | o que o asset mostra | bate? |
|---|---|---|---|---|
| 7 | 25,1-29,6s | "...utilizando o chat para fazer tarefas" | app de IA recebe pedido, planeja e entrega a planilha | sim |

Como preencher, sem atalho:
1. Extrair do `audio.json` as PALAVRAS (nao so o segmento) cobertas pelo bloco.
   Um bloco cobre varias palavras: o que manda e o substantivo da acao
   ("tarefas", "apresentacao", "resultado"), nao a primeira palavra do bloco.
2. Descrever o asset pelo que APARECE na tela, nao pelo nome do arquivo nem pelo
   que ele "deveria" mostrar. Arquivo chamado `v-k3-sites.mp4` que na verdade
   exibe um jogo 3D se descreve como "jogo 3D", nao como "sites".
3. Marcar "bate?" so com sim/nao. Sem "mais ou menos".

BLOQUEIO: **nenhum bloco com "nao" vai pro render.** Achou um "nao", troca o
asset e refaz a linha. So depois roda o `remotion render`.

ENTREGA: a tabela completa (todos os blocos, inclusive os de tela cheia) vai
JUNTO com o video, sempre, em toda versao. Sem tabela, a entrega esta incompleta.

Por que essa porta existe (custo real): varias rodadas de correcao queimadas por
desalinhamento, uma de cada vez, porque ninguem conferiu bloco a bloco antes de renderizar.
Exemplos tipicos:
- fala "criando slides, apresentacao" / tela mostrava PLANILHA;
- fala "resultado absurdo" / tela mostrava DOC DE PRECO DE API;
- fala "para fazer tarefas" / tela mostrava JOGO 3D.
O que a fala diz tem que aparecer na tela, bloco a bloco.

### 6c. PORTA DE SEGURANCA: varredura de dado sensivel em gravacao de tela (BLOQUEANTE)

Nenhuma gravacao de tela vira peca sem varredura do arquivo INTEIRO, nao so dos trechos que
alguem apontou. Quem grava presta atencao na fala, nao no que passou de relance atras: o dado
mais grave costuma ser o que ninguem viu. Canone: `references/aprendizados-de-producao.md`,
secao 5, item 5.8 (complementa `references/asset-sanitization.md`).

- **Procurar:** nome de cliente, documento de identificacao, numero de contrato, e-mail de
  terceiro, token ou chave dentro de URL, caminho de pasta pessoal. Inclusive em titulo de
  janela, aba do navegador, notificacao, dica flutuante e caixa de autocompletar.
- **Amostragem esparsa nao basta.** Passe denso no arquivo todo e confira as bordas de cada
  trecho tratado quadro a quadro, nao so o meio.
- **Tratamento, nesta ordem:** (1) tarja cirurgica cobrindo so o dado, com o resto da tela
  visivel; (2) webcam ampliada preenchendo o quadro, quando o dado ocupa a tela toda e nao
  sobra area segura; (3) cortar o trecho, so em ultimo caso (quebra a narracao).
  **Tela preta cobrindo tudo e proibida.**
- **Credencial vista em gravacao se REVOGA**, nao so se tarja: tarjar conserta o video, nao
  desfaz o fato de a credencial ter circulado. Avisar o usuario para gerar uma nova.
- O arquivo BRUTO continua contendo o dado mesmo depois da peca tratada: nunca subir para lugar
  publico e manter a copia fora de pasta versionada. Prevencao: fechar o que nao sera mostrado
  ANTES de gravar.
- **Entregar um relatorio** com o tempo inicial e final de cada trecho, o que aparece nele e o
  tratamento aplicado. Peca sem esse relatorio nao vai para aprovacao.

### 7. QA obrigatorio pos-render (frame a frame, com os olhos)
- **Assistir o video INTEIRO (com audio), do inicio ao fim, antes de entregar.**
  Regra dura: extrair frame pontual e rodar `silencedetect` NAO
  substitui assistir de verdade. Assim passam batidos trecho mudo no inicio e
  divergencia entre fala e legenda. Frame
  a frame (abaixo) e COMPLEMENTO da assistida completa, nunca substituto.
- **Conferir a legenda contra a fala real, frase por frase**, nao so no ponto de
  QA visual: cada linha da legenda tem que bater com o que o talento realmente
  falou naquele instante (o WhisperX erra nome de ferramenta/termo tecnico,
  conferir cada um).
- **Mostrar o texto completo da legenda/transcricao pro usuario aprovar, JUNTO com
  o video**, nunca so o arquivo de video sozinho. Regra dura.
- Depois de renderizar, extrair frames de CADA trecho (gancho, cada faixa do split
  alternado, tela de ferramentas/repos, fecho) e LER cada imagem (Read da png).
  Confirmar: (a) nada (b-roll/divisor/tela) cobre rosto ou boca; (b) legenda na
  zona livre correta daquele trecho; (c) nenhuma legenda/texto sobreposto; (d) o
  rosto aparece onde deve, sincronizado com a fala; (e) NAO termina em preto e o
  corte final e limpo. Se qualquer frame falhar -> auto-corrigir e RE-RENDERIZAR.
  So validar/entregar depois dessa checagem visual. Nunca entregar sem ela.
- (f) RECONFERIR o alinhamento fala<->tela da secao 6b NO VIDEO RENDERIZADO: pra
  cada bloco de b-roll, ler o frame e confirmar que a legenda queimada naquele
  frame fala do mesmo assunto que a tela mostra. A tabela da 6b so vale como
  entregue depois de reconferida aqui. Divergiu -> auto-corrigir e RE-RENDERIZAR.

### 7b. PORTA DE ENTREGA: bitrate e tamanho do MP4 (BLOQUEANTE, depois do QA visual)

Ultimo passo antes de mostrar pro usuario e antes de qualquer publicacao. Render bruto
do Remotion NAO e "original sagrado": sai superdimensionado. (Nao confundir com a
regra de nunca recomprimir o master (`references/aprendizados-de-producao.md` item 5.1), que fala da
FONTE gravada pelo talento, nao do entregavel que a gente renderiza.)

Dois caminhos, nao misturar:

**A) Remotion do zero**: alvo 1080x1920, 30fps CFR, h264 High, yuv420p,
video 10-12 Mbps, audio AAC 192k, `+faststart`, 80-100 MB num reel de ~60s.
Render bruto sai inchado; re-render com `--video-bitrate=11M`. NUNCA recomprimir
o MP4 pronto.

**B) Overlay/ffmpeg em cima de talking-head master**: bitrate da saida **>= bitrate do master**. Master ~22 Mbps NAO vira
11 Mbps. CRF 12, sem teto `-b:v 11M`, **proibido `-r 30`** (duplica frame e trava
a fala). Graph API e outra porta: copia <= ~49 MB so pra Instagram; HQ fica na
pasta de entrega POSTAR. TikTok e YouTube Shorts sobem o HQ.
**Copia Graph nao pode mudar a cor.** Sem `setparams`/`tonemap`/`color_trc bt709`.
Caso real: encode bt709 lavou a peca e ela foi apagada. Se a
API recusar HDR, parar. Nao converter pra subir.

```bash
ffprobe -v error -show_entries format=size,bit_rate \
  -show_entries stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,bit_rate \
  -of default=noprint_wrappers=1 ENTREGA.mp4
```

Aceite caminho A: bit_rate total <= ~12 Mbps E size <= ~100 MB (~60s). Estourou ->
ERRADO. Correcao: RE-RENDERIZAR do Remotion. NUNCA recomprimir o MP4 pronto.
Aceite caminho B: saida >= master (ffprobe dos dois). Abaixo do master = ERRADO.

```bash
npx remotion render <entry> CapCutSplit saida.mp4 --video-bitrate=11M --audio-bitrate=192k
ffmpeg -i saida.mp4 -c copy -movflags +faststart ENTREGA.mp4
```

`--crf` e `--video-bitrate` sao mutuamente exclusivos.

Pos-correcao: SSIM nos MESMOS 8 timestamps da secao 7. 0,95-0,99 = so compressao, ok.
Salto grande = composicao errada, PARAR. Reconferir legibilidade do texto pequeno do B-roll.

Exemplo: um render bruto saiu com 19,3 Mbps / 163 MB; o re-render com `--video-bitrate=11M`
deu 11,1 Mbps / 90 MB sem perda visual.

### 7c. PORTA DE TEXTO: acentuacao e formatacao (BLOQUEANTE antes de publicar)

- Legenda/descricao sempre por ARQUIVO UTF-8, nunca inline no comando.
- DRY-RUN provando `á ã ç é ê ó õ ú` integros antes de publicar.
- Conferir quebras de linha, hashtags no fim, sem caractere de controle, sem mojibake (`Ã¡`/`Ã£`/`Ã§`).
- LinkedIn: `escapeLittleText` no commentary (`/rest/posts` corta no 1o char especial nao escapado).

Detalhe canonico: `references/platform-specs.md`, secao "Acentuacao e formatacao na publicacao".

### 8. Motor
- Remotion (`CapCutSplit` / composicoes) + WhisperX + ffmpeg. Tudo LOCAL, gratis,
  na identidade do cliente ativo (accent do `design-system.md`).

## Quando usar
- "edita esse video que gravei", "poe legenda automatica", "estilo CapCut"
- "minha cara em cima e a tela do sistema/proposta embaixo"
- Reel/Short com legenda palavra-a-palavra + demonstracao de tela dinamica

NAO usar pra: motion graphics puro (ct-video-remotion), faceless/b-roll
(ct-video-mpt), avatar IA (ct-video-higgsfield), cinematografico (higgsfield).

### Gravacao em PAR de arquivos (tela limpa + webcam), quando o cliente grava assim

Gravando com OBS configurado para **dois arquivos por gravacao**, com o mesmo horario no nome,
na pasta de brutos do cliente:

- `{data} {hora} tela.mp4`: so a tela, **limpa** (sem rosto queimado), 1080p60, **sem audio**
- `{data} {hora} webcam.mp4`: so o rosto, **4K** 60fps, **com a voz**

Tratar o par como UMA gravacao. Comecam no mesmo frame (a webcam pode terminar ~0,5s
antes). Como a tela nao tem audio, o audio de referencia e sempre o da webcam.

Isso libera o enquadramento: a posicao do rosto vira decisao editorial (nao vem
queimada da gravacao), e o 4K da webcam permite corte 9:16 sem upscale.

Gravacao ANTIGA (arquivo unico com rosto queimado no canto) continua valendo o fluxo
de sempre.

## Stack (em `integrations/video-editor/`, uv py3.11)
| Etapa | Ferramenta | Saida |
|------|-----------|-------|
| Transcricao palavra-a-palavra | WhisperX | audio.json |
| Legenda CapCut | scripts/video-editor/build-captions.mjs | captions.json |
| Imagem da tela (proposta/app) | Playwright (capture-page-image.mjs) | page.png |
| Composicao/render | Remotion `CapCutSplit` | <name>.mp4 |
| Orquestrador | scripts/video-editor/run-editor.mjs | tudo |
| Corte semantico (EDL) | scripts/video-editor/build-edl-llm.mjs + apply-edl.mjs | edl.json + talking-cut.mp4 |
| Self-eval (confere render + retry) | scripts/video-editor/self-eval.mjs | veredito |

## Corte semantico (opt-in, default DESLIGADO)

Por padrao o video do talento toca inteiro. Ligando, o pipeline corta trechos
descartaveis por CONTEUDO (nao so silencio) antes do render.

- Ligar: `"cutMode": "silence+llm"` no config. (Sem isso = comportamento de hoje.)
- Heuristica (sempre, alta precisao): hesitacao nao-lexical (`éé`, `hum`, `ãh`...) +
  gagueira (palavra repetida imediata, mantem a ultima). NUNCA corta palavra real
  (`é/né/tipo/então` ficam).
- Semantico (opcional, `"cutLlm": true`): Claude (Sonnet, via ANTHROPIC_API_KEY) marca
  take refeito / divagacao. Conservador.
- Trava: nunca corta > 25% do total (`maxDropPct`); se LLM estourar, cai pra so heuristica.
- `"reviewEdl": true` para ANTES de cortar pra voce revisar `output/.../edl.json`.
- O corte e UM unico encode (trim+concat, 30fps CFR) -> respeita a regra anti-frame-preto;
  legendas (`audio.cut.json`) e `layout` sao remapeados pro novo timeline. self-eval roda depois.
- Avulso: `node scripts/video-editor/build-edl-llm.mjs <audio.json> <edl.json> [--llm]`.

## Self-eval com retry (default LIGADO)

Apos o render, o orquestrador confere o MP4 e re-renderiza se achar defeito nos
pontos de corte. Automatiza as REGRAS CRITICAS abaixo (anti-frame-preto / anti-flicker)
em vez de pegar na mao.

- Le luma media por frame (ffmpeg `signalstats` YAVG). Detecta:
  - **black**: YAVG < 20 (preto yuv420p range-TV = Y~16).
  - **flicker**: pico de brilho de 1 frame (> 40) que volta no frame seguinte.
- Se o defeito cai EM CIMA de uma fronteira do `layout` (corte), e fixavel: o
  orquestrador desloca a fronteira ~2 frames (66ms) e re-renderiza. Ate 3 tentativas.
- Defeito FORA de fronteira nao e auto-corrigivel: entrega + avisa o ponto (`type@seg`).
- Desligar: `selfEval: false` no config, ou env `SELF_EVAL=0`. Default = ligado.
- Rodar avulso: `node scripts/video-editor/self-eval.mjs <mp4> [b1,b2,...]` (exit 2 se falha).

## REGRAS CRITICAS (aprendidas na marra - NAO repetir os erros)

1. **Rotacao do celular/WhatsApp.** Video vem com `rotation=-90` em side-data;
   Chrome/Remotion IGNORA -> rosto deitado. Resolve no passo 1 do orquestrador
   (autorotate via ffmpeg). 576x1024 portrait apos bake.

2. **NUNCA encadear varios re-encodes do video do talento.** Foi a causa do
   "tela piscando o video todo": empilhar passes (autorotate + corte + freeze +
   freeze + fps30) INJETA UM FRAME PRETO PERIODICO, a cada N frames, onde N =
   denominador do fps original (ex: 600/19 = 31.58fps -> preto a cada 19 frames).
   **Normalizar em UM PASSE so:** `ffmpeg -i src -vf "fps=30,format=yuv420p"
   -fps_mode cfr -c:v libx264 -crf 18`. Validar com `blackdetect` = 0 frames pretos.
   Como diagnosticar: montagem de frames consecutivos (`tile`) e OLHAR, ou
   `blackdetect`/`blackframe`. NAO confiar em "brilho medio" (esconde o frame preto).

3. **Tela = SCREENSHOT full-page rolado no Remotion, NAO video de scroll.**
   Gravar video do scroll do Chrome (Playwright recordVideo) gera 25fps VFR;
   reamostrar pra 30fps = judder/stutter ("piscar"). Em vez disso: tirar um
   screenshot `fullPage` (imagem alta) e rolar por codigo no Remotion
   (`ScreenImagePan`, pan deterministico 30fps). Zero stutter, texto mais nitido.

4. **Render no Windows pode precisar do Chrome do sistema.** O download do Chrome Headless
   Shell do Remotion as vezes falha ao extrair o zip (loop de re-download). Se acontecer,
   defina `BROWSER_EXECUTABLE` no `.env.local` com o caminho do `chrome.exe`: o
   `remotion/remotion.config.ts` usa essa variavel (`setBrowserExecutable`) e o
   `run-editor.mjs` a le do `.env.local`.

5. **Duracao da composicao <= duracao do video do talento** (senao da frame preto
   no fim). Cauda curta apos a ultima legenda (~120ms). Ver `Root.tsx`
   calculateMetadata. Fim em modo `talk` = talento ao vivo (nao congelado).

6. **Anti-flicker na captura da pagina:** desligar reveal-on-scroll (`.rv`),
   animacoes/transicoes, e esconder `.nav`/`.hero` (backdrop-filter/blur e
   mix-blend tremulam). Ja no capture-page-image.mjs + flag `--hide`.

7. **Legenda classica (padrao do kit):** branca `#FFFFFF`, sombra preta suave, sem contorno/stroke
   e sem realce da palavra ativa ("traços estranhos" costumam ser reprovados). Posicao fixa
   no rodape, igual em todos os modos. A "Legenda de reel" do `design-system.md` da marca
   sobrepoe cor, destaque, caixa, peso e posicao (o `run-editor.mjs` aplica).

8. **Anonimizar** dados de cliente e precos antes de capturar (flag `--anon`).
   Publicacao sempre manual.

9. **LEGENDA COM POSICAO CONDICIONAL A FAIXA DO ROSTO (split cima/baixo).**
   No split horizontal alternado, a legenda NUNCA pode ficar no rodape fixo: quando
   o rosto esta na faixa de BAIXO (b-roll em cima) o rodape cai em cima do rosto/boca.
   Regra: rosto EMBAIXO -> legenda ACIMA do rosto, na faixa livre entre o b-roll e a
   cabeca. Rosto EM CIMA / tela cheia / PiP -> legenda no RODAPE. Bandas ASSIMETRICAS:
   a faixa do rosto e mais alta (folga p/ a boca), a do b-roll menor. O b-roll (e o
   divisor) NUNCA cobre a boca -> o rosto renderiza SEMPRE por cima do b-roll e o
   objectPosition enquadra deixando a boca com folga da borda.

10. **VERIFICACAO FRAME-A-FRAME POS-RENDER (obrigatoria antes de entregar).**
    Depois do render, extrair frames representativos de CADA trecho (gancho, cada
    faixa do split, tela de ferramentas, fecho) e LER cada imagem (Read da png) pra
    confirmar com os proprios olhos: (a) nenhum overlay/b-roll/divisor cobre o rosto
    ou a boca; (b) a legenda esta na zona livre daquele trecho (acima do rosto quando
    o rosto esta na faixa de baixo; rodape quando esta em cima); (c) nao ha duas
    legendas/textos sobrepostos; (d) o rosto aparece nos trechos que exigem (ex: PiP na
    tela de ferramentas, sincronizado com a fala real). Se qualquer frame falhar,
    consertar e RE-RENDERIZAR antes de entregar. Nunca entregar sem essa checagem visual.

11. **Sync final da legenda:** conferir o fim real da fala com `silencedetect`
    (ffmpeg) e a transcricao WhisperX; remover palavra fantasma/alucinada no fecho
    (ex: WhisperX medium troca "embaixo" por "Playwright") e cortar o hold da ultima
    palavra pra ela nao ficar lingerindo depois que a fala acaba.

## Fluxo

### 1. Contexto da marca ativa
Ler `.workspace` -> slug. Ler `brand-profile.md` (Preferencias de formato), `design-system.md`
(cores, fontes, Legenda de reel) e `regras-cliente.md` da marca (cores nao ficam fixas aqui).
O roteiro ja esta no video gravado.

### 2. Preparar a tela (pagina a demonstrar)
Pode ser uma URL publica (Vercel) ou uma pagina servida local. Para proposta-modelo
white-label: pegar o padrao de uma proposta real, anonimizar dados+precos, servir
local (`node` http server simples) e apontar `pageUrl` pra ela.

### 3. Montar config.json (em output/reel-agentes/<name>/config.json)
A legenda NAO entra aqui: vem da "Legenda de reel" do `design-system.md` (o config so sobrepoe
em caso de teste: `captionColor`, `highlightColor`, `captionStyle`, `captionUppercase`,
`captionBold`, `captionPosition`). `composition` pode ser `CapCutSplit` (padrao) ou
`CapCutSplitAlt` (split alternado, exige `layout` com `faceBottom` e `image` por bloco).
```json
{
  "name": "agentes-skills",
  "client": "<slug>",
  "sourceVideo": "<caminho-local-do-video-gravado.mp4>",
  "pageUrl": "http://localhost:8099/",
  "anon": "Cliente Real=>Cliente Exemplo,R$ 5.000=>R$ •••",
  "hide": ".nav,.hero,footer.foot",
  "composition": "CapCutSplit",
  "layout": [
    {"fromSec":0,"toSec":5,"mode":"talk"},
    {"fromSec":5,"toSec":11,"mode":"split"},
    {"fromSec":11,"toSec":17,"mode":"screen"},
    {"fromSec":17,"toSec":23,"mode":"split"},
    {"fromSec":23,"toSec":100,"mode":"talk"}
  ]
}
```

### 4. Rodar o orquestrador
```bash
node scripts/video-editor/run-editor.mjs output/reel-agentes/<name>/config.json
```
Ele normaliza o video (1 passe), transcreve, gera legendas, captura a imagem da
pagina e renderiza. Imprime no fim quantos frames pretos (tem que ser 0).

### 5. Revisar legendas (WhisperX erra nomes tecnicos)
Corrigir o texto em `output/reel-agentes/<name>/captions.json` mantendo os
timestamps por palavra (editar `words[].word`). Ex tipicos PT-BR/IA:
SQL->SKILL, Cloud Code->Claude Code, HTPT->GPT, mostra->amostra. Re-renderizar so
o passo do Remotion.

### 6. Loop de revisao com o cliente
Mandar preview, ajustar layout/cores/legenda, re-renderizar. **Verificar SEMPRE
como usuario:** abrir o video + checar frames pretos (`blackdetect`) e montagem de
frames. Video so fica bom iterando. So mover pra `content/<client>/reels/<name>/`
apos aprovacao.

## Modos de layout
`CapCutSplit` (rosto sempre em cima):
- `talk`: talento preenche 1080x1920 (full).
- `split`: talento em cima (~46%, divisor BRANCO) + tela embaixo.
- `screen`: tela cheia + talento em PIP redondo (canto sup. direito, borda branca).

`CapCutSplitAlt` (split alternado, o padrao canonico da secao 1):
- `talk`: talento em tela cheia (gancho e fecho).
- `split` com `faceBottom: false`: rosto em cima (60%, maior) + b-roll embaixo.
- `split` com `faceBottom: true`: b-roll em cima + rosto embaixo; a legenda sobe para a
  faixa livre acima do rosto.
- `image` em cada bloco = screenshot real (arquivo em `remotion/public/`), com Ken Burns leve.

## Componentes
- `remotion/src/CapCutSplit.tsx` - composicao (talkingSrc, screenImage+altura,
  captions, layout, estilo da legenda). `ScreenImagePan` = pan deterministico da imagem.
- `remotion/src/CapCutSplitAlt.tsx` - split alternado (rosto maior, cima/baixo por bloco).
- `remotion/src/CaptionText.tsx` - legenda no estilo da marca (palavra a palavra ou por frase).
- `scripts/video-editor/build-captions.mjs` - WhisperX json -> paginas CapCut.
- `scripts/video-editor/capture-page-image.mjs` - screenshot full-page + anon + hide.
- `scripts/video-editor/run-editor.mjs` - orquestrador.
- `integrations/video-editor/` - venv uv (whisperx).

## Como diagnosticar "piscar" (checklist)
1. `ffmpeg -i out.mp4 -vf blackdetect=d=0.01:pic_th=0.95 -an -f null -` -> conta frames pretos.
2. Montagem: `ffmpeg -i out.mp4 -vf "select='between(t,A,B)',tile=6x6" -vsync 0 m.png` e OLHAR.
3. Se preto periodico -> video do talento mal normalizado (regra 2).
4. Se judder na tela -> usar imagem+pan, nao video de scroll (regra 3).
