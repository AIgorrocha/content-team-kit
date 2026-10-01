---
name: ct-peca
description: "Maestro do fluxo completo de uma peca de conteudo, da materia-prima ate o registro no banco: confere a materia-prima real, apura na fonte primaria, objeta antes de executar, fecha o Instagram primeiro com aprovacao, so depois adapta o LinkedIn, monta e higieniza as midias, mostra a previa, publica ou agenda so com 'pode' e registra. Usar quando o usuario mandar foto/video/audio de um trabalho ou entrega, pedir post/carrossel/peca sobre um caso, resultado ou marco da empresa, ou disser 'fluxo de sempre'. White-label: vale para qualquer cliente do framework."
owner: ct-diretor
metadata: { "kit": { "emoji": "🧭", "local_only": true } }
environment: local
---

# ct-peca: fluxo canonico de producao de uma peca

Skill de ORQUESTRACAO. Ela nao gera slide, nao publica e nao agenda por conta propria:
diz a ORDEM, os PORTOES BLOQUEANTES e o que conferir entre um passo e outro, e invoca as
skills que ja existem.

Codifica o fluxo padrao de producao de uma peca, do material bruto ate o registro.

## Nao reimplementar

| Precisa de | Chamar |
|---|---|
| Ingerir midia do iPhone | `skills/ct-icloud-inbox` |
| Gerar slide PNG (HTML + Playwright) | `skills/ct-carrossel-gen` (agente `ct-carrossel`) |
| Legenda e post | agente `ct-redator` |
| Agendar/publicar IG e LinkedIn | `skills/ct-agendar`, `skills/ct-publicar-ig`, `skills/ct-publicar-li` |
| Transcrever video ou audio do usuario | skill `/watch` (ou Whisper) |
| Registrar publicacao | `registerPublication()` de `scripts/publishing/_lib/register.mjs` |

Se um passo abaixo pedir algo que ja tem skill, invocar a skill. Codigo novo aqui so quando
nao existir dono.

## Cliente ativo (white-label)

Nada nesta skill e especifico de um cliente. Antes de qualquer passo:

1. Ler `.workspace` (campo `client`, e `icloud_inbox` se houver) ou env `CT_CLIENT`.
   Fallback: `clients/active-client.md`.
2. Carregar `clients/{slug}/brand-profile.md` e `clients/{slug}/design-system.md`.
3. Pedido de outro cliente: recusar e mandar abrir a pasta do cliente certo (um cliente por pasta, ver `.workspace`).

Precedencia de regra: `brand-profile.md` > `design-system.md` > `clients/{slug}/regras-cliente.md` >
demais references.

