# Viral Playbook

Lugar CANONICO das regras de gancho, retencao, estrutura e CTA do framework Content Team AI.

> **Algoritmo do Instagram tem canone proprio: `references/instagram-algoritmo.md`.**
> La moram os sinais de ranking por superficie, a politica de originalidade, o limite de
> hashtag, watch time, a lista de MITOS derrubados e a agenda do que ainda nao sabemos.
> Onde os dois falarem do mesmo assunto, **aquele arquivo manda**. Este aqui cuida de
> gancho, retencao, estrutura por formato e CTA, e vale pra todas as redes.

## Proposito

Consolidar, em um unico arquivo, o que vale pra QUALQUER cliente na hora de produzir conteudo social. Se uma regra aparece aqui e tambem num brand-profile, **este arquivo perde**: a regra de cliente sempre manda sobre a regra generica.

## Escopo: BR-only por design

Este playbook assume **mercado brasileiro**. Janelas de atencao, horarios, formato de CTA, compliance (LGPD/CDC), lingua e referencias culturais sao calibrados pra publico BR. Nao e um documento global e nao tenta ser neutro. Se um dia atender outro mercado, sera outro arquivo.

## Escopo: so o generico

Entra aqui: mecanica de plataforma, estrutura de formato, taxonomia de gancho, regras de CTA, proibicoes, QA.

NAO entra aqui (fica em `clients/{slug}/brand-profile.md` e `design-system.md`):
- voz, tom e bordoes de um cliente especifico
- hooks proprios de um cliente
- quantidade de hashtags, hashtags obrigatorias (com **um teto que o cliente nao pode furar: 5 no Instagram**, limite da plataforma desde 18/dez/2025; e a funcao da hashtag e BUSCA, nao alcance. Ver `references/instagram-algoritmo.md` secao 3. Padrao do framework: LinkedIn sem hashtag, salvo a marca definir outro no `brand-profile.md`, maximo 5)
- cores, fontes, tokens visuais
- horarios validados de uma conta especifica

## Como usar

- `ct-diretor` le antes de delegar producao.
- `ct-redator`, `ct-carrossel`, `ct-video*`, `ct-otimizador` leem antes de produzir.
- Ordem de precedencia: `brand-profile.md` do cliente > `design-system.md` > este playbook > references genericas.
- Antes de publicar, rodar a secao **QA**.

## Status de evidencia (legenda)

Toda regra abaixo carrega um status. Sem status = regra invalida, nao siga.

| Status | Significa | Como tratar |
|---|---|---|
| `[MEDIDO]` | Tem dado real de conta do cliente ativo, com numero e fonte | Confiar. Reavaliar quando o cockpit atualizar |
| `[MECANICA]` | Decorre de como a plataforma funciona, verificavel na propria UI/doc | Confiar. Revalidar se a plataforma mudar |
| `[HIPOTESE]` | Veio de fonte externa ou opiniao, sem validacao nossa | Tratar como a testar. Nao apresentar como verdade |

Regra dura: **se nao tem evidencia, marque `[HIPOTESE]`. Nunca invente numero.**

---

## 1. GANCHO

Aprendizados genericos de gancho e retencao (pauta quente, prova em ambiente real, teste de formato em janela fechada, reel atrai e nao vende): `references/aprendizados-de-producao.md` secao 3.

### Janela por plataforma

| Plataforma | Janela util | Status | Base |
|---|---|---|---|
| Reels / TikTok / Shorts | 0-3s de video; o frame 1 ja precisa comunicar | `[MECANICA]` | Autoplay em feed vertical: o scroll acontece antes de qualquer fala terminar |
| LinkedIn (post texto) | ~140 chars ou ~2 linhas antes do "ver mais" no mobile | `[MECANICA]` | O corte do "ver mais" e observavel no proprio app |
| Instagram feed (legenda) | 1a linha antes do "mais" | `[MECANICA]` | Mesmo corte de UI |
| Carrossel | Slide 1 e o gancho inteiro; nao existe slide 2 sem swipe | `[MECANICA]` | Swipe e acao deliberada do usuario |
| YouTube (longo) | Thumbnail + titulo decidem o clique; primeiros ~20s decidem a permanencia | `[MECANICA]` | CTR e retencao sao metricas separadas na propria plataforma |
| Twitter/X | 1o tweet isolado; o resto da thread so existe se ele parar o scroll | `[MECANICA]` | Thread so expande sob clique |

