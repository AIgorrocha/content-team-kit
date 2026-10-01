---
name: ct-social-intel
description: Best-time-to-post + insights computados do historico real de metricas (ct_metrics_snapshots). Heatmap 7x24 dia x hora com media de engajamento por rede e cliente. Substitui o /besttimes do Metricool, gratis. Use quando pedirem "melhor horario pra postar", "que dia rende mais", "qual formato performa melhor", "best time", ou antes de agendar conteudo.
---

# ct-social-intel: Inteligencia social computada (best-time)

Replica gratis a heuristica de best-time do Metricool. Le os snapshots de metricas
proprias (gravados pelos analyzers em `ct_metrics_snapshots`), agrupa por dia-da-semana
x hora (fuso BRT) e calcula a media de engajamento real de cada celula. Quanto mais
historico acumulado, mais confiavel.

## Quando usar
- "Qual o melhor horario/dia pra postar no Instagram do cliente?"
- "Que formato (carrossel/reel) rende mais?"
- Antes do `ct-agenda` agendar: consultar best-time pra escolher o slot.
- Alimentar o cockpit (`ct-social-cockpit`).

## Como roda

```bash
node skills/ct-social-intel/compute.js [--client all|{slug}] [--platform all|instagram|linkedin|youtube|tiktok] [--days 90]
```

- Dedup: 1 linha por post (snapshot mais recente = estado final).
- Ranking: prioriza `engagement_rate` quando a celula tem >= 3 posts; senao usa
  media de interacoes (likes+comments+shares+saves). O campo `metric_used` diz qual.
- `confidence: alta` quando a celula tem >= 3 posts; `baixa` quando tem poucos.
- Grava 1 linha por (cliente, rede) em `ct_social_insights` (kind=`best_time`).

## Saida (payload jsonb em ct_social_insights)

- `best_slots`: top 5 (dia, hora, n, avg_rate, avg_interactions, confidence)
- `by_weekday`: ranking dos dias
- `by_hour`: ranking das horas
- `by_format`: performance por formato (carrossel/reel/video/short/post)
- `heatmap`: todas as celulas dia x hora
- `metric_used`, `sample_size`, `window_days`

## Ler o resultado (cockpit / agente)

```sql
SELECT payload FROM ct_social_insights
WHERE client_slug = '{slug}' AND platform = 'instagram' AND kind = 'best_time'
ORDER BY computed_at DESC LIMIT 1;
```

## Rodar toda semana sozinho (opcional)

Dois roteiros prontos em `scripts/infra/`, ambos para a marca ativa (`.workspace` ou `CT_CLIENT`):

| Arquivo | Onde | O que roda |
|---|---|---|
| `social-intel-local.mjs` (com `social-intel-local.cmd` para o Windows) | seu computador | Pipeline COMPLETO: Instagram, YouTube, LinkedIn, TikTok, posts salvos, melhor horario, concorrentes, tendencias, cockpit e briefing. Reabre o login quando uma sessao cai |
| `social-intel-weekly.sh` | Mac, Linux ou servidor | Versao sem navegador (Instagram, LinkedIn por API, YouTube, melhor horario, concorrentes, tendencias, cockpit). TikTok e salvos ficam de fora |

Regra do pipeline completo: se o Instagram da marca nao gerou snapshot novo (token vencido, por exemplo), a
agregacao NAO roda e o aviso diz para nao usar cockpit ou briefing antigos. O codigo de saida fica diferente de
0 quando algo falha.

Variaveis opcionais no `.env.local`: `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` (resumo no Telegram; sem elas o
resumo so aparece no terminal), `TIKTOK_HANDLE` (passo do TikTok, ex.: `@minhamarca`), `RAPIDAPI_KEY` (concorrentes),
`LINKEDIN_ORG_ID`, `IG_HANDLE` (o `@` do Instagram da marca, obrigatorio).

Teste dos roteiros: `node scripts/infra/social-intel-status.test.cjs`.

### Agendar no Windows (Agendador de Tarefas)

1. Abra o **Agendador de Tarefas**, **Criar Tarefa Basica**.
2. Nome: `Social Intel semanal`. Disparador: **Semanalmente**, domingo, 08:00.
3. Acao: **Iniciar um programa**, e escolha o arquivo `scripts/infra/social-intel-local.cmd` do kit.
4. Nas propriedades, marque **Executar somente quando o usuario estiver conectado** (os logins abrem janela de navegador).
5. O resultado fica em `social-intel-local.log` (na pasta do kit). Coluna "Ultimo resultado" diferente de 0 = falhou.

### Agendar no Mac ou Linux (cron)

```
crontab -e
0 8 * * 0 bash <pasta-do-kit>/scripts/infra/social-intel-weekly.sh
```

O log fica em `social-intel-weekly.log` na pasta do kit (mude com `SOCIAL_INTEL_LOG`).

## Dependencias
- Tabela `ct_metrics_snapshots` populada (rode os analyzers antes: ct-instagram-analyzer,
  ct-linkedin-analyzer, ct-youtube-analyzer, ct-tiktok-analyzer).
- Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (carregados de `.env`/`.env.local`).
- Sem dependencias npm (fetch nativo, Node 18+).

## Limites
- Confianca baixa enquanto o historico for pequeno. Roda semanalmente (cron Fase 4)
  pra acumular e refinar.
- Twitter/X proprio fora (API paga). Demais redes cobertas.
