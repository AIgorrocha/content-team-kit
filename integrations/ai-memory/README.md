# Memoria dos agentes (ai-memory)

Sem isso os agentes esquecem tudo entre uma sessao e outra. Com isso, decisoes editoriais,
regras da marca e o que ja foi publicado ficam disponiveis pra qualquer agente, em qualquer
CLI (Claude Code, Codex, Grok), pelo protocolo MCP.

Stack: [ai-memory](https://github.com/akitaonrails/ai-memory) (binario Rust em Docker,
SQLite com busca por texto, grafo e vetores). Uma instancia por empresa, na maquina da
empresa. O token nunca sai dela e nunca entra no Git.

## Instalar (uma vez)

1. Docker Desktop instalado e aberto.
2. Opcional, recomendado: [Ollama](https://ollama.com) instalado e
   `ollama pull nomic-embed-text` (busca semantica, 270 MB).
3. Na raiz do kit: `npm run memory:setup`. O script:
   - gera um token aleatorio e grava `integrations/ai-memory/.env` (gitignored);
   - sobe o container (`docker compose up -d`);
   - baixa o binario `ai-memory` da CLI pra `integrations/ai-memory/bin/` se ainda nao existir;
   - imprime os comandos pra registrar o MCP e os hooks no Claude Code.
4. Rode os comandos impressos. Abra uma sessao nova do Claude Code e confira com
   `memory_query` que a ferramenta aparece.

## Como os agentes usam

- **Automatico:** hooks do Claude Code (`session-start`, `user-prompt-submit`, `stop`,
  `pre-compact`, `session-end`) capturam o contexto e fazem o handoff entre sessoes.
- **Explicito:** ferramentas MCP `memory_query`, `memory_write_page`, `memory_read_page`.
  O `ct-onboarding` grava as paginas semente (marca, publico, redes, regras) no fim do
  questionario.

## Modo degradado

Sem Ollama: apague as linhas `AI_MEMORY_EMBEDDING_*` e `AI_MEMORY_LLM_*` do `.env`. A memoria
continua gravando e buscando por texto (FTS5), so perde a busca por significado.

## Operacao

| Acao | Comando (em `integrations/ai-memory/`) |
|---|---|
| Subir / reiniciar | `docker compose up -d` |
| Ver logs | `docker compose logs -f` |
| Parar | `docker compose down` (dados ficam no volume) |
| Backup | `docker run --rm -v ai-memory-data:/data -v "%cd%":/bk alpine tar czf /bk/ai-memory-backup.tgz /data` |
| Apagar tudo | `docker compose down -v` (irreversivel) |

Painel web: http://127.0.0.1:49374 (pede o token).
