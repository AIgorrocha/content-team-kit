---
name: ct-thumbnail
description: "Pacote YouTube completo: pesquisa SEO + titulo + descricao + tags + prompt de thumbnail (Gemini/NanoBanana)"
metadata:
  kit:
    emoji: "🖼️"
od:
  source: nexu-io/open-design
  version: 5e9687db4ae63d652531e06286b4e6d61a806c62
  applied: [tokens, anti-slop]
  mode: prototype
  scenario: marketing
  aspect_hint: "1280x720 (16:9)"
  preview: { type: png }
  design_system: { requires: true }
---
# YouTube Video Package - Pacote Completo pra Publicar Video

Recebe a transcricao de um video e entrega um pacote completo com SEO validado por dados reais.

O usuario so precisa: colar a transcricao. Depois anexa a foto dele e cola o prompt no Gemini/NanoBanana.

## Fluxo Integrado (OBRIGATORIO)

```
Usuario manda transcricao
        ↓
ETAPA 1: Extrair temas-chave da transcricao
        ↓
ETAPA 2: Pesquisa SEO (skill: seo-research)
  → Keyword Tool (YouTube) - keywords reais
  → Google Trends (BR) - validar tendencia
        ↓
ETAPA 3: Montar pacote com keywords validadas
  → Titulo com keyword principal real
  → Descricao com keywords long-tail reais
  → Hashtags baseadas em volume real
  → Paragrafo SEO com termos validados
        ↓
ETAPA 4: Gerar prompt da thumbnail
  → Design system do cliente ativo
  → Expressao adequada ao tom do video
  → Texto da thumbnail = keyword principal
        ↓
Entrega pacote completo ao usuario
```

## ETAPA 1 - Analise da Transcricao

Ao receber a transcricao:
1. Identificar o TEMA CENTRAL (1 frase)
2. Listar 3-5 SUBTEMAS abordados
3. Identificar TOM do video (tutorial, revelacao, alerta, case, dica)
4. Extrair 5-8 TERMOS CANDIDATOS a keyword

## ETAPA 2 - Pesquisa SEO (OBRIGATORIA)

Usar a skill **seo-research** via Playwright MCP:

### 2a. Keyword Tool (YouTube)
```
Playwright steps:
1. browser_navigate → https://keywordtool.io/youtube
2. browser_type → Campo de busca → [TEMA CENTRAL]
3. browser_click → Seletor de pais → Brazil
4. browser_click → Botao de pesquisa
5. browser_snapshot → Capturar keywords sugeridas
```

Repetir com 2-3 variacoes dos termos candidatos.

### 2b. Google Trends (BR)
```
Playwright steps:
1. browser_navigate → https://trends.google.com/trends/explore?geo=BR&q=termo1,termo2,termo3
2. browser_wait → Aguardar graficos
3. browser_snapshot → Comparar volume entre termos
```

Comparar os termos candidatos pra escolher a KEYWORD PRINCIPAL (maior volume/tendencia).

### 2c. Compilar dados SEO
Entregar junto com o pacote:

```markdown
## Pesquisa SEO Realizada

**Keyword principal:** [termo com mais busca]
**Keywords secundarias:** [lista]
**Tendencia:** [subindo/estavel/caindo]
**Fonte:** Keyword Tool (YouTube BR) + Google Trends
```

## ETAPA 3 - Pacote YouTube

### 3a. TITULO DO VIDEO

```
[Titulo com keyword principal REAL - max 60 caracteres]
```

**Regras:**
- Keyword principal (validada na pesquisa) no INICIO
- Maximo 60 caracteres
- Gerar curiosidade ou mostrar beneficio
- Sem clickbait vazio
- Estilo do cliente ativo (tom de voz em `brand-profile.md`): direto, pratico, sem jargao

**Formatos que funcionam:**
- "Como [RESULTADO] usando [METODO] (em [PRAZO])"
- "[NUMERO] [COISAS] que [RESULTADO SURPREENDENTE]"
- "[PROBLEMA COMUM]? Faz isso aqui"
- "Parei de [COISA COMUM] e [RESULTADO]"

### 3b. DESCRICAO DO VIDEO

```
[Hook: 1 frase com keyword principal - o que o video entrega]

[Contexto: 1-2 frases com keywords secundarias - por que importa]

🔑 O que voce vai aprender:
- [Topico 1 - usar keyword secundaria]
- [Topico 2]
- [Topico 3]
- [Topico 4]

⏱ Timestamps:
00:00 - [Intro/Hook]
XX:XX - [Secao 1]
XX:XX - [Secao 2]
XX:XX - [Secao 3]
XX:XX - [Conclusao/CTA]

---

🔔 Se inscreve e ativa o sino pra nao perder os proximos videos.

📱 Instagram: [handle do cliente ativo, ver brand-profile.md]
💼 LinkedIn: [link LinkedIn do cliente ativo, ver brand-profile.md]
📧 [email do cliente ativo, ver brand-profile.md]

Tags sugeridas: [keyword1], [keyword2], [keyword3], [keyword4], [keyword5], [keyword6], [keyword7], [keyword8]

---

[Paragrafo SEO: 2-3 frases com keywords long-tail naturais validadas na pesquisa]
```

