# Algoritmo do Instagram (FONTE CANONICA)

Fonte unica do framework sobre como o Instagram distribui conteudo. Consolidado em 05/ago/2026 a partir de fontes oficiais da Meta e de estudos de terceiros (lista na secao 9).

Quem le, e quando: `ct-diretor` antes de delegar, `ct-redator`, `ct-carrossel`, `ct-video*`, `ct-otimizador` e `ct-social` antes de produzir. Para Story, o canone continua sendo `references/instagram-stories-algorithm.md`, que esta subordinado a este.

Precedencia: `clients/{slug}/brand-profile.md` > `design-system.md` > este arquivo > `viral-playbook.md` > demais references. Regra de cliente vence regra generica, sempre.

## Regra dura de evidencia

Toda regra abaixo carrega um selo. **Sem selo, nao e regra: nao seguir.**

| Selo | Significa | Como tratar |
|---|---|---|
| `[MEDIDO]` | Dado das contas do cliente ativo, **com o n da amostra ao lado** | Confiar dentro do n. Reavaliar quando o cockpit atualizar |
| `[MECANICA]` | Declaracao oficial da Meta ou comportamento verificavel na propria UI/doc | Confiar. Revalidar se a plataforma mudar |
| `[HIPOTESE]` | Terceiro, opiniao, ou estudo correlacional sem validacao nossa | **Nunca vira regra de producao. Vira teste** |

Tres consequencias que valem mais que a tabela:

1. **`[HIPOTESE]` nao autoriza comportamento obrigatorio.** No maximo autoriza um experimento com criterio de leitura definido antes.
2. **Numero sem fonte datada nao entra.** Nem percentual, nem minuto, nem quantidade.
3. **`[MEDIDO]` sem n e invalido.** "Reel performa melhor" nao existe; "reel alcanca ~30% mais que carrossel, n=28 vs 21" existe.

---

## 1. Como o ranking funciona hoje, por superficie

`[MECANICA]` **Cada superficie tem seu proprio algoritmo.** A doc canonica da Meta ("Instagram Ranking Explained", 31/mai/2023) lista os sinais por superficie, em ordem declarada de importancia:

| Superficie | Sinais, na ordem declarada |
|---|---|
| **Feed** | 1. atividade do espectador (o que ele curtiu, compartilhou, salvou, comentou) · 2. informacao sobre o post (popularidade, horario) · 3. informacao sobre quem postou · 4. historico de interacao entre os dois |
| **Reels** | 1. atividade do espectador (reels curtidos, salvos, recompartilhados, comentados) · 2. historico de interacao com quem postou · 3. informacao sobre o reel (audio e sinais visuais) · 4. informacao sobre quem postou (inclui contagem de seguidores) |
| **Explore** | 1. informacao sobre o post (sinais de popularidade primeiro) · 2. atividade do espectador no Explore · 3. historico com quem postou · 4. informacao sobre quem postou |
| **Stories** | viewing history, engagement history, closeness. **Sem ordem de peso declarada** |
| **Search** | o texto digitado e "de longe o sinal mais importante"; depois atividade do usuario; depois sinais de popularidade |

`[MECANICA]` **Ressalva que muda como ler a tabela acima: essa doc e de mai/2023 e nunca foi reescrita.** Ela nao usa o vocabulario que a propria Meta adotou a partir de 2025. Existe uma lacuna documental oficial. Quem disser "saiu uma nova doc de ranking em 2026" esta apontando pra nada.

### 1.1 O vocabulario atual: os tres sinais

`[MECANICA]` Mosseri, jan/2025, estabelece publicamente os tres sinais que o criador deve acompanhar:

1. **Watch time**
2. **Likes per reach**
3. **Sends per reach**

`[MECANICA]` E a assimetria declarada, que e a informacao mais acionavel de toda a pesquisa: **like pesa mais no conteudo servido a quem JA SEGUE; send pesa mais no conteudo servido a quem NAO SEGUE.**

`[HIPOTESE]` **Nao existe peso numerico oficial entre os sinais.** Toda tabela de mercado tipo "send vale 3x um like" e invencao de blog. Se aparecer numero de peso relativo, e folclore.

### 1.2 Conta pequena e alcance pra nao seguidor