Convencoes de caminho usadas adiante:
- Peca: `content/{slug}/{formato}/{nome-kebab-case}/`
- Inbox (OPCIONAL, so quem usa o iCloud Inbox): caminho do `.workspace`, campo `icloud_inbox`. Sem inbox, a materia-prima vem do arquivo que o usuario enviou ou da pasta que indicou, e o Passo 0 vale igual.
- Entrega (OPCIONAL): `{pasta-de-entrega}\{Carroseis|Reels|Stories|Linkedin}\POSTAR-{nome}\`, so se o usuario tiver combinado uma pasta de entrega (Drive, Dropbox, celular). Sem ela, a peca fica em `content/{slug}/`.

---

## Passo 0. Materia-prima: conferir o arquivo, nao a descricao

Portao de realidade. A descricao falada e a materia-prima divergem por padrao.

1. Com iCloud Inbox: `node skills/ct-icloud-inbox/inbox.mjs list` e `ingest`. Sem ele: ler direto o arquivo ou a pasta indicada.
2. Para CADA arquivo: `ffprobe` (dimensao, rotation, fps, bitrate, duracao) e ABRIR o
   arquivo (ler a imagem, extrair frames do video). Nunca aceitar o que foi dito.
3. Conferir rotacao: `ffprobe -show_entries stream_side_data=rotation`. Container 1920x1440
   com `rotation=-90` EXIBE 1440x1920. Ignorar isso troca a solucao de formato inteira.
4. REPORTAR a divergencia antes de produzir qualquer coisa.

Exemplo: a capa descrita como "foto da equipe" era, no arquivo do inbox, uma nuvem de pontos.
Sem a conferencia, a peca seria montada em cima de uma capa inexistente.

Saida deste passo: lista `arquivo -> o que E de fato -> serve para qual slide`, com as
divergencias em destaque e o que esta FALTANDO nomeado como pendencia bloqueante.

## Passo 1. Apuracao na fonte primaria, ANTES de escrever

Obrigatorio sempre que a peca afirmar um fato verificavel: numero, prazo, cliente, resultado, data, cargo, marco ou recurso de produto.

1. Localizar a FONTE PRIMARIA do fato: o documento, contrato, relatorio, pagina oficial ou dado original de onde ele vem. Procurar na pasta da marca e nos arquivos compartilhados.
2. Extrair CITACAO LITERAL com pagina e item (ou URL). Nunca escrever a partir da memoria do usuario.
3. Montar um bloco de apuracao dentro do `roteiro-midia.md` da peca:

   | Afirmacao candidata | Status | Fonte |
   |---|---|---|
   | ... | CONFIRMADO / NAO ENCONTRADO / CONTRADITO | Documento de origem p. 3, item 2 |

4. Registrar o NAO ENCONTRADO com a mesma clareza do encontrado. Silencio vira numero
   inventado depois.
5. O que so existe na imprensa entra como ressalva explicita com URL, e nunca como se
   viesse do documento (regra de apuracao acima).

Por que este passo existe: a conferencia na fonte derruba causalidade inventada, confirma
vinculos com o texto do documento na mao e costuma revelar fatos que ninguem sabia, os
melhores ativos editoriais da peca.

### Modulo opcional: entrega tecnica

Vale so para marca que presta servico tecnico sob contrato (engenharia, arquitetura, consultoria, obra). Soma ao passo acima:

- Fonte primaria = edital, projeto basico, termo de referencia, contrato ou autorizacao de servico, com pagina e item. Conferir orgao, prazo e marco institucional ("projeto entregue").
- Nunca citar numero de contrato ou licitacao, ordem de servico, datas de assinatura ou prazo de execucao no post: entram o objeto (o que a empresa faz) e o cliente, se autorizado (`references/aprendizados-de-producao.md` itens 1.12 e 2.4).
- Norma, resolucao e sigla de conselho (CAU, CREA) viram a consequencia pratica na obra, no processo ou no custo (item 2.5).
- Pranchas e documentos tecnicos vao como JPG (nunca PDF no LinkedIn), com o carimbo tratado (Passo 5 e Passo 6).

## Passo 2. Objecao antes da execucao

Se o pedido contem afirmacao inverificavel, causalidade nao documentada ou superlativo
checavel ("o maior", "o primeiro", "por causa de"), DIZER ANTES de produzir, com a
alternativa defensavel ao lado.

Regra de encerramento: se ele reafirmar, EXECUTAR como ele pediu e registrar a ressalva no
relatorio final e no `roteiro-midia.md`. Nao repetir a objecao uma terceira vez.

## Passo 3. Instagram PRIMEIRO

PROIBIDO produzir IG e LinkedIn em paralelo. Cada correcao do usuario teria que ser aplicada
duas vezes e o LinkedIn seria reescrito a cada ajuste.

1. Delegar `ct-redator` (via `ct-diretor`) para a legenda do Instagram, e SO ela.
2. Voz do cliente ativo, conforme `brand-profile.md` e `voice-patterns.md` (registro, tamanho
   de frase, o que nunca dizer).
3. Sem travessao, sem cliche proibido, sem redundancia interna,
   hashtags minusculas no fim.
4. Levar SO a legenda do IG para aprovacao.

### PORTAO BLOQUEANTE 1: aprovacao do texto do Instagram
O fluxo PARA aqui. Sem "pode" ou "aprovado" explicito do usuario, nao existe passo 5.

## Passo 4. Ciclo de correcao

Quando o usuario ditar correcao, o DITADO E A FONTE:

- Corrigir gramatica, registro e quebra de linha. NUNCA reescrever o argumento dele.
- NUNCA devolver o que ele cortou.
- Havendo audio ou video sobre o tema, TRANSCREVER primeiro (`/watch`) e montar em cima da
  transcricao.

Se ele reprovar um PADRAO e nao so uma frase (por exemplo "a marca nao fala assim"):
1. Corrigir a FONTE DA MARCA que permitiu o erro: `brand-profile.md`, `design-system.md` ou
   `voice-patterns.md`. NUNCA editar `agents/` nem `skills/` numa instalacao do kit (gera conflito
   na proxima atualizacao).
2. Registrar em `clients/{slug}/regras-cliente.md` com data e o caso que motivou.
   Se o erro parecer do proprio kit (valeria pra qualquer empresa), oferecer `ct-reportar-problema`
   como sugestao de melhoria.
3. So depois corrigir o texto da vez.

Se a MESMA correcao vier tres vezes, o diagnostico esta errado: parar e perguntar com
opcoes concretas, nao ajustar no escuro.

## Passo 5. LinkedIn, adaptado do IG aprovado

So depois do portao 1.

- O post do LinkedIn e ADAPTACAO do IG APROVADO, nao peca irma.
- Se existir versao do LinkedIn escrita ANTES das correcoes, REESCREVER DO ZERO a partir do
  IG aprovado. Nao remendar.
- LinkedIn e STORYTELLING DO PROCESSO REAL, nunca ficha tecnica com paragrafos de atributo.
- Se o cliente ativo proibe dado contratual, numero de norma ou sigla de conselho (ver
  `regras-cliente.md`), dizer a CONSEQUENCIA PRATICA em vez do numero.
- Pergunta final: ESPECIFICA e so quando nascer natural do texto. Pergunta
  forcada fica pior que uma afirmacao tecnica firme. Nao abrir pelo cargo.
- Sem hashtag por padrao (se a marca usa, maximo 5). Imagem do LinkedIn: `linkedin-imagem.png` (1920x1080) ou os JPGs das folhas, conforme a peca.
- Link externo no PRIMEIRO COMENTARIO, nao no corpo (YouTube vai como cartao via `publish-linkedin-link.mjs`; excecao so se a marca registrou em `regras-cliente.md`).
- Aprovar o IG NAO aprova o LinkedIn. Colar o `post-linkedin.txt`
  INTEIRO no chat e PARAR. Sem "pode" nesse texto, nenhum `publish-linkedin-*.mjs`.
- **Modulo entrega tecnica: pranchas e documentos tecnicos em JPG, nunca PDF.** A interface do LinkedIn recusa PDF de folha. Raster no formato da folha. Uma por disciplina, a mais rica (3D/detalhe). Salvar na pasta da peca (e na pasta de entrega, se houver), mostrar. So depois publicar.
- Carimbo do cliente: tag so em nome/endereco/QR. Carimbo de terceiro: cobrir o bloco inteiro.

## Passo 5b. Twitter = LinkedIn partido, em fila

So para o cliente que tem X no `brand-profile.md`. Depois do LinkedIn aprovado:

```bash
node scripts/publishing/adapt-linkedin-to-x.mjs --slug {slug}
node scripts/publishing/enqueue-x.mjs --slug {slug}
```

Nao chamar `post.js`. A fila fica em `content/{slug}/fila-x/pending`; publique manualmente ou com a ferramenta que preferir. Pesquisa nao posta.

### Publicacao do LinkedIn: ordem unica (igual em `agents/ct-diretor.md` e `skills/ct-artigo-linkedin`)

1. **API** se a marca tiver o app LinkedIn configurado (`skills/ct-publicar-li`).
2. Sem app: **NAVEGADOR** (Claude in Chrome), so com "pode" explicito, pela rota abaixo.
3. Sem nenhum dos dois: entregar texto e imagem prontos e o usuario posta na mao.

Rota validada do navegador (Claude in Chrome):

1. `linkedin.com/company/{orgId}/admin/page-posts/published/`
2. "Comecar publicacao", digitar o texto no composer
3. "Adicionar midia". Localizar o `input[type=file]` com `find` e usar `file_upload`.
   **NUNCA clicar no input**: abre o dialogo nativo do sistema e trava a sessao.
4. "Avancar" e "Publicar"
5. Permalink: menu "..." do post, "Copiar link da publicacao", ou `javascript_tool`
   procurando `a[href*="/feed/update/"]`

Limitacoes duras:
- **LinkedIn NAO aceita imagem e video no mesmo post.** Peca com video vai so com as imagens,
  ou o video vira post separado. AVISAR o usuario sempre, antes de montar.
- `file_upload` tem teto de **10 MB somados**. Video grande nao passa por esse caminho.

## Passo 6. Midias

1. Montar os slides conforme o `roteiro-midia.md` da peca, via `ct-carrossel-gen` para os
   cards HTML e ffmpeg para os cards de video.
2. HIGIENIZACAO frame a frame, em todo asset: placa de veiculo, rosto de
   terceiro, cracha, logo de terceiro ou cliente, carimbo, registro profissional, endereco, QR, numero de
   processo, etiqueta de visitante. Regra canonica: `references/asset-sanitization.md`. Filtro por nome de arquivo nao basta: inspecao visual.
   Blur DESTRUTIVO (pixelizar, reamostrar NEAREST, gaussiano forte). Tarja semitransparente
   e blur leve sao recuperaveis, nao servem.
3. Decisao ja tomada pelo usuario sobre um asset (manter a placa, cortar tal trecho) e
   RESPEITADA e nao represtada.
2b. Foto de iPhone chega ROTACIONADA. Conferir orientacao e corrigir antes de qualquer coisa.
2c. Higienizacao, o que leva e o que nao leva (exemplo de decisao tomada numa peca):
   LEVA blur destrutivo: cracha com foto e nome de terceiro.
   NAO leva: cordao com marca de orgao, placa de sinalizacao, bordado de camisa ilegivel na
   resolucao final. Decisao do usuario uma vez tomada nao se represta.
4. Capa: texto nunca sobre rosto, sem faixa preta solida, bloco de texto no miolo
   LER o arquivo final e confirmar rosto limpo.

### Texto sobre foto: as 4 regras que custaram rodadas

1. **Faixa solida ou gradiente atras, sempre.** Texto solto sobre area clara de foto some.
2. **Contraste conferido por NUMERO, nao por olho.** Metodo que funcionou: renderizar o card
   SEM o texto, montar a mascara dos glifos pela diferenca entre os dois PNGs, e amostrar o
   pixel de fundo REAL sob cada glifo. Amostrar a cor teorica do CSS nao vale.
3. **Cor de destaque clara sobre fundo branco costuma REPROVAR no contraste** (ex.: ciano `#00BFFF` sobre branco da 2,12:1). Sobre branco, usar
   a variante escura do design system. A cor clara so serve como texto sobre fundo escuro, ou como
   ornamento (tag, filete, dots).
