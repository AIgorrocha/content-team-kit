---
name: ct-projeto-conteudo
description: Transforma uma entrega tecnica do cliente ativo (modelos 3D, pranchas, prints) em storytelling de conteudo (carrossel IG, reel, estatico) e adaptacao LinkedIn da Company Page. Use quando o usuario disser "projeto entregue", "conteudo desse projeto", "mina a entrega", ou apontar pasta de contrato. So se aplica a clientes com fluxo de entrega tecnica (ver brand-profile.md), terminal local. Nunca cita cliente real do cliente ativo.
owner: ct-diretor
---

# ct-projeto-conteudo

**Modulo opcional "entrega tecnica".** Vale so para marca que presta servico tecnico sob contrato (engenharia, arquitetura, consultoria, obra) e que descreveu esse fluxo em `clients/{slug}/brand-profile.md`. Marca sem esse fluxo usa `ct-peca` (fluxo generico de peca); o passo 1 dele ("fonte primaria do fato") ja cobre a apuracao.

Gatilho: pasta de entrega de um contrato (ex.: `ENTREGA/`), ou "projeto X entregue".
Nunca publica sozinho. IG so com "pode publicar". LinkedIn Company Page: preparar pacote, publicar so se o usuario pedir, pela ordem unica (API se a marca tem app, navegador com "pode", ou manual; ver `agents/ct-diretor.md`).
Nunca citar numero de contrato ou licitacao, datas de assinatura ou prazo de execucao no post (`references/aprendizados-de-producao.md` item 2.4); norma e sigla de conselho viram a consequencia pratica (item 2.5).

Gabarito de referencia: ver ultima peca publicada em `content/{slug}/carousels/` (link no `brand-profile.md`).

## LGPD (trava)

Lista do que nao entra no copy nem no recorte (razao social, numero de registro profissional, endereco, codigos internos de sala/projeto etc.): ler `clients/{slug}/brand-profile.md` secao LGPD. Sem essa lista, tratar qualquer identificador do cliente final do projeto como sensivel por padrao.
Publico: tipo de espaco/projeto + fato de projeto, nunca a identidade do cliente final.
Prancha no LinkedIn: JPG no formato da folha, nunca PDF. Uma por disciplina, a mais bonita (3D/detalhe), nao a primeira folha. Prancha com instalacoes: mostrar o desenho das instalacoes, nunca planta vazia de pontos. Carimbo do cliente: tag so em nome, endereco e QR. Carimbo de terceiro: cobrir o bloco inteiro, sem buraco enorme; legenda, notas, 3D e grid ficam. Inspecao visual do selo e obrigatoria.

## Ordem (nao inverter)

1. Inventario READ-ONLY (PDF, modelos 3D, stories).
2. **Midia + texto PRIMEIRO.** O usuario escolhe prints/modelos e dita o arco. Nao montar slide antes.
3. Card comprime. A fala dele manda (ver `clients/{slug}/regras-cliente.md`). Sem slogan inventado.
4. Template de design system do cliente ativo (HTML+Playwright 1080x1350, ver `clients/{slug}/design-system.md`). `/design` e spec de produto, NAO card de IG.
5. Briefing 1 pagina: tese, 2-3 fatos, assets 3D, o que NAO narrar.
6. Delegar ct-diretor -> ct-redator / ct-carrossel / ct-video / ct-otimizador.
7. QA visual de CADA PNG e do 1o/meio/fim do GIF/MP4 **antes** de mostrar. Vazio azul, 3D miudo, texto cortado, selo no frame = consertar.
8. Copiar so a peca ATUAL pra pasta de saida do cliente (`POSTAR-{slug-peca}/`, caminho em `brand-profile.md`; opcional: sem pasta de saida, a peca fica em `content/{slug}/`). Apagar captura, arquivo de modelo, GIF duplicado, PNG da capa se o item 1 for MP4.
9. LinkedIn Company Page no mesmo ciclo (nao e extra). Ver secao LinkedIn.
10. Status draft. Publicar IG so com aprovacao. Aprovacao do IG nao vale LinkedIn.

