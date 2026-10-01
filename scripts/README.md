# scripts/

Scripts utilitários do Content Team AI. Os agentes chamam esses scripts; normalmente você
não precisa rodá-los à mão.

## Raiz

| Script | Função |
|--------|--------|
| `sync-agents-push.mjs` | Envia os agentes `ct-*` para o banco (`npm run sync:agents`) |
| `sync-skills-push.mjs` | Envia as skills para o banco (`npm run sync:skills`) |
| `gen-wiki.mjs` | Regenera a pasta `wiki/` (`npm run gen:wiki`) |
| `ingest-research-to-supabase.js` | Guarda relatórios de pesquisa no banco |
| `set-youtube-thumb.mjs` | Troca a capa de um vídeo do YouTube |

## Subpastas

| Pasta | Conteúdo |
|-------|----------|
| `_lib/` | Funções compartilhadas (marca ativa, leitura de configuração) |
| `analytics/` | Coleta de métricas e análise |
| `checks/` | Conferências (`npm run check:join`) |
| `content/` | Utilitários de organização das peças |
| `criativos/` | Criativos de anúncio em lote |
| `database/` | Utilitários de banco |
| `ig-webhook/` | Resposta automática a comentários e DMs do Instagram (opcional) |
| `infra/` | Rotinas agendadas e workers (ads, iCloud, painel) |
| `memory/` | Instalação da memória dos agentes (`npm run memory:setup`) |
| `mpt/` | Vídeo sem rosto (MoneyPrinterTurbo) |
| `publishing/` | Publicação em cada rede |
| `queries/` | Consultas SQL prontas |
| `sala/` | Painel (Sala de Comando): banco local, sincronização, checagens |
| `video/`, `video-editor/` | Produção e edição de vídeo |
