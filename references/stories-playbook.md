# Stories Playbook

Lugar CANONICO das regras de Story do framework Content Team AI. Complementa o `references/viral-playbook.md`, que continua mandando em gancho, CTA e proibicoes globais.

## Proposito

Story nao e feed em formato vertical. Tem outra audiencia, outro tempo de vida e outro voto. Este arquivo consolida o que vale pra QUALQUER cliente na hora de produzir uma sequencia de Stories.

Se uma regra aparece aqui e tambem num `brand-profile.md`, **este arquivo perde**: regra de cliente sempre manda sobre regra generica.

## Escopo

Entra aqui: mecanica de Story, os 4 tipos editoriais, arco narrativo, limite de texto por tela, imagem vs texto puro, anti-padroes, diferenca de voz.

NAO entra aqui: voz e bordoes de um cliente (fica no `brand-profile.md`), cores e tokens (fica no `design-system.md`), o metodo tecnico de render PNG (fica em `skills/ct-story/SKILL.md`).

## Como usar

- `ct-story` le ANTES de montar qualquer sequencia.
- `ct-diretor` le antes de delegar Story.
- `ct-redator` le quando o texto do Story nasce dele.
- Ordem de precedencia: `brand-profile.md` do cliente > `design-system.md` > este playbook > `viral-playbook.md` > references genericas.
- Aprendizados genericos de Story (diario de stories, destaque nomeado pelo problema do leitor, story de venda como outro produto): `references/aprendizados-de-producao.md` secao 6.

## Status de evidencia (legenda)

Toda regra abaixo carrega um status. Sem status = regra invalida, nao siga.

| Status | Significa | Como tratar |
|---|---|---|
| `[MEDIDO]` | Tem dado real de conta do cliente ativo, com numero e fonte | Confiar. Reavaliar quando o cockpit atualizar |
| `[MECANICA]` | Decorre de como a plataforma (ou o nosso design system) funciona, verificavel na propria UI/doc/arquivo | Confiar. Revalidar se a plataforma ou o token mudar |
| `[HIPOTESE]` | Veio de fonte externa, de opiniao ou de raciocinio nosso sem validacao | Tratar como a testar. Nao apresentar como verdade |

Regra dura: **se nao tem evidencia, marque `[HIPOTESE]`. Nunca invente numero.**

**Aviso de calibragem honesta:** este kit nao traz dado proprio de Story de nenhum cliente. Cada cliente mede o seu (secao 0). O que nunca existe retroativamente e **retencao por tela**: quantas pessoas aguentaram ate a tela 3, quem saiu onde, qual sequencia reteve mais. O insight por-story vive 24h e morre com a story. Por isso quase toda regra de ARCO aqui e `[MECANICA]` ou `[HIPOTESE]`. Leia assim.

---

## 0. DADO DE STORY (o que medir, e o que ele NAO responde)

`[MECANICA]` O que a API entrega de Story por conta sao metricas agregadas por dia, via `GET /me/insights?metric={views|reach|total_interactions}&period=day&metric_type=total_value&breakdown=media_product_type` (token IGAA da conta). Cada cliente levanta a propria serie e o proprio share de Story nas views da conta.

`[HIPOTESE]` Ressalva ao ler o share de Story: ele sobe quando as views totais da conta caem (por exemplo, fim de anuncio pago: a dimensao `AD` some do breakdown) sem Story ter crescido. O denominador encolheu. Sempre olhar a serie, nao so o percentual.

### 0.1 O que este dado NAO e, e nunca vai ser

`[MECANICA]` **Isto NAO e retencao por tela.** O agregado por dia soma todas as telas daquele dia. Ele nao sabe:

- quantas telas foram publicadas
- em que ordem
- quem saiu na tela 3
- qual sequencia reteve mais
- qual dos 4 tipos funciona melhor

`[MECANICA]` **Dividir view por tela pra "estimar retencao" e numero inventado. Nao facam.** `navigation` (tap_forward, tap_back, exit) so existe por-story, dentro das 24h de vida. Nao ha retencao por tela retroativa e nunca havera: testado `/me/stories`, `/me/media` paginado ate o fim (nao lista Story), `/me/highlights` (edge nao existe) e media-id de tela de destaque com controle positivo e negativo (a API o trata como id inventado).

`[MECANICA]` O que o agregado responde: **"quanto Story rendeu neste dia"**. Nunca **"esta sequencia funcionou"**.

`[MECANICA]` `total_interactions` de Story agrega like e reply e nao separa os dois. `[HIPOTESE]` Se for baixissimo, e compativel com "ninguem responde porque nunca se pergunta" (ver secao 7.1), mas a metrica sozinha nao fecha o argumento.

### 0.2 Coleta daqui pra frente

