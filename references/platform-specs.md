# Especificacoes de Plataformas - Mercado Brasileiro

Referencia **tecnica** por plataforma: dimensao, limite de caracteres, formato de arquivo, requisito de API.

> **Escopo deste arquivo:** so spec tecnica.
>
> **NAO esta aqui:** gancho, curva de retencao, loop, estrutura editorial e CTA. Fonte canonica: **`references/viral-playbook.md`**.
>
> **Horario de publicacao:** nao e definido aqui. Vem computado do historico real da conta via **`skills/ct-social-intel/`** (heatmap 7x24 dia x hora sobre `ct_metrics_snapshots`). Horario chutado foi removido deste arquivo de proposito.
>
> **Hashtags (quantidade e quais):** `clients/{slug}/brand-profile.md`. LinkedIn: sem hashtag por padrao (a marca pode definir outro no `brand-profile.md`; nesse caso, maximo 5).

Duracoes marcadas como "ideal" por fontes externas nao tem validacao nossa e foram removidas. O que sobrou aqui e limite de plataforma, que e verificavel. Ver `viral-playbook.md`, secao 8 (lacunas conhecidas).

---

## 1. TikTok Brasil

### Especificacoes Tecnicas
- **Formato**: vertical 9:16 (1080x1920px)
- **Texto na tela**: legenda queimada obrigatoria (motivo: acessibilidade e consumo sem som, ver `viral-playbook.md` secao 2)
- **Hashtags**: conforme brand-profile do cliente ativo
- **Sem watermark de outra plataforma** (o TikTok despriorizada conteudo com marca d'agua concorrente)

### Editorial
Gancho, estrutura e CTA: `viral-playbook.md`, secoes 1, 3 e 4. CTA valido no TikTok inclui `comenta "PALAVRA"` e salvar.

### Audio
- **Trending audio**: janela de uso e curta, enquanto o som esta em alta
- **Voz propria**: fideliza mais
- **Hibrido**: trending audio com narracao propria por cima

---

## 2. LinkedIn Brasil

### Especificacoes Tecnicas
- **Post texto**: limite duro de 3.000 caracteres. Corte do "ver mais" no mobile em ~140 chars / ~2 linhas
- **Imagens**: imagem unica ou JPG/PNG (1920x1080 na sintese horizontal). **PDF de documento/carrossel: a interface recusa, nao usar**
- **Video**: nativo
- **Artigo**: formato longo nativo
- **API**: posta em perfil pessoal. **Nao posta em company page** (falta Community Management API no app). Post de pagina e manual

### Editorial
- Gancho na janela dos ~140 chars: `viral-playbook.md`, secao 1
- Estrutura do post: `viral-playbook.md`, secao 3
- **Fechamento: pergunta especifica so quando nascer natural** (senao, afirmacao firme). `comenta "PALAVRA"` NAO se usa no LinkedIn (regra dura, `viral-playbook.md` secao 4)
- Faixas de tamanho "ideal" de post sao `[HIPOTESE]` no playbook. Nao tratar como regra
- Link externo: no PRIMEIRO COMENTARIO, nao no corpo (regra unica do kit). Excecao: YouTube vira cartao de previa via `publish-linkedin-link.mjs`. Excecao por marca so se registrada em `regras-cliente.md`
- Publicacao: API se a marca tem app configurado; senao navegador com "pode"; senao manual
- Arquivo da imagem: `linkedin-imagem.png`

### Sequencia de imagens (sem PDF)
- Imagem 1: capa
- Imagens intermediarias: 1 ideia por imagem
- Ultima imagem: fechamento
- Design e regras visuais: `references/carousel-design-system.md` e o `design-system.md` do cliente ativo

---

## 3. Instagram Brasil

### Especificacoes Tecnicas
- **Feed (legenda)**: ate 2.200 caracteres. Corte do "mais" na 1a linha
- **Reels**: vertical 9:16 (1080x1920px). **Capa obrigatoria** (via `cover_url` + `thumb_offset`, verificar pos-publicacao)
- **Stories**: 15s por story
- **Carrossel**: ate 10 imagens
- **Evitar**: watermark do TikTok, bordas pretas, baixa resolucao

### Editorial
Gancho, estrutura de reel, story e carrossel, e CTA: `viral-playbook.md`, secoes 1, 3 e 4. CTA valido: `comenta "PALAVRA"`, salvar, compartilhar em DM.

### Publicacao via API
- Legenda deve ser enviada em **UTF-8 blindado** (bug recorrente de mojibake em acento). Dry-run provando acento antes de publicar.

---

## 4. YouTube Shorts Brasil

### Especificacoes Tecnicas
- **Duracao**: ate 60s
- **Formato**: vertical 9:16 (1080x1920px)
- **Titulo**: ~60-70 caracteres com keyword
- **Capa**: manual (a plataforma nao aceita capa de Short via o mesmo fluxo do longo)

### Mecanica
- A plataforma mede **% de visualizacao completa**. Shorts e long-form sao superficies separadas.
- Funil comum: Short atrai, CTA no fim leva ao video longo.

### Descricao (modelo)
```
Resumo de 1 frase do short.

Video completo: [link do long form]
Contato: [email/Instagram]

#Shorts #[NichoKeyword] #Brasil
```

---

## 5. YouTube Longo Brasil

Disponivel pra qualquer cliente que liste YouTube em `clients/{slug}/brand-profile.md`.

### Especificacoes Tecnicas
- **Resolucao**: 1080p minimo
- **Thumbnail**: 1280x720px, menos de 2MB
- **Titulo**: ~60-70 caracteres
- **Descricao**: com acento e pontuacao corretos
- **Tags**: relevantes ao tema

### Mecanica
- CTR e retencao sao metricas **separadas**: thumbnail e titulo decidem o clique, os primeiros ~20s decidem a permanencia (`viral-playbook.md`, secao 1).
- Clickbait aparece como CTR alto com watch time baixo.

### Titulo (formula)
```
[Keyword Principal] + [Beneficio/Resultado] + [Especificidade]
```
Evitar titulo vago sem keyword.

### Thumbnail
- Texto: 3-5 palavras, maiusculas, contraste alto
- Rosto com expressao legivel
- Regra dos tercos
- Estilo especifico da mentoria: ver memoria do cliente e `skills/ct-thumbnail/`

### Descricao (modelo)
```
[Resumo de 2-3 linhas com keyword nos primeiros 100 caracteres]

TIMESTAMPS
0:00 - Introducao
...

RECURSOS MENCIONADOS
- [Link 1]

ME SIGA
Instagram: @seu_user
LinkedIn: linkedin.com/in/seu_user

CONTATO
email@exemplo.com

#KeywordPrincipal #Keyword2 #Keyword3
```

---

## 6. Twitter/X Brasil

### Especificacoes Tecnicas
- **Tweet**: 280 caracteres (conta padrao)
- **Imagem**: 1200x675px (2:1)
- **Video**: ate 2:20min

### Editorial
Tweet 1 precisa fechar sentido sozinho; a thread so expande sob clique (`viral-playbook.md`, secoes 1 e 3). CTA valido: responder, seguir.

### Formatacao Visual
- Quebras de linha
- Um paragrafo = 1-2 linhas
- Listas e bullets

---

## 7. Blog/Site (SEO On-Page)

### Especificacoes Tecnicas
- **Titulo (H1)**: 60-70 caracteres
- **Meta description**: 150-160 caracteres
- **Imagens**: otimizadas (menos de 100KB), com alt text
- **URL**: curta e descritiva

### Estrutura SEO-Friendly
```
# H1: [Keyword Principal] + [Beneficio]

## Introducao
- Contexto e promessa
- [Keyword principal nas primeiras 100 palavras]

## H2: [Subtopico com keyword secundaria]
### H3: [Detalhe especifico]

## Conclusao
- Resumo
- CTA primario unico

## FAQ
**Pergunta?**
Resposta objetiva.
```

### SEO On-Page Checklist
- [ ] Keyword principal no H1
- [ ] Keyword nas primeiras 100 palavras
- [ ] Densidade natural (nao forcar)
- [ ] LSI keywords (sinonimos, relacionadas)
- [ ] URL curta e descritiva
- [ ] Meta description com keyword
- [ ] Imagens com alt text descritivo
- [ ] Links internos com anchor text natural
- [ ] Links externos para sites de autoridade
- [ ] Subtitulos (H2, H3) com keywords secundarias
- [ ] Paragrafos curtos
- [ ] Listas e bullets (escaneabilidade)

### CTA
Uma acao primaria por pagina (`viral-playbook.md`, secao 4).

---

## COMPARATIVO TECNICO RAPIDO

| Plataforma | Limite/Formato | Metrica que a plataforma prioriza |
|-----------------|------------------------|--------------------------|
| TikTok | 9:16 | % assistido |
| LinkedIn | 3.000 chars / imagens (sem PDF) | dwell time, comentario |
| Instagram Reels | 9:16, capa obrigatoria | % assistido, salvar, compartilhar |
| Instagram Feed | 2.200 chars / ate 10 imagens | tempo de visualizacao, salvar |
| YouTube Shorts | ate 60s, 9:16 | % assistido |
| YouTube Longo | 16:9, thumb 1280x720 | watch time, CTR |
| Twitter/X | 280 chars | resposta, retweet |
| Blog | texto | tempo no site, backlinks |

Frequencia de publicacao por rede: decisao de cliente (`brand-profile.md`), calibrada pelo cockpit (`skills/ct-social-cockpit/`).

---

## Publicacao de video: arquivo HQ e capa (REGRA DURA, todas as redes)

### Sempre publicar o MP4 HQ original, byte-a-byte `[MECANICA]`
- Publicar SEMPRE o arquivo de alta qualidade original, SEM re-encode. O WhatsApp comprime (~1,6 Mbps) e degrada; se o arquivo chegou por WhatsApp, PEDIR o original (Drive ou similar) (~15 Mbps, 1080x1920).
- Provar antes de subir: `md5` do arquivo source == destino (nenhum re-encode no meio) + `ffprobe` conferindo resolucao/bitrate. So subir depois de provar.

### Arquivo de ENTREGA de reel/short: bitrate e tamanho (CHECK BLOQUEANTE) `[MEDIDO]`

NAO confundir com a regra acima. A regra acima e sobre a **FONTE** (master do Drive vs comprimido do WhatsApp: nunca recomprimir o que o cliente gravou).
Esta e sobre o **ENTREGAVEL** que a gente renderiza. Render bruto do Remotion **nao** e "original sagrado": ele sai superdimensionado e precisa ser re-renderizado no alvo.

Alvo do MP4 de entrega:

| Parametro | Alvo |
|---|---|
| Resolucao / fps | 1080x1920, 30fps CFR |
| Codec | h264 High profile, yuv420p |
| Bitrate video | 10 a 12 Mbps |
| Audio | AAC 192 kbps |
| moov | `+faststart` (inicio do arquivo) |
| Tamanho (~60s) | 80 a 100 MB |

Check, ANTES de entregar e ANTES de publicar:

```bash
ffprobe -v error -show_entries format=size,bit_rate \
  -show_entries stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,bit_rate \
  -of default=noprint_wrappers=1 ENTREGA.mp4
```

Criterio de aceite: `bit_rate` total <= ~12 Mbps E `size` <= ~100 MB num reel de ~1 min. Estourou = ESTA ERRADO, nao entrega, nao publica.

Correcao (unica valida): **re-renderizar do Remotion**, nunca recomprimir o MP4 ja renderizado.

```bash
npx remotion render <entry> <Comp> saida.mp4 --video-bitrate=11M --audio-bitrate=192k
ffmpeg -i saida.mp4 -c copy -movflags +faststart ENTREGA.mp4
```

`--crf` e `--video-bitrate` sao mutuamente exclusivos: passar os dois falha.

Pos-correcao, validar por SSIM nos MESMOS 8 timestamps do QA frame-a-frame. Faixa 0,95-0,99 = so compressao, ok. Salto grande pra baixo = composicao mudou, PARAR e investigar. Conferir tambem legibilidade do texto pequeno do B-roll.

Exemplo: um render que saiu com 19,3 Mbps / 163 MB foi refeito e ficou com 11,1 Mbps / 90 MB sem perda visual.

### Acentuacao e formatacao na publicacao (PORTA BLOQUEANTE, todas as redes) `[MECANICA]`

Nao e recomendacao. Sem esses checks passando, nao publica.

- Legenda/descricao vai pra API **sempre via arquivo UTF-8** (`--caption-file`/`@arquivo`), NUNCA inline no comando (o shell do Windows corrompe acento).
- DRY-RUN obrigatorio antes de publicar, provando que os acentos chegam integros: `á ã ç é ê ó õ ú`.
- Conferir formatacao no mesmo dry-run: quebras de linha preservadas, hashtags no fim, sem caractere de controle, sem mojibake (`Ã¡`, `Ã£`, `Ã§`).
- LinkedIn: `escapeLittleText` no `commentary`. A `/rest/posts` **corta a legenda no 1o char especial nao escapado**. `#` e `@` NUNCA sao escapados.
- LinkedIn HASHTAG GATE (so se o post TEM hashtag, ou seja, a marca usa; sem hashtag no arquivo nao ha o que conferir; bug recorrente "o post sai sem as hashtags do fim"): rodar `assertHashtagsPreserved(source, payloadText)` de `scripts/publishing/_lib/linkedin-text.mjs` ANTES de publicar; se qualquer `#hashtag` do arquivo sumiu do payload, ABORTA. Duas causas: (a) send-side, `raw.split(/\n-{3,}\n/)[0]` derruba tudo depois de `---`; (b) LinkedIn-side, ugcPosts pode derrubar hashtags em paragrafo final isolado (detectar com `verifyHashtagsLive`, que exige token com read scope).

```bash
# criterio de aceite do dry-run: bate byte-a-byte com o arquivo fonte
node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');console.log(s);console.log('MOJIBAKE:', /Ã.|Â./.test(s))" legenda.txt
```

Aceite: acentos legiveis na saida E `MOJIBAKE: false`.

### Capa do reel/short (obrigatoria) `[MECANICA]`
- Reel/short SEMPRE com capa. Se o frame escolhido tem legenda queimada, cobrir com scrim OPACO (alpha 255) antes de escrever a headline.
- Fonte escalada a resolucao do video (auto-fit a largura); gerar a capa na resolucao do MP4 HQ. Arquivo `capa-v2.png`.
- Aplicacao: IG via `cover_url` **JPEG** + verificar `thumbnail_url` baixada; TikTok via "Editar capa" > "Carregar capa" no editor do post (miniatura da lista mente); YT Short = sem capa.
- Graph REELS: publicar com `video_url` publico + caption + cover. Nao rupload com caption/cover no container (ProcessingFailedError). HQ ~86 MB nao sobe; copia Graph <= ~49 MB, HQ fica no Drive. Detalhe: `skills/ct-publicar-ig/SKILL.md`.

---

## Onde cada rede publica (matriz operacional) `[MECANICA]`

| Rede | Como publica | Observacao |
|------|--------------|-----------|
| Instagram | cron/agendador proprio (ver `docs/PUBLICACAO_AUTO.md`) | Graph API, UTF-8 blindado |
| TikTok | Playwright local (browser visivel, maquina acordada) | API exige app auditado; sobe "sob analise" |
| YouTube | Data API local (app auditado, sai publico) | thumbnail custom = manual no Studio |
| LinkedIn | API local (texto) se a marca tem app; senao navegador com "pode"; senao manual | leitura via GET da 403 (falta scope); confirmar visual no feed |

Nao existe agendador local confiavel pras 3 (TikTok/YT/LinkedIn). Se precisar sincronizar horario, publicar direto ou disparar na propria sessao (nao agendar local). Agendamento de IG e feito pelo cron/agendador configurado em `docs/PUBLICACAO_AUTO.md`.

---

## Convergencias de formato (validas hoje)

1. **Vertical 9:16** e o formato de video curto em todas as redes (TikTok, Reels, Shorts, Stories).
2. **Legenda queimada** e requisito de acessibilidade e de consumo sem som. Nao depende de estatistica pra se justificar. O numero "80% assistem sem som" circula sem fonte primaria e **nao deve ser usado como argumento** (`viral-playbook.md`, secao 2).
3. **SEO social**: YouTube, LinkedIn e blog respondem a keyword.
4. **Reaproveitamento**: uma peca longa vira varias curtas (ver `ct-reciclador`).
