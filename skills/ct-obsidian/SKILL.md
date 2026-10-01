---
name: ct-obsidian
description: "Gerenciar notas Obsidian via Obsidian MCP server"
---
# Obsidian Vault - Knowledge Base

Gerencia notas no vault Obsidian usando o Obsidian MCP server.

## Opcional: precisa do servidor MCP do Obsidian

Esta skill so funciona se o seu Claude Code (ou Codex) tiver um servidor MCP de Obsidian conectado, que
exponha as ferramentas abaixo (`read_note`, `write_note`, `search_notes` e outras). O kit NAO traz esse
servidor: sem ele, ignore esta skill (nada mais do kit depende dela). Para ligar:

1. Tenha o Obsidian com um vault (uma pasta de notas) no computador.
2. Instale um servidor MCP de Obsidian que aponte para a pasta do vault (por exemplo o pacote
   `@bitbonsai/mcpvault`; siga o README dele) e registre no Claude Code: `claude mcp add obsidian -- npx @bitbonsai/mcpvault@latest "<caminho-do-seu-vault>"`.
3. Reinicie a sessao e confira com `/mcp` que o servidor `obsidian` aparece como conectado.

## Como Usar

Use as ferramentas do Obsidian MCP:
- `read_note`: ler uma nota
- `write_note`: criar/atualizar nota
- `search_notes`: buscar por conteudo
- `list_directory`: listar notas em pasta
- `manage_tags`: gerenciar tags
- `get_vault_stats`: estatisticas do vault

## Quando Usar

- Salvar conhecimento aprendido pelos agentes
- Consultar informacoes de referencia
- Manter documentacao do projeto
- Criar daily notes e logs

## Regras

- Sempre confirmar antes de sobrescrever notas existentes
- Usar formato Markdown padrao Obsidian
- Tags com #prefixo
- Wikilinks com [[Nome da Nota]]
