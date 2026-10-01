# Inbox iPhone -> Content Team

Objetivo: voce grava/tira foto no iPhone, o arquivo cai numa pasta que este PC ve,
os agentes montam legenda/capa. **Publicar so com "pode".** Original intacto.

## Como funciona no PC

Com o iCloud for Windows instalado, o iCloud Drive aparece como uma pasta do computador.

Crie uma pasta por cliente na RAIZ do iCloud Drive (o iPhone nao mostra subpasta), com o nome
`Content Team {slug}` (ex.: `Content Team acme`). Jogue o take direto nela, sem subpasta.

Se o iCloud Drive nao estiver disponivel, use uma pasta comum do computador (veja o fim da proxima secao).

## Instalar iCloud (pra ter o sync automatico)

1. Microsoft Store: app **iCloud** (`9PKTQ5699M62`)
2. Apple ID no app iCloud
3. **iCloud Drive** ligado. Camera roll (`Pictures\iCloud Photos`) existe, mas a skill NAO varre ela
4. Pasta do cliente na raiz: `Content Team {slug}`
5. `.workspace` local (nao vai pro git):

```
client: acme
icloud_inbox: <caminho-do-iCloudDrive>\Content Team acme
```

## iPhone (Atalhos)

1. App Atalhos -> Novo
2. Nome: `Content Team`
3. Receber: Fotos, Videos, Arquivos
4. Acao: Salvar arquivo em `iCloud Drive / Content Team {slug}`
5. Compartilhar o take pelo Share Sheet -> Content Team

Sem iCloud Drive no Windows: AirDrop/cabo na pasta Desktop, ou salvar no Google Drive
numa pasta que o Desktop Drive ja monta, e apontar `icloud_inbox` pra ela.

## Comandos

```
node skills/ct-icloud-inbox/inbox.mjs setup
node skills/ct-icloud-inbox/inbox.mjs status
node skills/ct-icloud-inbox/inbox.mjs ingest
```

Gatilho falado: "gravei um video", "tem foto no icloud", "processa o que mandei".
ct-diretor roda ingest e so depois produz. Nunca publica sozinho.

Opcional: `scripts/infra/icloud-watch.mjs` olha as pastas de inbox sozinho (rode de tempos em tempos pelo Agendador de Tarefas do Windows ou por um cron).
