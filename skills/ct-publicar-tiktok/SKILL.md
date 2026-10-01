---
name: ct-publicar-tiktok
description: "Publica video no TikTok via TikTok Studio web com Playwright numa sessao logada (a Content Posting API oficial so cria rascunho self-only sem app aprovado em audit). Usar quando o pedido for subir Reel/Short pro TikTok. EXCLUSIVO terminal local (Playwright + Chrome logado). Vale pra qualquer cliente com TikTok listado no brand-profile."
environment: local
---

# Publicar Video no TikTok (Playwright logado)

Skill para publicar video no TikTok. A Content Posting API do TikTok NAO publica sem
app aprovado em audit (so rascunho self-only), entao publicamos via TikTok Studio web
com Playwright numa sessao logada. White-label: vale pra qualquer cliente que tenha conta.

Rede disponivel pra qualquer cliente cuja secao Plataformas do `clients/{slug}/brand-profile.md` liste TikTok e que tenha a sessao logada (ver `docs/INTEGRACOES.md`). Confirmar `active-client.md` antes de subir.

## PORTA BLOQUEANTE: acentuacao e formatacao (rodar SEMPRE antes de publicar)

Sem esses 4 checks passando, NAO publica. Legenda do TikTok e IDENTICA a do IG.

1. Legenda vai por ARQUIVO UTF-8, NUNCA inline no comando.
2. DRY-RUN provando os acentos integros: `á ã ç é ê ó õ ú`.
3. Formatacao: quebras de linha preservadas, hashtags no fim, sem caractere de controle.
4. Zero mojibake (`Ã¡`, `Ã£`, `Ã§`).

```bash
node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');console.log(s);console.log('MOJIBAKE:',/Ã.|Â./.test(s))" legenda.txt
```
Aceite: acentos legiveis E `MOJIBAKE: false`. No TikTok, confirmar tambem por SNAPSHOT que
o texto colado no campo apareceu com acento antes de clicar em publicar.

Video: se o MP4 for entregavel renderizado por nos, conferir `ffprobe` (alvo 10 a 12 Mbps,
80 a 100 MB em ~60s) antes de subir. Canone: `references/platform-specs.md`.

## REGRA DURA: CAPA (fluxo real corrigido em ee916d3)

NUNCA publicar sem a CAPA aplicada. Ter `capa.png` na pasta NAO basta: o TikTok pega
um frame aleatorio se a capa nao for setada no upload.

O `upload-tiktok.mjs` JA SETA a capa quando recebe `--cover <capa.png>`. Fluxo REAL que
o script executa (e que deve ser mantido se mexer nele):
1. "Editar capa" = botao overlay na miniatura, so reage a HOVER + clique real no elemento.
2. Abre o modal -> clicar "Carregar capa" (upload de IMAGEM PROPRIA, NAO frame do video).
3. `setInputFiles(capa)` no `input[type=file]` (via filechooser ou input direto).
4. "Salvar".
5. CONFIRMAR por snapshot que a miniatura mudou pra imagem propria ANTES de publicar.

Se rodar sem `--cover`, o script avisa e a capa fica manual. Mesma regra vale pra IG
(cover_url) e YT Short (thumbnails.set). Ver memoria [[cross-post-capa-schema]].

## REGRA DURA: privacidade + confirmar publicacao real `[MECANICA]`

- TikTok sobe o video "sob analise" e forca "Somente eu". Mudar pra **Todos** no dropdown
  da linha na aba Conteudo e confirmar. Enquanto a analise roda, a distribuicao pode ficar
  limitada (lado deles, nao e bug nosso).
- NAO confiar na mensagem "PUBLICADO" que o script imprime: verificar o estado REAL na aba
  Conteudo (a contagem de publicacoes sobe **e** a linha da peca aparece). Clique em
  Publicar com video ainda processando = publish fantasma. Espera escala com o arquivo:
  ~86 MB >= 50s; ~159 MB >= 90s. O script
  `upload-tiktok.mjs` ja espera 50s ou 90s conforme o tamanho.