`[MECANICA]` "Helping Creators Find New Audiences" (30/abr/2024) declara que a Meta corrigiu o vies pro criador grande e que **toda peca publica qualificada e mostrada primeiro a uma audiencia pequena, escolhida por afinidade, independente de seguir a conta ou nao**. O desempenho nesse grupo decide a distribuicao maior. O mercado chama isso de "sistema de audicao": o nome e de terceiro, **a mecanica e oficial**.

`[MECANICA]` Reels de ate 3 minutos sao elegiveis a distribuicao pra nao seguidor em Reels e Explore. Acima de 3 minutos, fora do criterio de recomendacao.

`[MECANICA]` **Story so tem candidatos entre contas que voce ja segue.** Story nao e canal de aquisicao, e isso e estrutural, nao tatico.

`[HIPOTESE]` Taxa de alcance por faixa de seguidor ("conta de 1k-5k alcanca 9,78%") nao e da Meta, e benchmark de ferramenta. Nao usar como meta.

### 1.3 Politica pro-originalidade

`[MECANICA]` Meta declara (jan/2026, sobre Q4/2025) que **a prevalencia de conteudo original nas recomendacoes nos EUA subiu 10 pontos percentuais no trimestre, chegando a 75% das recomendacoes.**

`[MECANICA]` Conta que posta conteudo de terceiro "que nao criou nem melhorou significativamente" **10 ou mais vezes em 30 dias fica desqualificada das recomendacoes**. Conteudo identico ja publicado no IG: a plataforma recomenda apenas o original e rotula o repost com link pro criador original.

Leitura operacional: **experiencia propria e caso real tem vantagem estrutural declarada.** Conteudo agregado, listicle generico e "resumo do que saiu essa semana" competem contra uma politica explicita.

---

## 2. O que a Meta declara que PENALIZA

Tudo `[MECANICA]`. E a secao mais solida do documento, e a unica onde cabe a palavra "penalidade".

| Pratica | O que a Meta declara |
|---|---|
| **Marca d'agua visivel de outra rede** | Conteudo com marca d'agua visivel nao e elegivel a recomendacao. Reel visivelmente reciclado de outro app e despriorizado |
| **Repost de conteudo ja publicado no IG** | So o original e recomendado; o repost e substituido e rotulado |
| **Conta agregadora** | 10+ reposts de terceiro em 30 dias = desqualificada das recomendacoes |
| **Engagement bait** | Listado explicitamente entre o que nao e recomendado. Definicao: pedido vazio de voto, marcacao, compartilhamento ou comentario "para fins que nao sejam um call to action especifico" |
| **Clickbait** | Idem |
| **Baixa qualidade tecnica** | Video borrado, baixa resolucao, mudo, com bordas, ou majoritariamente texto na tela: menos visivel nas recomendacoes |
| **Link pra pagina ruim** | Distribuicao reduzida pra link de site coberto de anuncio, lento ou quebrado. O alvo e a pagina de destino, nao o ato de linkar |
| **Violacao de Community/Recommendation Guidelines** | Continua alcancando quem ja segue, mas sai de Explore, Search, Reels e sugestoes. Motivo visivel no Account Status |

`[MECANICA]` **Editar fora do Instagram e permitido.** A excecao unica e a marca d'agua. Subir o MP4 original limpo sempre; nunca o arquivo baixado com selo de outra plataforma.

---

## 3. Hashtag: o que mudou, e e duro

`[MECANICA]` **18/dez/2025: o Instagram passou a limitar a 5 hashtags por post.** O teto anterior era 30. Declaracao oficial: "usar menos (ate 5) hashtags mais direcionadas, em vez de muitas genericas, pode melhorar tanto a performance do conteudo quanto a experiencia das pessoas".

`[MECANICA]` Mosseri, 2025: **"hashtag nao e mais uma via primaria de aumentar alcance no Instagram".**

`[MECANICA]` O valor que sobra pra hashtag e **BUSCA e classificacao de tema**, nao alcance. A busca casa o termo digitado com username, bio, **legenda**, hashtag e local. Palavra-chave na legenda alimenta a busca; **comentario nao e indexado**, entao keyword e hashtag vao na legenda, nunca no primeiro comentario.

