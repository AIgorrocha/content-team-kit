---
name: ct-seo
description: "Pesquisa de keywords e tendencias pra conteudo social via Playwright"
metadata:
  kit:
    emoji: "🔍"
    requires:
      bins: [node]
---
# SEO Research - Pesquisa de Keywords pra Conteudo Social

Pesquisa de keywords e tendencias usando Playwright MCP pra acessar fontes gratuitas sem captcha.
Foco: descobrir o que as pessoas buscam pra criar conteudo social relevante.

## Fontes Disponiveis

### 1. Google Trends (trends.google.com)
- **O que faz:** Mostra tendencias de busca em tempo real
- **Sem login:** Sim
- **Captcha:** Possivel com uso excessivo - usar com moderacao
- **Melhor pra:** Ver o que esta em alta AGORA, comparar termos

### 2. Keyword Tool (keywordtool.io)
- **O que faz:** Gera ate 750 sugestoes de keywords long-tail
- **Sem login:** Sim, funciona 100% sem conta
- **Captcha:** Nao
- **Melhor pra:** Ideias de conteudo, descobrir o que as pessoas perguntam
- **Plataformas:** Google, YouTube, Instagram, TikTok, Pinterest

### 3. AnswerThePublic (answerthepublic.com)
- **O que faz:** Mostra perguntas que as pessoas fazem sobre um tema
- **Sem login:** 1 busca gratuita
- **Captcha:** Cloudflare (pode bloquear)
- **Melhor pra:** Descobrir duvidas do publico pra responder em posts

## Fluxo de Pesquisa de Keywords

### Passo 1 - Definir o tema
Exemplo: "{tema do cliente} para empresas"

### Passo 2 - Buscar no Keyword Tool
Usar Playwright MCP pra:
1. Navegar pra https://keywordtool.io/
2. Selecionar plataforma (Instagram, YouTube, Google)
3. Digitar o tema na barra de busca
4. Selecionar pais: Brazil / idioma: Portuguese
5. Clicar em pesquisar
6. Extrair a lista de keywords sugeridas

```
Playwright steps:
1. browser_navigate → https://keywordtool.io/
2. browser_click → Aba da plataforma desejada (Instagram/YouTube/Google)
3. browser_type → Campo de busca → "{tema do cliente}"
4. browser_click → Seletor de pais → Brazil
5. browser_click → Botao de pesquisa
6. browser_snapshot → Capturar resultados
```

### Passo 3 - Verificar tendencia no Google Trends
1. Navegar pra https://trends.google.com/trends/explore?geo=BR&q=termo
2. Capturar grafico de interesse ao longo do tempo
3. Ver buscas relacionadas e em ascensao

```
Playwright steps:
1. browser_navigate → https://trends.google.com/trends/explore?geo=BR&q=agentes+de+IA
2. browser_wait → Aguardar carregamento dos graficos
3. browser_snapshot → Capturar dados de tendencia
```

### Passo 4 - Comparar termos
No Google Trends, comparar ate 5 termos pra ver qual tem mais busca:
```
URL: https://trends.google.com/trends/explore?geo=BR&q=termo1,termo2,termo3
```

### Passo 5 - Compilar resultado
Entregar ao agente solicitante:
- Top 10-20 keywords relevantes
- Volume relativo de busca (alto/medio/baixo)
- Tendencia (subindo/estavel/caindo)
- Sugestoes de conteudo baseadas nas keywords

## Output Esperado

```markdown
## Pesquisa de Keywords: [TEMA]

### Keywords Principais
| Keyword | Plataforma | Tendencia |
|---------|-----------|-----------|
| keyword 1 | Instagram | Em alta |
| keyword 2 | YouTube | Estavel |

### Perguntas do Publico
- Como [keyword]?
- O que e [keyword]?
- Quanto custa [keyword]?

### Sugestoes de Conteudo
1. Post sobre [keyword 1] - responder duvida principal
2. Carrossel sobre [keyword 2] - comparativo
3. Reel sobre [keyword 3] - tendencia em alta

### Hashtags Sugeridas
#keyword1 #keyword2 #keyword3
```

## Regras

- Sempre pesquisar com geo=BR e idioma PT-BR
- Priorizar keywords com intencao de conteudo social (nao comercial)
- Nao abusar das fontes - max 3-5 pesquisas por sessao
- Se uma fonte bloquear, pular pra proxima
- Sempre entregar resultado em PT-BR
- Focar em keywords que gerem ENGAJAMENTO, nao apenas volume

## Quando Usar

- Antes de criar conteudo (descobrir o que esta em alta)
- Planejamento editorial semanal/mensal
- Quando o Pesquisador precisa de dados de busca
- Validar se um tema tem interesse do publico

## Agentes que Usam

- **ct-pesquisador** - Pesquisa de tendencias e temas
- **ct-diretor** - Planejamento editorial com dados
- **ct-otimizador** - Escolher hashtags e termos ideais
- **ct-redator** - Adaptar linguagem aos termos que o publico usa