- Miniatura da **lista** Conteudo costuma ficar no frame falando mesmo com capa certa.
  Prova da capa e o campo Capa no editor
  `https://www.tiktok.com/tiktokstudio/upload/post/{id}` (lapis da linha). Perfil 4:3
  corta o 9:16; nao recortar a capa ate cortar o rosto. Ajustar capa **depois** de
  publicar nesse editor se a lista enganar.

## Fluxo Resumo

```
ct-diretor recebe pedido e delega:
  ├── ct-redator → legenda (com hashtags + nota "link na bio/comentario fixado")
  └── (video ja existe: reel/short do ct-video* ou ct-video-editor)
         ↓
ct-publicar-tiktok (ct-social executa):
  1. Roda scripts/publishing/upload-tiktok.mjs (sobe video + legenda + Publico + publica)
  2. Registra a peca em ct_content_items com o link (o script tenta sozinho; senao register-publication.mjs)
  3. Entrega: lembrar o usuario de FIXAR comentario com o link (TikTok nao expoe por API)
```

## Pre-requisitos (1x)

- Sessao logada salva por marca em `~/.playwright-tiktok-{slug}` (login via QR code pelo app na 1a vez). Cada marca entra na sua propria conta.
- Chrome do sistema (channel:chrome).

## Etapa 1: Preparar conteudo

ct-diretor delega ao **ct-redator** a legenda em `content/{cliente}/reels/{nome}/legenda-tiktok.txt`.

Formato do arquivo (o script usa SO o texto antes do separador `---`):
```
<legenda + hashtags lowercase BR>

#hashtag1 #hashtag2 ...

---
COMENTARIO FIXADO: <url do guia/lead magnet>
```
- A legenda tem limite ~2200 chars.
- O texto apos `---` (comentario fixado) NAO entra na legenda; e nota pra fixar manual depois.

Video: o mp4 9:16 ja produzido (ex: `output/.../{nome}-ig.mp4` ou `content/{cliente}/reels/{nome}/{nome}.mp4`).

### REGRA: video HQ (byte-a-byte) `[MECANICA]`
Publicar SEMPRE o MP4 HQ original, SEM re-encode. WhatsApp comprime (~1,6 Mbps) e degrada;
se o usuario mandou por WhatsApp, pedir o original da pasta de entrega (~15 Mbps, 1080x1920). Provar por `md5`
(source == destino) + `ffprobe` (resolucao/bitrate) ANTES de subir. Detalhe em
`references/platform-specs.md` (secao "Publicacao de video").

## Etapa 2: Upload + Publicar

```bash
node scripts/publishing/upload-tiktok.mjs <video.mp4> --caption-file <legenda-tiktok.txt> --cover <capa.png> --pode
```
TRAVA NO CODIGO: sem `--pode` o comando so mostra o que publicaria (pre-visualizacao) e nao publica. O assistente so acrescenta `--pode` DEPOIS do "pode" explicito do usuario.
Passar SEMPRE `--cover` (regra de capa acima). `<video.mp4>` = o arquivo HQ original
byte-a-byte (ver "REGRA: video HQ" abaixo), nunca a versao comprimida do WhatsApp.
Ex (marca ativa):
```bash
node scripts/publishing/upload-tiktok.mjs \
  content/{slug}/reels/{peca}/{peca}.mp4 \
  --caption-file content/{slug}/reels/{peca}/legenda-tiktok.txt \
  --cover content/{slug}/reels/{peca}/capa.png --pode
```

O que o script faz:
1. Abre TikTok Studio (`tiktokstudio/upload`) na sessao logada. Se pedir login, espera (ate 5 min) ate a area de upload aparecer.
2. Sobe o mp4 (acha o `input[type=file]` em todas as frames).
3. Preenche a legenda (fecha pop-ups com Escape + clique force; digita devagar p/ disparar deteccao de hashtags).
4. **Define visibilidade = Todos (publico)**, TikTok as vezes default "Somente eu". CRITICO conferir.
5. Espera processar e clica **Publicar** (auto).
6. Confere na aba Conteudo se o comeco da legenda apareceu, tenta ler o link do video e registra a peca.

Flags:
- `NO_PUBLISH=1` -> sobe e preenche mas NAO publica (revisao manual).
- Caption inline em vez de arquivo: `... <video.mp4> "minha legenda #tag"`.

