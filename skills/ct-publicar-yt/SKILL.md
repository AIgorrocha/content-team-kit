---
name: ct-publicar-yt
description: "Publica video no YouTube (upload, titulo, descricao, tags, thumbnail) e entrega o material pronto pro post de LinkedIn. Tem porta bloqueante de acentuacao e formatacao antes de subir. Usar quando o pedido for publicar no YouTube ou subir episodio novo. Vale pra qualquer cliente com YouTube listado no brand-profile."
---

# Publicar Video no YouTube + Preparar LinkedIn

Skill completa para publicar video no YouTube e entregar material pronto pro LinkedIn.
Rede disponivel pra qualquer cliente cuja secao Plataformas do `clients/{slug}/brand-profile.md` liste YouTube e que tenha as credenciais da Data API (ver `docs/INTEGRACOES.md`). Cliente sem YouTube no brand-profile: recusar e avisar.

## PORTA BLOQUEANTE: acentuacao e formatacao (rodar SEMPRE antes de subir)

Sem esses 4 checks passando, NAO publica. Titulo e descricao do YT vao COM acento e pontuacao.

1. `titulo.txt` / `descricao.txt` / `tags.txt` lidos como ARQUIVO UTF-8, nunca inline.
2. DRY-RUN provando os acentos integros: `á ã ç é ê ó õ ú`.
3. Formatacao: quebras de linha da descricao preservadas, links no lugar certo, sem caractere de controle.
4. Zero mojibake (`Ã¡`, `Ã£`, `Ã§`).

```bash
node -e "for(const f of ['titulo.txt','descricao.txt']){const s=require('fs').readFileSync(f,'utf8');console.log('==',f);console.log(s);console.log('MOJIBAKE:',/Ã.|Â./.test(s))}"
```
Aceite: acentos legiveis nos dois E `MOJIBAKE: false`.

Video: Shorts sobe o HQ (byte-a-byte da pasta POSTAR), nao a copia Graph, salvo excecao
registrada em `clients/{slug}/brand-profile.md`. Script:
`scripts/publishing/upload-youtube-api.mjs`. Canone: `references/platform-specs.md`.

Antes do primeiro uso, gere o acesso de publicacao: `node scripts/publishing/youtube-auth.mjs`
(grava `YOUTUBE_REFRESH_TOKEN`; passo a passo em `docs/CONECTAR-REDES.md`). O painel (Conexoes)
pede so leitura e nao serve pra publicar.

## Fluxo Resumo

```
O usuario grava video → transcreve (Whisper)
         ↓
ct-diretor recebe e delega:
  ├── ct-redator → titulo, descricao, tags
  ├── ct-reciclador → post LinkedIn
  └── ct-thumbnail → prompt thumbnail (o usuario gera no Gemini)
         ↓
ct-publicar-yt:
  1. Upload video no YouTube (API)
  2. Setar thumbnail (API)
  3. Registro da peca em ct_content_items (o script faz)
  4. Gerar PACOTE LINKEDIN pronto pro usuario
  5. Cleanup MP4 local
         ↓
O usuario recebe pacote LinkedIn:
  - Texto completo pra copiar
  - Link YouTube pra colar
  - Thumbnail pra baixar
  → o usuario cola no LinkedIn e agenda manualmente
```

## IMPORTANTE: LinkedIn NAO e automatico

A API do LinkedIn NAO gera preview de video YouTube corretamente.
Por isso o fluxo e:
1. Claude Code publica no YouTube (automatico)
2. Claude Code entrega PACOTE LINKEDIN pro usuario (texto + link + thumbnail)
3. o usuario copia, cola e agenda no LinkedIn MANUALMENTE

NUNCA tentar publicar no LinkedIn via API com link de YouTube.

## Etapa 1: Preparar Conteudo

O ct-diretor delega:
- **ct-redator**: titulo.txt, descricao.txt, tags.txt
- **ct-reciclador**: post-linkedin.txt (adaptado do video)
- **ct-thumbnail**: prompt-thumbnail.txt (o usuario gera no Gemini)

Arquivos em `content/{slug}/youtube/{episodio}/`:
- titulo.txt (max 100 chars)
- descricao.txt (com timestamps, links, CTA)
- tags.txt (separadas por virgula, 15-25 tags)
- post-linkedin.txt (DEVE incluir link YouTube no final: "🎬 Assista: https://youtu.be/{videoId}")
- prompt-thumbnail.txt
- THUMBNAIL.png (o usuario coloca na pasta)
- transcricao.txt

## Etapa 2: Upload YouTube