4. **Folga entre texto e pessoa mede-se na FAIXA HORIZONTAL DO TEXTO**, nao no ponto mais
   baixo de qualquer pessoa do card. Medir errado jogou fora 311 px de espaco util numa capa
   e obrigou duas rodadas extras.

Safe zone de rodape: no feed do IG a faixa inferior e encoberta pela interface. Respeitar a
margem de `references/carousel-safe-zone.md` (base 175 px).

### Padrao de CAPA-FOTOGRAFIA

Vale quando a capa E uma foto, e NAO substitui o gabarito de carrossel padrao do cliente:

- Foto FULL BLEED, sem corte
- SEM cromo de marca: sem logo, sem tag, sem @handle, sem dots
- So o titulo, centralizado, em duas linhas
- Posicionado sobre area VAZIA da foto, com gradiente escuro atras
- Respiro no pe, acima da safe zone
5. Qualidade: nunca recomprimir original. Bitrate da saida maior ou igual ao do master.
6. PROPORCAO: conferir com `ffprobe` que TODOS os cards saem exatamente na mesma proporcao
   (4:5, 1080x1350 no carrossel). Um card divergente recorta o carrossel inteiro.

```bash
for f in content/{slug}/carousels/{nome}/slide-*; do
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$f"
done
```

## Passo 7. Organizacao (origem e entrega, quando a marca usa)