`[MECANICA]` O insight por-story completo existe **de agora em diante**, se a coleta rodar dentro das 24h. `scripts/analytics/collect-story-insights.mjs` faz isso, cron a cada 4h. Story postada e vencida no intervalo passa em branco.

---

## 1. POR QUE STORY E DIFERENTE DE FEED

| Fato | Consequencia editorial | Status |
|---|---|---|
| Story aparece na barra do topo, para quem **ja segue** a conta | Nao precisa se apresentar nem provar quem voce e a cada tela. O feed capta, o Story aprofunda | `[MECANICA]` |
| Story expira em **24h** | Custo de errar e baixo. Serve pra material cru, bastidor, work in progress. Nao precisa do acabamento do feed | `[MECANICA]` |
| A sequencia e consumida **em ordem**, tela por tela | Existe arco. Tela 2 pode depender da tela 1, coisa que o feed nunca permite | `[MECANICA]` |
| O tap-forward avanca; o tap-hold pausa; o swipe-up sai da conta | **O unico voto real e continuar assistindo.** Nao ha like publico nem contagem de compartilhamento visivel na tela | `[MECANICA]` |
| Enquete, caixinha de pergunta, quiz e slider sao mecanicas nativas de resposta | Existe uma acao de baixissimo atrito disponivel que o feed nao tem | `[MECANICA]` |
| Story fica visivel no topo por 24h independente de horario de pico do feed | Menos dependencia de horario "ideal" que o feed | `[HIPOTESE]` |
| Se enquete/caixinha aumenta alcance | Nao sabemos. Ninguem mediu isso na nossa conta | `[HIPOTESE]` |

### O que isso muda na escrita

`[MECANICA]` A metrica que importa e **quantas telas a pessoa aguenta**. Cada tela precisa fazer a proxima parecer necessaria. Uma tela que fecha o assunto no meio da sequencia mata o resto dela.

`[MECANICA]` O Story e o unico formato onde o **bastidor** cabe naturalmente: audiencia ja seguidora, expiracao em 24h, sem exigencia de acabamento. Nao desperdice o formato repostando o carrossel do feed.

---

## 2. O ARCO NARRATIVO PADRAO (3-5 telas por DISCIPLINA, nao por performance)

Story avulso nao existe no nosso padrao. Toda sequencia tem arco.

### 2.0 O teto de 5 telas: por que ele existe, e o que ele NAO e (LEIA ANTES)

`[HIPOTESE]` Passar de 5 telas **nao prejudica retencao por si so: nao ha base pra isso.** O teto nao tem evidencia a favor, e duas frentes independentes apontam contra:

| Frente | O que diz | Fonte |
|---|---|---|
| **Dado externo grande** | Exit rate **cai** de forma continua ate a tela 9 (23,8% na t1, 20,5% na t2, 18,5% na t3, 13,3% na t9) e o reach **sobe ate a tela 13** (37,8%), so caindo depois da 13. Nada no dado indica penalidade em 6, 7 ou 8 | Socialinsider, N=161.180 Stories, jan a mai/2025. `references/instagram-stories-algorithm.md` secao 4.1 |
| **Pratica do nicho** | Perfis tecnicos B2B publicam sequencias longas de ensino (mais de 15 telas em um dia) e guardam em destaque | Observacao em perfis publicos de nicho tecnico |

`[HIPOTESE]` **A unica coisa a favor do teto de 5 e opiniao de agencia sem amostra publicada** (guia brasileiro de algoritmo 2026: "3 a 5 stories com comeco meio e fim funcionam melhor que 20 seguidos"). Convergencia com opiniao nao e validacao.

**Entao por que mantemos 3-5 como default?**

`[HIPOTESE]` Por **disciplina editorial, nao por performance**. Tres motivos honestos:

1. Cabe na rotina. Sequencia de 5 sai numa sessao de trabalho, sequencia de 12 vira projeto e nao acontece.
2. Se voce precisa de 8 telas pra um bastidor, provavelmente esta enchendo linguica. O teto forca o corte.
3. Sem retencao por tela medida (ver secao 0.1), ninguem sabe se uma sequencia de 7 ou 9 telas funcionou. Nao da pra "seguir o que funcionou" sem esse dado.

**Nunca escreva nem repita "retencao cai depois de 5 telas". Isso e mentira.** O criterio e "a ideia acabou", nao "chegou na tela 5".

### 2.0.1 Excecao nomeada: SEQUENCIA DE ENSINO

`[HIPOTESE]` Existe um formato legitimo que estoura o teto e **nao precisa de aprovacao caso a caso**: a **sequencia de ensino ou de bastidor longo**.

Quando cabe:
- A materia-prima e um **manual**, nao um arco: N passos de um procedimento, N armadilhas de um processo, a construcao inteira de uma coisa do zero.
- Cada tela e **util sozinha**. A pessoa que sai na tela 6 levou 6 coisas, nao levou meia historia.
- Modelo observado em perfis tecnicos: sequencia longa nomeada pelo problema do leitor, nao pelo vocabulario interno da empresa.

