---
name: ct-analyzer
description: Router unificado de análise de redes sociais. Detecta plataforma pelo URL ou contexto, delega pra skill correta (Instagram/LinkedIn/YouTube/Twitter/TikTok), e sintetiza output em relatório acionável estilo Sherlock (tom de voz, estrutura de ganchos, cadência, hashtags, recomendações pro ct-redator). Usar quando o usuário mandar link de rede social pedindo análise, disser "analisa esse perfil/post", ou pedir investigação de concorrente/referência.
version: "1.0.0"
categories: [content-team, research, analysis]
---

# ct-analyzer - Sherlock Unificado

## Quando usar

- Usuário manda URL de IG/LinkedIn/YouTube/Twitter/TikTok pedindo análise
- Usuário fala "analisa esse perfil", "analisa esse concorrente", "veja esse post"
- Usuário pede varredura de referência pra alimentar criação de conteúdo
- ct-diretor delega pesquisa de concorrente durante pipeline de criação

**NÃO usar pra:**
- Scraping direto (use a skill especializada correspondente)
- Análise de próprio canal (use skill `ct-instagram-analyzer`, `ct-linkedin-analyzer`, `ct-youtube-analyzer` direto)

## Como funciona

### Passo 1: Detectar plataforma

A partir do URL (regex simples) OU contexto da mensagem:

```
instagram.com/{handle}          → ct-instagram-analyzer (Graph API se for nosso, RapidAPI se for terceiro)
linkedin.com/in/{handle}        → ct-linkedin-analyzer (mode=personal)
linkedin.com/company/{org}      → ct-linkedin-analyzer (mode=company)
youtube.com/@{handle} | youtu.be → ct-youtube-analyzer
twitter.com/{handle} | x.com    → ct-twitter-research
tiktok.com/@{handle}            → ct-tiktok-analyzer
```

Se **não tem URL** mas o usuario mencionou handle + plataforma:
- "@joaosilva no IG" → ct-instagram-analyzer com handle=joaosilva
- "canal da Petrobras no YT" → ct-youtube-analyzer com query=petrobras

Se **ambíguo** (só handle, sem plataforma):
- Perguntar qual plataforma antes de rodar

### Passo 2: Rotear pra skill especializada

| Plataforma | Skill chamada | Quando usar qual |
|---|---|---|
| IG | `ct-instagram-analyzer` | Graph API para a(s) conta(s) propria(s) do cliente ativo (handles em `clients/{slug}/brand-profile.md`); RapidAPI `instagram-looter2` para qualquer outro perfil público |
| LinkedIn | `ct-linkedin-analyzer` | Ambos modos |
| YouTube | `ct-youtube-analyzer` | Canal do cliente ativo + qualquer canal público |
| Twitter/X | `ct-twitter-research` | So clientes com Twitter/X listado no brand-profile |
| TikTok | `ct-tiktok-analyzer` | Só clientes com TikTok no brand-profile |

**Regra de escolha IG:** se o handle e uma das contas proprias do cliente ativo (ver `brand-profile.md`), Graph API. Senao, RapidAPI.

### Passo 3: Coletar dados brutos

Skill especializada retorna JSON + markdown com:
- Dados da conta (followers, biografia, link)
- Últimos N posts (texto, engagement, formato, permalink, data)
- Top posts por engagement rate
- Distribuição por formato (reel/carrossel/post/story)
- Cadência de publicação

### Passo 4: SHERLOCK SYNTHESIS (o diferencial)

Não devolva dados brutos. Sintetize em **relatório acionável** com 5 seções:

#### 1. Tom de voz dominante
- Formal vs informal
- Técnico vs acessível
- Humor/seriedade
- Exemplos literais de 2-3 frases características

#### 2. Estrutura dos top 5 posts
Pra cada um: hook inicial, desenvolvimento, CTA. Identifique padrões repetidos.

#### 3. Ganchos que funcionam
Extraia os hooks de abertura que geraram mais engagement. Liste 5-10 exemplos.

#### 4. Cadência e formatos
- Posts/semana
- Distribuição (% reel, % carrossel, % post, % story)
- Dias/horas mais usados

#### 5. Hashtags e referências
- Hashtags recorrentes (top 15)
- Accounts mencionados/taggeados
- Links em bio ou posts

#### 6. Recomendações acionáveis pro ct-redator
Baseado nos patterns, sugira 3-5 ideias de post que seguem a fórmula do analisado mas adaptadas pro cliente ativo. Exemplo:
```
"Este perfil usa fórmula 'pergunta retórica + 3 bullets + CTA pessoal'. 
Pro cliente ativo, aplicar em: 
1. 'Você já agendou seus posts manualmente? [3 razões] → cria a skill.'
2. ...
```