Consequencia dura pro framework: **maximo 5 hashtags, especificas ao tema real do post, justificadas por busca.** Qualquer regra nossa que mande usar mais esta quebrada por limite de plataforma, nao so por eficacia. E qualquer regra que mande escolher hashtag "popular, de alcance" em vez de "especifica, de busca" esta invertida em relacao a unica funcao que a hashtag ainda tem.

`[HIPOTESE]` Os estudos de terceiro se contradizem frontalmente sobre o efeito da hashtag (Metricool, N=24,3M posts: quem usa ao menos 1 hashtag tem 31,7% menos views · Fanpage Karma, N=1,6M: 12,6% mais alcance). Nao da pra reconciliar, e provavelmente os dois medem QUEM usa hashtag, nao o efeito dela. **O unico fato duro e o corte de 30 pra 5.**

---

## 4. Video: watch time e duracao

`[MECANICA]` O sistema olha **percentual assistido E segundos absolutos ao mesmo tempo**. Justificativa oficial declarada por Mosseri (fev/2025): "nao queremos punir videos mais longos, por isso olhamos nao so o percentual assistido, mas tambem o numero de segundos".

Consequencia operacional direta: **nao cortar video artificialmente pra inflar taxa de conclusao.** Um video de 20s completado 100% e um video de 50s completado 60% nao sao equivalentes pro sistema, e encolher conteudo que tem substancia joga fora os segundos absolutos. O corte legitimo continua sendo o de silencio, pausa e cauda morta, que e qualidade, nao metrica.

`[MECANICA]` Teto de 3 minutos pra elegibilidade em recomendacao.

`[HIPOTESE]` **Replay nao tem fonte primaria como sinal de ranking.** Procurado, nao encontrado, nem na doc de 2023 nem nas falas de 2025. Todo "completion + replay decidem o alcance" que circula e blog sem fonte.

`[HIPOTESE]` Nao existe numero oficial de retencao nos 3 primeiros segundos, hook rate ideal, nem curva de retencao publicada. Todo numero de hook em circulacao e de ferramenta.

`[HIPOTESE]` Faixas de duracao "ideal" (30-60s, 21-34s, 45-60s) vem de estudo correlacional de terceiro ou de blog sem N. A testar com dado proprio, agora que o coletor pede `ig_reels_avg_watch_time`.

---

## 5. Formato: o que o dado proprio sustenta

Este kit nao traz dado medido de nenhum cliente. Os cortes abaixo sao hipoteses a validar com os dados do cliente ativo (Graph API, `ct_metrics_snapshots`), sempre com o n da amostra ao lado.

`[HIPOTESE]` **Formato:** em conta B2B pequena, reel tende a alcancar mais que carrossel e a ser mais compartilhado, com engajamento equivalente. Validar com os dados do cliente: comparar alcance e share medianos por formato, com n por formato. Se nao houver diferenca, nao existe formato vencedor pra esta conta: nao inventar um.

`[HIPOTESE]` **Conteudo:** posts que mostram trabalho real e identificavel tendem a alcancar mais que tese abstrata sem caso especifico. Validar com os dados do cliente: cruzar os posts de maior e de menor alcance com a presenca de caso real.

`[HIPOTESE]` **Share x like:** em muitas contas, os posts de maior share nao sao os de maior like, e o maior alcance absoluto pode vir de like em massa da rede proxima, sem share nem save. Sao dois caminhos distintos de alcance (rede proxima e nicho) e nao podem virar um indicador so. O share e o que leva a nao seguidor. Validar com os dados do cliente.

`[HIPOTESE]` **Imagem unica:** amostra pequena nao sustenta conclusao. Nao tirar regra de n=1 ou n=2.

`[HIPOTESE]` **Imagem unica em queda livre no mercado:** Metricool (N=24,3M posts) reporta reach -21,96%, interacoes -25,41% e engajamento -45,98% ano a ano; Buffer e Socialinsider apontam a mesma direcao com metodologias diferentes. Correlacao de terceiro, nao medicao nossa, mas **os tres maiores estudos disponiveis convergem**, e nosso proprio dado nao tem n pra contradizer. Tratar como razao suficiente pra priorizar reel e carrossel, nao como numero a citar.

---

## 6. Copy: o achado com melhor lastro externo