### O que sabemos que satura

- `[HIPOTESE]` **Narrativa de erro/falha tende a performar pior que case de entrega em publico tecnico B2B.** Case positivo com prova visual real (trabalho entregue) tende a bater serie de posts sobre erro ou auditoria. Validar com os dados do cliente (`ct-social-cockpit`): comparar mediana de alcance e likes dos dois tipos, com n por tipo.
- `[HIPOTESE]` **Post sobre produto proprio tende a performar pior que post sobre trabalho entregue.** O publico responde a trabalho entregue, nao a anuncio de produto. Validar com os dados do cliente.
- `[HIPOTESE]` "Voce sabia que...", "POV:", e formulas de hook importadas de infoprodutor performam mal em publico profissional adulto. Sem medicao nossa. A testar.

### PESSOA bate EMPRESA (hipotese comum em pesquisa de nicho, e ainda assim HIPOTESE)

`[HIPOTESE]` Em varios nichos B2B, contas de pessoas tendem a alcancar e engajar mais que contas de empresa do mesmo nicho. Validar com os dados do cliente e com a pesquisa de concorrentes do `ct-pesquisador`, sempre com mediana e n.

**Ressalvas, e elas importam:**

- `[HIPOTESE]` **Correlacao confundida.** "Pessoal" costuma vir junto com legenda curta, rosto na imagem, data comemorativa e base menor e mais engajada. Essas variaveis nao sao isoladas em pesquisa de concorrente.
- `[HIPOTESE]` **Contraexemplos existem:** conta-pessoa que opera como conta-empresa (mural de noticia, quase nenhum comentario) nao ganha da empresa. **O que ganha nao e o CPF, e a presenca de gente de verdade no conteudo.**
- Isto **nao** autoriza a regra "poste conteudo pessoal". Ver a taxonomia de gancho abaixo, que e mais especifica.

### Taxonomia de tipos de gancho

Use como cardapio, nao como script. O gancho precisa ser verdadeiro pro conteudo que vem depois.

| Tipo | Forma | Onde tende a caber | Status |
|---|---|---|---|
| **Resultado concreto** | Entrega + numero real ("X ficou pronto em N semanas") | Todas. Hipotese mais sustentada em pesquisa de nicho | `[HIPOTESE]` (validar no cockpit do cliente) |
| **Prova visual** | Abre no artefato real (trabalho entregue, tela, resultado), sem texto explicando | Reel, carrossel, feed | `[HIPOTESE]` (validar no cockpit do cliente) |
| **Contraste** | "Todo mundo fala de X. Ninguem fala de Y" | LinkedIn, X | `[HIPOTESE]` |
| **Custo aprendido** | Perda real com numero real ("perdemos R$ N. Aprendemos isso:") | LinkedIn, X | `[HIPOTESE]` |
| **Pergunta especifica** | Pergunta que so o publico-alvo entende | LinkedIn | `[HIPOTESE]` |
| **Numero enumerado** | "N coisas que mudam em [processo]" | Carrossel, Shorts | `[HIPOTESE]` |
| **Correcao** | "Se voce faz X, para" | Reel, TikTok | `[HIPOTESE]` |

Regra transversal `[MECANICA]`: o gancho tem que ser **cumprido** pelo corpo. Gancho que promete mais do que o conteudo entrega derruba retencao, e retencao e o que a plataforma mede.

### Mecanismo de abertura: resultado pronto bate curiosidade e processo

`[HIPOTESE]`, observada em analise de concorrentes de nichos de conhecimento aplicado a negocio: **abrir mostrando o resultado ja pronto e mais comum entre os posts que passam de 3x a mediana do proprio perfil do que entre os que nao passam.** Curiosidade pura como mecanismo nao teve o mesmo reforco. Validar com a pesquisa de concorrentes do cliente (`ct-pesquisador`) e com os posts dele no cockpit.

