# Instagram Stories: Algoritmo e Distribuicao

Pesquisa cetica sobre o que REALMENTE faz Story engajar e ser distribuido, aplicada a contas B2B pequenas (ex.: perfil pessoal de consultor, empresa B2B de servico tecnico). Handles reais: ver `clients/{slug}/brand-profile.md`.

Pesquisa realizada em 15/jul/2026. Padrao de evidencia herdado de `references/viral-playbook.md`.

## Status de evidencia (legenda)

| Status | Significa | Como tratar |
|---|---|---|
| `[MEDIDO]` | Dado real de conta do cliente ativo | **Nao existe nenhum neste arquivo.** Nao temos dado proprio de Story ainda |
| `[MECANICA]` | Decorre de como a plataforma funciona, verificavel na UI ou na doc oficial da Meta | Confiar. Revalidar se a plataforma mudar |
| `[HIPOTESE]` | Fonte externa, benchmark de terceiro ou opiniao | A testar. Nunca apresentar como verdade nossa |

Aviso duro: **este arquivo inteiro e `[MECANICA]` ou `[HIPOTESE]`.** Zero `[MEDIDO]`. Todo numero aqui e de terceiro, com fonte, data e N declarados. A secao 8 (LACUNAS) e o que transforma isso em conhecimento nosso.

---

## 1. Resumo executivo: as 5 coisas que mais importam

1. **`[MECANICA]` Story nao e canal de alcance, e canal de profundidade.** Mosseri, jan/2025: Stories sao "designed to connect people with their friends", e "posting to Feed is going to be the best way to reach as many people as possible". Story serve pra atingir o publico mais fiel com bastidor e conteudo do momento. Consequencia direta pra conta B2B pequena: **parar de medir Story por alcance.** Ele nao vai crescer conta.

2. **`[MECANICA]` O ranking de Story e de RELACIONAMENTO, nao de conteudo.** Doc oficial da Meta (`about.instagram.com`, mai/2023) lista tres sinais: viewing history, engagement history, closeness. Todos os tres sao propriedades do PAR (voce, seguidor), nao da tela que voce postou. Um Story otimo nao te leva pra frente da barra de quem nunca te ve.

3. **`[MECANICA]` Watch time nao e sinal em Story.** Mosseri (jan/2025) diz que os sinais mais importantes sao a probabilidade de a pessoa **tocar** no Story, **curtir** e **responder por DM**. Isso e o oposto de Reels (onde watch time manda). Consequencia: **prender a pessoa 15s numa tela nao compra distribuicao. Provocar uma resposta compra.**

4. **`[MECANICA]` A metrica que importa pra conta B2B pequena e o REPLY em DM.** E o unico sinal citado por Mosseri que (a) alimenta o ranking, (b) alimenta closeness pra proxima vez, e (c) e literalmente uma conversa comercial iniciada. Pra conta B2B pequena, Story bom = DM recebido, nao view.

5. **`[HIPOTESE]` Sequencia curta retem muito mais que sequencia longa, e a queda e brutal nas 3 primeiras telas.** Rival IQ (2024, N=125k+ Stories / 539k+ frames / 1.470 contas): completion 75% com 1-3 frames vs 50% com 7+. Socialinsider (2025, N=161.180 Stories): exit rate de **23,8% ja na primeira tela**. Nenhum dos dois e dado nosso. Testar antes de virar regra.

---

## 2. Como o ranking de Story funciona (mecanica)

### 2.1 O funil

`[MECANICA]` Segundo a doc oficial da Meta (Instagram Ranking Explained, publicado 31/mai/2023):

1. **Candidatos:** so entram Stories de contas que voce **segue**. Story nao tem superficie de descoberta pra nao seguidor (diferente de Reels e Explore).
2. **Filtro:** remove o que viola Community Standards.
3. **Ranking:** ordena a barra do topo com base em tres sinais.

Implicacao dura `[MECANICA]`: **Story so fala com quem ja te segue.** Otimizar Story pra "viralizar" e um erro de categoria. O teto de alcance de Story e o numero de seguidores, e na pratica uma fracao dele.

### 2.2 Os tres sinais oficiais

Citacao literal da doc da Meta:

| Sinal | O que a Meta diz | Traducao operacional |
|---|---|---|
| **Viewing history** | "how often you view an account's stories so we can prioritize the stories from accounts we think you don't want to miss" | Habito. Quem te ve sempre continua te vendo. Constancia constroi posicao |
| **Engagement history** | "how often you engage with that account's stories, such as sending a like or a DM" | Historico de acao, nao de view passivo |
| **Closeness** | "your relationship with the author overall and how likely you are to be connected as friends or family" | Proximidade geral (DMs trocadas, conexao social), nao so Story |

### 2.3 As tres predicoes

`[MECANICA]` A doc diz que a Meta prediz "how likely you are to **tap into a story**, **reply to a story** or **move on to the next story**".

Leitura literal: **tap-in e reply sao predicoes positivas. "Move on to the next story" (tap-forward) e a predicao que o sistema quer EVITAR.** Ou seja, a propria doc trata tap-forward como sinal negativo.

`[MECANICA]` Mosseri, jan/2025, reafirma e refina com o vocabulario de acao: os sinais mais importantes sao probabilidade de **tap**, **like** e **reply com mensagem**.

**Watch time nao aparece em nenhuma das duas fontes primarias.** Isso e o achado mais acionavel deste documento.

### 2.4 Recencia

`[HIPOTESE]` Varias fontes secundarias (Hootsuite, Later, Buffer, 2026) afirmam que "Stories prioriza recencia + viewing history". **A doc oficial da Meta nao menciona recencia como fator de ranking de Story.** A recencia existe como mecanica obvia (Story dura 24h e some), mas "recencia pesa no ranking da barra" e afirmacao de terceiro. Nao adotar como regra.

---

## 3. Sinais de engajamento por peso, com evidencia

Ordenado pelo que as fontes primarias sustentam.

| Sinal | Efeito na distribuicao | Status | Fonte |
|---|---|---|---|
| **Reply em DM** | Positivo forte. Citado por Mosseri e pela doc. Alimenta engagement history E closeness pra proxima vez (efeito composto) | `[MECANICA]` | Meta ranking doc (2023); Mosseri (jan/2025) |
| **Tap-in (abrir seu Story a partir da barra)** | Positivo. Primeira predicao citada | `[MECANICA]` | Meta ranking doc; Mosseri (jan/2025) |
| **Like no Story** | Positivo. Citado explicitamente por Mosseri em jan/2025 e pela doc ("sending a like") | `[MECANICA]` | Mesmas |
| **Tap-forward (pular pra proxima tela)** | Negativo. E a predicao "move on to the next story" que o sistema tenta evitar | `[MECANICA]` (que e sinal considerado) + `[HIPOTESE]` (o quanto pesa) | Meta ranking doc |
| **Exit (sair da barra inteira)** | Presumivelmente o pior sinal, mas **a Meta nao cita exit em lugar nenhum** da doc de ranking de Story. Aparece so como metrica no Insights | `[HIPOTESE]` | Inferencia. Nao confirmado |
| **Tap-back (voltar uma tela)** | **Nao citado por nenhuma fonte primaria.** A tese "tap-back e sinal positivo" e 100% de terceiro | `[HIPOTESE]` | HypeAuditor/joinotto e similares, sem N. Ver secao 6 |
| **Watch time / tempo na tela** | **Nao e sinal.** Ausente da doc e explicitamente fora do trio citado por Mosseri | `[MECANICA]` (por ausencia nas primarias) | Meta ranking doc; Mosseri (jan/2025) |
| **Sticker tap (enquete, quiz, slider)** | **Nao citado por nenhuma fonte primaria como sinal de ranking.** Ver secao 6, conflito 3 | `[HIPOTESE]` | So fonte secundaria |
| **Compartilhar Story em DM** | Nao citado na doc de Story (aparece como "sends per reach" no contexto de Reels/Feed) | `[HIPOTESE]` | Inferencia |

### 3.1 Sobre stickers interativos: o achado incomodo

`[MECANICA]` Enquete, caixinha de pergunta, quiz e slider sao **mecanicas nativas de resposta**: cada uma gera uma interacao que a Meta contabiliza, e caixinha de pergunta gera literalmente uma DM. Ate ai e verificavel na UI.