### REGRA CRITICA: visibilidade
Sempre conferir que ficou **Todos/Publico**, NAO "Somente eu". Se o auto-set falhar, o log avisa
("Nao consegui setar visibilidade auto"). Nesse caso editar manual: TikTok Studio > Conteudo >
o video > Editar > "Quem pode ver este video" > Todos > Salvar. (Foi o que aconteceu 2026-06-24.)

## Etapa 3: Registrar a peca

O `upload-tiktok.mjs` tenta ler o link do video na aba Conteudo e chama `registerPublication()`
(grava em `ct_content_items`). Se nao achar o link, ou se nao houver banco configurado, ele avisa.
Nesse caso, pegue o link (`https://www.tiktok.com/@conta/video/ID`) e registre:

```bash
node scripts/publishing/register-publication.mjs --platform tiktok --type video \
  --title "<nome da peca>" --url "<link do video>" --caption-file content/{slug}/reels/{peca}/legenda-tiktok.txt
```

Sem o link registrado, a peca fica fora das metricas.

## Etapa 4: Lembrete final pro usuario

Entregar:
```
TikTok publicado (Publico). Falta 1 passo MANUAL:
- Fixar comentario com o link: {url do guia}
  (TikTok nao deixa fixar comentario por API/web automation confiavel)
```

## Limitacoes conhecidas

| Item | Causa | Tratamento |
|------|-------|-----------|
| API nao publica | Content Posting API exige audit aprovado | Playwright logado (esta skill) |
| Vira "Somente eu" | Default do TikTok p/ algumas contas | Auto-set Publico + conferir log / editar manual |
| Comentario fixado | Sem API confiavel | Fixar manual no app |
| Pop-up "analisar video" intercepta legenda | Tooltip floating-ui | Escape + clique force (ja tratado no script) |
| input de upload nao aparece | Login nao concluido | Script espera ate 5 min o input surgir |

## Config

- Conta: handle e slug em `clients/{slug}/brand-profile.md`. Sessao: `~/.playwright-tiktok-{slug}` (uma por marca).
- Scripts (`scripts/publishing/`): `upload-tiktok.mjs` (publica), `tiktok-open-content.mjs` (abre o Studio na aba Conteudo, por exemplo para mudar a privacidade), `tiktok-edit-caption.mjs` (edita a legenda), `tiktok-verify-post.mjs` (confere legenda e privacidade).
- EXCLUSIVO terminal local (Playwright + Chrome). Nunca via bot ou Telegram.

## Corrigir legenda de post JA publicado

Antes de apagar e republicar por causa de texto, TENTE EDITAR. Republicar zera visualizacao,
curtida e comentario, e nao devolve nada em troca.

- **Da pra editar no lugar**, pela sessao logada do TikTok Studio: cada post tem um botao
  "Editar" que abre `tiktokstudio/upload/post/{id}` com a legenda editavel e botao Salvar.
- **Janela de 7 dias** a partir da publicacao. Depois disso fecha, e ai sim so sobra
  comentario fixado do proprio autor ou republicacao.
- **Nao existe API publica pra isso.** A Content Posting API nem publica sem audit, muito
  menos edita. O caminho e a sessao Playwright.
- Depois de salvar, RELEIA o post pra confirmar (o Studio e a `og:description` da pagina
  publica servem de prova): `node scripts/publishing/tiktok-verify-post.mjs <videoId> [--handle conta]`. E confira a privacidade de novo: o TikTok tem o habito de jogar
  o video pra "Somente eu" enquanto reanalisa.

Como fazer, com a sessao logada da marca (mostre o texto novo e espere o "pode" antes de gravar):

```bash
node scripts/publishing/tiktok-edit-caption.mjs probe "<trecho da legenda atual>"          # so olha
node scripts/publishing/tiktok-edit-caption.mjs write "<trecho>" <arquivo-legenda.txt> --pode  # grava (so com --pode; sem ele mostra o texto)
```

Exemplo de uso: um CTA prometia algo que a ferramenta nao faz. A edicao no lugar preserva views,
curtidas e comentarios, que seriam perdidos ao apagar e republicar.