### Evidencia: mostrar bate argumentar

`[HIPOTESE]` Quem usa exemplo ou demonstracao real como prova (tela real, output real, numero real) tende a superar quem so argumenta ou raciocina. Regra pratica: tela real, output real, numero real na tela, nunca so explicar por que algo importa. Validar com os dados do cliente.

### O teste do envio (criterio de pauta, nao de redacao)

`[MECANICA]` **Send (compartilhamento em DM) e o sinal que empurra a peca pra quem NAO segue.** Mosseri, jan/2025: like pesa mais no conteudo servido a quem ja segue, send pesa mais no conteudo servido a nao seguidor. Nao ha peso numerico oficial, e nao se deve inventar um.

`[HIPOTESE]` Em muitas contas, os posts de maior share nao sao os de maior like, e o maior alcance absoluto pode vir de like em massa da rede proxima, sem share nem save. Validar com os dados do cliente (Graph API, `ct_metrics_snapshots`): hipotese forte, nao regra.

Pergunta de aprovacao de pauta, antes de escrever qualquer linha: **"alguem manda isso pra um colega especifico?"** Se a resposta honesta e nao, a pauta rende curtida da rede pessoal e nao rende publico novo. As duas coisas sao validas, mas sao objetivos diferentes e nao podem ser confundidas num indicador so.

### Originalidade tem vantagem declarada

`[MECANICA]` A Meta declara politica pro-originalidade: 75% das recomendacoes ja sao conteudo original (dado oficial de Q4/2025), conta que reposta material de terceiro 10+ vezes em 30 dias e desqualificada das recomendacoes, e conteudo identico ja publicado no IG so tem o original recomendado.

Consequencia editorial: **caso real, trabalho proprio e experiencia de primeira pessoa competem com vantagem estrutural.** Conteudo agregado ("resumo das novidades da semana", listicle de ferramenta compilado de terceiros) compete contra uma politica explicita.

---

## 2. RETENCAO E LOOP

### Estrutura de video curto

| Bloco | Funcao | Status |
|---|---|---|
| 0-1s | Frame que comunica sozinho. Assunto visivel, sem depender de audio | `[MECANICA]` |
| 1-3s | Promessa concreta: o que a pessoa leva se ficar | `[MECANICA]` |
| Corpo | Uma ideia por trecho. Cortes na troca de ideia, nao a cada N segundos | `[HIPOTESE]` |
| CTA | Um so, no fim (ver secao 4) | `[MECANICA]` |
| Loop | Fim reencontra o inicio, sem cauda morta | `[HIPOTESE]` |

### Watch time

- `[MECANICA]` **Instagram olha percentual assistido E segundos absolutos, ao mesmo tempo.** Declaracao de Mosseri (fev/2025): "nao queremos punir videos mais longos, por isso olhamos nao so o percentual assistido, mas tambem o numero de segundos". **Corrige a regra anterior deste arquivo**, que dizia "percentual assistido, nao segundos absolutos" e levava a encolher video artificialmente pra inflar conclusao. Nao estique conteudo pra encher tempo, e **nao encolha conteudo que tem substancia pra fabricar taxa de conclusao**: as duas coisas custam. O corte legitimo continua sendo silencio, pausa e cauda morta. Canone: `references/instagram-algoritmo.md` secao 4.
- `[MECANICA]` **Corte silencio e pausa.** Quando a fala acaba, o video acaba. Nada de cauda em silencio nem frame preto no fim. Fonte: `skills/ct-video-editor/SKILL.md`.
- `[HIPOTESE]` "Sweet spots" de duracao (21-34s, 30-45s etc.) circulam sem fonte primaria. Nao temos medicao propria. A testar via cockpit.

### Ritmo de corte (leitura visual)

`[HIPOTESE]`, observada em analise visual de reels de concorrentes de um nicho de conhecimento aplicado a negocio. Validar com os dados do cliente antes de virar regra.

