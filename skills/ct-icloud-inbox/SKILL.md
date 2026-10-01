---
name: ct-icloud-inbox
description: Inbox de foto/video do iPhone (iCloud Drive ou pasta local no Desktop). Copia o ORIGINAL sem recomprimir, gera meta/ffprobe, entrega pro ct-diretor montar legenda/capa. NUNCA publica. EXCLUSIVO terminal local.
owner: ct-diretor
environment: local
---

# ct-icloud-inbox

Quando o usuario grava no iPhone e manda o arquivo pra uma pasta sincronizada, os agentes
leem daqui. Nao e a camera roll inteira. So o que ele jogou na inbox.

EXCLUSIVO PC local. iCloud nao existe em servidor remoto.

## Nao faz

- Publicar
- Reencodar / comprimir (regra 1.1)
- Varrer o rolo da camera
- WhatsApp (aquilo ja chega esmagado)

## Comandos

```
node skills/ct-icloud-inbox/inbox.mjs setup
node skills/ct-icloud-inbox/inbox.mjs status
node skills/ct-icloud-inbox/inbox.mjs list
node skills/ct-icloud-inbox/inbox.mjs ingest
node skills/ct-icloud-inbox/inbox.mjs ingest --dry
```

Copia pra `output/{slug}/icloud-inbox/{data}-{nome}/original.ext` + `meta.json`.
Git ignora `output/`.

## Onde a pasta mora

Ordem: `CT_ICLOUD_INBOX` > `.workspace` campo `icloud_inbox` >
`~/iCloudDrive/Content Team {slug}` > Desktop `Content-Team-Inbox/{slug}`.

Inbox canonica na RAIZ do Drive (iPhone nao mostra subpasta):
`iCloudDrive/Content Team {slug}` (uma pasta por cliente).
`.workspace` campo `icloud_inbox` (nao commitar).

Watcher local: `node scripts/infra/icloud-watch.mjs` (10 min, todos os clientes). Transcreve video e anota `content/{slug}/inbox-learnings.md`.

## Depois do ingest (ct-diretor)

1. Listar os `original.*` novos
2. Assistir video / ler foto
3. Delegar ct-redator (legenda) + ct-video-editor ou ct-designer (capa)
4. Copiar peca final pro Drive `POSTAR-{slug}`
5. Parar. Publicar so com "pode"

## iPhone

Atalho "Content Team": receber foto/video -> Salvar em Arquivos -> iCloud Drive ->
`Content Team {slug}` (na raiz do iCloud Drive). Enquanto o iCloud do Windows nao existir: AirDrop/cabo
na pasta Desktop, ou Google Drive `Content-Team-Inbox` se montar no mesmo caminho.

Setup e o passo a passo: `docs/ICLOUD-INBOX.md`.