`[HIPOTESE]` Metricool, N=24,3M posts, jan-fev/2026 vs jan-fev/2025:

- **Pergunta na legenda: +36,70% de comentarios**
- **CTA focado em comentario: +202,78% de comentarios**

E `[HIPOTESE]`, nao `[MEDIDO]`: e correlacao, de terceiro, em base enviesada pra conta de marca que paga ferramenta. **Mas e o achado de copy com maior amostra e maior consistencia interna de todo o levantamento**, e o mecanismo e plausivel (pergunta convida resposta). Autoriza mudanca de comportamento padrao em copy, nao autoriza citar o numero como promessa.

Cuidado que anda junto: **CTA de comentario precisa ser especifico e ligado a uma entrega real.** Pedido vazio ("marca 3 amigos", "comenta SIM se concorda") e exatamente a definicao de engagement bait, que e `[MECANICA]` penalizada. "Comenta PALAVRA que eu mando o material" so vale se a automacao de resposta existir de fato.

`[HIPOTESE]` Legenda abaixo de 30 palavras correlaciona com ER maior (Socialinsider, N=9,1M). Correlacao com QUEM escreve curto, provavelmente. **Legenda longa NAO derruba alcance:** o proprio Instagram ja declarou isso.

---

## 7. MITOS: nao seguir

Esta secao existe pra impedir que folclore derrubado volte. Se alguem propuser qualquer item daqui, a resposta e esta linha.

| Mito | Veredito | Por que |
|---|---|---|
| "Existe combinacao de palavras que o algoritmo ama" | **FOLCLORE** | Nenhuma fonte descreve pontuacao por vocabulario. **Proibido criar lista de palavras magicas** |
| "Existem palavras proibidas que derrubam o alcance" | **FOLCLORE** na forma de lista | O que existe e politica sobre ASSUNTO (Community Standards), nao sobre token. Trocar sinonimo nao e o mecanismo |
| "Existe shadowban" | **FOLCLORE no nome** | A Meta nao usa o termo. O mecanismo real e inelegibilidade pra recomendacao, **com aviso no Account Status**. Nunca diagnosticar shadowban por queda de alcance: queda de alcance e o estado normal |
| "Tem que postar todo dia, o algoritmo pune quem some" | **FOLCLORE** | Nenhum sinal publicado e "dias desde o ultimo post". Mosseri diz o oposto. Mais posts e mais tentativas, nao favorecimento |
| "Hashtag e tudo, use 30" | **FOLCLORE, e agora impossivel** | Teto da plataforma e 5 desde 18/dez/2025 |
| "Hashtag morreu" | **ERRADO no literal** | Ela perdeu o alcance, mantem a busca. Ver secao 3 |
| "Nao pode falar 'link na bio', derruba alcance" | **FOLCLORE** | Mosseri desmentiu. Legenda de post nem tem link clicavel: nao ha mecanismo |
| "Os 30 primeiros minutos definem o alcance" | **FOLCLORE no numero** | Nenhuma fonte cita janela. A distribuicao e incremental e post ganha alcance por dias. **Janela minima de leitura: 48 a 72h** |
| "Repostar o feed no story aumenta o alcance do post" | **FOLCLORE** | Mosseri desmentiu explicitamente. Serve pra avisar seguidor |
| "Conta comercial alcanca menos que pessoal" | **FOLCLORE** | Nenhum sinal publicado usa tipo de conta |
| "Conteudo com IA e punido" | **FOLCLORE na forma bruta** | A politica e ROTULAR, nao remover. O que e demovido e conteudo sem originalidade, com IA ou sem |
| "Editar fora do Instagram derruba alcance" | **FOLCLORE** | Permitido. A unica excecao e marca d'agua |
| "Existe melhor horario universal" | **FOLCLORE** | Dois estudos de 8 digitos (9,6M e 24,3M posts) apontam dias e horas DIFERENTES. So o dado da propria conta responde, e com n por celula |
| "Apagar post prejudica o perfil" | **FOLCLORE** | O proprio Account Status sugere apagar post inelegivel pra recuperar recomendacao |
| "Responder DM sobe o alcance do perfil" | **FOLCLORE** | Nenhum sinal publicado envolve taxa de resposta a DM |
| "Legenda longa derruba alcance" | **FOLCLORE** | O Instagram ja declarou que tamanho de legenda nao afeta alcance |
| "Responder comentario na 1a hora aumenta alcance" | **PLAUSIVEL, sem confirmacao** | Nenhuma fonte menciona latencia de resposta. Boa pratica de comunidade, **nao prometer alcance, nao criar plantao de 1 hora** |
| "Alt text e fator de SEO no IG" | **FOLCLORE ate prova em contrario** | A doc de Search de 2021 nao cita alt text. A Meta documenta como acessibilidade |
| "Replay e sinal de ranking em Reels" | **SEM FONTE** | Ver secao 4 |
| "Sticker interativo (enquete, quiz) sobe o ranking do Story" | **SEM FONTE** | Ver `instagram-stories-algorithm.md` |