Como fazer:
- Ate **13 telas**. Acima disso o unico dado que existe (Socialinsider) mostra o reach caindo. `[HIPOTESE]`
- A tela 1 continua sendo a barreira: a sangria mora nas 3 primeiras telas em toda fonte externa. Abrir com prova visual real. `[HIPOTESE]`
- **Nao e arco.** Nao force tensao e virada num manual. Ver secao 3 pra escolher o tipo certo.
- Vale registrar como teste: e a lacuna 1 da secao 10.

Fora dessa excecao, o default e 3-5 e a decisao de esticar e do `ct-diretor`, nao do impulso do momento.

| Tela | Papel | Regra | Status |
|---|---|---|---|
| **1. Gancho concreto** | Uma cena, um objeto, um numero real. A pessoa entende o assunto sem contexto anterior | **Nunca pergunta retorica.** Nunca "voce sabia que", "POV", "olha isso" | `[MECANICA]` (a tela 1 e a unica garantida; as outras dependem de nao dar tap) |
| **2. Tensao** | O problema real, do jeito que aconteceu. O que estava quebrado, travado, errado | Tem que ser um problema que o publico daquele cliente reconhece como dele | `[HIPOTESE]` |
| **3. Virada** | O que foi feito. Concreto, especifico, verificavel | Aqui aparece o metodo. **Mostrado, nunca anunciado** | `[HIPOTESE]` |
| **4. Insight** | O que generaliza. A frase que a pessoa leva pro trabalho dela | Um insight, nao tres. Se tem tres, sao tres sequencias | `[HIPOTESE]` |
| **5. Fechamento leve** | Pergunta aberta ou caixinha. Fim de conversa, nao fim de pitch | **Nunca oferta.** Ver secao 7 | `[MECANICA]` (caixinha e recurso nativo) |

### Quando cortar pra 3 telas

`[HIPOTESE]` Corte pra 3 quando qualquer uma for verdade:

- A materia-prima e **um fato so** (um bug, um print, uma decisao). Esticar pra 5 vira enchimento.
- Tensao e virada sao **a mesma tela** na pratica (o problema e a solucao estao na mesma imagem).
- O insight ja esta obvio na virada. Repetir insulta o leitor.
- E ROTINA (ver secao 3), que por natureza nao tem tensao dramatica.

Formato de 3 telas: **gancho concreto, virada, fechamento leve.** Tensao entra dentro do gancho em uma linha, o insight entra dentro da virada.

### Por que o arco funciona: causalidade, nao suspense

`[HIPOTESE]` O arco de 5 telas e uma story spine (Kenn Adams, 1991, adotada pela Pixar): "Era uma vez... Todo dia... Ate que um dia... Por causa disso... Ate que finalmente... E desde entao". O motor dela e **causalidade** ("por causa disso"), nao surpresa. Tela 2 e "ate que um dia" (evento datado e especifico, nao condicao generica), tela 3 e "por causa disso", tela 4 e "ate que finalmente" (o loop aberto na tela 2 fecha aqui, senao a pessoa sai frustrada e nao curiosa), tela 5 e "e desde entao". Em ROTINA nao ha "ate que um dia", por isso ela corta pra 3 telas.

`[HIPOTESE]` O efeito Zeigarnik (tarefa interrompida e lembrada melhor que a concluida) explica por que uma tela que fecha o assunto no meio da sequencia mata o resto dela. A aplicacao honesta e so essa. "Empilhar open loops" e "parte 2 amanha" e retencao artificial: nao adotar. O loop util e o de conteudo, em que a tela 2 so faz sentido depois da tela 1 porque a informacao pede.

`[HIPOTESE]` Default de 5 telas por sequencia. Passar disso e decisao editorial do `ct-diretor`, nao do impulso do momento, **e nao e proibido**: ver a secao 2.0 (o teto e disciplina, nao performance) e a excecao de SEQUENCIA DE ENSINO na 2.0.1.

---

## 3. OS 4 TIPOS DE STORY

### As 4 fontes de materia-prima

| # | Fonte | O que e |
|---|---|---|
| **F1** | **Chat** | Foto ou print que o usuario manda na hora na conversa |
| **F2** | **Acervo** | Fotos, renders, videos e desenhos que a marca ja tem (pasta indicada pelo usuario) |
| **F3** | **Texto puro** | Sem imagem. So a tela de texto |
| **F4** | **Sessao** | Contexto da propria sessao de trabalho: discussao, bug resolvido, decisao tomada no terminal ou em reuniao |

---

### 3.1 BASTIDOR