### Passo 5: Salvar em Supabase + output

- Salvar relatório bruto em `ct_research_runs` + `ct_research_posts`
- Salvar síntese Sherlock em `content/research/YYYY-MM-DD-sherlock-{handle}-{plataforma}.md`
- Retornar path do arquivo + resumo de 5 linhas pro usuario

## Exemplos de uso

### Exemplo 1: URL Instagram
```
Usuario: analisa https://instagram.com/perfil.exemplo
ct-analyzer:
  1. Detecta: IG, handle=perfil.exemplo, não é conta do cliente ativo
  2. Chama ct-instagram-analyzer (rota RapidAPI, handle nao e nosso)
  3. Recebe 20 posts + métricas
  4. Sintetiza Sherlock (tom, ganchos, cadência, etc.)
  5. Salva em content/research/2026-04-21-sherlock-perfil-exemplo-ig.md
  6. Retorna resumo + 3 sugestões de post adaptadas
```

### Exemplo 2: Handle ambíguo
```
Usuario: analisa @joaosilva
ct-analyzer: Qual plataforma? IG, LinkedIn, YouTube, Twitter ou TikTok?
```

### Exemplo 3: Próprio canal
```
Usuario: analisa o canal do cliente ativo no YT
ct-analyzer:
  1. Detecta: YT, canal do cliente ativo
  2. Chama ct-youtube-analyzer (Data API v3)
  3. Sintetiza Sherlock
  4. Salva + retorna
```

### Exemplo 4: Link LinkedIn company
```
Usuario: analisa https://linkedin.com/company/acme
ct-analyzer:
  1. Detecta: LI, mode=company
  2. Chama ct-linkedin-analyzer mode=company org=acme
  3. Sintetiza Sherlock
  4. Salva + retorna
```

## Integração com pipeline ct-diretor

Quando ct-diretor precisa pesquisar referência ANTES de criar conteúdo, invoca `ct-analyzer` em vez de cada skill individual:

```
ct-diretor: "Preciso analisar 3 perfis pra inspirar o carrossel"
  → ct-analyzer(perfil1) → síntese Sherlock
  → ct-analyzer(perfil2) → síntese Sherlock  
  → ct-analyzer(perfil3) → síntese Sherlock
  → ct-redator recebe as 3 sínteses + brief + brand do cliente
```

Isso **substitui** chamadas diretas a ct-instagram-analyzer/ct-linkedin-analyzer/etc. dentro do fluxo de ct-diretor. As skills especializadas continuam existindo pra casos em que o usuário pede varredura técnica crua (ex: "me retorna o JSON puro do perfil X").

## Output schema (JSON)

```json
{
  "platform": "instagram|linkedin|youtube|twitter|tiktok",
  "handle": "perfil.exemplo",
  "url": "https://instagram.com/perfil.exemplo",
  "raw_data_file": "content/research/runs/2026-04-21-perfil-exemplo-ig-raw.json",
  "sherlock_report": "content/research/2026-04-21-sherlock-perfil-exemplo-ig.md",
  "synthesis": {
    "tone": "Técnico informal com humor",
    "top_hooks": ["exemplo 1", "exemplo 2"],
    "cadence_per_week": 5,
    "dominant_format": "reels (60%), carrossel (25%), post (15%)",
    "top_hashtags": ["#IA", "#NoCode", "#Automatizacao"],
    "recommendations": [
      "Formula X aplicada a: [sugestao 1]",
      "Formula Y aplicada a: [sugestao 2]"
    ]
  }
}
```

## Regras obrigatórias

1. **SEMPRE usar skill especializada** - não implementar scraper próprio
2. **SEMPRE sintetizar Sherlock-style** - devolver dados brutos é ruído, o usuario precisa de insight
3. **Salvar em Supabase** - pra histórico e comparação futura
4. **Respeitar regras de cliente**: TikTok e Twitter/X so pra clientes que listam essas redes no brand-profile
5. **Pedir plataforma se ambíguo** - não assumir
6. **Instagram: escolher método certo** - Graph API pras contas do cliente ativo, RapidAPI pra concorrentes

## Dependências

- `ct-instagram-analyzer` (Graph API para conta nossa, RapidAPI para terceiro)
- `ct-linkedin-analyzer`
- `ct-youtube-analyzer`
- `ct-twitter-research`
- `ct-tiktok-analyzer`
- Supabase MCP (ct_research_runs, ct_research_posts)

## Env vars necessárias

Herdadas das skills filhas - não precisa de vars próprias.