**Regras da descricao:**
- Keyword principal nas 2 primeiras linhas (aparecem antes do "mostrar mais")
- Keywords validadas nos primeiros 150 caracteres
- Timestamps baseados na transcricao
- NAO usar hashtags no YouTube (impacto minimo), usar TAGS do video (campo separado no upload)
- Listar 8-15 tags sugeridas pro campo de tags do YouTube
- Paragrafo SEO com long-tail reais do Keyword Tool
- Hashtags SEMPRE minusculas quando usadas (Instagram)

### 3c. PROMPT DA THUMBNAIL

```
Create a YouTube thumbnail, 1280x720 pixels, 16:9 aspect ratio.

BACKGROUND:
- Dark gradient background from [FUNDO DA MARCA] (left) to [SUPERFICIE DA MARCA] (right)
- Subtle [DESTAQUE DA MARCA] glow/light effect behind the person

PERSON (from reference photo):
- Position: RIGHT side of the frame, taking ~40% of width
- Cut at chest level
- Expression: [EXPRESSAO DA TABELA ABAIXO]
- The person MUST look EXACTLY like the reference photo
- Keep the real face, hair, beard, skin tone - do NOT stylize or change anything
- Professional clothing (dark shirt or blazer)
- Slight 3/4 angle, looking at camera or slightly off-camera

TEXT (LEFT side, ~55% of frame):
- Main text: "[KEYWORD PRINCIPAL - MAX 4-5 PALAVRAS]"
- Font: Bold sans-serif, white (#FFFFFF)
- Size: Very large, fills the left area
- Key word highlighted in [DESTAQUE DA MARCA]
- Add subtle dark shadow/outline behind text for readability
- Optional: small subtext below in #A0A0A0

VISUAL ELEMENTS:
- [1-2 ICONES RELEVANTES AO TEMA]
- Keep minimal
- Use accent colors ([DESTAQUE 1 E 2 DA MARCA])

STYLE:
- Clean, modern, professional
- High contrast - readable on mobile at small size
- Tech/business aesthetic
- No clutter, no busy backgrounds
- Must be eye-catching in 2 seconds
- 4K quality, high resolution
```

**Texto da thumbnail = keyword principal** (validada pela pesquisa SEO).
Isso garante que o texto do thumbnail REFORÇA a keyword que as pessoas buscam.

**Tabela de expressoes:**

| Tom do video | Expressao |
|--------------|-----------|
| Tutorial/Como fazer | "confident smile, looking at camera, one hand gesturing as if explaining" |
| Revelacao/Dados | "surprised expression, wide eyes, mouth slightly open, one hand pointing up" |
| Problema/Alerta | "serious face, slightly concerned, arms crossed or hand on chin" |
| Resultado/Case | "happy, celebrating, thumbs up or fist pump" |
| Comparativo | "thoughtful, hand on chin, looking slightly off-camera as if analyzing" |
| Dica/Hack | "knowing smile, one finger raised as if sharing a secret" |
| Mentoria/Curso | "confident, welcoming smile, open palm gesture as if inviting to learn" |

## Output Final (Formato de Entrega)

Entregar SEMPRE nesta ordem:

```
## Pesquisa SEO Realizada
[dados da pesquisa]

---

## 1. TITULO DO VIDEO
[titulo]

---

## 2. DESCRICAO DO VIDEO
[descricao completa]

---

## 3. PROMPT DA THUMBNAIL
[prompt pronto pra colar]
```

## Checklist de Qualidade

### Pesquisa SEO
- [ ] Keyword Tool consultado (YouTube BR)
- [ ] Google Trends consultado (BR)
- [ ] Keyword principal definida por dados reais
- [ ] Keywords secundarias listadas

### Titulo
- [ ] Max 60 caracteres
- [ ] Keyword principal REAL no inicio
- [ ] Gera curiosidade
- [ ] Sem clickbait vazio

### Descricao
- [ ] Keyword principal nos primeiros 150 chars
- [ ] Timestamps incluidos
- [ ] Hashtags = keywords com volume real
- [ ] Links sociais do cliente ativo
- [ ] Paragrafo SEO com long-tail validadas

### Prompt da Thumbnail
- [ ] 1280x720 especificado
- [ ] Cores do design system do cliente ativo
- [ ] Rosto identico a foto
- [ ] Texto = keyword principal (max 4-5 palavras)
- [ ] Expressao adequada ao tom
- [ ] Palavra-chave em cor de destaque

## Design System (carrega do cliente ativo)

Ler `clients/{slug}/design-system.md` pra cores, fontes e estilo.

Troque os campos entre colchetes ([FUNDO DA MARCA], [SUPERFICIE DA MARCA], [DESTAQUE DA MARCA]) pelas cores do design system da marca ativa.
Se a marca ainda nao preencheu as cores, peca ao usuario antes de gerar. Nunca use cor de outra marca.

## Agentes que Usam

- **ct-video** - Pipeline completo de video YouTube
- **ct-redator** - Titulo e descricao otimizados
- **ct-otimizador** - SEO do YouTube (chama seo-research)
- **ct-designer** - Prompt visual da thumbnail
- **ct-pesquisador** - Executa a pesquisa SEO (etapa 2)
