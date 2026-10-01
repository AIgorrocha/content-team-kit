---
name: ct-notebook
description: "Google NotebookLM - criar podcasts, quizzes, resumos, slides a partir de conteudo"
metadata:
  kit:
    emoji: "🎙️"
    requires:
      bins: [python]
---
# NotebookLM - Google NotebookLM CLI

Automacao completa do Google NotebookLM via CLI Python.
Cria notebooks, adiciona fontes, gera podcasts (audio overview), quizzes, slides, e mais.

## Instalacao

Instalar via pip: `notebooklm-py==0.3.4`

Login salvo em: `./.notebooklm\storage_state.json` (criado no primeiro login, nao versionar)

## Comandos Principais

### Gerenciar Notebooks
```bash
# Listar notebooks
python -m notebooklm list

# Criar notebook
python -m notebooklm create "Nome do Notebook"

# Selecionar notebook ativo
python -m notebooklm use <notebook-id>

# Ver status atual
python -m notebooklm status
```

### Adicionar Fontes
```bash
# Adicionar URL como fonte
python -m notebooklm source add "https://url-do-conteudo.com"

# Adicionar arquivo local
python -m notebooklm source add "/caminho/arquivo.pdf"

# Adicionar pesquisa (NotebookLM busca na web)
python -m notebooklm source add-research "tema da pesquisa"

# Listar fontes
python -m notebooklm source list
```

### Gerar Conteudo (Artefatos)
```bash
# Gerar podcast (Audio Overview)
python -m notebooklm generate audio

# Gerar quiz
python -m notebooklm generate quiz

# Gerar slides
python -m notebooklm generate slide-deck

# Gerar relatorio
python -m notebooklm generate report

# Gerar flashcards
python -m notebooklm generate flashcards

# Gerar mapa mental
python -m notebooklm generate mind-map

# Gerar infografico
python -m notebooklm generate infographic
```

## REGRA DURA: infografico e SEMPRE do NotebookLM

**PROIBIDO recriar infografico/card em HTML+Playwright.** Todo infografico entregavel
(card horizontal do LinkedIn, versao vertical de Story) sai da ARTE REAL gerada aqui pelo
NotebookLM, preservando o traco/ilustracao dele. HTML so entra se o NotebookLM falhar E o
usuario autorizar explicitamente na hora.

Fluxo obrigatorio:
1. `python -m notebooklm generate infographic` a partir das fontes do tema
2. Baixar a arte
3. **Remover a marca "NotebookLM"** do canto inferior direito (sempre, sem rastro)
4. Gerar TAMBEM a versao vertical 1080x1920 pra Stories, a partir da MESMA arte do
   NotebookLM (formato vertical nativo se existir, senao recorte/reorganizacao das
   ilustracoes dele). Vertical recriada em HTML ja foi reprovada pelo usuario.
5. Mostrar as duas pro usuario e esperar aprovacao antes de publicar

Se o cliente ativo tiver regra propria sobre infografico, ver `clients/{slug}/regras-cliente.md`.

### Download de Artefatos
```bash
# Baixar podcast gerado
python -m notebooklm download audio

# Baixar slides
python -m notebooklm download slide-deck

# Baixar video cinematico
python -m notebooklm download cinematic-video
```

### Perguntar ao Notebook
```bash
# Fazer pergunta sobre o conteudo
python -m notebooklm ask "Quais os principais pontos?"

# Ver historico de conversas
python -m notebooklm history
```

### Compartilhamento
```bash
# Ver status de compartilhamento
python -m notebooklm share status

# Tornar publico
python -m notebooklm share public
```

## Fluxo Tipico para Conteudo

1. Criar notebook com o tema
2. Adicionar fontes (URLs, PDFs, pesquisas)
3. Gerar podcast pra reaproveitar como Reels/audio
4. Gerar quiz pra Stories interativos
5. Gerar resumo pra legendas/posts
6. Baixar artefatos gerados

## Quando Usar

- Transformar artigos/PDFs em podcast (audio overview)
- Criar quizzes interativos pra Stories
- Gerar resumos de conteudo longo
- Pesquisar e consolidar informacoes
- Criar material educativo (flashcards, slides)
- Reaproveitar conteudo em varios formatos

## Agentes que Usam

- **ct-reciclador** - Transformar conteudo existente em novos formatos
- **ct-pesquisador** - Consolidar pesquisa de multiplas fontes
- **ct-redator** - Gerar rascunhos a partir de notebooks
- **ct-video** - Audio de podcast como base pra Reels