**Quando usar:** quando existe um artefato real pra mostrar. Trabalho em andamento, tela de terminal, print de erro, documento ou modelo aberto. `[MECANICA]` (o formato existe pra isso: audiencia ja seguidora + 24h + sem exigencia de acabamento)

**Fonte tipica:** F1 (foto na hora), F2 (acervo), F4 (print da sessao).

**Arco (5 telas):**

| Tela | Papel |
|---|---|
| 1 | A imagem crua, com uma linha que nomeia o que se ve |
| 2 | Por que aquilo estava ali. O problema atras da imagem |
| 3 | O que foi feito com aquilo |
| 4 | O que isso ensina pra quem faz o mesmo trabalho |
| 5 | Pergunta aberta |

**Exemplo completo, perfil pessoal de consultor:**

```
STORY 1  (imagem: print do terminal com a fila de erro)
Isso aqui e a fila de erro de um agente
que rodou a madrugada inteira sozinho.

STORY 2  (texto puro)
Ele processou tudo certo e travou no final.
Nao era o modelo. Era o formato de uma data
que a API do cliente devolve diferente
uma vez a cada mil chamadas.

STORY 3  (texto puro)
Coloquei o caso na base de conhecimento dele.
Agora, quando encontra essa data, ele trata
e segue. Nao me chama de madrugada.

STORY 4  (texto puro)
Agente bom nao e o que nunca erra.
E o que guarda o erro que ja viu
e nao repete.

STORY 5  (caixinha de pergunta)
Qual foi o ultimo erro que voce teve
que explicar duas vezes pro mesmo sistema?
```

**Exemplo completo, empresa B2B de servicos (logistica):**

```
STORY 1  (imagem: doca de carga, caminhao parado)
Doca 3, 6h40 da manha.
Caminhao chegou 2 horas antes do horario.

STORY 2  (texto puro)
Sem janela de descarga, ele entra na fila.
Fila na doca vira atraso na entrega
do cliente no fim do dia.

STORY 3  (imagem: painel de agendamento)
Aqui a janela foi remarcada na hora,
pelo painel, antes do caminhao encostar.

STORY 4  (texto puro)
A maior parte do atraso nasce no agendamento.
E no agendamento que sai barato resolver.

STORY 5  (caixinha de pergunta)
Na sua operacao, a janela de descarga
e combinada antes ou na hora?
```

---

### 3.2 ROTINA

**Quando usar:** pra mostrar como o trabalho acontece de verdade, sem evento dramatico. E o tipo que constroi familiaridade. `[HIPOTESE]`

**Fonte tipica:** F1, F4.

**Arco (3 telas, por natureza):** rotina nao tem tensao. Forcar tensao aqui vira novela.

| Tela | Papel |
|---|---|
| 1 | A cena. O que esta acontecendo agora |
| 2 | Como funciona. O criterio, o ritmo, a ordem |
| 3 | Fechamento leve |

**Exemplo completo, perfil pessoal de consultor:**

```
STORY 1  (imagem: foto da tela com varias sessoes abertas)
Segunda de manha, antes de qualquer reuniao:
eu leio o que os agentes fizeram no fim de semana.

STORY 2  (texto puro)
Nao e relatorio bonito. E uma lista do que rodou,
o que travou e o que eles aprenderam sozinhos.
Leva 15 minutos. Define a semana inteira.

STORY 3  (caixinha de pergunta)
Como comeca a sua segunda?
```

**Exemplo completo, empresa B2B de servicos (logistica):**

```
STORY 1  (imagem: sala de despacho, telas com as rotas do dia)
Toda segunda, 7h, despacho e operacao
na mesma sala. Rotas da semana na tela.

STORY 2  (texto puro)
Cada rota e revisada em voz alta.
Problema que aparece ali, sai resolvido dali.
Nao vira ligacao no meio da entrega.

STORY 3  (caixinha de pergunta)
Quem revisa as rotas da sua semana,
e quando?
```

---

### 3.3 DISCUSSAO

**Quando usar:** quando houve divergencia real. Duas opcoes defensaveis, uma escolha feita. `[HIPOTESE]` (o tipo "contraste" da taxonomia do `viral-playbook.md` secao 1 esta como `[HIPOTESE]`, e este tipo herda isso)

**Fonte tipica:** F4 (discussao da sessao ou da reuniao), as vezes F1 (print da conversa).

**Regra dura:** so publique DISCUSSAO se a divergencia aconteceu de verdade. Divergencia inventada pra criar tensao e prova social fabricada, proibida pelo `viral-playbook.md` secao 5.

**Arco (4-5 telas):**

| Tela | Papel |
|---|---|
| 1 | A pergunta em disputa, dita como foi dita |
| 2 | Lado A, com o argumento honesto de quem defendeu |
| 3 | Lado B, tambem honesto. Se o lado B parece burro, voce nao entendeu o lado B |
| 4 | O que decidimos e por que |
| 5 | Enquete ou pergunta aberta |

