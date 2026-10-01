---
name: ct-telas
description: "Gera telas de demonstracao para Reels com Playwright"
agent: ct-video
triggers:
  - "gerar telas"
  - "criar screens"
  - "telas do reel"
---

# Reels Screens Generator

## O que faz

Gera telas de demonstracao (B-roll) pra usar no Reel via Playwright screenshots.

## Design System

| Propriedade | Valor |
|-------------|-------|
| Dimensao | 1080 x 1920 px |
| Fundo, surface, texto, destaques | do `clients/{slug}/design-system.md` da marca ativa |
| Fonte | do design system da marca (sem definicao: fonte do sistema) |
| Border radius | 16px |

## Tipos de Tela

### 1. Tela de Problema
- Simula a situacao ANTES (ex: caixa de email lotada)
- Visual de app/dashboard com dados ficticios
- Cores frias, tons de cinza

### 2. Tela de Solucao
- Simula o agente trabalhando (ex: extraindo dados)
- Progress bar, checkmarks, dados sendo processados
- Cores azul/roxo nos destaques

### 3. Tela de Resultado
- Numeros grandes (antes → depois)
- Cards com metricas (200 notas/dia, +40% receita)
- Resposta automatica enviada
- Verde/azul pra sucesso

### 4. Tela de CTA
- Texto grande centralizado
- Botao com gradiente azul→roxo
- "Comenta [PALAVRA]" + emoji 👇

## Como Gerar

```javascript
import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
await page.setContent(html)
await page.screenshot({ path: 'output/screens/nome.png' })
```

## Script

`scripts/video/screen-recordings.mjs`: gera telas a partir de um JSON (modelo em `scripts/video/telas-exemplo.json`), nas cores da marca
