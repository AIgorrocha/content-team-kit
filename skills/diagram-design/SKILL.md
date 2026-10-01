---
name: diagram-design
description: Fluxogramas editoriais HTML+SVG (processo, arquitetura, loop). Sem Mermaid. Tokens do cliente ativo. Fonte cathrynlavery/diagram-design.
---

# Diagram design (Content Team)

Fonte: https://github.com/cathrynlavery/diagram-design
Perfil desta instância: `clients/{slug}/diagram-design.md` (slug do cliente ativo desta pasta)
Marcador: `.diagram-design` -> `profile: {slug}`

Checkout opcional: `integrations/diagram-design/` (fica no `.gitignore`, por isso
nao vem junto no clone). Serve so pra consultar os tipos extras e o taste gate do
upstream. Se a pasta nao existir e voce quiser:

```bash
git clone --depth 1 https://github.com/cathrynlavery/diagram-design integrations/diagram-design
```

Sem o checkout a skill continua funcionando: o tipo usado no dia a dia (o
flowchart abaixo) e os tokens estao inteiros aqui neste arquivo. Nao bloquear a
producao esperando o clone.

## Tipo pra processo de implantação

Eixo sequencial, cima → baixo (flowchart). Um ator. Sem Mermaid.

Se o usuario ditou a lista de etapas, a tela mostra as frases dele, não um resumo de 5 caixas. Accent em 1 nó (o sistema).

## Tokens

Paleta, tipografia e regras visuais de cada cliente: ver `clients/{slug}/diagram-design.md`
(ou `design-system.md` se o cliente nao tiver arquivo dedicado).

## Saída

Um HTML auto-contido em `content/{slug}/...`. Abre no browser, tela cheia, sem build.

Quando a peca ENSINA o Diagram Design, o card do LinkedIn E um artefato da skill
(tipo flowchart + template dark + taste gate), nao um HTML paralelo. Caso:
`montar-fluxogramas-ia`, 17/set/2026.
---