**Exemplo completo, perfil pessoal de consultor:**

```
STORY 1  (texto puro)
Discussao de hoje aqui:
o agente devia perguntar antes de agir,
ou agir e avisar depois?

STORY 2  (texto puro)
Perguntar antes: nada acontece sem aprovacao.
Seguro. So que, na pratica, vira uma fila
de perguntas que ninguem responde.
O agente para.

STORY 3  (texto puro)
Agir e avisar: fluido, roda sozinho.
E quando erra, erra ja feito.
Em coisa reversivel, tudo bem.
Em coisa que mexe com dinheiro, nao.

STORY 4  (texto puro)
Ficou assim: age sozinho no que da pra desfazer,
pergunta no que nao da.
A regra nao e sobre confianca no agente.
E sobre o custo de desfazer.

STORY 5  (enquete: Perguntar antes / Agir e avisar)
No seu caso, qual seria?
```

**Exemplo completo, empresa B2B de servicos (logistica):**

```
STORY 1  (texto puro)
Discussao desta semana:
frota propria ou frota terceirizada
para a rota do interior.

STORY 2  (texto puro)
Propria: controle total do horario,
motorista treinado. Custa mais parada
e mais manutencao.

STORY 3  (texto puro)
Terceirizada: custo variavel, sem frota ociosa.
Pede contrato claro de prazo e de avaria,
senao o problema volta pra nos.

STORY 4  (imagem: planilha comparando custo por entrega)
Ficou terceirizada nas rotas de baixo volume.
Decisao tomada com o custo por entrega
na frente, nao no palpite.

STORY 5  (caixinha de pergunta)
Essa conta voces fazem antes
ou descobrem no fim do mes?
```

---

### 3.4 INSIGHT

**Quando usar:** quando existe uma ideia generalizavel que nasceu de trabalho real. `[HIPOTESE]`

**Fonte tipica:** F3 (texto puro) ou F4.

**Regra dura:** INSIGHT sem lastro e frase de LinkedIn motivacional. A tela 2 obrigatoriamente ancora o insight em um caso concreto. Se voce nao consegue escrever a tela 2, voce nao tem um insight, tem uma opiniao.

**Arco (3-4 telas):**

| Tela | Papel |
|---|---|
| 1 | A afirmacao, seca |
| 2 | De onde ela saiu. O caso concreto |
| 3 | O que muda na pratica pra quem ouviu |
| 4 | Pergunta aberta |

**Exemplo completo, perfil pessoal de consultor:**

```
STORY 1  (texto puro)
A parte cara de montar um sistema com IA
nao e a IA.

STORY 2  (texto puro)
No ultimo projeto, o agente ficou pronto
em dois dias. Organizar a base de conhecimento
que ele le, com o que a empresa ja sabia
mas nunca tinha escrito, levou tres semanas.

STORY 3  (texto puro)
Por isso o primeiro trabalho nunca comeca
no modelo. Comeca perguntando onde esta
o conhecimento da casa hoje,
e quem e o dono dele.

STORY 4  (caixinha de pergunta)
Onde fica o conhecimento da sua empresa hoje?
```

**Exemplo completo, empresa B2B de servicos (logistica):**

```
STORY 1  (texto puro)
Entrega nao e lugar de decidir.
Entrega e lugar de cumprir o combinado.

STORY 2  (imagem: motorista aguardando na doca)
Toda decisao que sobra pra estrada
chega com motorista parado esperando resposta.
O relogio nao para enquanto se decide.

STORY 3  (texto puro)
Por isso a rota fecha antes da saida.
O motorista cumpre, nao improvisa.

STORY 4  (caixinha de pergunta)
Quantas decisoes de rota
voces ainda tomam com o caminhao na rua?
```

---

## 4. REGRAS DE TEXTO POR TELA

### Quanto cabe, de verdade

`[MECANICA]` Geometria do canvas, derivada de `skills/ct-story/SKILL.md`:

| Formato | Canvas | Area util de texto | Fonte | Linha |
|---|---|---|---|---|
| Texto puro | 1080x1920 | 936px de largura (1080 menos 72px de cada lado), ~1760px de altura | Inter 46px | line-height 1.5 = 69px |
| Texto com imagem | 1080x1920 | imagem 1080x960 no topo, texto em 936px x ~840px | Inter 42px | line-height 1.5 = 63px |

`[MECANICA]` Em Inter regular, a largura media de caractere fica em torno de 0.5em. A 46px isso da **~40 caracteres por linha** antes da quebra.

`[HIPOTESE]` Limites de conforto que adotamos (nao medidos, adotados por leitura):

