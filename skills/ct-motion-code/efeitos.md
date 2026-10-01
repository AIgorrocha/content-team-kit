# Catalogo de efeitos (ct-motion-code)

Catalogo de 16 efeitos de motion graphics descritos EM PALAVRAS NOSSAS, com a
mecanica recriada em cima do `engine/motion.js` (spring fechada, `track`,
`stretchIndicator`, `swapAlpha`, `loopT`).

Cada efeito serve de PONTO DE PARTIDA pra pedir uma cena ao `ct-motion-code`:
descrever qual efeito (ou combinacao de 2-3) mais se encaixa na peca, e o
agente monta a cena usando as primitivas do motor com os tokens do cliente
ativo.

Origem: as 16 ideias foram inspiradas em kit de motion de terceiro (Opus Motion Graphics, de Charlie
Hills); a descricao e a mecanica aqui sao recriadas em codigo proprio, sem copiar o original. Se a
peca partir do codigo de um kit de terceiro, vale a regra dura 0 da `SKILL.md` (adaptar o original e
creditar o autor). Catalogo completo de tecnicas (composicoes Remotion, edicao, ferramentas externas e
o que ficou de fora): `catalogo-tecnicas.md`.

**Regra dura:** numero em cena de TESTE ou
DEMO e sempre marcado como exemplo/ilustrativo (rotulo "EXEMPLO" ou
"ILUSTRATIVO" visivel). Em peca real pro cliente, so numero verdadeiro com
fonte na mao. Nunca inventar metrica de negocio pra parecer resultado real.

## Interfaces (mostrar o produto fazendo algo)

### 1. Botao -> player
Um botao pequeno (ex: "Preview") cresce e vira um player de video/audio com
barra de progresso. **Quando usar:** capa de reel ou card de "assista a
demo" em landing page/email de lancamento. **Duracao tipica:** 2-3s dentro
de uma peca maior, ou 4-6s em loop isolado. **Como pedir:** `track()` no
`x/y/largura/altura` do container (mola `heavy`, cresce sem overshoot) +
`stretchIndicator` na barra de progresso que enche depois que o player abre.

### 2. Busca -> resultados
Um campo de busca "digita" um termo (revelado caractere a caractere em
funcao de `t`, nunca por timer) e os resultados empilham um a um. **Quando
usar:** mostrar o que aparece ao buscar no centro de ajuda ou biblioteca de
conteudo. **Duracao tipica:** 3-4s. **Como pedir:** `track()` no indice de
caracteres revelados do texto da busca; `track()` no `y` de cada resultado
com preset `fast` e disparo escalonado (~120ms entre um e outro).

### 3. Card -> workspace
Um card pequeno se expande e vira a tela cheia de trabalho. **Quando usar:**
anunciar uma feature nova, "isso pequeno vira aquilo grande". **Duracao
tipica:** 3-4s. **Como pedir:** `track()` em `x/y/largura/altura` do card
(mola `heavy`) ate ocupar o frame; conteudo interno do workspace entra
depois, via `swapAlpha`, so quando o card ja abriu (nunca simultaneo).

### 4. Abas -> paineis
Varias abas, o indicador troca de aba e o painel de conteudo muda junto.
**Quando usar:** comparar planos, pacotes ou canais sem parede de texto.
**Duracao tipica:** 2-3s por troca de aba. **Como pedir:**
`stretchIndicator` embaixo/atras da aba ativa (`leading: fast`,
`trailing: standard` = o indicador estica ao mudar de aba antes de
assentar); `swapAlpha` no conteudo do painel.

## Dado e lista (fazer um numero aterrissar)

### 5. Grafico morfando
Um conjunto de barras vira uma linha (ou o inverso). **Quando usar:** um
resultado semanal num relatorio de cliente ou post de resultado. **Duracao
tipica:** 2-3s. **Como pedir:** `track()` na altura de cada barra E, em
paralelo, na posicao Y do ponto de linha correspondente; crossfade
barra->linha com `swapAlpha` centrado no meio da transicao.

### 6. Zoom no dashboard
Um numero (KPI) especifico "sai" de dentro de um dashboard cheio de cards e
ocupa o frame sozinho. **Quando usar:** puxar o UNICO KPI que importa do
dashboard mensal. **Duracao tipica:** 2s. **Como pedir:** `track()` em
`scale + translate` do card do KPI (mola `heavy`, sem overshoot no numero
grande); o resto do dashboard sai com `swapAlpha` (`outAlpha`).

## Cards e ferramentas

### 7. Pilha com mola
Cards empilhados se espalham em leque e assentam no lugar. **Quando usar:**
3 ofertas, cases ou depoimentos, um de cada vez. **Duracao tipica:** 3s.
**Como pedir:** `track()` em `rotacao + x + y` de cada card com preset
`playful` (unico lugar do catalogo onde overshoot visivel é intencional) e
disparo escalonado por card (~150-200ms).