## Copy

Publico: ver `clients/{slug}/brand-profile.md` (perfil tecnico do publico). Fato de projeto, 1-2 linhas no card. Texto longo na legenda.
Tag/categoria do card: ler padrao do cliente em `brand-profile.md` (nao usar "estudo de caso" salvo se for o padrao do cliente).
Sem informalismo, sem jargao inventado, sem travessao. CTA ditada pelo usuario entra como ele falou.
IG: max 5 hashtags. Legenda por arquivo UTF-8. Provar acentos antes de publicar.

## 3D do modelo (so clientes com modelo 3D ou BIM)

Modelo 3D como visual principal: usar o proprio software de modelagem do cliente para gerar a vista (orbita), nao um formato de troca (ex.: IFC) que perde cor e material. Regras da vista (disciplinas, cores, tempo de orbita, o que esconder) ficam em `clients/{slug}/regras-cliente.md` e `design-system.md`. Feed do Instagram nao anima GIF: o item 1 do carrossel e MP4. Pasta POSTAR: `slide-01.mp4` + `slide-02.png`..., sem `slide-01.png`.

## Instagram

Carrossel misto: 1o item `VIDEO` (`capa-cover-orbit.mp4`) + PNG 02-N. Graph `is_carousel_item`. Caption `--caption-file` UTF-8.
Permalink real `instagram.com/p/{shortcode}` em `registerPublication()`. Nunca id de midia.
Token: variavel de ambiente do cliente ativo (nome em `brand-profile.md`) + user id do `/me`.

## LinkedIn Company Page (sempre no ciclo, salvo pausa explicita do usuario)

Conferir em `clients/{slug}/brand-profile.md` se ha alguma peca com texto LinkedIn pausado por pedido do usuario antes de reescrever ou publicar.

O orquestrador (Claude principal) NUNCA escreve `post-linkedin.txt`. Sempre delegar `ct-diretor` -> `ct-redator` (texto) e `ct-carrossel` (midia 1920x1080 ou video 16:9). Sem isso o texto vira legenda de IG colada, e o usuario corta.

Fonte: a postagem do Instagram. ct-redator + ct-otimizador reescrevem. Nao e a legenda alongada.

Voz do LinkedIn do cliente ativo (primeira pessoa, tecnico falando com tecnico, tamanho alvo, o que e proibido): ler `clients/{slug}/brand-profile.md` secao LinkedIn.

Teste: se parece carrossel, anuncio ou texto de modelo, reescrever. ct-otimizador le depois do redator e barra se ainda soar IG.

Dois formatos pra testar (registrar qual foi ao ar no `post-linkedin.txt`):

| Teste | Arquivo | Quando |
|-------|---------|--------|
| A. Sequencia horizontal | `linkedin/slide-0N.png` 1920x1080 | padrao |
| B. Video horizontal | `linkedin/orbit-federado-16x9.mp4` 1920x1080 | alternativa, se o usuario pedir |

Nao usar PDF de prancha no LinkedIn: a UI recusa. Raster JPG paisagem, salvar na pasta da peca (e em `{pasta-de-saida-do-cliente}\Linkedin\{slug}\imagens\`, se houver pasta de saida), abrir a pasta e mostrar antes de publicar. Link externo no primeiro comentario, nao no corpo. Comparar no cockpit depois (impressoes, reacoes, comentarios). O que ganhar vira padrao ate a proxima medicao.

## POSTAR-{slug-peca}

```
{pasta-de-saida-do-cliente, ver brand-profile.md}\POSTAR-{slug-peca}\
  slide-01.mp4          (se capa for video)
  slide-02.png ...
  legenda.txt
  post-linkedin.txt
  linkedin\             (sequencia 1920x1080 e/ou mp4 16:9)
```

Apagar: captura de tela, arquivo de modelo, GIF, PNG da capa quando o 1 for MP4, duplicata.

## Playbooks

Reel: ver playbook do cliente (nome exato em `brand-profile.md`).
Sanitizacao: `references/asset-sanitization.md`.