**Regra de encerramento de discussao:** quando alguem disser "o algoritmo mudou", a pergunta de volta e **"mudou o que, segundo qual fonte, em que data"**. Sem as tres respostas, nao vira regra.

---

## 8. O que NAO sabemos (agenda de instrumentacao)

Em ordem de quanto destrava. Isto nao e lista de desejo: e o que impede regra de sair de `[HIPOTESE]`.

| # | Buraco | Estado | Como fecha |
|---|---|---|---|
| 1 | **Retencao de reel** | `ig_reels_avg_watch_time` passou a ser coletado em 05/ago/2026 (o coletor pedia `plays`, metrica removida, e a API rejeitava o lote inteiro em silencio: 740 linhas de reel gravadas com tudo zerado). Serie comeca do zero agora | Acumular ~3 meses e cruzar duracao x watch time. So entao regra de gancho e duracao sai de `[HIPOTESE]` |
| 2 | **Alcance seguidor vs nao-seguidor** | `breakdown=follow_type` devolve HTTP 400 nas metricas que usamos | Testar se um tipo de conta (Business ou Creator) libera onde o outro nao libera. Se nao, declarar nao-mensuravel e usar proxy nomeado |
| 3 | **Velocidade de acumulo de alcance** | Snapshot e diario: nao ha grao fino nas primeiras horas | Gravar reach com timestamp fino em 3h/24h/7d. Sem isso nenhuma teoria de janela inicial e testavel |
| 4 | **Atributo editorial ligado a metrica** | `ct_content_items` so cruza com parte dos posts IG medidos. Nao existe campo de tema, gancho, presenca de rosto, numero de slides, duracao | Taguear a peca **no momento da publicacao**. Enquanto nao houver, todo corte editorial e regex ou leitura manual |
| 5 | **Serie de seguidores por dia (IG)** | Existe desde 10/set/2026 (1 ponto/dia, cron `CT_IG_DAILY`). Falta seguidor POR PECA, que a API nao entrega | Cruzar delta diario com data de publicacao |
| 6 | **Story alem de reach/views** | Sem navegacao (taps_forward, taps_back, exits), sem replies, sem retencao tela a tela. **Insight de Story expira em 24h: dia sem coleta e dado perdido pra sempre** | Confirmar se o cron `ct-story-insights` grava navegacao ou so reach/views |
| 7 | **Trial Reels** | Nenhum terceiro publicou estudo com N. A Meta nao publica o criterio numerico de graduacao automatica | So teste proprio responde |
| 8 | **Benchmark do nicho** | Nao existe benchmark de terceiro pra muitos nichos B2B tecnicos brasileiros. Nenhum estudo estratifica formato por tamanho de conta | Aceitar que a referencia e a propria conta. **Nao inventar benchmark de nicho** |

---

## 9. Fontes

Fontes primarias: Meta ("Instagram Ranking Explained", 31/mai/2023; "Helping Creators Find New Audiences", 30/abr/2024; Recommendation Guidelines) e falas publicas de Adam Mosseri (2025). Estudos de terceiros citados acima: Metricool, Fanpage Karma, Socialinsider, Buffer. Ao atualizar este arquivo, registrar URL e data de acesso de cada fonte nova.

Limitacao metodologica declarada: post e video nativos do Mosseri no Instagram e no Threads nao sao recuperaveis por fetch. Toda fala dele aqui chega por veiculo que a transcreve. Isso e um teto de confianca, nao um detalhe.