- **Nao fragmentar o corte em troca de cena/plano a cada poucos segundos.** Edicao com corte rapido/nervoso aparece menos entre os posts acima de 3x a mediana do proprio perfil. Preferir plano mais estavel no corpo do video; o corte legitimo continua sendo so silencio, pausa e cauda morta (`skills/ct-video-editor/SKILL.md`), nunca corte a cada N segundos pra "criar dinamismo".
- **Abrir os 0-3s olhando direto pra camera.** Contato visual direto no gancho e mais comum entre os posts acima da mediana. Nao desviar o olhar nem cortar pra outro plano antes do gancho terminar.
- **Capa com rosto ajuda um pouco, mas nao e garantia sozinha.** O julgamento de "capa eficaz" isolado (composicao, contraste, legibilidade) nao discrimina. Nao investir em capa "bonita" como substituto de conteudo forte.
- **Prova visual no quadro e CTA visivel/falado, lidos so pela montagem do video, nao discriminam com forca**, o que contradiz parcialmente os achados de "exemplo como prova" e "CTA ausente" lidos por transcricao (secoes 1 e 4). Duas leituras registradas, nenhuma apagada: possivel que o que importa seja o CONTEUDO falado, nao a MONTAGEM visual isolada.

### Texto na tela

- `[MECANICA]` Legenda queimada e requisito de acessibilidade e de consumo em ambiente sem som. Nao depende de estatistica pra se justificar.
- `[HIPOTESE]` O numero "80% assistem sem som" circula amplamente **sem fonte primaria verificavel**. Nao usar como argumento. A regra de legenda se sustenta pela mecanica acima.
- `[MECANICA]` **Timing de legenda vem de transcricao real do audio (WhisperX), nunca de estimativa manual.** Legenda dessincronizada e pior que legenda ausente. Fonte: `skills/ct-video-editor/SKILL.md`.
- `[MECANICA]` **Nada cobre o rosto ou a boca do talento.** Legenda, b-roll, divisor e overlay ficam na zona livre. Quando o rosto esta na faixa de baixo, a legenda vai acima dele. Mesma fonte.
- `[HIPOTESE]` Texto na tela aparece em praticamente todos os posts de video de nichos maduros, acima e abaixo da mediana. Virou piso, nao diferencial: nao usar como argumento de vantagem competitiva, so como requisito minimo.

---

## 3. ESTRUTURA POR FORMATO

### Reel / Short / TikTok
Gancho visual (0-3s), promessa, uma ideia por trecho, CTA unico, loop. Legenda queimada obrigatoria. Capa obrigatoria. `[MECANICA]`

`[HIPOTESE]`, observada em analise de concorrentes: formato de captura (fala direto pra camera, split tela-dividida, bastidor filmado, tela/print, texto puro na tela) **nao discrimina desempenho** (distribuicao quase identica acima/abaixo da mediana). Escolher formato pelo que a pauta pede, nunca por "formato que converte mais". Conta especifica pode ter formato dominante: isso e leitura da CONTA, nao do nicho. Medir no cockpit do cliente antes de mudar o default, sem generalizar pra outro cliente.

**Estrutura "problema, depois solucao" pura nao discrimina desempenho.** `[HIPOTESE]`, observada em analise de concorrentes: em algumas coletas ela aparece mais entre posts abaixo da mediana do proprio perfil, em outras empata com os acima. Contradicao registrada, nao apagada. Recomendacao pratica: **nao proibir problema-solucao como estrutura, so preferir abrir no resultado (ver secao 1) quando o roteiro permitir**, e reservar problema-solucao puro pros casos em que a "solucao" e um caso ou produto NOMEADO especifico, nunca conselho generico.

### Story
Sequencia curta com funcao por tela: abertura, contexto, valor, fechamento (pergunta ou caixinha, nunca oferta nos 4 tipos de story). Recursos interativos (enquete, caixinha) existem como mecanica nativa de resposta; se ajudam alcance e `[HIPOTESE]`. `[MECANICA]`