```bash
node scripts/publishing/upload-youtube-api.mjs content/{slug}/youtube/{episodio}/video.mp4 \
  content/{slug}/youtube/{episodio}/titulo.txt content/{slug}/youtube/{episodio}/descricao.txt \
  content/{slug}/youtube/{episodio}/tags.txt --long --pode
```

TRAVA NO CODIGO: sem `--pode` o comando so mostra o que publicaria (pre-visualizacao) e nao publica. O assistente so acrescenta `--pode` DEPOIS do "pode" explicito do usuario.

`--long` = video longo (link `watch?v=`); sem ele a URL sai como Short (`/shorts/`). `--client <slug>`
troca a marca do registro (padrao: marca ativa). Categoria padrao 28, idioma pt-BR, publico. O
script imprime o ID do video e a URL, e ja registra a peca em `ct_content_items` com o link.
Se o YouTube recusar o lote de tags, o script sobe sem tags e aplica uma a uma.

Plano B pelo navegador (sem Data API): `scripts/publishing/upload-youtube-short.mjs`, que usa a
sessao logada desta marca (`~/.playwright-youtube-{slug}`).

## Etapa 3: Setar Thumbnail

Comprimir pra <2MB (limite API):
```bash
ffmpeg -i "{BASE}/THUMBNAIL.png" -vf scale=1280:720 -q:v 2 -update 1 "{BASE}/thumb-yt.jpg" -y
node scripts/set-youtube-thumb.mjs {videoId} "{BASE}/thumb-yt.jpg"
```

Se der erro de permissao: conta precisa verificacao em youtube.com/verify

## Etapa 4: Registro da peca

Ja feito pelo `upload-youtube-api.mjs` (ver Etapa 2). Se o registro avisou que falhou (sem banco
configurado), registre depois:

```bash
node scripts/publishing/register-publication.mjs --platform youtube --type short \
  --title "{titulo}" --url "https://youtube.com/shorts/{videoId}"
```

Para corrigir a descricao de um video ja publicado (mostre o texto novo e espere o "pode"):
`node scripts/publishing/yt-update-description.mjs read {videoId}` e
`node scripts/publishing/yt-update-description.mjs write {videoId} <descricao.txt> --pode` (sem `--pode`, so mostra o texto).

## Etapa 5: Entregar PACOTE LINKEDIN

Apos publicar no YouTube, entregar pro usuario EXATAMENTE assim:

```
---
📋 PACOTE LINKEDIN, PRONTO PRA COLAR

📝 TEXTO (copie completo, JA INCLUI o link do YouTube no final):
{conteudo exato do post-linkedin.txt}

🖼️ THUMBNAIL (baixe e anexe no post):
content/{slug}/youtube/{episodio}/THUMBNAIL.png

📌 INSTRUÇÕES:
1. Abra o LinkedIn
2. Crie novo post
3. Cole o TEXTO acima (link YouTube ja esta no final)
4. Anexe a THUMBNAIL como imagem
5. Publique ou agende

📓 NOTEBOOKLM: adicione ao notebook YouTube do cliente ativo (nome em brand-profile.md):
1. Abra: https://notebooklm.google.com
2. Entre no notebook do cliente
3. Clique em "+ Add source"
4. Cole: https://www.youtube.com/watch?v={videoId}
---
```

NUNCA publicar no LinkedIn via API. SEMPRE entregar o pacote pro usuario postar manual.
SEMPRE incluir link pro NotebookLM no pacote final.

## Etapa 7: Cleanup

Apagar video e arquivos temporarios:
```bash
rm "{BASE}/*.mp4" "{BASE}/*.mov" "{BASE}/thumb-yt.jpg" 2>/dev/null
```

Manter: titulo.txt, descricao.txt, tags.txt, post-linkedin.txt, prompt-thumbnail.txt, THUMBNAIL.png, transcricao.txt

## Config

- Canal, email da conta e ID: ver `clients/{slug}/brand-profile.md`
- Categoria: 28 (Science & Technology), padrao. Ajustar se o cliente pedir outra.
- Idioma: pt-BR

## Erros Comuns

| Erro | Causa | Solucao |
|------|-------|---------|
| Media too large (thumb) | >2MB | ffmpeg pra 1280x720 JPEG |
| Insufficient permissions (thumb) | Conta nao verificada | youtube.com/verify |
| Insufficient scopes | Token sem scope | Rodar de novo `node scripts/publishing/youtube-auth.mjs` |
| Canal errado | Multiplos canais | Selecionar canal correto no OAuth |
| ENOENT video | MP4 nao encontrado | Verificar arquivo na pasta |
