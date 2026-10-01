---
name: ct-adaptar
description: "Adapta posts virais de concorrentes pro publico do cliente ativo. Recebe link do Instagram ou texto copiado e transforma no tom e formato do cliente."
metadata:
  kit:
    emoji: "🔄"
    requires:
      apis: [rapidapi-instagram-looter]
---
# Content Adapter - Adaptar Posts Virais de Concorrentes

Quando o usuario mandar um post de concorrente (link do Instagram OU texto copiado), esta skill:
1. Extrai os dados do post original
2. Analisa formato, tema, mecanica de engajamento
3. Carrega contexto do cliente ativo
4. Adapta pro tom de voz e publico do cliente
5. Entrega conteudo pronto pra cada plataforma

## Quando Usar

- Usuario manda link de post do Instagram de concorrente
- Usuario cola legenda/script de post viral
- Usuario pede pra adaptar conteudo de referencia
- Pesquisador encontra post viral e quer adaptar
- Reciclador precisa transformar conteudo externo

## Fluxo Completo

### Passo 1 - Receber Input

Aceitar dois formatos:

### Regra crítica de contexto

Se o pedido for apenas "adapta", "cria um título", "frase de capa", "headline" ou "gancho", sem material-base suficiente, NÃO improvisar.
Pedir antes o contexto mínimo:
- cliente
- formato da peça
- tema
- objetivo/ângulo
- link, texto, transcrição ou briefing base

**Formato A - Link do Instagram:**
```
https://www.instagram.com/p/{CODE}/
https://www.instagram.com/reel/{CODE}/
```

**Formato B - Texto copiado:**
O usuario cola a legenda/script diretamente no chat.

### Passo 2 - Extrair Dados (se for link do Instagram)

Usar RapidAPI Instagram Looter v2 pra extrair dados do post:

```bash
# 1. Extrair username do link
# Ex: https://www.instagram.com/p/ABC123/ → precisamos do username

# 2. Buscar perfil do usuario
curl -s "https://instagram-looter2.p.rapidapi.com/profile?username={USERNAME}" \
  -H "x-rapidapi-host: instagram-looter2.p.rapidapi.com" \
  -H "x-rapidapi-key: ${RAPIDAPI_KEY}"

# 3. No response, navegar pelos edges pra encontrar o post pelo CODE
# response.data.user.edge_owner_to_timeline_media.edges[]
# Cada edge tem: node.shortcode, node.edge_liked_by.count, node.edge_media_to_comment.count
# Encontrar o node onde shortcode == CODE do link

# 4. Extrair do post encontrado:
# - Formato: __typename (GraphImage, GraphVideo, GraphSidecar)
# - Likes: edge_liked_by.count
# - Comentarios: edge_media_to_comment.count
# - Legenda: edge_media_to_caption.edges[0].node.text
```

**Mapeamento de formato:**
- `GraphImage` → post imagem
- `GraphVideo` → reel
- `GraphSidecar` → carrossel

Se o link nao tiver username visivel, usar Playwright como fallback:
```
1. browser_navigate → URL do post
2. browser_snapshot → Capturar pagina
3. Extrair username, legenda, metricas visiveis
```

### Passo 3 - Analisar o Post Original

Com o conteudo em maos, analisar:

```markdown
## Analise do Post Original

### Dados
- **Autor:** @username
- **Formato:** [carrossel | reel | post]
- **Likes:** X | **Comentarios:** Y
- **Idioma:** [PT-BR | EN | outro]

### Conteudo
- **Tema/assunto:** [do que fala]
- **Gancho/hook:** [como comeca, o que prende atencao]
- **Mecanica de engajamento:** [CTA, "comenta X", pergunta, enquete]
- **Estrutura narrativa:** [HOOK → PROBLEMA → SOLUCAO → CTA]
- **O que funciona:** [por que esse post engaja]
- **Angulo original:** [perspectiva/abordagem do autor]
```

### Passo 4 - Carregar Contexto do Cliente

```
1. Ler clients/active-client.md → slug do cliente ativo
2. Ler clients/{slug}/brand-profile.md → tom de voz, publico-alvo, pilares, expressoes, posicionamento
3. Ler clients/{slug}/brand-profile.md secao "Preferencias de formato" (vence o padrao desta skill)
4. Ler clients/{slug}/voice-patterns.md secao "Legendas aprovadas" e clients/{slug}/regras-cliente.md
5. Ler clients/{slug}/competitors.md → contexto de concorrencia (opcional)
```

### Passo 5 - Adaptar Conteudo

Regras de adaptacao:

1. **Traduzir** se o original for em ingles ou outro idioma
2. **Ajustar tom de voz** pro cliente ativo
3. **Ajustar angulo** pro publico-alvo
4. **Respeitar o posicionamento da marca** (o que ela defende e o que nunca diz) conforme o `brand-profile.md`; nunca inventar posicionamento
5. **Revisar o texto final** para ficar natural, claro e coerente com o cliente
6. **Sem travessoes** (-) em nenhum texto
7. **NUNCA copiar, e parafrasear tambem e copiar.** Layout, estrutura, ordem e paleta da referencia sao livres; a frase nao. Trocar palavras por sinonimo ou mudar o numero mantem a mesma frase disfarcada (plagio silencioso). Teste: "a frase deles e a nossa dizem a mesma coisa?" Se sim, esta errada: reescrever a partir do tema, com angulo proprio. ANTES de aprovar, comparar linha a linha o texto adaptado com o original (`references/aprendizados-de-producao.md` item 2.8)
8. **Respeitar pilares de conteudo** do cliente

### Passo 6 - Entregar por Formato

#### Se Carrossel

Criar pasta `content/{slug}/carousels/{nome-do-carrossel}/` com:

