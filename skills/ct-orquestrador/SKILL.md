---
name: ct-orquestrador
description: Orquestra tarefas de conteudo do Content Team AI via ct-diretor + sub-agentes ct-*. Usar SEMPRE que o usuario pedir algo relacionado a conteudo (carrossel, post, legenda, reel, story, pesquisa de tema, analise de concorrente, agendamento, publicacao, adaptacao entre plataformas) em qualquer cliente ativo (ver clients/). NUNCA produzir conteudo direto: assumir o papel do ct-diretor (ler `agents/ct-diretor.md`) e delegar cada sub-agente via Agent tool.
---

# ct-orquestrador: Regra Mestra do Content Team AI

## Quando usar

Ative esta skill SEMPRE que o prompt do usuario envolver:

- **Carrossel** (gerar, ajustar, revisar slides)
- **Post** (Instagram, LinkedIn, feed)
- **Legenda / Caption**
- **Reel / Video curto**
- **Story / Stories diarios**
- **Pesquisa** (de tema, concorrente, tendencia, SEO, keyword)
- **Analise de perfil** (IG, LinkedIn)
- **Agendamento / Calendario editorial**
- **Publicacao / Aprovacao**
- **Adaptacao** (mesmo conteudo em varias plataformas)
- **Mencao a clientes**: qualquer cliente cadastrado em `clients/` (ver `clients/active-client.md`)

## Fluxo Obrigatorio

### 1. Ler cliente ativo
Ler o campo `client:` do arquivo `.workspace` (ele vence). Se faltar, rodar `npm run workspace:boot` e ler `clients/active-client.md`.
```bash
grep '^client:' .workspace
```

Se o cliente ativo for diferente do que o usuario quer, peca confirmacao pra trocar.

### 2. Assumir o diretor e delegar

O assistente principal (voce) assume o papel do ct-diretor: leia `agents/ct-diretor.md` e siga. Nao abra um subagente para ser o diretor (subagente nao cria subagente). Cada sub-agente e chamado pelo Agent tool:
- `subagent_type: general-purpose`
- `description`: resumo curto (3-5 palavras)
- `prompt`: "Leia agents/ct-X.md e siga; contexto: ..."

Template de prompt para cada sub-agente:

```
Leia agents/ct-{agente}.md e siga.

CLIENTE ATIVO: {slug}

CONTEXTO A CARREGAR:
- clients/{slug}/brand-profile.md (secao Preferencias de formato)
- clients/{slug}/design-system.md
- clients/{slug}/voice-patterns.md (secao Legendas aprovadas)
- clients/{slug}/regras-cliente.md
- clients/{slug}/competitors.md (se existir)
- references/ (frameworks relevantes)

TAREFA:
{tarefa na integra, angulo aprovado, onde salvar}

REPORTE no final: o que fez, arquivos gerados, duvidas com ⚠️.
```

Quem chamar:
- ct-pesquisador → pesquisa de tema/concorrente
- ct-redator → legendas, textos, scripts
- ct-carrossel → slides IG (usa skill ct-carrossel-gen)
- ct-designer → direcao de arte
- ct-video → Reels
- ct-story → stories
- ct-otimizador → adaptacao por plataforma
- ct-reciclador → 1 conteudo → varios formatos
- ct-agenda → calendario
- ct-social → DMs, escuta
- ct-trafego → ads Meta
- ct-integrador → APIs/automacoes

Sem Agent tool (por exemplo, no Codex), faca o papel de cada agente em sequencia, lendo o arquivo dele.

### 2.5 Skill chamada direto (terminal ou Telegram)

Se o pedido chegar como NOME DE SKILL (ex: "roda ct-publicar-ig", "usa ct-carrossel-gen")
e nao como tarefa, NAO execute a skill solta. Consulte `references/skill-agent-map.md`,
descubra o AGENTE DONO e delegue pro ct-diretor com esse agente. A skill so roda DENTRO do
agente dono, com contexto de cliente carregado. Skills de analytics podem rodar diretas,
mas o resultado volta pro ct-diretor virar decisao editorial.

### 3. Proibicoes Absolutas

- NAO escrever legenda/copy direto
- NAO gerar slides manualmente sem ct-carrossel
- NAO pesquisar concorrentes sem ct-pesquisador
- NAO publicar/agendar sem o "pode" explicito do usuario
- NAO commitar dados de clientes em repo publico

### 4. Papel do Claude Principal

Voce (o assistente principal) e o **diretor e orquestrador** deste projeto:
- Orquestra
- Valida com usuario
- Nunca produz conteudo

## Clientes

Lista de clientes ativos, slug e plataformas: ver pastas em `clients/` (cada uma com `brand-profile.md`).

## Referencias

- `CLAUDE.md` do projeto
- `agents/ct-diretor.md` (papel do diretor)

## Excecoes

Se a tarefa NAO for producao de conteudo (ex: so conversa sobre o projeto, ajuste de settings, analise de logs, debugging de sistema), ignore esta skill.