| Formato | Maximo | Por que |
|---|---|---|
| Texto puro | **~320 caracteres** (~8 linhas) | Acima disso o bloco vira paragrafo, e o leitor da tap antes de ler |
| Texto com imagem | **~180 caracteres** (~5 linhas) | A metade inferior e menor e a imagem ja carrega parte da mensagem |
| Tela 1 (gancho) | **~120 caracteres** | O gancho tem que ser lido antes do polegar decidir |

**Se nao cabe, a tela esta errada, nao a fonte.** Nunca reduza o corpo pra enfiar mais texto. Quebre em duas telas ou corte a ideia.

### Ritmo

- `[HIPOTESE]` **Uma ideia por tela.** Se a tela tem "e" ligando dois assuntos, sao duas telas.
- `[HIPOTESE]` Frases curtas com quebra de linha manual, no ponto onde a fala respira. O texto e lido no ritmo de quem fala, nao de quem escreve.
- `[MECANICA]` **Zero travessao e traco longo.** Virgula, ponto, parenteses ou dois-pontos. Regra do framework, repetida no `viral-playbook.md` secao 5.
- `[MECANICA]` Acentuacao completa e correta, sempre. UTF-8 no arquivo.

---

## 5. IMAGEM VS TEXTO PURO

`[HIPOTESE]` Use **imagem** quando:

- A imagem e **prova**: o trabalho existe, o documento existe, o erro esta na tela. `[HIPOTESE]` no feed, case com prova visual real tende a bater serie de erro sem prova visual (ver `viral-playbook.md` secao 1). **Isso e hipotese de FEED, nao de Story.** A leitura pra Story e extrapolacao.
- A imagem carrega informacao que o texto gastaria 3 linhas pra descrever.
- E tela 1 e o assunto tem forma fisica.

`[HIPOTESE]` Use **texto puro** quando:

- A ideia e abstrata (INSIGHT, DISCUSSAO). Imagem decorativa atras de texto abstrato so rouba contraste.
- A unica imagem disponivel e stock, ilustracao generica ou print ilegivel. **Sem imagem e melhor que imagem ruim.**
- E tela de virada ou de insight, onde a frase precisa do palco inteiro.

`[MECANICA]` **A imagem e o texto nunca dizem a mesma coisa.** Se a foto mostra o desenho, o texto nao escreve "este e o desenho". O texto diz o que o desenho nao consegue dizer.

`[MECANICA]` Print de tela precisa ser legivel a 1080px de largura no celular. Se o texto do print nao se le, recorte a regiao que importa ou descreva em texto puro. Print ilegivel e ruido.

`[HIPOTESE]` Numa sequencia de 5, alternar. Cinco telas de texto puro seguidas viram um documento. Cinco telas de imagem viram um album sem tese.

---

## 6. ANTI-PADROES (NUNCA)

**Editorial**

- `[MECANICA]` **Bordao proibido: "nao e a ferramenta, e o metodo"** e toda variacao. Regra global, `viral-playbook.md` secao 5 e `clients/{slug}/brand-profile.md` do cliente ativo. Mostre o metodo, nao anuncie que tem um.
- `[MECANICA]` **Sem hype.** "Revolucionario", "incrivel", "game changer", "isso vai mudar tudo". Proibido.
- `[MECANICA]` **Sem auto-referencia.** "Nesse story voce vai ver", "presta atencao que isso e importante", "fiz esses stories porque". Entregue.
- `[MECANICA]` **Sem pergunta retorica como gancho.** "Voce sabia que", "POV:", "adivinha o que aconteceu". Anti-padrao do framework (ver `viral-playbook.md` secao 1), sem evidencia a favor.
- `[HIPOTESE]` **Sem story isolado sem arco.** Uma tela solta nao e Story, e recado. Se e recado, e recado, nao gaste o formato.
- `[MECANICA]` **Texto que repete a imagem.** Ver secao 5.
- `[MECANICA]` **Print ilegivel.** Ver secao 5.
- `[MECANICA]` **Numero sem fonte.** Todo numero que vai pra tela e real e rastreavel. `viral-playbook.md` secao 6.
- `[MECANICA]` **Travessao e traco longo.** Em qualquer tela.

**Venda**

- `[MECANICA]` **Nenhuma CTA de venda em Story de bastidor, rotina, discussao ou insight.** Ver secao 7.
- `[MECANICA]` **"Comenta PALAVRA" nao existe em Story.** Esse CTA e de legenda de post no IG, TikTok e YouTube Shorts (`viral-playbook.md` secao 4). Story tem caixinha, que e melhor e nativa.
- `[MECANICA]` **Link na bio / arraste pra cima nao entram nestes 4 tipos.** Story de venda e outro produto, com outra decisao editorial.

---

## 7. FECHAMENTO SEM VENDA (REGRA DURA)