A peca final sempre fica em `content/{slug}/`. Origem e entrega abaixo so valem se a marca usa iCloud Inbox ou pasta de entrega; nesse caso nao se pede autorizacao para fazer.

**Origem** (rastreabilidade da materia-prima, so com iCloud Inbox):
mover as midias de origem do inbox para `{inbox}\{nome-da-peca}\`, ORIGINAIS INTACTOS
(mover, nao converter, nao recomprimir). O `LEIA-ME.txt` fica na RAIZ do inbox.

**Entrega** (so com pasta de entrega combinada; quem aprova costuma operar do celular):
copiar a peca final para
`{pasta-de-entrega}\Carroseis\POSTAR-{nome}\`
na convencao da pasta: `legenda.txt`, `post-linkedin.txt`, `slide-NN.png|jpg|mp4`.
LinkedIn de projeto: tambem `{pasta-de-entrega}\Linkedin\{slug}\` com `post-linkedin.txt` + `imagens/*.jpg` (nunca PDF).
Copia byte a byte, provada por `md5`. A peca continua morando em `content/{slug}/` no repo.

Avisar o caminho ao usuario (ou, sem pasta de entrega, o caminho em `content/{slug}/`).

## Passo 8. Previa das midias

### PORTAO 2A: VOCE olha primeiro

Antes de mandar qualquer coisa para o usuario, **abra a midia renderizada e OLHE**.
`ffprobe` passar e proporcao bater NAO provam que a peca esta legivel. Provam formato.

1. Abrir o PNG/MP4 final com a ferramenta de leitura de imagem. Nao o HTML, nao o preview
   do gerador
2. LER cada texto do card no tamanho em que ele sai. Nao conseguiu ler facil, esta reprovado
3. Texto sobre foto exige **faixa solida ou overlay atras**. Texto solto sobre area clara de
   fotografia e proibido. Conferir contraste por numero: amostrar o pixel do fundo REAL e
   calcular WCAG, minimo 3:1 headline grande, 4.5:1 corpo
4. Recorte ampliado da regiao do texto E da regiao higienizada (crachá, placa, rosto)
5. Video: contact sheet de frames, nunca so o primeiro frame

Caso tipico que criou este portao: headline escura sobre parede branca estourada e subtitulo
cinza claro sobre branco. HTML correto, proporcao exata, ffprobe limpo, texto invisivel.
Ninguem tinha aberto o PNG.

### PORTAO BLOQUEANTE 2: previa visual
So depois do 2A. Enviar as midias montadas para o usuario VER (anexar no chat ou abrir a pasta), antes de
qualquer agendamento. Ele aprova o VISUAL, nao so o texto. Aprovacao de texto nao vale como
aprovacao de midia.

## Passo 9. Agendamento

### PORTAO BLOQUEANTE 3: "pode"
Nada entra em fila nem vai para a API sem "pode" explicito.

- **Inserir em `ct_content_items` com `status=scheduled` NAO agenda nada sozinho:** so vale se alguem consome a fila. Agendar = pelo `ct-agendar` ou pelo painel, se a marca tem agendador configurado. **Nunca dizer "agendado" sem confirmar no proprio agendador** (`references/aprendizados-de-producao.md` item 1.8). Sem agendador: publicar na hora, com o "pode" do usuario.
- **Publisher one-shot nao pode ter URL hardcoded.** Ler `media_urls` do banco em RUNTIME,
  sempre. Caso real: um script tinha as 3 URLs numa const e teria publicado o card velho;
  trocar no banco nao teria efeito nenhum.
- **Nunca sobrescrever o mesmo caminho no Supabase Storage** para trocar midia ja
  enfileirada: a URL fica identica e o CDN pode servir o arquivo antigo na hora de publicar.
  Subir com NOME NOVO e atualizar `media_urls`.
- **Instagram**: porta de UTF-8 obrigatoria (legenda por arquivo, dry-run provando acentos,
  zero mojibake) antes de entrar na fila. `INSTAGRAM_BUSINESS_USER_ID` do `.env` e id de conta
  business; a Instagram Login API exige o id app-scoped: resolver via `/me` em runtime.
- **LinkedIn**: sem a API nao ha agendador. Publicar pela ordem do passo 5 (API, navegador com "pode", ou manual).
  **Nunca prometer agendamento de LinkedIn sem a API.**
- Cross-post: PREPARAR as versoes no mesmo dia quando aplicavel ao cliente; publicar cada rede so com o "pode" dela.

## Passo 10. Registro

Toda peca publicada entra em `ct_content_items` com `publish_url` REAL:

- Via `registerPublication()` de `scripts/publishing/_lib/register.mjs`. Nao montar INSERT
  a mao.
- Instagram: o **permalink** (`instagram.com/p/{shortcode}`), obtido em
  `GET /{media-id}?fields=permalink`. NUNCA a URL montada com o id de midia da Graph API:
  ela nao abre e nunca casa com a metrica.
- Publicado na mao pelo usuario: PEDIR o link e gravar na mesma sessao.
- **Conferir a URL da midia por `md5` contra o arquivo local ANTES de gravar.** Deduzir a URL
  pelo nome do arquivo leva a apontar para a versao errada.
- Divida conhecida: `registerPublication()` **nao aceita `media_urls`**. Exige um PATCH
  separado depois. Nao esquecer, ou a peca fica registrada sem midia.
- Conferir com `npm run check:join`.
- Com iCloud: ele pode DESFAZER sozinho a organizacao de pastas por sincronizacao. Reconferir o passo 7
  depois de mover.
- Prova da publicacao: abrir o post no ar e conferir capa, acentos, hashtags e texto sem truncar (item 1.10 de `references/aprendizados-de-producao.md`).

Ao fim (OPCIONAL): se o usuario quiser versionar, PERGUNTAR antes e so entao `git add` dos arquivos tocados, commit e push. Nao versionar sem confirmacao.

---

## Checklist executavel

```
[ ] 0  Cliente ativo lido do .workspace, brand-profile e design-system carregados
[ ] 0  ffprobe + leitura visual de TODO arquivo da materia-prima (inbox ou enviado); divergencias reportadas
[ ] 0  Rotacao conferida (rotation=-90 muda a proporcao de exibicao)
[ ] 1  Fonte primaria do fato localizada; citacoes com pagina e item no roteiro-midia.md
[ ] 1  NAO ENCONTRADO listado explicitamente
[ ] 2  Objecoes levantadas ANTES de produzir; ressalva registrada se ele reafirmou
[ ] 3  SO a legenda do Instagram produzida (LinkedIn nao existe ainda)
[ ] 3  Sem travessao, sem coloquial, registro do cliente conferido
[ ] PORTAO 1: aprovacao explicita do texto do IG
[ ] 4  Correcao aplicada sobre o ditado do usuario, sem reescrever o argumento dele
[ ] 4  Padrao reprovado corrigido na FONTE DA MARCA (nunca em agents/ ou skills/) + registrado em clients/{slug}/regras-cliente.md
[ ] 5  LinkedIn adaptado do IG APROVADO (reescrito do zero se havia versao velha)
[ ] 5  LinkedIn: storytelling do processo, sem dado contratual, sem numero de norma/resolucao
[ ] 5  Usuario avisado se a peca tem video (LinkedIn nao aceita imagem + video no mesmo post)
[ ] 6  Foto de iPhone: orientacao conferida e corrigida
[ ] 6  Slides montados conforme roteiro-midia.md
[ ] 6  Higienizacao frame a frame, blur destrutivo, decisoes do usuario respeitadas
[ ] 6  ffprobe: todos os cards na MESMA proporcao
[ ] 6  Capa lida: nenhum texto sobre rosto
[ ] PORTAO 2A: VOCE abriu o PNG/MP4 final e LEU cada texto nele
[ ] PORTAO 2A: contraste calculado pela mascara de glifos sobre o fundo REAL (nao a cor CSS)
[ ] PORTAO 2A: nenhuma cor de destaque clara como texto sobre fundo claro
[ ] PORTAO 2A: folga texto x pessoa medida na FAIXA HORIZONTAL do texto
[ ] PORTAO 2A: rodape dentro da safe zone (base 175 px)
[ ] PORTAO 2A: recorte ampliado da regiao higienizada conferido depois de aplicada
[ ] 6  Nenhum dado proibido pelo cliente (ex.: dado contratual) em texto nem em slide
[ ] 7  (se usa iCloud Inbox) Midias de origem movidas para {inbox}\{nome}\, originais intactos, LEIA-ME na raiz
[ ] 7  (se usa pasta de entrega) Peca copiada para POSTAR-{nome}, md5 conferido, caminho avisado
[ ] PORTAO 2: previa visual enviada ao usuario
[ ] PORTAO 3: "pode" explicito
[ ] 9  Midia trocada subiu com NOME NOVO no Storage (nunca sobrescrever o mesmo caminho)
[ ] 9  Publisher le media_urls do BANCO em runtime; zero URL hardcoded
[ ] 9  IG com dry-run UTF-8 aprovado; agendado pelo ct-agendar/painel e confirmado no agendador, OU publicado na hora com "pode"
[ ] 9  LinkedIn: API, OU navegador com "pode", OU avisado que precisa de postagem manual
[ ] 10 URL da midia conferida por md5 contra o arquivo local antes de gravar
[ ] 10 registerPublication() com permalink real + PATCH de media_urls; npm run check:join
[ ] 10 (opcional, com confirmacao) git add/commit/push dos arquivos tocados
```

## Erros ja cometidos neste fluxo (nao repetir)

| Erro | Onde |
|---|---|
| Aceitar a descricao falada da midia sem abrir o arquivo (a capa descrita como "foto da equipe" era uma nuvem de pontos) | Passo 0 |
| Ler a dimensao do container e ignorar `rotation=-90`, concluindo 4:3 horizontal onde era 3:4 vertical | Passo 0 |
| Escrever a partir da memoria do usuario sem o documento na mao, criando causalidade inventada | Passo 1 |
| Nao registrar o que NAO foi encontrado, deixando a lacuna virar afirmacao depois | Passo 1 |
| Produzir IG e LinkedIn juntos e ter que aplicar a mesma correcao duas vezes | Passo 3 |
| Reescrever o texto ditado pelo usuario "melhorando", ou devolver o que ele cortou | Passo 4 |
| Remendar o LinkedIn velho em vez de reescrever a partir do IG aprovado | Passo 5 |
| Represtar decisao de higienizacao que o usuario ja tomou | Passo 6 |
| Card fora de 4:5 recortando o carrossel inteiro | Passo 6 |
| Agendar sem mandar a previa visual | Passo 8 |
| Prometer agendamento de LinkedIn, que nao tem agendador confiavel | Passo 9 |
| Gravar `instagram.com/p/{media-id}` em vez do permalink | Passo 10 |
| Escrever LinkedIn como ficha tecnica, com paragrafos de atributo em vez do processo real | Passo 5 |
| Citar numero de norma e sigla de conselho em vez da consequencia pratica | Passo 5 |
| Forcar pergunta final no LinkedIn so para cumprir formato | Passo 5 |
| Clicar no `input[type=file]` do LinkedIn, abrindo o dialogo nativo e travando a sessao | Passo 5 |
| Montar peca com imagem + video para o LinkedIn, que nao aceita os dois no mesmo post | Passo 5 |
| Texto solto sobre area clara de foto, sem faixa nem gradiente | Passo 6 |
| Usar cor de destaque clara como texto sobre fundo branco (ex.: ciano `#00BFFF`, 2,12:1, reprova WCAG) | Passo 6 |
| Amostrar a cor teorica do CSS em vez do pixel de fundo real sob os glifos | Passo 8 |
| Medir folga do texto pelo ponto mais baixo de qualquer pessoa, perdendo 311 px de capa | Passo 6 |
| Ignorar a rotacao EXIF da foto de iPhone | Passo 6 |
| Sobrescrever o mesmo caminho no Storage e o CDN servir o arquivo antigo | Passo 9 |
| Publisher one-shot com as URLs hardcoded, ignorando a troca feita no banco | Passo 9 |
| Dizer "agendado" apos inserir `status=scheduled`, sem nenhum processo consumindo a fila | Passo 9 |
| Deduzir a URL da midia pelo nome do arquivo em vez de conferir por md5 | Passo 10 |
| Chamar `registerPublication()` e esquecer o PATCH de `media_urls` | Passo 10 |