### Carrossel
Fonte canonica: **`references/carousel-design-system.md`**. Ele manda.

- Arco padrao de 7 slides (5-10 aceitos): Hero, Problema, Solucao, Features, Detalhes, Como funciona, CTA.
- Cada slide leva **tag de categoria acima do heading**, e **tem heading**. `[MECANICA]`
- Alternancia claro/escuro pra ritmo visual.
- Ultimo slide: sem seta, progress bar em 100%, CTA claro.
- A antiga regra "nenhum slide com titulo" esta **obsoleta**. Nao seguir.
- `[HIPOTESE]`, observada em analise de concorrentes: carrosseis de melhor desempenho tendem a ter 7 a 8 slides, com uma ideia aplicavel. O arco padrao de 7 slides acima ja bate com isso.

### Post LinkedIn
Gancho nos primeiros ~140 chars, corpo com paragrafos curtos e espacamento generoso, fecho com pergunta especifica so quando nascer natural do texto (senao, afirmacao firme). `[MECANICA]` na janela dos 140; o resto e convencao de legibilidade.

- `[MECANICA]` Limite duro de 3.000 chars (perfil pessoal e company page normal).
- `[HIPOTESE]` Faixas de tamanho "ideal" (1.500-2.000 pra valor denso, 2.700-2.900 pra long-form tecnico) vem de fontes externas (socialrails, powerin, authoredup, typecount). Nao validado por nos.
- `[MECANICA]` Link de destino no corpo do post gera preview automatico. Onde colocar o link e decisao de cliente, nao regra global.

### Thread (X)
Tweet 1 e o produto inteiro do ponto de vista do algoritmo: precisa fechar sentido sozinho. Uma ideia completa por tweet. Fecho com sintese. `[MECANICA]`

---

## 4. CTA POR REDE

| Rede | CTA valido | Status |
|---|---|---|
| Instagram | "comenta PALAVRA", salvar, compartilhar em DM | `[MECANICA]` (todos sao acoes nativas da UI) |
| TikTok | "link na bio" + comentario fixado, salvar. Sem "comenta PALAVRA": nao ha resposta automatica | `[MECANICA]` |
| YouTube Shorts | "comenta PALAVRA" so com o respondedor (yt-comment-responder) ligado, inscrever | `[MECANICA]` |
| **LinkedIn** | **Pergunta especifica so quando natural, ou convite direto pro direct.** "Comenta PALAVRA" NAO se usa aqui | `[MECANICA]` |
| YouTube (long-form) | Inscrever, proximo video, comentar pergunta especifica | `[MECANICA]` |
| X | Responder, seguir | `[MECANICA]` |
| Blog | Uma acao primaria por pagina | `[MECANICA]` |

Regras duras:

1. **`comenta "PALAVRA"` e exclusivo de Instagram e YouTube (video e Shorts)** (as unicas redes com resposta automatica suportada pelo kit). **TikTok nao**: troca so essa frase por "link na bio" + comentario fixado. **No LinkedIn NUNCA**: fecha com pergunta especifica ao publico, so se nascer natural ("e voce, como resolve isso hoje?"), ou convite direto pra chamar no direct. O motivo e mecanico, nao de estilo: o CTA de palavra-chave depende de automacao de DM que o LinkedIn nao tem, entao la ele so confunde o leitor e le como engagement bait.
2. **CTA unico.** Uma peca, uma acao. Duas CTAs competem e as duas perdem. `[HIPOTESE]` quanto ao efeito medido, `[MECANICA]` quanto a clareza.
3. CTA de captura por palavra so existe se a automacao de resposta existir de fato. CTA que nao responde queima confianca.
4. **Fechar com pergunta e o default em toda rede.** `[HIPOTESE]` Metricool, N=24,3M posts: pergunta na legenda vem junto de **+36,7% de comentarios**, e CTA focado em comentario de **+202,8%**. E correlacao de terceiro, em base enviesada pra conta de marca: **autoriza mudar o default de escrita, nao autoriza citar o numero como promessa.** No LinkedIn a pergunta so entra quando nasce natural do texto; no IG e TikTok ela passa a conviver com o CTA de acao, sem competir (a pergunta fecha o texto, o CTA de acao e o unico pedido explicito). E a pergunta tem que ser especifica e respondivel por quem leu: pergunta generica ("concorda?") e o pedido vazio que a politica de engagement bait pega.

