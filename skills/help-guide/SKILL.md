---
name: help-guide
description: Guia interativo de skills e agentes do Content Team agrupado por dominio. Ativar quando o usuario mandar /skills, /help, "quais skills tenho", "quais agentes tenho", "o que voce sabe fazer", "lista skills", "como uso", "guia".
---

# Help Guide: Skills e Agentes do Content Team

Quando o usuario pedir o guia, RESPONDER com uma lista curta e agrupada por dominio, em
linguagem simples (sem jargao). O canal principal e o terminal (Claude Code ou Codex): usar texto
simples. Telegram e um canal opcional (so se a pessoa configurou); ai sim usar HTML compacto,
como no exemplo abaixo.

```html
<b>Content Team: Guia de Skills</b>

<b>5 dominios</b>

<b>1. CONTEUDO</b> (producao, sempre via ct-diretor)
   Agentes: ct-diretor (orquestra) · ct-redator · ct-carrossel · ct-pesquisador · ct-designer · ct-video · ct-story · ct-agenda · ct-social · ct-otimizador · ct-reciclador
   Skills: ct-peca (fluxo completo de uma peca) · ct-carrossel-gen (carrossel) · ct-story · ct-reel · ct-artigo-linkedin · ct-plano-semanal
   Pedir: "cria um carrossel sobre X" · "post de LinkedIn sobre Y" · "monta o plano da semana"

<b>2. PESQUISA E ANALISE</b>
   Agentes: ct-pesquisador · ct-social
   Skills: ct-pesquisa (concorrentes) · ct-seo · ct-social-cockpit (painel de desempenho) · ct-aprender-perfil (aprendizado diário do seu Instagram) · ct-instagram-analyzer · ct-linkedin-analyzer · ct-youtube-analyzer
   Pedir: "analisa o concorrente Y" · "como estao minhas redes" · "o que esta funcionando" · "aprender com o meu perfil"

<b>3. PUBLICACAO</b> (sempre com o seu "pode")
   Skills: ct-publicar-ig · ct-publicar-li · ct-publicar-yt · ct-publicar-tiktok · ct-agendar
   Pedir: "publica o carrossel X no Instagram" · "agenda para terca 12h"

<b>4. VIDEO E DESIGN</b>
   Skills: ct-video-editor · ct-remotion · ct-motion-code · ct-thumbnail · ct-template-designer · diagram-design
   Pedir: "edita esse video" · "faz uma thumbnail" · "desenha o fluxo do processo"

<b>5. CONFIGURACAO E MANUTENCAO</b>
   Skills: ct-onboarding (configurar) · ct-atualizar-kit · ct-reportar-problema · ct-avaliar-novidade
   Pedir: "configurar empresa nova" · "continuar configuracao" · "conectar as redes" · "atualizar o kit" · "reportar problema" · "avaliar essa ferramenta"

<b>Regras</b>
- Toda acao envolvendo cliente: confirmo qual e o cliente ativo antes
- Conteudo: NUNCA crio direto, sempre delego ao ct-diretor
- Publicar: SEMPRE espero o seu "pode"
- Primeira vez: peca "configurar empresa nova" (skill ct-onboarding); para retomar, "continuar configuracao"

Use linguagem natural: o guia e so um mapa.
```

## Variantes do guia

O usuario pode pedir guia especifico:
- "/help conteudo" ou "skills conteudo": so secao 1 expandida com lista completa ct-*
- "/help pesquisa": so secao 2 com exemplos
- "/help publicacao": so secao 3
- "/help video": so secao 4
- "/help configuracao": so secao 5

## Comportamento

1. Detectar se pediu guia geral ou especifico
2. Conferir a lista atual de skills, se precisar, em `references/skill-agent-map.md` (catalogo completo) ou com `ls skills/ | grep "^ct-"`
3. Formatar a resposta compacta (no Telegram, HTML: limite de 4096 chars por mensagem; se exceder, dividir em 2)

## Auditoria: "ver delegacao"

Se o usuario perguntar "voce esta delegando certo?" ou pedir auditoria, resumir no chat quais
agentes foram chamados na sessao e o que cada um fez (delegou vs fez direto).