### 7.1 Aviso: esta regra e pratica, nao descricao

`[MECANICA]` Reply em DM e o unico sinal que e simultaneamente ranking (citado por Mosseri e pela doc da Meta), relacionamento (alimenta closeness pra proxima vez) e pipeline comercial. Caixinha de pergunta e o unico sticker cuja mecanica gera DM de verdade. Ver `references/instagram-stories-algorithm.md` secao 3.

`[HIPOTESE]` Muitas contas nunca usaram sticker de conversa (caixinha, enquete, quiz, slider): so stickers de distribuicao (repost de feed, mencao, musica, localizacao, link). Conferir nos destaques do cliente, lendo o metadado de sticker de cada tela. Se a conta nunca usou, "nao vender" acontece por **nao fechar**, nao por fechar direito, e a pergunta "se caixinha aumenta alcance" nao esta aberta por falta de instrumentacao: **esta aberta por falta de habito.** A primeira caixinha da conta e um experimento, nao uma rotina. O mesmo vale pros 4 tipos da secao 3: e um repertorio proposto, nao uma descricao do que a conta faz.

### 7.2 A regra

`[MECANICA]` Story de BASTIDOR, ROTINA, DISCUSSAO e INSIGHT fecha com **pergunta aberta** ou **caixinha de pergunta / enquete**. Nunca com oferta, nunca com link, nunca com "fala comigo".

Motivo: os 4 tipos existem justamente pra nao vender. A audiencia ja segue. Vender no fim de um bastidor transforma o bastidor em anuncio retroativo, e o proximo bastidor ja e lido como anuncio. `[HIPOTESE]` quanto ao efeito medido, `[MECANICA]` quanto a intencao editorial declarada.

Fechamentos validos:

| Recurso | Quando | Status |
|---|---|---|
| Caixinha de pergunta | Quando voce quer a resposta em texto e ela pode virar conteudo depois | `[MECANICA]` |
| Enquete (2 opcoes) | Fim de DISCUSSAO, onde as duas opcoes ja estao na mesa | `[MECANICA]` |
| Pergunta aberta em texto, sem sticker | Quando a pergunta e mais pra pensar do que pra responder | `[MECANICA]` |

`[HIPOTESE]` A pergunta e especifica do assunto que acabou de passar. Pergunta generica ("e voce, o que acha?") nao e fechamento, e falta de fechamento.

---

## 8. VOZ EM STORY: PESSOA X EMPRESA (fonte: brand-profile de cada cliente)

A fonte da voz continua sendo o `brand-profile.md` de cada cliente. Aqui fica so o que tende a mudar **especificamente em Story**.

| Dimensao | Perfil pessoal (consultor, fundador) | Conta institucional (empresa) |
|---|---|---|
| Pessoa | Primeira pessoa do singular. "Eu montei", "eu travei nisso" | Primeira do plural ou impessoal. "A equipe resolveu", "foi detectado na revisao". A empresa nao e pessoa |
| Registro | Conversa de profissional senior. Pode ser informal, nunca giria de guru | Tecnico e acessivel. Autoridade sem arrogancia |
| Emoji | Com moderacao, quando serve de marcador. Nunca substituindo palavra | Conforme o `brand-profile.md`. Na duvida, nenhum |
| Erro proprio | Pode e deve aparecer. Bastidor de erro constroi confianca | Erro aparece como **contexto tecnico dentro de um case resolvido**, nao como confissao. `[HIPOTESE]` |
| Frases-ancora | Ver `brand-profile.md`. Nunca o bordao proibido | Banco em `voice-patterns.md` do cliente |
| Fechamento | Caixinha ou pergunta direta e conversacional | Pergunta tecnica especifica, no registro do `voice-patterns.md` |
| Confidencialidade | Cliente pode ser citado se ja e publico | Nunca nome de cliente sem autorizacao. No maximo a regiao ou o setor. Regra do `brand-profile.md` |
| Visual | Ver `clients/{slug}/design-system.md` do cliente | Ver `clients/{slug}/design-system.md` do cliente. Vertical 1080x1920 |

---

## 9. QA (antes de renderizar)

**Arco**
- [ ] Tem 3, 4 ou 5 telas (default)? **Se tem mais, e SEQUENCIA DE ENSINO declarada (secao 2.0.1) com cada tela util sozinha, e nao arco esticado?** Nunca 1 tela solta
- [ ] Tela 1 abre em cena, objeto ou numero concreto, sem pergunta retorica?
- [ ] **Teste de causalidade:** leia tela N, depois "POR CAUSA DISSO", depois tela N+1. Se soar como "e ai", as telas estao soltas e uma das duas esta errada
- [ ] Cada tela faz a proxima parecer necessaria?
- [ ] Uma ideia por tela?
- [ ] Se e DISCUSSAO: a divergencia aconteceu de verdade e o lado B esta defendido honestamente?
- [ ] Se e INSIGHT: existe a tela de lastro concreto?