### A isca "comenta PALAVRA" e DIVIDA, nao tatica

`[HIPOTESE]` Em pesquisa de concorrentes, a conclusao "o nicho vive de isca, entao copiar a isca" costuma ser **artefato da lista de concorrentes**, nao do nicho: se a lista inicial e cheia de contas de isca, toda pesquisa que parte dela herda a conclusao. Descoberta feita sem a lista inicial tende a mostrar contas de alto alcance com pouca ou nenhuma isca.

`[MECANICA]` **Isca nao e requisito de alcance: e requisito de captura.** Ela so funciona se a automacao de resposta existir de fato (regra 3 acima).

`[MECANICA]` **Usar isca sem a automacao de resposta e divida a pagar, nao estrategia a copiar.** Ou a automacao existe, ou a isca sai.

### Ausencia de CTA correlaciona com desempenho abaixo

`[HIPOTESE]`, observada em analise de concorrentes: nao ter CTA nenhum e mais comum entre os posts abaixo de 3x a mediana do proprio perfil do que entre os acima. CTA de comentario e CTA de seguir sao mais comuns entre os acima. **Nao contraria a regra de CTA unico** (secao 4 acima, que e sobre o que PUBLICAR): o achado e sobre TER ou nao ter CTA, nao sobre quantos. Justifica priorizar o teste de CTA de comentario, sempre com a palavra cadastrada na automacao (ver regra 3).

---

## 5. PROIBICOES

### Gatilhos antieticos (nunca, em nenhum cliente)
- Escassez ou urgencia falsa: contador que reseta, "ultimas vagas" perpetuas, prazo que nunca vence.
- Prova social inventada: depoimento fabricado, screenshot editado, "milhares de clientes" sem numero verificavel.
- Autoridade falsa: titulo inventado, resultado de terceiro apresentado como proprio.
- Medo exagerado: consequencia catastrofica inventada pra forcar acao.
- Manipulacao emocional extrema: explorar tragedia, criar culpa, ameaca velada.

Escassez, urgencia, prova social e autoridade **sao permitidos quando reais e verificaveis**, com o numero exato e o motivo da limitacao explicito.