`[HIPOTESE]` **Nao encontrei UMA fonte primaria da Meta dizendo que sticker interativo pesa no ranking de Story.** Tudo que circula ("polls sinalizam pro algoritmo", "quiz gera 50% mais engajamento") vem de blog de ferramenta sem N, sem periodo e sem metodologia. O unico numero com nome proprio que apareceu (Dunkin', "20% menor custo por view com sticker de enquete") e de **Instagram Ads**, nao de Story organico, e nao tem link pro estudo original.

Leitura honesta: **sticker aumenta engajamento APARENTE (contagem de interacao) com certeza mecanica. Se isso vira distribuicao, e hipotese.** MAS: enquete e like sao interacoes leves, e caixinha de pergunta produz reply em DM, que e sinal confirmado. Entao a recomendacao muda de "use stickers" pra **"use o sticker que produz DM"**.

---

## 4. Benchmarks externos (TUDO `[HIPOTESE]`)

Nenhum numero abaixo e nosso. Nenhum e de conta B2B tecnica brasileira. Usar como ordem de grandeza, nunca como meta.

### 4.1 Socialinsider, 2025

| Fonte | Data | N | Nicho | Metrica | Numero |
|---|---|---|---|---|---|
| Socialinsider | jan-mai/2025 (vs jan-mai/2024) | 161.180 Stories | "Marcas ativas", vertical nao declarado | Exit rate, 1-5k seguidores, imagem | 12,82% |
| Socialinsider | 2025 | idem | idem | Exit rate, 1-5k seguidores, video | 13,42% |
| Socialinsider | 2025 | idem | idem | Tap-forward, 1-5k, imagem | 56,82% |
| Socialinsider | 2025 | idem | idem | **Tap-forward, 1-5k, video** | **50,50%** |
| Socialinsider | 2025 | idem | idem | Reach rate Story, 1-5k, imagem | 9,55% |
| Socialinsider | 2025 | idem | idem | **Reach rate Story, 1-5k, video** | **10,40%** |
| Socialinsider | 2025 | idem | idem | Reach rate Feed post, 1-5k | 4,00% |
| Socialinsider | 2025 | idem | idem | Exit rate na PRIMEIRA tela | 23,8% |
| Socialinsider | 2025 | idem | idem | Frequencia mediana, 1-5k seguidores | 12 stories/mes (~3/semana) |
| Socialinsider | 2025 | idem | idem | Reply rate | "1 em cada 5 Stories recebe DM" |
| Socialinsider | 2025 | idem | idem | Mix de formato | 57% imagem / 43% video |

Observacoes criticas sobre esta fonte:
- O tier **1-5k e o de muitas contas B2B pequenas**. Isso e util e raro.
- **Reach de Story (9,5-10,4%) e MAIOR que reach de Feed (4%) no tier 1-5k**, e o padrao inverte a partir de 5k. Ou seja: pra conta pequena, Story ainda alcanca proporcionalmente bem. Isso **tensiona** a fala do Mosseri de "Feed alcanca mais". Ver secao 6, conflito 1.
- Video bate imagem em TODAS as metricas no nosso tier: menos tap-forward (50,5% vs 56,8%) e mais reach (10,4% vs 9,55%). Diferenca pequena, N grande, sem intervalo de confianca publicado.
- O relatorio nao declara verticais nem paises. Amostra de "brands" globais. **Extrapolar pra B2B tecnico BR e chute.**

### 4.2 Rival IQ, 2024

| Fonte | Data | N | Nicho | Metrica | Numero |
|---|---|---|---|---|---|
| Rival IQ | jun-nov/2023, publicado 2024 | 125.000+ Stories, 539.000+ frames, 1.470 contas (min. 1k seguidores, min. 100 views/frame) | Beleza, midia, influencers, outdoor, marketing | Completion, 1-3 frames/dia | ~75% |
| Rival IQ | idem | idem | idem | Completion, 7+ frames/dia | ~50% |
| Rival IQ | idem | idem | idem | Retencao 3-7 frames | acima de 75% |
| Rival IQ | idem | idem | idem | Maior queda de retencao | do frame 1 pro 2 |
| Rival IQ | idem | idem | idem | **Tap-back rate mediano** | **4,6%** (top 25% das marcas: 6,5%) |
| Rival IQ | idem | idem | idem | Exit rate, Story de 1 frame | 14% |
| Rival IQ | idem | idem | idem | Exit rate, 5+ frames | ~5% |
| Rival IQ | idem | idem | idem | Reply rate | "metade do ano anterior" |
| Rival IQ | idem | idem | idem | Distribuicao de comportamento | ~60% da atividade das marcas e 1-3 frames/dia |
| Rival IQ | idem | idem | idem | Reach: post vs Story, marca pequena (<10k) | post ~3x Story |

Observacoes criticas:
- Nicho **declarado e errado pra nos**: beleza, midia, influencer. Zero B2B tecnico.
- Dado de 2023. **Dois anos e meio de defasagem.** O proprio Socialinsider mostra exit rate subindo ano a ano.
- **Rival IQ diz que post alcanca ~3x Story pra marca pequena. Socialinsider diz o contrario no tier 1-5k.** Conflito direto, ver secao 6.
- Tap-back mediano de 4,6% e o unico numero de tap-back com N que encontrei. Serve de baseline: **se a gente ficar acima de 6,5%, estamos no top quartil daquela amostra.**

### 4.3 Hootsuite, links em Story (2022)

| Fonte | Data | N | Nicho | Achado |
|---|---|---|---|---|
| Hootsuite (experimento pessoal de uma autora) | 27/jan/2022 | **N=20 posts, conta unica** | Marketing | Stories com link sticker foram 20% dos top replies, 20% dos top shares, 25% do top reach, 30% dos top follows |

**Marcar como FRACO.** N=20 numa conta so, sem controle, sem significancia. Nao usar pra decidir nada. Citado aqui so porque e o unico "estudo" que circula sobre o assunto.

---

## 5. O que fazer / o que nao fazer (B2B tecnico pequeno)

Contexto: conta B2B pequena (ordem de poucos milhares de seguidores), publico profissional, nao lifestyle. Conteudo: bastidor, rotina, discussao, insight. Sem venda. Ajustar ao publico e ao tamanho reais do cliente ativo (`brand-profile.md`).

### Fazer

- `[MECANICA]` **Definir sucesso de Story como DM recebida, nao como view.** Reply e o unico sinal que e simultaneamente ranking, relacionamento e pipeline comercial. Pra conta B2B, uma DM de um comprador real vale mais que 400 views.
- `[MECANICA]` **Terminar a sequencia com uma pergunta que produza DM**, nao com "arrasta pra cima" nem CTA de venda. Caixinha de pergunta e o unico sticker cuja mecanica gera DM de verdade.
- `[MECANICA]` **Postar com constancia, porque o sinal e viewing history.** Habito do seguidor e o ativo. Story esporadico nao constroi posicao na barra. Isso e mecanica, nao opiniao: o sinal e literalmente "how often you view".
- `[MECANICA]` **Aceitar que Story nao capta seguidor novo.** So seguidores entram no funil. Aquisicao e problema de Reel e Feed. Nao cobrar de Story o que Story nao faz.
- `[MECANICA]` **Nao esticar tela pra segurar tempo.** Watch time nao e sinal. Se a ideia acabou em 4s, a tela acaba em 4s. O que custa e o tap-forward, e tela longa e chata causa tap-forward.
- `[HIPOTESE]` **Comecar pela tela mais forte.** Se o exit de 23,8% na primeira tela do Socialinsider se repetir aqui, um quarto do publico decide na tela 1. Prova visual real (entrega, tela do sistema, resultado) na abertura, coerente com a hipotese do viral-playbook de que prova visual bate narrativa.
- `[HIPOTESE]` **Preferir video a imagem estatica.** Socialinsider, tier 1-5k: video tem menos tap-forward e mais reach. Diferenca pequena. Testar.
- `[HIPOTESE]` **Sequencia de 3 a 5 telas.** Rival IQ e Socialinsider convergem em "a queda mora nas primeiras telas e sequencias curtas completam mais". Nao e dado nosso. Ver teste T1.

### Nao fazer

- **Nao usar Story como canal de alcance.** `[MECANICA]`, fala do Mosseri.
- **Nao encher de sticker "pra agradar o algoritmo".** `[HIPOTESE]` sem nenhuma fonte primaria. Sticker que nao produz DM produz vaidade.
- **Nao usar hashtag em Story esperando alcance.** Story nao tem superficie de descoberta pra nao seguidor (`[MECANICA]`, a doc so considera contas que voce segue). Hashtag em Story nao tem pra onde levar.
- **Nao medir Story por completion sem contexto.** Sequencia de 1 tela tem completion alta por construcao. Comparar completion entre sequencias de tamanhos diferentes e comparacao invalida.
- **Nao repostar conteudo com marca d'agua de outra rede.** Ver secao 7, mito 5 (o efeito e confirmado pra Reels, nao pra Story, mas o custo de evitar e zero).
- **Nao aplicar "comenta PALAVRA".** Regra do `viral-playbook`. Em Story o equivalente correto e "me responde aqui".

---

## 6. Conflitos abertos entre fontes

### Conflito 1: Story alcanca mais ou menos que Feed pra conta pequena?

- **Mosseri (jan/2025):** "posting to Feed is going to be the best way to reach as many people as possible". Feed vence.
- **Rival IQ (dados 2023, N=125k+ Stories):** marca com menos de 10k seguidores tem ~3x mais reach em post que em Story. Feed vence.
- **Socialinsider (2025, N=161.180):** no tier **1-5k**, Story imagem 9,55% e Story video 10,40% de reach, contra Feed post 4,00%. **Story vence por mais de 2x.**

O que decide: as duas primeiras fontes falam de "conta pequena" como <10k ou em geral. O Socialinsider quebra por tier e mostra a inversao acontecendo por volta de 5-10k. E possivel que **as tres estejam certas e o cruzamento fique perto de 5k**, que e onde muitas contas B2B pequenas estao. **Isso importa muito e so o dado do cliente resolve.** Ver teste T4.

### Conflito 2: quantos Stories por dia?

- **Mosseri (2025):** recusa dar numero. "Depende do que voce posta e do que seus seguidores querem. Eu posto todo dia, voce nao precisa. Conheco quem posta 1x por mes e vai bem."
- **Rival IQ (2023):** completion cai de ~75% (1-3 frames) pra ~50% (7+). Sugere sequencia curta.
- **Socialinsider (2025):** exit se concentra nas telas 1-3, depois **estabiliza nas telas 4-9**, e o **pico de reach acontece nas telas 10-13** (37,8%), caindo depois da 13. Sugere que sequencia LONGA nao e punida, e que quem sobrevive a tela 3 vai ate o fim.

Este e o conflito mais serio do documento. Rival IQ le "menos frames = melhor". Socialinsider le "a barreira e a tela 3; passou dela, pode ir longe". As duas leituras produzem estrategias opostas.

Possivel reconciliacao (`[HIPOTESE]`): as metricas nao sao a mesma. Rival IQ mede completion (% que chega ao fim), que cai mecanicamente com o comprimento. Socialinsider mede exit por posicao e reach por posicao, que e sobrevivencia condicional. **Podem ser o mesmo fenomeno descrito de dois jeitos.** Nao resolvivel por leitura. Ver teste T1.

O que decide nos nossos dados: rodar 3 telas vs 5 telas vs 8 telas no mesmo assunto e comparar DMs geradas (nao completion).

### Conflito 3: sticker interativo pesa no ranking?

- **Meta (doc oficial + Mosseri):** silencio total. Nenhuma mencao a sticker em ranking de Story.
- **Buffer, Later, influencermarketinghub, socialrails (2025-2026):** afirmam que sim, que "sinaliza pro algoritmo". **Nenhum apresenta N, periodo ou metodologia.**

Nao ha conflito de evidencia aqui, ha conflito entre **evidencia e folclore**. Tratar o lado dos blogs como especulacao ate teste. Ver teste T2.

### Conflito 4: tap-back e sinal positivo?

- **Meta:** nao cita tap-back em lugar nenhum. Cita tap-in, reply e "move on".
- **HypeAuditor, joinotto e afins:** afirmam que tap-back indica impacto e e positivo. Sem N, sem fonte primaria.

Plausivel? Sim: voltar e acao deliberada. Confirmado? Nao. **Tap-back e hoje um sinal de qualidade EDITORIAL util pra nos (a tela foi boa o bastante pra reler), sem prova de que compra distribuicao.** Usar como metrica interna de qualidade, nao como alavanca de algoritmo. Baseline pra comparar: 4,6% mediano do Rival IQ.

### Conflito 5: recencia pesa no ranking da barra?

- **Meta:** nao menciona.
- **Hootsuite/Later/Buffer (2026):** "Stories prioriza recencia e viewing history".

Sem fonte primaria do lado dos blogs. Nao adotar. Ver teste T3.

---

## 7. Mitos derrubados

| # | Mito | Realidade | Fonte que derruba |
|---|---|---|---|
| 1 | "Segurar a pessoa mais tempo na tela melhora a distribuicao do Story" | **Watch time nao e sinal de ranking em Story.** Os sinais sao tap, like e reply. Isso e Reels, nao Story | Mosseri (jan/2025); ausencia na doc oficial da Meta (mai/2023). `[MECANICA]` |
| 2 | "Falar 'link na bio' derruba o alcance" | Mosseri, literal: "That is not true. You're more than welcome to say 'link in bio', it will not affect your reach one way or another" | Mosseri. `[MECANICA]` |
| 3 | "Link sticker no Story derruba o alcance" | A Meta nunca confirmou supressao de alcance por link. O que existe e queda de **engajamento**, porque o link tira a pessoa do app antes dela responder. Alcance e engajamento sao coisas diferentes. Unico "estudo" e um N=20 de conta unica (Hootsuite, jan/2022), fraco demais pra sustentar qualquer lado | Ausencia de confirmacao da Meta; Hootsuite (2022, N=20, FRACO). `[HIPOTESE]` dos dois lados |
| 4 | "Shadowban de Story existe" | Mosseri, publico: "shadowbanning is not a thing". O que existe e reducao de alcance por politica, com aviso na conta | Mosseri (via Gizmodo). `[MECANICA]` |
| 5 | "Marca d'agua de outra rede derruba alcance" | **Confirmado, mas pra REELS, nao pra Story.** A Meta declarou que desprioriza conteudo visivelmente reciclado de outro app no Reels e no Explore. Story nao tem superficie de descoberta, entao o mecanismo declarado nem se aplica. Evitar mesmo assim: custo zero | Instagram via Social Media Today. `[MECANICA]` pra Reels, `[HIPOTESE]` pra Story |
| 6 | "Hashtag em Story amplia alcance" | Story so e servido pra quem ja segue (doc oficial: candidatos = contas que voce segue). Nao existe superficie de descoberta de Story pra nao seguidor. A hashtag nao tem pra onde levar trafego | Meta ranking doc (mai/2023). `[MECANICA]` |
| 7 | "Sticker de enquete e cheat code de algoritmo" | Zero fonte primaria da Meta. Todo o argumento vem de blog de ferramenta sem N | Ausencia total nas primarias. `[HIPOTESE]` |
| 8 | "Repost de Feed pro Story mata alcance" | **Nao encontrei nenhuma fonte, primaria ou secundaria com N, afirmando nem negando isso.** O mito circula sem base e sem refutacao. Lacuna real | Nenhuma. Ver teste T5 |

---

## 8. LACUNAS: o que so os nossos dados respondem

**Esta e a secao mais importante do arquivo.** Tudo acima e de terceiro. Nada acima foi medido em conta B2B tecnica brasileira de poucos milhares de seguidores. A chance de os benchmarks de beleza e influencer valerem pra nos e desconhecida.

Pre-requisito de infra: hoje `ct-social-cockpit` e `ct-social-intel` cobrem Feed/Reels via `ct_metrics_snapshots`. **Nenhum dos dois coleta metrica de Story.** A lacuna 8 do `viral-playbook` ("efeito de enquete/caixinha no alcance de Story") ja registrava isso. Sem coleta de Story via Graph API (`/stories` + `/insights` com `metric=impressions,reach,replies,exits,taps_forward,taps_back`), **nenhum teste abaixo roda.** Esse e o item zero.

| # | Lacuna | Teste pra fechar | Metrica de decisao |
|---|---|---|---|
| **T0** | **Nao coletamos NADA de Story.** Insight de Story expira em 24h no app e some | Estender `ct-instagram-analyzer` pra puxar `/stories` + insights (`impressions`, `reach`, `replies`, `exits`, `taps_forward`, `taps_back`) diariamente antes do vencimento das 24h. Persistir por tela, com posicao na sequencia, formato e tipo de sticker | Existir 30 dias de historico de Story do cliente. **Bloqueia T1-T6** |
| **T1** | Conflito 2: sequencia curta ou longa? Rival IQ e Socialinsider discordam | Mesmo assunto, 3 versoes ao longo de 6 semanas: 3 telas, 5 telas, 8 telas. Alternar ordem pra nao confundir com efeito de novidade | **DMs recebidas por sequencia**, nao completion. Secundario: exit por posicao. Se a tela 3 for a barreira (Socialinsider), esperamos exit alto ate a 3 e estabilidade depois |
| **T2** | Conflito 3: sticker interativo faz alguma coisa alem de contar interacao? | Pareado: mesma sequencia com e sem caixinha de pergunta na tela final. E: enquete vs caixinha vs nada | **Reply em DM por reach.** Se enquete sobe sticker tap mas nao sobe DM, sticker e vaidade e a regra vira "so caixinha" |
| **T3** | Conflito 5: horario importa em Story? Story e ranking por afinidade, nao por horario, entao o heatmap de Feed pode nao transferir | Publicar a mesma classe de bastidor em 3 janelas distintas por 4 semanas. Cruzar com o heatmap 7x24 ja computado pelo `ct-social-intel` | Reach nas 2h iniciais + reply rate. **Hipotese nula esperada: horario nao muda nada em Story**, porque quem te ve, te ve quando abre o app. Se o nulo se confirmar, para de otimizar horario de Story |
| **T4** | Conflito 1: pra conta do cliente, Story alcanca mais ou menos que Feed? Fontes discordam exatamente nesse tier | Comparar reach rate medio de Story vs Feed post do cliente no mesmo periodo de 30 dias | Se Story > Feed em reach (como diz o Socialinsider), a fala do Mosseri nao vale pro nosso tier e Story sobe de prioridade. Se Feed > Story, o Mosseri vale e Story fica so como canal de DM |
| **T5** | Mito 8: repost de Feed pro Story custa alguma coisa? Ninguem tem dado | Alternar: metade dos posts de Feed repostados no Story, metade nao. 8 semanas | Reach do Story reposto vs Story original. Secundario: o repost gera visita de perfil? |
| **T6** | Video vs imagem no nosso tier. Socialinsider da vantagem pequena pro video, em amostra de marca generica | Pareado: mesmo conteudo, versao foto (print/tela) e versao video (mesma tela com pan/zoom) | Tap-forward rate. Se a diferenca for menor que a variacao semana a semana, a regra e "tanto faz, usa o mais barato de produzir" |
| **T7** | Story converte em que, pra B2B? Ninguem no mercado mede isso pra muitos nichos B2B tecnicos | Taggear em `ct_content_items` qual assunto de Story gerou DM, e cruzar com o CRM: DM virou conversa comercial? Virou proposta? | **DM qualificada por sequencia.** E a unica metrica que liga Story a receita. Se bastidor gera DM de comprador e insight tecnico nao gera (ou o contrario), isso reescreve a pauta |
| **T8** | Tap-back e sinal de algoritmo ou so de qualidade editorial? | Nao e testavel por nos: nao conseguimos observar o ranking da barra de terceiros | **Nao tentar fechar.** Usar tap-back como metrica interna de qualidade, comparado ao baseline de 4,6% do Rival IQ. Reclassificar so se a Meta falar |
| **T9** | A hipotese do viral-playbook ("prova visual e resultado concreto batem narrativa de erro") vale em Story tambem? Aquela hipotese e de Feed | Rodar as duas narrativas em Story: sequencia de case entregue vs sequencia de erro/auditoria | Reply rate. **Story e canal de bastidor e de intimidade, entao e plausivel que a narrativa de erro funcione AQUI e nao no Feed.** Vale testar justamente porque contradiz |

Ordem de execucao: **T0 e pre-requisito de tudo.** Depois T7 (define o que e sucesso), depois T1 e T2 (as duas maiores duvidas operacionais), depois o resto.

Enquanto T0 nao existir, **toda regra de Story deste framework e hipotese importada de amostra de marca de beleza americana.** Ler assim.

---

## 9. Bibliografia

Todas acessadas em 15/jul/2026.

**Primarias (Meta / Mosseri)**
1. Instagram Ranking Explained, publicado 31/mai/2023. https://about.instagram.com/blog/announcements/instagram-ranking-explained
2. "Instagram Shares Notes on Stories Ranking", Social Media Today, 28/jan/2025 (reporta declaracao direta de Adam Mosseri sobre os sinais de tap/like/reply e sobre Story nao ser canal de alcance). https://www.socialmediatoday.com/news/instagram-stories-ranking-factors-2025/738541/
3. "@Mosseri: Ask Me Anything Instagram Updates (March 2025)", Luan Wise, mar/2025 (compilado de AMA: frequencia de Stories, watch time). https://www.luanwise.co.uk/mosseri-ask-me-anything-instagram-updates-march2025
4. "Instagram's Head Says You Shouldn't Worry About Shadowbanning", Gizmodo (declaracao de Mosseri: "shadowbanning is not a thing"). https://gizmodo.com/instagram-account-ban-shadowban-adam-mosseri-twitteri-1850495774
5. "Instagram Will Now Limit the Reach of Re-posts from TikTok Within its Reels Clone", Social Media Today (marca d'agua, escopo Reels). https://www.socialmediatoday.com/news/instagram-will-now-limit-the-reach-of-re-posts-from-tiktok-within-its-reels/594803/
6. About the Link Sticker for Instagram Stories, Meta Business Help Center. https://www.facebook.com/business/help/529979981436890

**Estudos com N declarado (`[HIPOTESE]`)**
7. 2025 Instagram Stories Benchmarks, Socialinsider. N=161.180 Stories, jan-mai/2025 vs jan-mai/2024. https://www.socialinsider.io/social-media-benchmarks/instagram-stories-benchmarks
8. Instagram Stories Data: Latest Performance Benchmarks, Socialinsider. https://www.socialinsider.io/blog/instagram-stories-data/
9. 2024 Instagram Stories Benchmark Report, Rival IQ. N=125.000+ Stories / 539.000+ frames / 1.470 contas, jun-nov/2023. https://www.rivaliq.com/blog/instagram-stories-benchmark-report/ (PDF: https://get.rivaliq.com/hubfs/eBooks/Rival-IQ-2024-Instagram-Stories-Benchmark-Report.pdf)

**Fraca (N insuficiente, citada so por transparencia)**
10. "Experiment: Do links in Instagram Stories ruin engagement?", Hootsuite, 27/jan/2022. N=20 posts, conta unica. https://blog.hootsuite.com/adding-links-instagram-stories-ruin-engagement/

**Secundarias sem N (usadas so pra mapear o folclore, nao pra sustentar regra)**
11. How the Instagram Algorithm Works: 2026 Guide, Buffer. https://buffer.com/resources/instagram-algorithms/
12. Instagram algorithm tips for 2026, Hootsuite. https://blog.hootsuite.com/instagram-algorithm/
13. Instagram algorithm in 2026: rank signals for growth, Later. https://later.com/blog/how-instagram-algorithm-works/
14. "What Navigation in Instagram Stories Means", HypeAuditor (tese de tap-back positivo, sem N). https://hypeauditor.com/blog/what-navigation-in-instagram-stories-actually-means/
15. "Polls, Stickers & Micro-Interactions", Influencer Marketing Hub (tese de sticker como sinal, sem N). https://influencermarketinghub.com/polls-stickers-micro-interactions/

---

## Relacao com outros arquivos do framework

- `references/viral-playbook.md` secao 3 (Story) fica **subordinada a este arquivo** no que diz respeito a mecanica de ranking. A frase "recursos interativos existem como mecanica nativa de resposta; se ajudam alcance e `[HIPOTESE]`" continua correta e este arquivo detalha o porque.
- Lacuna 8 do viral-playbook ("efeito de enquete/caixinha no alcance de Story") vira o teste **T2** aqui.
- Precedencia mantida: `clients/{slug}/brand-profile.md` > `design-system.md` > viral-playbook > este arquivo e demais references.