### 8. Dock magnetico
Um dock com icones que crescem conforme um "cursor" passa perto (o cursor
tambem e funcao de `t`, nunca input real, pra manter `seek(t)` puro).
**Quando usar:** mostrar as ferramentas do stack ou as integracoes do
produto. **Duracao tipica:** 3-4s, boa pra loop. **Como pedir:** `track()`
no `scale` de cada icone com alvo recalculado a cada instante a partir da
distancia entre a posicao do cursor-fantasma (percorrendo o dock em funcao
de `t`) e o icone.

## Tipografia

### 9. Tipografia mascarada
Uma palavra em contorno se preenche de baixo pra cima, como um liquido
subindo dentro das letras. **Quando usar:** revelar o nome de uma campanha,
edicao de newsletter ou titulo de lancamento. **Duracao tipica:** 1.5-2s.
**Como pedir:** um retangulo de recorte (`clip`) cuja altura sobe via
`track()` (mola `heavy`: zero overshoot em tipografia, regra dura do
motor).

### 10. Tipografia elastica
Cada letra de uma palavra estica (escala horizontal) na mesma linha de
base, uma de cada vez. **Quando usar:** abrir um evento, webinar ou
episodio com um titulo em movimento. **Duracao tipica:** 1.5-2s. **Como
pedir:** `track()` por letra no eixo de escala X, com `t` de disparo
escalonado (~40-60ms entre letras) e preset `fast` (leve overshoot, ainda
assim contido: a regra de zero overshoot vale pro CONJUNTO da palavra
assentando, nao proibe uma esticada rapida letra a letra).

### 11. Texto -> layout
Uma linha de titulo se reorganiza e vira uma pagina completa de artigo.
**Quando usar:** virar manchete de blog em capa de carrossel ou teaser de
artigo. **Duracao tipica:** 2-3s. **Como pedir:** `track()` na
posicao/tamanho do bloco de texto original ate a posicao final de headline
da pagina; corpo e imagem do layout entram depois via `swapAlpha`.

## Imagem e profundidade

### 12. Revelacao de imagem
Tarjas escuras deslizam e revelam uma imagem por baixo. **Quando usar:**
teaser de lancamento de produto (SEMPRE com foto real do cliente por baixo,
nunca gerada/reimaginada). **Duracao tipica:** 1.5-2s. **Como pedir:**
`track()` na posicao de N tarjas saindo em sequencia com disparo escalonado,
sobre um asset real coletado do cliente (ver regra "so UI/tela real" no
`SKILL.md`).

### 13. Mudanca de perspectiva
As camadas planas de uma pagina se separam em profundidade (tipo exploded
view). **Quando usar:** explicar as camadas de um servico, sistema ou stack
tecnico. **Duracao tipica:** 3s. **Como pedir:** `track()` em
`translateY + scale + opacity` de cada camada com `t` de disparo escalonado;
uma leve inclinacao (skew 2D) sugere profundidade sem exigir WebGL/3D real.

### 14. Foco em vidro
Uma lente desliza por uma tabela ou relatorio, e cada linha fica em foco ao
ser tocada pela lente. **Quando usar:** guiar o olho pra UMA linha
especifica de um relatorio ou tabela de precos. **Duracao tipica:** 3-4s.
**Como pedir:** `track()` na posicao Y da lente; nitidez simulada por
contraste/peso da fonte da linha sob o foco (canvas 2D nao tem blur
gaussiano barato por linha; simular com opacidade/peso tipografico das
linhas fora de foco, nunca com filtro CSS).

## Fluxo e marca

### 15. Fluxo de caminhos
Pulsos percorrem linhas que ligam um ponto de origem (ex: "Pauta") a varios
canais de destino e um ponto de chegada (ex: "Relatorio"). **Quando usar:**
mostrar 1 peca de conteudo alimentando varios canais, ou um funil simples.
**Duracao tipica:** 3-4s, boa pra loop. **Como pedir:** `loopT()` pro ciclo
de cada pulso; `track()` na posicao do pulso interpolando linearmente entre
os pontos de controle do caminho (sem precisar de curva Bezier pro nivel 1).

### 16. Logo de particulas
Pontos espalhados pela tela voam e se organizam formando a marca do
cliente. **Quando usar:** fechar um video, reel ou post de lancamento com a
marca. **Duracao tipica:** 2s. **Como pedir:** `track()` por particula
(posicao final = um pixel/ponto do logo real do cliente, posicao inicial =
ponto espalhado gerado com `Motion.mulberry32`, nunca `Math.random`); todas
convergem com a mesma mola, mas com `t` de disparo levemente escalonado
(tambem via rng com semente) pra nao parecer sincronizado demais.

## Como combinar

Uma peca real raramente usa 1 efeito isolado: normalmente e 2-3 em
sequencia (ex: **9. Mascarada** revela o titulo -> **7. Pilha com mola**
mostra os pontos -> **16. Particulas** fecha com a marca), respeitando a
regra dura de "algo novo a cada 2-4s" do `SKILL.md`. Escolher pelo OBJETIVO
da peca (abrir, provar com dado, comparar, fechar), nao pela novidade do
efeito.