**legenda-instagram.txt:**
- Maximo 2.200 caracteres (ou o tamanho que o `brand-profile.md` definir)
- Ate 5 hashtags minusculas, especificas ao tema
- CTA "Comenta X" so se a automacao de resposta da marca estiver ligada
- Sem travessoes

**post-linkedin.txt:**
- O tamanho que o assunto pede (limite duro 3.000 caracteres; faixas como 1.200 a 2.000 sao `[HIPOTESE]`)
- Sem hashtag por padrao (se a marca usa, maximo 5)
- Pergunta final especifica so quando nascer natural (nunca "comenta PALAVRA": isso e mecanica de IG/TikTok/YouTube Shorts, o LinkedIn nao tem DM automatica)
- Link externo no primeiro comentario, nao no corpo
- Paragrafos curtos (2-3 linhas max)
- Texto revisado antes de entregar

**generate-slides.js:**
- Gerar usando skill `ct-carrossel-gen` (agente `ct-carrossel`)
- Seguir design-system.md do cliente
- Zona segura IG: topo 150px, base 175px, laterais 65px

#### Se Reel

Criar pasta `content/{slug}/reels/{nome-do-reel}/` com:

**roteiro.md:**
- Maximo 60 segundos
- Com marcacoes de tempo [00:00-00:05], [00:05-00:15], etc.
- Estrutura: HOOK → CONTEXTO → DESENVOLVIMENTO → CTA
- Hook nos primeiros 3 segundos

**legenda-instagram.txt:**
- Maximo 2.200 caracteres (ou o tamanho do `brand-profile.md`)
- Ate 5 hashtags minusculas
- Sem travessoes

**post-linkedin.txt:**
- O tamanho que o assunto pede (limite duro 3.000)
- Sem hashtag por padrao
- Pergunta final especifica so quando vier natural
- Paragrafos curtos

#### Se Post Imagem

Criar pasta `content/{slug}/posts/{nome-do-post}/` com:

**legenda-instagram.txt:**
- Maximo 2.200 caracteres (ou o tamanho do `brand-profile.md`)
- Ate 5 hashtags minusculas
- Sem travessoes

**post-linkedin.txt:**
- O tamanho que o assunto pede (limite duro 3.000)
- Sem hashtag por padrao
- Pergunta final especifica so quando vier natural
- Paragrafos curtos

## Regras LinkedIn (2026)

- Sem hashtag por padrao (se a marca usa, maximo 5)
- Pergunta final especifica so quando nascer natural do texto; senao, afirmacao tecnica firme. NUNCA "comenta PALAVRA" (mecanica de IG/TikTok/YouTube Shorts, sem DM automatica no LinkedIn)
- Link externo no PRIMEIRO COMENTARIO, nao no corpo (YouTube vai como cartao via `publish-linkedin-link.mjs`; excecao so se a marca registrou em `regras-cliente.md`)
- Paragrafos curtos (max 3 linhas por paragrafo)
- Limite duro 3.000 caracteres; o tamanho certo e o que o assunto pede (faixas de 1.200 a 2.000 sao `[HIPOTESE]` externa, nao meta)
- Texto revisado antes de entregar
- Setas (→) e bullet points sao bem-vindos

## Regras Instagram

- Maximo 2.200 caracteres na legenda (Threads, se a marca usa, e post proprio de ate 500)
- Ate 5 hashtags, todas minusculas
- CTA "Comenta X" so se a automacao de resposta da marca estiver ligada
- Sem travessoes (-)
- Texto revisado antes de entregar
- Horario de postagem: vem do ct-social-intel/cockpit; sem dado, perguntar ao usuario

## Regras Gerais

- NUNCA copiar conteudo - sempre ADAPTAR com angulo proprio
- Sempre carregar brand-profile.md antes de adaptar
- Respeitar o posicionamento da marca conforme o `brand-profile.md`
- Revisar o texto final antes de entregar
- Sem travessoes (-) em nenhum texto gerado
- Usar o idioma e o tom definidos para o cliente e para a plataforma
- Analisar semanticamente se o conteudo adaptado ja existe antes de criar
- Cadencia de publicacao: a da marca (`brand-profile.md`, "Preferencias de formato"); sem definicao, perguntar
- Se faltar contexto mínimo para adaptar ou nomear a peça, pedir esse contexto antes de responder

## Exemplos de Adaptacao

### Input: Post em ingles sobre um erro comum de quem abre o primeiro negocio

**Original:** "90% of new businesses fail in year one. Here's how to survive..."
**Angulo original:** Medo, urgencia, sobrevivencia

**Adaptacao (exemplo ilustrativo; o angulo real vem do brand-profile do cliente ativo):**
- **Angulo:** Um erro concreto que o publico do cliente reconhece e como evita-lo
- **Tom:** o registro definido no `brand-profile.md`
- **Foco:** o publico-alvo do cliente ativo
- **Fechamento:** pergunta especifica sobre a experiencia do leitor, so se vier natural

### Input: Carrossel de concorrente com lista de dicas

**Original:** "10 dicas que voce precisa conhecer"
**Angulo original:** Lista generica

**Adaptacao (exemplo ilustrativo):**
- **Angulo:** Como APLICAR uma das dicas na pratica, com um caso real do cliente, em vez de listar
- **Tom:** Case real, resultado concreto, numero rastreavel
- **Foco:** o que o publico do cliente faz diferente depois de ler

## Agentes que Usam

- **ct-diretor** - Delega quando usuario manda post de concorrente
- **ct-pesquisador** - Analisa posts virais e pede adaptacao
- **ct-reciclador** - Transforma conteudo externo em conteudo proprio
- **ct-redator** - Gera textos finais a partir da analise
- **ct-otimizador** - Ajusta conteudo adaptado por plataforma
