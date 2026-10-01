---
name: ct-linkedin-analyzer
description: "Analisa posts LinkedIn via REST API. Dois modos: pessoal (via urn:li:person) e company (via urn:li:organization). Pega ultimos N posts, reacoes e comentarios, ranqueia top posts. Outputs JSON + markdown em content/research/. A API pode exigir scopes organizacionais que nao estao aprovados - se falhar com 401/403, skill reporta e sugere fallback Playwright."
---

# ct-linkedin-analyzer - Analise de posts LinkedIn

## Dois caminhos

1. **API REST** (`analyze-personal.js` / `analyze-company.js`) - exige o produto
   **Community Management API** aprovado no app. Sem isso retorna 403 ACCESS_DENIED
   (vale pra pessoal E company). Postar funciona; LER analise nao, ate aprovar.
2. **Fallback Playwright** (`scrape.js`) - **RECOMENDADO hoje**, contorna o gate da API.
   Usa sessao logada em `.linkedin-profile/` (rodar `node login-setup.js` 1x).
   Cobre pessoal (`personal`) e Company Page (`company --org {org-id}`), quando o cliente
   ativo for admin da pagina. Grava em `ct_metrics_snapshots` (source `:scrape`).
   Comandos:
   - `node scrape.js personal --handle {handle-linkedin-do-cliente} --limit 30`
   - `node scrape.js company --org {org-id-do-cliente} --limit 30`
   LIMITACAO: o scrape nao expoe a hora-do-dia do post (so label relativo "4 d").
   A hora e fixada em 12:00 UTC -> best-time de HORA do LinkedIn nao e confiavel;
   use o DIA-da-semana e o engajamento/formato, que sao reais.

## Quando usar

- Snapshot periodico de performance propria (conta pessoal + company page)
- Input pro ct-pesquisador / ct-redator pra decidir formato
- Validar se posts da company page estao convertendo

## Credenciais

Em `.env.local`:

- `LINKEDIN_ACCESS_TOKEN` - token OAuth com scopes `w_member_social`, `r_basicprofile`, idealmente `r_member_social`
- `LINKEDIN_PERSON_ID` - ID da pessoa (ex: `SEU_PERSON_ID`)
- `LINKEDIN_ORG_ID` - ID numerico da org (company page) do cliente (ex: `SEU_ORG_ID`)

## Uso

```bash
cd skills/ct-linkedin-analyzer
npm install

# Pessoal
node analyze-personal.js --limit 20

# Company - pode dar 401/403 por escopo nao aprovado
node analyze-company.js --limit 20
```

## Output

- `output/linkedin-analyzer/{scope}-{YYYY-MM-DD}.json`
- `content/research/{YYYY-MM-DD}-linkedin-analysis.md`

## Endpoints usados

- `GET /rest/posts?author=urn:li:person:{ID}&q=author&count=N` - posts pessoais
- `GET /rest/posts?author=urn:li:organization:{ID}&q=author&count=N` - posts da company
- `GET /rest/socialActions/{urn}` - reacoes + comentarios agregados

Header obrigatorio: `LinkedIn-Version: 202411` + `X-Restli-Protocol-Version: 2.0.0`.

## Limitacoes conhecidas

- **Company posts:** a Community Management API pode nao estar aprovada pro app. Se retornar 401/403, documentar e usar Playwright como fallback (nao implementado aqui - overengineering).
- **Rate limit:** LinkedIn limita ~100 req/dia por app.
- **Comments/reactions count:** vem em endpoint separado (`socialActions`). Se falhar, skill usa so o post sem metricas.