### Compliance BR
- **LGPD:** consentimento explicito pra email, descadastro visivel, sem compra de lista, sem repasse de dado sem autorizacao.
- **CDC:** publicidade paga identificada (#publi/#ad), sem promessa impossivel, sem antes/depois enganoso, direito de arrependimento de 7 dias em compra online, cancelamento sem friccao artificial.
- **Setores regulados:** saude (nao substitui consulta medica, sem promessa de cura, produto com registro Anvisa), financas (rentabilidade passada nao garante retorno futuro), educacao (resultado depende de esforco individual, sem promessa de emprego ou salario).

### Auto-referencia (proibicao editorial)
- **`"nao e a ferramenta, e o metodo"` e variantes sao PROIBIDOS** em post, legenda, roteiro de reel e qualquer peca de conteudo. Virou muleta.
  - Principio: **mostrar o metodo, nao anunciar que tem metodo.** Se o conteudo precisa avisar que tem profundidade, ele nao tem.
  - Excecao de posicionamento: a frase de posicionamento que a propria marca definiu no `brand-profile.md` e **permitida em BIO/perfil do Instagram e headline do LinkedIn**, dita 1x. Ali e posicionamento, nao conteudo.
  - No YouTube: evitar como posicionamento central.
- Nao anunciar o proprio conteudo dentro do conteudo ("nesse post voce vai aprender", "presta atencao que isso e importante"). Entregue.
- Nao explicar o formato ("fiz esse carrossel porque..."). O leitor nao se importa.

### Pontuacao
- Proibido travessao e traco longo em qualquer texto do framework. Usar virgula, ponto, parenteses ou dois-pontos. Regra do framework.

---

## 6. QA (antes de publicar)

**Conteudo**
- [ ] O gancho cabe na janela da plataforma (ver secao 1)?
- [ ] O corpo cumpre o que o gancho prometeu?
- [ ] Todo numero citado e real e rastreavel? Nenhum foi estimado?
- [ ] Uma CTA unica, correta pra rede (secao 4)?
- [ ] Nenhum gatilho da secao 5? Nenhuma auto-referencia? Nenhum bordao proibido?
- [ ] Compliance do setor atendido (disclaimer, #publi se pago)?
- [ ] Zero travessao ou traco longo no texto?
- [ ] O texto e para o SEGUIDOR, sem linguagem de processo da producao ("versao", "ajustei", "conforme o briefing", "fonte", mencao a agente ou pesquisa)? (`references/aprendizados-de-producao.md` secao 2)

**Cliente**
- [ ] `clients/active-client.md` conferido e o brand-profile carregado?
- [ ] Voz, hashtags e tokens visuais vieram do cliente (nao deste arquivo)?
- [ ] **No maximo 5 hashtags no Instagram**, especificas ao tema (limite da plataforma, nao preferencia)? **Sem hashtag no LinkedIn por padrao** (maximo 5 se a marca usa)?
- [ ] **Nenhuma marca d'agua de outra rede** no arquivo publicado (unica penalidade de edicao confirmada)?
- [ ] A peca passa no teste do envio ("alguem manda isso pra um colega?") ou esta declarado que ela busca outro objetivo?

**Video (adicional)**
- [ ] Legenda com timing de transcricao real, nao estimado?
- [ ] Nenhum overlay, b-roll ou divisor cobre rosto ou boca?
- [ ] Silencio e pausa cortados? Nao termina em preto nem em cauda muda?
- [ ] Capa presente e verificada?
- [ ] **QA frame-a-frame feito com os olhos**, nao presumido?

---

## 7. AVISOS METODOLOGICOS PERMANENTES (nao sao lacunas, sao armadilhas ja conhecidas)

Armadilhas conhecidas de pesquisa de concorrente e de dado social. Nao sao teoria: cada uma ja produziu conclusao errada.

### 7.1 MEDIANA sempre. Media so com a mediana ao lado

`[MECANICA]` **Media mente em dado social, e mente por construcao:** a distribuicao tem cauda longa e um viral carrega a conta inteira. Em nichos de conhecimento, a media de engajamento de reels pode ser muitas vezes a mediana.

`[MECANICA]` Quem olhar a media do nicho vai achar que ele engaja muito mais do que engaja. **O nicho e loteria de outlier, nao processo estavel. Copiar "o que os campeoes fazem" e copiar bilhete premiado, nao metodo.**

Regra dura: **rankear por mediana. Nunca publicar media sozinha.** E **separar post fixado do recente sempre**: fixado e vitrine escolhida pelo dono, com centenas de dias, nao vencedor recente.

### 7.2 "ER%" sobre seguidores NAO e taxa de engajamento. O nome esta PROIBIDO

`[MECANICA]` Curtida e view **nao sao limitadas por seguidor**: o post e entregue pra quem nao segue. Dividir interacao por seguidor produz numeros como 322% ou 90%. Um post nao pode ter 322% da audiencia engajando.

O que esse numero e, de verdade: um **proxy contaminado de alcance**, ou um **indice de o quanto o algoritmo empurra a conta pra fora da base**. Serve pra comparar contas entre si. **Nunca serve como metrica de saude, e nunca deve ser apresentado ao cliente ou em conteudo como "taxa de engajamento".**

Vale igual pra `views/seguidores`. Views de reel sao proxy de alcance **melhor** que curtida (sobrevivem a curtida oculta), mas tambem nao sao limitadas por seguidor.

### 7.3 Lista velha vira vies. Descoberta comeca SEM a lista

`[HIPOTESE]` Ver a secao 4 (isca como divida) e `agents/ct-pesquisador.md`. Se a pesquisa comeca pelo `competitors.md`, ela so reencontra o `competitors.md`, e herda todo erro que ele tem. Listas de concorrentes envelhecem rapido: handles errados, mortos ou irrelevantes entram sem ninguem perceber. Reescrever a lista a partir de uma descoberta feita SEM ela.

### 7.4 O que nao vemos, de ninguem

`[MECANICA]` Nao temos alcance, retencao, salvamento nem compartilhamento de **nenhum** concorrente, e nunca teremos por fora. `[HIPOTESE]` Pra conteudo tecnico, util e guardavel, **salvamento e provavelmente o sinal que mais importa, e e exatamente o que nao vemos.** Um carrossel de 15 curtidas e 300 salvamentos e invisivel em todo dataset de concorrente e pode ser o melhor post do nicho.

---

## 8. Lacunas conhecidas / a validar

Para ler metricas e medir o proprio sistema (amostra pequena, correlacao nao e causa, peca derivada com origem): `references/aprendizados-de-producao.md` secao 9.

Tudo abaixo esta hoje em `[HIPOTESE]` e precisa de dado real do `ct-social-cockpit` (`skills/ct-social-cockpit/`) e do `ct-social-intel` (`skills/ct-social-intel/`, heatmap 7x24 do historico real em `ct_metrics_snapshots`).

| # | Hipotese aberta | Como validar |
|---|---|---|
| 1 | Duracao ideal de reel/short (as faixas "21-34s", "30-45s" nao tem fonte nossa). Coletas em concorrente oscilam entre achar e nao achar diferenca de duracao entre acima e abaixo da mediana: sinal fraco, nao promovido a regra | Cruzar duracao x retencao dos reels ja publicados no cockpit |
| 2 | "80% assistem sem som" nao tem fonte primaria | Nao validavel por nos. Manter a regra de legenda pela mecanica, e aposentar a estatistica |
| 3 | Qual tipo de gancho da taxonomia (secao 1) realmente performa alem de "resultado concreto" e "prova visual" | Taggear gancho por post em `ct_content_items` e cruzar com metricas |
| 4 | Faixas de tamanho de post LinkedIn (1.500-2.000 / 2.700-2.900) | Cruzar char count x impressao/comentario via `ct-linkedin-analyzer` |
| 5 | Horarios de publicacao ideais por rede | Ja e o proposito do `ct-social-intel` (heatmap dia x hora). Substituir qualquer horario chutado pelo computado |
| 6 | Se CTA unica realmente bate CTA dupla | A/B ao longo de N posts, medir acao primaria |
| 7 | Se "narrativa de erro performa mal" generaliza pra outros clientes/publicos | Testar em cada cliente. Um dado de uma conta nao vale pra outra |
| 8 | Efeito de enquete/caixinha no alcance de Story | Costuma estar aberta por falta de PRATICA, nao de instrumentacao: se a conta nunca usou caixinha, nao ha o que medir. Ver `references/stories-playbook.md` |
| 9 | O Instagram e o canal certo pro nicho do cliente? | `[HIPOTESE]` Em alguns nichos de conhecimento aplicado a negocio, as maiores referencias de metodo vivem no YouTube ou em newsletter, nao no IG. **E pergunta de canal, nao de peca.** Validar com a pesquisa de concorrentes do cliente |

### Estado do `[MEDIDO]` no framework

Este kit nao traz nenhum dado `[MEDIDO]`: cada cliente gera o proprio, via Graph API e `ct-social-cockpit`, com n ao lado. Ate la, toda regra baseada em desempenho neste playbook e `[HIPOTESE]`.

`[MECANICA]` Nota tecnica: **`impressions` foi removida da Media Insights API** ("does not support the impressions metric for this media product type"). Qualquer regra ou codigo que ainda peca `impressions` esta pedindo erro em silencio. Usar `views`.

Ainda assim: **quase todo o resto deste playbook e mecanica de plataforma e hipotese honesta.** Leia assim, e nao promova hipotese a regra so porque uma fonte externa afirmou com confianca.