**Texto**
- [ ] Cada tela cabe no limite da secao 4 (~320 texto puro, ~180 com imagem, ~120 no gancho)?
- [ ] Zero travessao e traco longo?
- [ ] Acentuacao completa, UTF-8?
- [ ] Todo numero e real e rastreavel?
- [ ] Nenhum bordao proibido, nenhum hype, nenhuma auto-referencia?
- [ ] O texto e para o SEGUIDOR, sem linguagem de processo da producao ("versao", "ajustei", "conforme o briefing")?

**Imagem**
- [ ] A imagem e prova, e nao decoracao?
- [ ] O texto diz algo que a imagem nao diz?
- [ ] Todo print e legivel a 1080px no celular?

**Fechamento**
- [ ] Fecha com pergunta aberta ou caixinha, e nao com oferta?
- [ ] A pergunta e especifica deste assunto?
- [ ] Nenhum "comenta PALAVRA", nenhum link, nenhum "arraste pra cima"?

**Cliente**
- [ ] `clients/active-client.md` conferido e o `brand-profile.md` carregado?
- [ ] Voz, emoji e tokens visuais vieram do cliente, e nao deste arquivo?
- [ ] Se o cliente exigir tom formal: zero emoji, zero gíria, zero nome de cliente?

**Aprovacao**
- [ ] Textos de TODAS as telas apresentados ao usuario e aprovados ANTES de renderizar PNG?

---

## 10. Lacunas conhecidas / a validar

### 10.1 Lacunas em aberto

| # | Hipotese aberta | Como validar |
|---|---|---|
| **1** | Numero ideal de telas. O teto de 5 e disciplina editorial, nao performance (secao 2.0) | Rodar a mesma materia-prima em 5 telas (arco) e em 8 a 10 (didatico), 4 pares, 4 semanas. Metrica: **DMs recebidas**, nao completion |
| **2** | Se caixinha e enquete aumentam alcance. Aberta por falta de PRATICA, nao de instrumentacao (secao 7.1) | Usar caixinha de forma recorrente por algumas semanas e ler reply e alcance |
| **3** | Qual dos 4 tipos retem mais, por cliente | Taggear tipo por sequencia em `ct_content_items` e cruzar com retencao. So vale pra Story nova (ver A) |
| **4** | Se o limite de ~320 chars por tela e o ponto certo de corte | A/B: mesma ideia em 1 tela cheia vs 2 telas curtas, comparar tap-forward |
| **5** | Se "case positivo bate narrativa de erro" (hipotese de FEED) vale tambem em Story | Story tem audiencia ja seguidora, que pode tolerar erro melhor que o feed. Testar antes de assumir |
| **6** | Se imagem retem mais que texto puro em Story | Comparar telas de texto puro vs com imagem dentro da mesma sequencia. O benchmark externo nao resolve: se contradiz por faixa de seguidor |
| **7** | Se fechar sem venda preserva a confianca ao longo do tempo (tese da secao 7) | So mensuravel no longo prazo, e depende de comecar a fechar (secao 7.1) |
| **8** | Horario de publicacao de Story | A serie diaria agregada da **dia da semana**, nao hora. Melhor que nada, longe do heatmap 7x24 |
| **A** | **Retencao por tela e irrecuperavel pra tudo que ja foi publicado.** Nao existe caminho, testado com controle positivo e negativo | Nao validar. **Aceitar.** So a coleta de 4 em 4h daqui pra frente produz esse dado, e so pra Story nova |
| **B** | Se a sequencia de ENSINO (6 a 13 telas, secao 2.0.1) retem no publico do cliente | Mesmo teste da lacuna 1 |
| **C** | Cadencia de Story. A mediana observada em benchmark de terceiro e ~3 sequencias por semana na faixa de 1k a 5k seguidores; a recomendacao do Mosseri e cerca de 4x isso | Decisao editorial por cliente: 4 semanas em 1 por semana, 4 semanas em 3 por semana, olhando retencao **e** unfollows |
| **D** | Taxonomia de destaque. Os 4 tipos sao tipos de SEQUENCIA, nao de arquivo. Destaque nomeado pelo problema do leitor tende a servir melhor que nomeado por tipo interno (ninguem procura "insight") | Decidir em que destaque cada sequencia morre, antes de produzir mais |
| **E** | Conteudo antigo no destaque que contradiz as regras do `brand-profile.md` (emoji, nome de cliente, numero sem fonte) | Decisao do cliente: ou muda a regra, ou poda o acervo |

O resto deste arquivo e mecanica de plataforma e hipotese honesta. Nao cite nada daqui como numero do cliente: numero de cliente so vem do cockpit dele.
